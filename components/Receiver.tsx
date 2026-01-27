import React, { useState, useEffect, useRef } from 'react';
import { Activity, Radio, Wifi, Volume2, AlertCircle, Play, Square } from 'lucide-react';
import { ConnectionState } from '../types';
import { API_BASE_URL } from '../constants';
import Visualizer from './Visualizer';

const Receiver: React.FC = () => {
  const [code, setCode] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.IDLE);
  const [useDemoMode, setUseDemoMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [volume, setVolume] = useState(0.8);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  // Visualization State
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(128).fill(128));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Demo Interval
  const demoIntervalRef = useRef<number | null>(null);

  const cleanupAudio = () => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setConnectionState(ConnectionState.DISCONNECTED);
  };

  const initAudio = () => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const gainNode = ctx.createGain();
    const analyser = ctx.createAnalyser();
    
    analyser.fftSize = 256;
    gainNode.connect(analyser);
    analyser.connect(ctx.destination);
    
    gainNode.gain.value = volume;

    audioContextRef.current = ctx;
    gainNodeRef.current = gainNode;
    analyserRef.current = analyser;
    nextStartTimeRef.current = ctx.currentTime;

    // Start visualizer loop
    const updateVisualizer = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(dataArray);
        setAudioData(new Uint8Array(dataArray)); // Copy to trigger react render
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
    };
    updateVisualizer();
  };

  const playTone = (freq: number, type: OscillatorType = 'sine', duration: number = 0.1) => {
    if (!audioContextRef.current || !gainNodeRef.current) return;
    
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.connect(gainNodeRef.current);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const handleConnect = async () => {
    if (!code && !useDemoMode) {
        setStatusMessage("Please enter a valid session code.");
        return;
    }

    setConnectionState(ConnectionState.CONNECTING);
    setStatusMessage("Initializing audio subsystem...");

    // Initialize Audio Context (must be user triggered)
    initAudio();

    if (useDemoMode) {
        setStatusMessage("CONNECTED TO DEMO STREAM (SIMULATION)");
        setConnectionState(ConnectionState.CONNECTED);
        
        // Simulate incoming data
        demoIntervalRef.current = window.setInterval(() => {
            // Random beep boop sounds to simulate stream
            const freq = 200 + Math.random() * 600;
            if (Math.random() > 0.5) playTone(freq, 'square', 0.1);
        }, 150);
        return;
    }

    // Real Connection Logic
    setStatusMessage(`Attempting handshake with ${API_BASE_URL}...`);
    
    try {
        const response = await fetch(`${API_BASE_URL}/listen/${code}`, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        if (!response.body) {
             throw new Error("ReadableStream not supported");
        }

        setConnectionState(ConnectionState.CONNECTED);
        setStatusMessage("STREAM ESTABLISHED. BUFFERING...");

        const reader = response.body.getReader();
        
        // Process PCM Stream
        const processStream = async () => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                if (value && audioContextRef.current && gainNodeRef.current) {
                    // value is a Uint8Array of bytes (S16LE)
                    // We need to convert it to Float32 for Web Audio API
                    
                    // Create Int16 view. Assumes little-endian (standard for WebAssembly/most CPUs)
                    // If byte length is odd, slice it to be even to avoid errors
                    const alignedLength = value.length - (value.length % 2);
                    const int16View = new Int16Array(value.buffer, value.byteOffset, alignedLength / 2);
                    
                    // Create Audio Buffer
                    // Client records at 44100Hz, Mono
                    const audioBuffer = audioContextRef.current.createBuffer(
                        1, 
                        int16View.length, 
                        44100
                    );
                    
                    const channelData = audioBuffer.getChannelData(0);
                    
                    // Convert Int16 to Float32 (-1.0 to 1.0)
                    for (let i = 0; i < int16View.length; i++) {
                        channelData[i] = int16View[i] / 32768.0;
                    }
                    
                    // Schedule playback
                    const source = audioContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(gainNodeRef.current);
                    
                    // Ensure gapless playback by scheduling next chunk at the end of the last
                    // If we fell behind (buffer underrun), reset to currentTime
                    const currentTime = audioContextRef.current.currentTime;
                    if (nextStartTimeRef.current < currentTime) {
                        nextStartTimeRef.current = currentTime;
                    }
                    
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                }
            }
        };
        processStream();

    } catch (err) {
        console.error(err);
        setConnectionState(ConnectionState.ERROR);
        setStatusMessage(`Connection Failed: ${(err as Error).message}. (Ensure backend is running)`);
        
        // Fallback suggestion
        setTimeout(() => {
            if (confirm("Connection failed. Switch to Demo Mode to see the UI in action?")) {
                setUseDemoMode(true);
            }
        }, 1000);
    }
  };

  const handleDisconnect = () => {
    cleanupAudio();
    setConnectionState(ConnectionState.IDLE);
    setStatusMessage("");
    setAudioData(new Uint8Array(128).fill(128));
  };

  // Adjust volume
  useEffect(() => {
    if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupAudio();
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      
      {/* Visualizer Section */}
      <Visualizer 
        isPlaying={connectionState === ConnectionState.CONNECTED} 
        audioData={audioData}
      />

      {/* Control Panel */}
      <div className="bg-cyber-dark border border-cyber-gray p-6 rounded-xl shadow-2xl">
        <div className="flex flex-col md:flex-row gap-6 items-end md:items-center justify-between mb-6">
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Radio className="text-cyber-primary" />
                    Receiver Configuration
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                    Input the 6-character code from your Python script.
                </p>
            </div>
            
            {/* Status Indicator */}
            <div className={`px-4 py-2 rounded-full border flex items-center gap-2 text-sm font-mono
                ${connectionState === ConnectionState.CONNECTED ? 'bg-cyber-primaryDim border-cyber-primary text-cyber-primary' : 
                  connectionState === ConnectionState.ERROR ? 'bg-red-900/20 border-red-500 text-red-500' :
                  'bg-cyber-gray border-gray-600 text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-cyber-primary animate-pulse' : connectionState === ConnectionState.ERROR ? 'bg-red-500' : 'bg-gray-500'}`} />
                {connectionState}
            </div>
        </div>

        <div className="space-y-4">
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="ENTER CODE (e.g. X7K9P2)"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING}
                    className="w-full bg-black border border-cyber-gray focus:border-cyber-primary text-white text-3xl font-mono text-center py-4 rounded-lg tracking-[0.5em] placeholder:tracking-normal placeholder:text-lg focus:outline-none transition-all disabled:opacity-50"
                />
            </div>

            <div className="flex gap-4">
                {connectionState !== ConnectionState.CONNECTED ? (
                    <button 
                        onClick={handleConnect}
                        disabled={connectionState === ConnectionState.CONNECTING}
                        className="flex-1 bg-cyber-primary hover:bg-[#00d182] text-cyber-black font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {connectionState === ConnectionState.CONNECTING ? (
                            <Activity className="animate-spin" />
                        ) : (
                            <Wifi />
                        )}
                        ESTABLISH LINK
                    </button>
                ) : (
                    <button 
                        onClick={handleDisconnect}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-all"
                    >
                        <Square className="fill-current" />
                        TERMINATE LINK
                    </button>
                )}
            </div>

            <div className="flex items-center gap-4 bg-black/30 p-3 rounded-lg border border-white/5">
                <Volume2 size={20} className="text-gray-400" />
                <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyber-primary"
                />
            </div>
        </div>

        {/* Demo Toggle & Logs */}
        <div className="mt-6 pt-6 border-t border-cyber-gray">
             <div className="flex items-center justify-between mb-4">
                 <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-white">
                     <input 
                        type="checkbox" 
                        checked={useDemoMode}
                        onChange={(e) => setUseDemoMode(e.target.checked)}
                        disabled={connectionState === ConnectionState.CONNECTED}
                        className="w-4 h-4 accent-cyber-secondary rounded"
                     />
                     Simulate Connection (Demo Mode)
                 </label>
             </div>
             
             <div className="bg-black font-mono text-xs p-4 rounded h-32 overflow-y-auto text-green-500 border border-cyber-gray/50">
                <div className="opacity-50 mb-2"> SYSTEM LOGS // </div>
                {statusMessage && <div>> {statusMessage}</div>}
                {connectionState === ConnectionState.CONNECTED && (
                    <div className="animate-pulse">> Receiving packets...</div>
                )}
             </div>
        </div>

      </div>
    </div>
  );
};

export default Receiver;
