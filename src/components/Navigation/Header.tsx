import React from 'react';
import { Layers, Settings, Monitor, ExternalLink, Trash2, Sparkles } from 'lucide-react';

interface HeaderProps {
  onToggleOverlay: () => void;
  onOpenScreenCapture: () => void;
  onOpenSettings: () => void;
  onClearHistory: () => void;
  hasAnswers: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleOverlay,
  onOpenScreenCapture,
  onOpenSettings,
  onClearHistory,
  hasAnswers,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-dark-700/80 bg-dark-900/80 backdrop-blur-md px-6 py-3.5">
      <div className="flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>AI Interview Assistant</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20">
                Desktop Copilot
              </span>
            </h1>
            <p className="text-[11px] text-dark-400">Personalized real-time interview answers & screen intelligence</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          {hasAnswers && (
            <button
              onClick={onClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-dark-400 hover:text-rose-400 hover:bg-dark-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Feed</span>
            </button>
          )}

          <button
            onClick={onOpenScreenCapture}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800 hover:bg-dark-700 text-dark-200 hover:text-white border border-dark-700 transition-all"
            title="Screen Analysis (Shortcut: Ctrl + Shift + S)"
          >
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
            <span>Screen Analysis</span>
          </button>

          <button
            onClick={onToggleOverlay}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-sm"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Toggle Floating Overlay</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 border border-transparent hover:border-dark-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

