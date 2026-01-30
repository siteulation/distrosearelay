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
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, '../dist')

logger.info(f"Serving static files from: {DIST_DIR}")
if not os.path.exists(DIST_DIR):
    logger.error("DIST FOLDER DOES NOT EXIST! Run 'npm run build' first.")

# Initialize Flask
# static_folder is set, but we handle serving manually to support SPA routing
app = Flask(__name__, static_folder=DIST_DIR)
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
                yield streams[code_id].popleft()
            else:
                time.sleep(0.01)
                
    return Response(stream_with_context(generate()), mimetype='application/octet-stream')

# Serve root index.html explicitly
@app.route('/')
def index():
    logger.info("Serving root index.html")
    return send_from_directory(app.static_folder, 'index.html')

# Serve other static files or fallback to index.html
@app.route('/<path:path>')
def serve_static(path):
    # Check if file exists in dist folder
    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(app.static_folder, path)
    
    # Fallback to index.html for SPA (unless it's an API call which should be caught above)
    # We generally don't want to return index.html for missing assets like .js/.css
    if path.startswith("assets/"):
        return "Asset not found", 404
        
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
