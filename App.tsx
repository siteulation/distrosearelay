import React, { useState } from 'react';
import { Terminal, Radio, Settings, Github, HelpCircle, Download } from 'lucide-react';
import CodeViewer from './components/CodeViewer';
import Receiver from './components/Receiver';
import { CLIENT_SCRIPT_PY, SERVER_SCRIPT_PY } from './constants';

enum Tab {
  HOME = 'HOME',
  SETUP = 'SETUP',
  CONNECT = 'CONNECT'
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);

  const renderContent = () => {
    switch (activeTab) {
      case Tab.HOME:
        return (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-6 py-12">
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyber-primary via-cyber-accent to-cyber-secondary">
                DISTROSEA<br />RELAY
              </h1>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                Bridge the gap between ephemeral browser VMs and the outside world.
                Stream audio and data from <span className="text-white font-bold">Distrosea.com</span> directly to your local speakers.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                <button 
                  onClick={() => setActiveTab(Tab.SETUP)}
                  className="px-8 py-4 bg-cyber-gray border border-cyber-gray hover:border-cyber-primary hover:text-cyber-primary text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Terminal size={20} />
                  GET SCRIPTS
                </button>
                <button 
                  onClick={() => setActiveTab(Tab.CONNECT)}
                  className="px-8 py-4 bg-cyber-primary hover:bg-[#00d182] text-cyber-black rounded-lg font-bold transition-all shadow-[0_0_20px_rgba(0,255,157,0.3)] hover:shadow-[0_0_30px_rgba(0,255,157,0.5)] flex items-center justify-center gap-2"
                >
                  <Radio size={20} />
                  START LISTENING
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
               <div className="p-6 bg-cyber-dark border border-cyber-gray rounded-xl">
                  <Terminal className="text-cyber-accent mb-4" size={32} />
                  <h3 className="text-lg font-bold text-white mb-2">1. Deploy Client</h3>
                  <p className="text-gray-400 text-sm">Run our Python script inside your Distrosea Ubuntu terminal. It captures PulseAudio output automatically.</p>
               </div>
               <div className="p-6 bg-cyber-dark border border-cyber-gray rounded-xl">
                  <Settings className="text-cyber-secondary mb-4" size={32} />
                  <h3 className="text-lg font-bold text-white mb-2">2. Relay Server</h3>
                  <p className="text-gray-400 text-sm">Data travels through a high-speed relay server (source provided) to bypass browser security restrictions.</p>
               </div>
               <div className="p-6 bg-cyber-dark border border-cyber-gray rounded-xl">
                  <Radio className="text-cyber-primary mb-4" size={32} />
                  <h3 className="text-lg font-bold text-white mb-2">3. Tune In</h3>
                  <p className="text-gray-400 text-sm">Enter your unique session code on this site to hear your remote VM's audio in real-time.</p>
               </div>
            </div>
          </div>
        );

      case Tab.SETUP:
        return (
          <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">Configuration</h2>
                <p className="text-gray-400">
                    To make this work, you need two parts: the client script running on Distrosea, and the relay server.
                </p>
            </div>

            <div className="space-y-12">
                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded bg-cyber-primary text-cyber-black flex items-center justify-center font-bold">1</div>
                        <h3 className="text-xl font-bold text-white">The Client Script (Run in Distrosea)</h3>
                    </div>
                    <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-lg mb-4 flex gap-3">
                        <HelpCircle className="text-yellow-500 shrink-0" />
                        <p className="text-sm text-yellow-200">
                            <strong>Prerequisite:</strong> Distrosea usually has Python installed. You might need to install requests: <code className="bg-black/30 px-1 rounded">pip install requests</code>. 
                            If <code className="bg-black/30 px-1 rounded">parec</code> is missing, install pulseaudio-utils.
                        </p>
                    </div>
                    <CodeViewer 
                        title="Client Script" 
                        filename="client.py" 
                        language="PYTHON" 
                        code={CLIENT_SCRIPT_PY} 
                    />
                </section>

                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded bg-cyber-secondary text-white flex items-center justify-center font-bold">2</div>
                        <h3 className="text-xl font-bold text-white">The Server Script (Deploy to Render)</h3>
                    </div>
                    <p className="text-gray-400 text-sm mb-4">
                        This website expects a backend at <code className="text-cyber-accent">https://distrosea-relay.onrender.com</code>. 
                        If that is not active, deploy this Flask app to Render.com (Web Service, Python 3).
                    </p>
                    <CodeViewer 
                        title="Server Script" 
                        filename="app.py" 
                        language="PYTHON" 
                        code={SERVER_SCRIPT_PY} 
                    />
                     <div className="bg-cyber-dark p-4 rounded border border-cyber-gray mt-2">
                        <p className="text-xs text-gray-500 font-mono">requirements.txt</p>
                        <pre className="text-sm text-gray-300 mt-1">flask<br/>flask-cors<br/>gunicorn</pre>
                    </div>
                </section>
            </div>
          </div>
        );

      case Tab.CONNECT:
        return (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <Receiver />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-cyber-black text-gray-200 font-sans selection:bg-cyber-primary selection:text-cyber-black">
      {/* Navigation */}
      <nav className="border-b border-cyber-gray bg-cyber-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab(Tab.HOME)}>
              <div className="w-3 h-3 bg-cyber-primary rounded-full animate-pulse" />
              <span className="font-mono font-bold tracking-widest text-white">DISTROSEA_RELAY</span>
            </div>
            
            <div className="flex space-x-1 sm:space-x-4">
              {[
                { id: Tab.HOME, label: 'Home' },
                { id: Tab.SETUP, label: 'Setup' },
                { id: Tab.CONNECT, label: 'Receiver' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-cyber-gray text-white border border-cyber-gray shadow-inner'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-24">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full bg-cyber-black border-t border-cyber-gray py-4 z-40">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-xs text-gray-500 font-mono">
            <div>STATUS: ONLINE</div>
            <div className="flex gap-4">
                <span>V 1.0.2</span>
                <span>LATENCY: &lt;50ms</span>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
