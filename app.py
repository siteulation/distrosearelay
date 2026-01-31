from flask import Flask, request, Response, stream_with_context, send_from_directory
from flask_cors import CORS
import time
import logging
import os
from collections import defaultdict, deque

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define the static folder path (./static)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')

# Initialize Flask with explicit static folder
app = Flask(__name__, static_folder=STATIC_DIR)
CORS(app)

# Store streams in memory
streams = defaultdict(lambda: deque(maxlen=200)) 

@app.route('/api/status')
def status():
    return {"status": "Distrosea Relay Server Online", "version": "2.0.0"}

@app.route('/stream/<code_id>', methods=['POST'])
def ingest_stream(code_id):
    """
    Receives binary audio chunks from the Python client.
    """
    chunk = request.data
    if chunk:
        streams[code_id].append(chunk)
    return "OK", 200

@app.route('/listen/<code_id>', methods=['GET'])
def listen_stream(code_id):
    """
    Streams audio data to the browser.
    """
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
    """Serve the single page app."""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static assets (js, css, images)."""
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    # Ensure static folder exists to prevent errors locally
    if not os.path.exists(STATIC_DIR):
        os.makedirs(STATIC_DIR)
        print(f"Created {STATIC_DIR}")
    
    app.run(host='0.0.0.0', port=10000)
