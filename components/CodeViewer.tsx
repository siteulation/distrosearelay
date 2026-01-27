import React, { useState } from 'react';
import { Clipboard, Check } from 'lucide-react';

interface CodeViewerProps {
  title: string;
  code: string;
  language: string;
  filename: string;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ title, code, language, filename }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full my-6 rounded-lg overflow-hidden border border-cyber-gray bg-cyber-dark">
      <div className="flex items-center justify-between px-4 py-2 bg-cyber-gray border-b border-cyber-black">
        <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-cyber-accent uppercase">{language}</span>
            <span className="text-sm font-semibold text-gray-300">{filename}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-cyber-black bg-cyber-primary hover:bg-white transition-colors rounded"
        >
          {copied ? <Check size={14} /> : <Clipboard size={14} />}
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <div className="p-4 overflow-x-auto bg-[#050505]">
        <pre className="text-sm font-mono text-gray-400 leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default CodeViewer;
