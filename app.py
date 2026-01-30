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
DIST_DIR = os.path.join(BASE_DIR, 'dist')

logger.info(f"Current Working Directory: {os.getcwd()}")
logger.info(f"Base Directory: {BASE_DIR}")
logger.info(f"Dist Directory: {DIST_DIR}")

if os.path.exists(DIST_DIR):
    logger.info("Dist directory found.")
    logger.info(f"Dist contents: {os.listdir(DIST_DIR)}")
else:
    logger.warning("DIST FOLDER NOT FOUND. Frontend will not be served correctly until built.")

# Initialize Flask
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

@app.route('/')
def index():
    # Check if index.html exists
    index_path = os.path.join(app.static_folder, 'index.html')
    if not os.path.exists(index_path):
        # Fallback debug page
        try:
            cwd_contents = os.listdir(os.getcwd())
        except:
            cwd_contents = "Error listing directory"
            
        return f"""
        <html>
            <body style="font-family: monospace; padding: 20px; background: #111; color: #f0f0f0;">
                <h1>Deployment Status: Waiting for Build</h1>
                <p style="color: #ff5555;">ERROR: The frontend build artifact (dist/index.html) is missing.</p>
                <hr style="border-color: #333;" />
                <h3>Debug Info:</h3>
                <ul>
                    <li>Base Dir: {BASE_DIR}</li>
                    <li>Expected Dist Dir: {DIST_DIR}</li>
                    <li>Dist Dir Exists: {os.path.exists(DIST_DIR)}</li>
                </ul>
                <h3>Root Directory Contents:</h3>
                <pre style="background: #222; padding: 10px;">{cwd_contents}</pre>
                <p><strong>Solution:</strong> Ensure your build command includes <code>npm install && npm run build</code> and that dependencies are installed.</p>
            </body>
        </html>
        """, 500
        
    logger.info("Serving root index.html")
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Check if file exists in dist folder
    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(app.static_folder, path)
    
    # Don't fallback to index.html for assets to avoid confusion
    if path.startswith("assets/") or path.endswith(".js") or path.endswith(".css"):
        return "Asset not found", 404
        
    # Fallback to index.html for SPA routing
    index_path = os.path.join(app.static_folder, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(app.static_folder, 'index.html')
    else:
        return "Frontend not built", 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
