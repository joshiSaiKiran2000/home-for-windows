import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Minus,
  X,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  RotateCw,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  Sliders,
  Code2
} from 'lucide-react';
import { AnswerResponse } from '../../types';
import { CodeBlock } from '../AnswerDisplay/CodeBlock';
import { ScreenCaptureModal } from '../Controls/ScreenCaptureModal';

export const OverlayWindow: React.FC = () => {
  const [answers, setAnswers] = useState<AnswerResponse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompact, setIsCompact] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [opacity, setOpacity] = useState(0.96);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quickQuestion, setQuickQuestion] = useState('');
  const [isScreenModalOpen, setIsScreenModalOpen] = useState(false);

  // Subscribe to new answers from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanup = window.electronAPI.onNewAnswer((newAns) => {
      setAnswers((prev) => [newAns, ...prev]);
      setCurrentIndex(0);
      setIsLoading(false);
    });

    const cleanupMode = window.electronAPI.onOverlayModeChange((compact) => {
      setIsCompact(compact);
    });

    const cleanupMinimized = window.electronAPI.onOverlayMinimizedChange?.((minimized) => {
      setIsMinimized(minimized);
    });

    return () => {
      cleanup();
      cleanupMode();
      cleanupMinimized?.();
    };
  }, []);

  const activeAnswer = answers[currentIndex] || null;

  const handleCopy = async () => {
    if (!activeAnswer) return;
    try {
      await navigator.clipboard.writeText(activeAnswer.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy answer:', err);
    }
  };

  const handleRegenerate = async () => {
    if (!activeAnswer || isLoading || !window.electronAPI) return;
    setIsLoading(true);
    try {
      const res = await window.electronAPI.generateAnswer({ question: activeAnswer.question });
      if (res.success && res.data) {
        setAnswers((prev) => [res.data!, ...prev]);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Regenerate error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuestion.trim() || isLoading || !window.electronAPI) return;
    const q = quickQuestion.trim();
    setQuickQuestion('');
    setIsLoading(true);
    try {
      const res = await window.electronAPI.generateAnswer({ question: q });
      if (res.success && res.data) {
        setAnswers((prev) => [res.data!, ...prev]);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Quick ask error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCompact = () => {
    const next = !isCompact;
    setIsCompact(next);
    window.electronAPI?.setOverlayCompact(next);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    window.electronAPI?.setOverlayMinimized(true);
  };

  const handleExpand = () => {
    setIsMinimized(false);
    window.electronAPI?.setOverlayMinimized(false);
  };

  // Dragging support for floating minimized expand button
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ screenX: 0, screenY: 0 });
  const hasMovedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startPosRef.current = { screenX: e.screenX, screenY: e.screenY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.screenX - startPosRef.current.screenX;
    const dy = e.screenY - startPosRef.current.screenY;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      hasMovedRef.current = true;
      startPosRef.current = { screenX: e.screenX, screenY: e.screenY };
      window.electronAPI?.moveOverlayBy(dx, dy);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (!hasMovedRef.current) {
      handleExpand();
    }
  };

  const handleScreenCapture = async (sourceId?: string) => {
    if (!window.electronAPI) return;
    setIsLoading(true);
    try {
      const res = await window.electronAPI.captureAndAnalyzeScreen(sourceId);
      if (res.success && res.data) {
        setAnswers((prev) => [res.data!, ...prev]);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Screen capture error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for rendering markdown & code
  const renderFormattedAnswer = (text: string) => {
    const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(
          <div key={`p-${lastIndex}`} className="space-y-1.5 whitespace-pre-wrap leading-relaxed">
            {text.substring(lastIndex, matchIndex)}
          </div>
        );
      }
      const lang = match[1] || 'javascript';
      const code = match[2];
      parts.push(<CodeBlock key={`c-${matchIndex}`} language={lang} code={code} />);
      lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(
        <div key={`p-${lastIndex}`} className="space-y-1.5 whitespace-pre-wrap leading-relaxed">
          {text.substring(lastIndex)}
        </div>
      );
    }

    return parts;
  };

  if (isMinimized) {
    return (
      <div
        style={{ opacity }}
        className="drag-region w-screen h-screen flex items-center justify-center bg-transparent select-none p-1"
      >
        <button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          title="Drag to reposition • Click to expand"
          className="no-drag group relative flex items-center justify-center w-12 h-12 rounded-2xl bg-dark-900/95 border border-brand-500/80 text-brand-400 hover:text-white hover:bg-brand-600 shadow-2xl backdrop-blur-xl transition-colors cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95"
        >
          <Maximize2 className="w-5 h-5 transition-transform group-hover:scale-110 pointer-events-none" />
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-dark-900" />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ opacity }}
      className="flex flex-col h-screen w-screen overflow-hidden rounded-2xl border border-dark-600 bg-dark-900/95 text-dark-100 shadow-2xl backdrop-blur-xl transition-all"
    >
      {/* Draggable Titlebar */}
      <div className="drag-region flex items-center justify-between px-3.5 py-2.5 bg-dark-800/90 border-b border-dark-700/80 cursor-move select-none shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            Interview Copilot
          </span>
          {answers.length > 0 && (
            <span className="text-[10px] text-dark-400 px-1.5 py-0.5 rounded bg-dark-700 font-mono">
              {currentIndex + 1}/{answers.length}
            </span>
          )}
        </div>

        {/* Window controls */}
        <div className="no-drag flex items-center gap-1">
          <button
            onClick={() => setIsScreenModalOpen(true)}
            title="Analyze Screen"
            className="p-1 rounded text-dark-400 hover:text-emerald-400 hover:bg-dark-700 transition-colors"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleCompact}
            title={isCompact ? 'Expand Window' : 'Compact Overlay'}
            className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
          >
            {isCompact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleMinimize}
            title="Minimize to Expand Icon"
            className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => window.electronAPI?.hideOverlay()}
            title="Hide Overlay (Ctrl+Shift+Space to restore)"
            className="p-1 rounded text-dark-400 hover:text-rose-400 hover:bg-dark-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 select-text">
        {isLoading && (
          <div className="p-3 rounded-xl bg-brand-950/30 border border-brand-800/40 flex items-center gap-2.5 text-xs text-brand-300">
            <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Formulating conversational, beginner-friendly answer...</span>
          </div>
        )}

        {!activeAnswer && !isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center text-center p-4">
            <Sparkles className="w-8 h-8 text-brand-400/60 mb-2" />
            <h4 className="text-xs font-semibold text-dark-200">Listening & Ready</h4>
            <p className="text-[11px] text-dark-400 max-w-xs mt-1 leading-relaxed">
              Questions detected from audio or typed below will automatically produce tailored answers here.
            </p>
          </div>
        ) : activeAnswer ? (
          <div className="space-y-2.5">
            {/* Question Bar */}
            <div className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-dark-800/80 border border-dark-700/80">
              <div className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                  {activeAnswer.source === 'screen'
                    ? 'Screen Question'
                    : activeAnswer.source === 'audio'
                    ? 'Spoken Question'
                    : 'Prompt'}
                </span>
                <p className="text-xs font-semibold text-white leading-snug">{activeAnswer.question}</p>
              </div>

              {/* Actions */}
              <div className="no-drag flex items-center gap-1 shrink-0">
                <button
                  onClick={handleRegenerate}
                  disabled={isLoading}
                  title="Regenerate answer"
                  className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleCopy}
                  title="Copy full answer"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-dark-700 hover:bg-dark-600 text-dark-200 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Answer Body */}
            <div className="text-xs text-dark-200 leading-relaxed font-sans pr-1">
              {renderFormattedAnswer(activeAnswer.answer)}
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer Navigation & Quick Input */}
      <div className="shrink-0 p-2.5 bg-dark-800/90 border-t border-dark-700/80 space-y-2">
        {answers.length > 1 && (
          <div className="flex items-center justify-between text-[11px] text-dark-400 px-1">
            <button
              onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, answers.length - 1))}
              disabled={currentIndex >= answers.length - 1}
              className="flex items-center gap-1 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Older</span>
            </button>
            <span className="font-mono text-[10px]">
              {currentIndex + 1} of {answers.length}
            </span>
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
              disabled={currentIndex <= 0}
              className="flex items-center gap-1 hover:text-white disabled:opacity-30 transition-colors"
            >
              <span>Newer</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Question Form */}
        <form onSubmit={handleQuickAsk} className="relative flex items-center">
          <input
            type="text"
            value={quickQuestion}
            onChange={(e) => setQuickQuestion(e.target.value)}
            placeholder="Discreet question (e.g. what is debounce?)..."
            disabled={isLoading}
            className="w-full pl-3 pr-16 py-1.5 rounded-lg bg-dark-900 border border-dark-700 text-xs text-dark-200 placeholder-dark-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans"
          />
          <button
            type="submit"
            disabled={isLoading || !quickQuestion.trim()}
            className="absolute right-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white transition-all flex items-center gap-1"
          >
            <Send className="w-3 h-3" />
            <span>Ask</span>
          </button>
        </form>
      </div>

      {/* Screen Selection Modal in Overlay */}
      <ScreenCaptureModal
        isOpen={isScreenModalOpen}
        onClose={() => setIsScreenModalOpen(false)}
        onCapture={handleScreenCapture}
      />
    </div>
  );
};

