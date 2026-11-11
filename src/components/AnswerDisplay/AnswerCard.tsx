import React, { useState } from 'react';
import { Copy, Check, RotateCw, Monitor, Mic, HelpCircle, Code } from 'lucide-react';
import { AnswerResponse } from '../../types';
import { CodeBlock } from './CodeBlock';

interface AnswerCardProps {
  answer: AnswerResponse;
  onRegenerate?: (question: string) => void;
  compact?: boolean;
}

export const AnswerCard: React.FC<AnswerCardProps> = ({ answer, onRegenerate, compact = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const getSourceBadge = () => {
    switch (answer.source) {
      case 'audio':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Mic className="w-3 h-3" /> Live Audio
          </span>
        );
      case 'screen':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Monitor className="w-3 h-3" /> Screen Vision
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <HelpCircle className="w-3 h-3" /> Manual Prompt
          </span>
        );
    }
  };

  // Helper to parse answer into markdown code blocks and paragraphs
  const renderFormattedAnswer = (text: string) => {
    const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        const prose = text.substring(lastIndex, matchIndex);
        parts.push(
          <div key={`prose-${lastIndex}`} className="space-y-2 whitespace-pre-wrap leading-relaxed text-dark-200">
            {prose}
          </div>
        );
      }

      const lang = match[1] || 'javascript';
      const code = match[2];
      parts.push(<CodeBlock key={`code-${matchIndex}`} language={lang} code={code} />);

      lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(
        <div key={`prose-${lastIndex}`} className="space-y-2 whitespace-pre-wrap leading-relaxed text-dark-200">
          {text.substring(lastIndex)}
        </div>
      );
    }

    return parts;
  };

  return (
    <div
      className={`rounded-xl border border-dark-700 bg-dark-800/80 backdrop-blur-md transition-all shadow-sm ${
        compact ? 'p-3' : 'p-5'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 mb-3 border-b border-dark-700/60">
        <div className="flex flex-wrap items-center gap-2">
          {getSourceBadge()}
          {answer.isCodingQuestion && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Code className="w-3 h-3" /> Coding Solution
            </span>
          )}
          <span className="text-[11px] text-dark-400">
            {new Date(answer.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onRegenerate && (
            <button
              onClick={() => onRegenerate(answer.question)}
              title="Regenerate answer"
              className="p-1.5 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleCopy}
            title="Copy answer"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-dark-700/80 hover:bg-dark-600 text-dark-200 hover:text-white transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Question */}
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-white tracking-wide flex items-baseline gap-2">
          <span className="text-brand-400">Q:</span>
          <span>{answer.question}</span>
        </h4>
      </div>

      {/* Content */}
      <div className={`text-sm text-dark-200 select-text ${compact ? 'max-h-96 overflow-y-auto pr-1' : ''}`}>
        {renderFormattedAnswer(answer.answer)}
      </div>
    </div>
  );
};

