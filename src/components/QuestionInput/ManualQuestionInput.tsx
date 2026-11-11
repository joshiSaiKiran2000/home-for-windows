import React, { useState } from 'react';
import { Send, Sparkles, MessageSquare } from 'lucide-react';

interface ManualQuestionInputProps {
  onAsk: (question: string) => void;
  isLoading: boolean;
}

const SAMPLE_QUESTIONS = [
  'Explain how the virtual DOM works in React.',
  'How do you reverse an array in JavaScript without using reverse()?',
  'What is the difference between let, const, and var?',
  'Walk me through a difficult project from your resume.',
  'How do you handle asynchronous operations in JavaScript?'
];

export const ManualQuestionInput: React.FC<ManualQuestionInputProps> = ({ onAsk, isLoading }) => {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim() || isLoading) return;
    onAsk(question.trim());
    setQuestion('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800/60 p-5 backdrop-blur-sm">
      <div className="flex items-center gap-2.5 pb-3 border-b border-dark-700/60 mb-3">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Ask an Interview Question</h3>
          <p className="text-xs text-dark-400">Type any technical, coding, or behavioral interview question</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative flex items-center">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Write a function to check if two strings are anagrams..."
          disabled={isLoading}
          className="w-full pl-4 pr-24 py-3 rounded-xl bg-dark-900/80 border border-dark-700 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all font-sans"
        />
        <button
          type="submit"
          disabled={isLoading || !question.trim()}
          className="absolute right-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white transition-all flex items-center gap-1.5"
        >
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </>
          )}
        </button>
      </form>

      {/* Suggested Quick Prompts */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 text-xs text-dark-400">
        <span className="flex items-center gap-1 text-[11px] font-medium text-dark-500 shrink-0">
          <Sparkles className="w-3 h-3 text-brand-400" />
          Suggestions:
        </span>
        {SAMPLE_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setQuestion(q)}
            className="shrink-0 px-2.5 py-1 rounded-full bg-dark-700/60 hover:bg-dark-700 text-dark-300 hover:text-white border border-dark-600/40 text-[11px] transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};

