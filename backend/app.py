from flask import Flask, request, Response, stream_with_context, send_from_directory
from flask_cors import CORS
import time
import logging
import os
from collections import defaultdict, deque

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Determine absolute path to the dist folder
# app.py is in backend/, so dist/ is in ../dist relative to this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, '../dist')

# Initialize Flask with explicit static folder
app = Flask(__name__, static_folder=DIST_DIR, static_url_path='')
CORS(app)

# Store streams in memory
streams = defaultdict(lambda: deque(maxlen=200)) 

@app.route('/api/status')
def status():
    return {"status": "Distrosea Relay Server Online", "version": "1.0.0"}

@app.route('/stream/<code_id>', methods=['POST'])
def ingest_stream(code_id):
    """
    Receives binary audio chunks from the Python client.
    Expects raw body to be PCM data.
    """
    chunk = request.data
    if chunk:
        streams[code_id].append(chunk)
    return "OK", 200

@app.route('/listen/<code_id>', methods=['GET'])
def listen_stream(code_id):
    """
    Streams audio data to the browser using chunked transfer encoding.
    """
    def generate():
        logger.info(f"Client connected to listen to {code_id}")
        while True:
            if streams[code_id]:
                # Yield the oldest chunk
                yield streams[code_id].popleft()
            else:
                time.sleep(0.01) # Small sleep to prevent CPU spin
                
    return Response(stream_with_context(generate()), mimetype='application/octet-stream')

# Catch-all route must be last to avoid shadowing API routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """
    Serve static files from the React build (dist folder).
    If file doesn't exist, fallback to index.html for SPA routing.
    """
    # Normalize path to strip leading slashes which might confuse os.path.join
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    
    # Fallback to index.html for any other route (SPA behavior)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
