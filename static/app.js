// --- CONFIGURATION ---
const CLIENT_SCRIPT = `import requests
import time
import random
import string
import sys
import subprocess

# CONFIGURATION
# Replace this with the deployed backend URL if different
SERVER_URL = "https://distrosea-relay.onrender.com"

def generate_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def get_audio_stream():
    """
    Attempts to record system audio using parec (PulseAudio).
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
                requests.post(
                    f"{SERVER_URL}/stream/{session_code}", 
                    data=data,
                    headers={'Content-Type': 'application/octet-stream'},
                    timeout=1
                )
                sys.stdout.write(".")
                sys.stdout.flush()
            except requests.exceptions.RequestException:
                pass 
                
    except KeyboardInterrupt:
        print("\\nStopping relay...")
        audio_proc.terminate()

if __name__ == "__main__":
    main()
`;

// --- UI STATE ---
let isConnected = false;
let audioContext = null;
let gainNode = null;
let nextStartTime = 0;
let abortController = null;
let visualizerId = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Populate Code Block
    document.getElementById('client-code').textContent = CLIENT_SCRIPT;
    
    // Init Visualizer (Idle State)
    drawVisualizer(new Uint8Array(128).fill(128));

    // Volume Listener
    document.getElementById('volume-slider').addEventListener('input', (e) => {
        if (gainNode) gainNode.gain.value = parseFloat(e.target.value);
    });
});

// --- TABS ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Update buttons
    ['home', 'setup', 'connect'].forEach(id => {
        const btn = document.getElementById(`btn-${id}`);
        if(id === tabId) {
            btn.className = "px-3 py-2 rounded-md transition-all bg-cyber-gray text-white border border-cyber-gray shadow-inner";
        } else {
            btn.className = "px-3 py-2 rounded-md transition-all text-gray-400 hover:text-white hover:bg-white/5";
        }
    });
}

function copyClientScript() {
    navigator.clipboard.writeText(CLIENT_SCRIPT);
    const btn = document.getElementById('copy-btn');
    btn.textContent = "COPIED!";
    setTimeout(() => btn.textContent = "COPY", 2000);
}

// --- LOGGING ---
function log(msg) {
    const logs = document.getElementById('logs');
    const line = document.createElement('div');
    line.textContent = `> ${msg}`;
    logs.appendChild(line);
    logs.scrollTop = logs.scrollHeight;
}

// --- AUDIO ENGINE ---
async function toggleConnection() {
    if (isConnected) {
        stopConnection();
    } else {
        const code = document.getElementById('session-code').value.toUpperCase();
        if (code.length !== 6) {
            log("INVALID CODE. Must be 6 characters.");
            return;
        }
        await startConnection(code);
    }
}

async function startConnection(code) {
    updateStatus('CONNECTING', 'cyber-accent');
    log(`Connecting to session ${code}...`);
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.gain.value = document.getElementById('volume-slider').value;
        
        // Visualizer Setup
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        gainNode.connect(analyser);
        analyser.connect(audioContext.destination); // Connect to speakers
        
        startVisualizer(analyser);

        abortController = new AbortController();
        const response = await fetch(`/listen/${code}`, {
            signal: abortController.signal
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error("No body");

        isConnected = true;
        updateStatus('CONNECTED', 'cyber-primary');
        log("Stream established! Buffering...");
        updateButton(true);

        const reader = response.body.getReader();
        nextStartTime = audioContext.currentTime;

        processStream(reader);

    } catch (err) {
        if (err.name === 'AbortError') return;
        log(`Error: ${err.message}`);
        stopConnection();
        updateStatus('ERROR', 'red-500');
    }
}

function stopConnection() {
    if (abortController) abortController.abort();
    if (audioContext) audioContext.close();
    if (visualizerId) cancelAnimationFrame(visualizerId);
    
    isConnected = false;
    audioContext = null;
    abortController = null;
    
    updateStatus('IDLE', 'gray-500');
    updateButton(false);
    log("Disconnected.");
    drawVisualizer(new Uint8Array(128).fill(128)); // Reset viz
}

async function processStream(reader) {
    while (true) {
        try {
            const { done, value } = await reader.read();
            if (done) break;
            if (value && audioContext) {
                playChunk(value);
            }
        } catch (e) {
            break;
        }
    }
}

function playChunk(int16Bytes) {
    // Align bytes
    const alignedLength = int16Bytes.length - (int16Bytes.length % 2);
    const int16View = new Int16Array(int16Bytes.buffer, int16Bytes.byteOffset, alignedLength / 2);
    
    const audioBuffer = audioContext.createBuffer(1, int16View.length, 44100);
    const channelData = audioBuffer.getChannelData(0);
    
    // Int16 -> Float32
    for (let i = 0; i < int16View.length; i++) {
        channelData[i] = int16View[i] / 32768.0;
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);
    
    // Gapless scheduling
    const currentTime = audioContext.currentTime;
    if (nextStartTime < currentTime) nextStartTime = currentTime;
    
    source.start(nextStartTime);
    nextStartTime += audioBuffer.duration;
}

// --- VISUALIZER ---
function startVisualizer(analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function renderFrame() {
        visualizerId = requestAnimationFrame(renderFrame);
        analyser.getByteTimeDomainData(dataArray);
        drawVisualizer(dataArray);
    }
    renderFrame();
}

function drawVisualizer(dataArray) {
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = 'rgba(10, 10, 10, 0.2)'; // Fade effect
    ctx.fillRect(0, 0, width, height);
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = isConnected ? '#00ff9d' : '#333';
    ctx.beginPath();
    
    const sliceWidth = width * 1.0 / dataArray.length;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        
        x += sliceWidth;
    }
    
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
}

// --- HELPER UTILS ---
function updateStatus(text, colorClass) {
    const badge = document.getElementById('status-badge');
    const dot = badge.firstElementChild;
    badge.lastChild.textContent = " " + text;
    
    if (text === 'CONNECTED') {
        badge.className = `px-4 py-2 rounded-full border border-cyber-primary bg-cyber-primaryDim text-cyber-primary text-sm font-mono flex items-center gap-2`;
        dot.className = `w-2 h-2 rounded-full bg-cyber-primary animate-pulse`;
    } else if (text === 'ERROR') {
        badge.className = `px-4 py-2 rounded-full border border-red-500 bg-red-900/20 text-red-500 text-sm font-mono flex items-center gap-2`;
        dot.className = `w-2 h-2 rounded-full bg-red-500`;
    } else {
        badge.className = `px-4 py-2 rounded-full border border-gray-600 bg-cyber-gray text-gray-400 text-sm font-mono flex items-center gap-2`;
        dot.className = `w-2 h-2 rounded-full bg-gray-500`;
    }
}

function updateButton(active) {
    const btn = document.getElementById('toggle-btn');
    if (active) {
        btn.innerHTML = `<span class="fill-current text-white">■</span> TERMINATE LINK`;
        btn.className = "w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2";
    } else {
        btn.innerHTML = `ESTABLISH LINK`;
        btn.className = "w-full bg-cyber-primary hover:bg-[#00d182] text-cyber-black font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2";
    }
}
