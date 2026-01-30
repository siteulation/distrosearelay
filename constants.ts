// In production, we use relative URL (backend serves frontend). 
// In development/standalone, we might point to the specific URL.
export const API_BASE_URL = (import.meta as any).env?.PROD ? "" : "https://distrosea-relay.onrender.com";

export const CLIENT_SCRIPT_PY = `import requests
import time
import random
import string
import sys
import subprocess
import threading

# CONFIGURATION
# Replace this with the deployed backend URL if different
SERVER_URL = "https://distrosea-relay.onrender.com"

def generate_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def get_audio_stream():
    """
    Attempts to record system audio using parec (PulseAudio).
    Common on Ubuntu/Debian distros used in Distrosea.
    """
    try:
        # Record stereo, 16-bit, 44.1kHz
        process = subprocess.Popen(
            ["parec", "--format=s16le", "--rate=44100", "--channels=1"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL
        )
        return process
    except FileNotFoundError:
        print("Error: 'parec' not found. Is PulseAudio installed?")
        return None

def main():
    session_code = generate_code()
    print("\\n" + "="*40)
    print(f" DISTROSEA RELAY CLIENT")
    print("="*40)
    print(f"\\n[+] SESSION CODE: {session_code}")
    print(f"[+] Server: {SERVER_URL}")
    print("\\nCopy the Session Code into the website to listen.")
    print("Press Ctrl+C to stop.\\n")

    audio_proc = get_audio_stream()
    if not audio_proc:
        print("Could not start audio capture. Exiting.")
        return

    chunk_size = 4096 # Bytes
    
    try:
        while True:
            # Read raw PCM data
            data = audio_proc.stdout.read(chunk_size)
            if not data:
                break
            
            # Send to server
            try:
                # We send raw bytes. In a real app, you might base64 encode 
                # inside a JSON payload, but raw body is faster for this demo logic.
                requests.post(
                    f"{SERVER_URL}/stream/{session_code}", 
                    data=data,
                    headers={'Content-Type': 'application/octet-stream'},
                    timeout=1
                )
                sys.stdout.write(".")
                sys.stdout.flush()
            except requests.exceptions.RequestException:
                pass # Ignore dropped packets for realtime stream
                
    except KeyboardInterrupt:
        print("\\nStopping relay...")
        audio_proc.terminate()

if __name__ == "__main__":
    main()
`;

export const SERVER_SCRIPT_PY = `from flask import Flask, request, Response, stream_with_context, send_from_directory
from flask_cors import CORS
import time
import logging
import os
from collections import defaultdict, deque

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Determine absolute path to the dist folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, 'dist')

logger.info(f"Serving static files from: {DIST_DIR}")
if not os.path.exists(DIST_DIR):
    logger.error("DIST FOLDER DOES NOT EXIST! Run 'npm run build' first.")

# Setup Flask to serve static files from the build directory
app = Flask(__name__, static_folder=DIST_DIR)
CORS(app)

# Store streams in memory
streams = defaultdict(lambda: deque(maxlen=200)) 

@app.route('/api/status')
def status():
    return {"status": "Distrosea Relay Server Online", "version": "1.0.0"}

@app.route('/stream/<code_id>', methods=['POST'])
def ingest_stream(code_id):
    chunk = request.data
    if chunk:
        streams[code_id].append(chunk)
    return "OK", 200

@app.route('/listen/<code_id>', methods=['GET'])
def listen_stream(code_id):
    def generate():
        logger.info(f"Client connected to listen to {code_id}")
        while True:
            if streams[code_id]:
                yield streams[code_id].popleft()
            else:
                time.sleep(0.01)
                
    return Response(stream_with_context(generate()), mimetype='application/octet-stream')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
`;