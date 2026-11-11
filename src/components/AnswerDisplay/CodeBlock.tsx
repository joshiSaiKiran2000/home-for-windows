import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'javascript' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="relative my-3 rounded-lg border border-dark-600 bg-dark-900/90 overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-dark-700/60 border-b border-dark-600/60 text-dark-400">
        <span className="text-[11px] font-medium tracking-wide uppercase">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-dark-300 hover:text-white hover:bg-dark-600 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="p-3 overflow-x-auto text-dark-200 leading-relaxed whitespace-pre font-mono">
        {code}
      </div>
    </div>
  );
};

