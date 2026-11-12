import React, { useState, useEffect, useRef } from "react";
import {
  Minus,
  X,
  Maximize2,
  Minimize2,
  Check,
  RotateCw,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  Sliders,
  Code2,
  Mic,
  Settings,
  Trash2,
} from "lucide-react";
import { AnswerResponse, AppSettings } from "../../types";
import { CodeBlock } from "../AnswerDisplay/CodeBlock";
import { ScreenCaptureModal } from "../Controls/ScreenCaptureModal";
import { SettingsModal } from "../Settings/SettingsModal";
import { useAudioCapture } from "../../hooks/useAudioCapture";

export const OverlayWindow: React.FC = () => {
  const [answers, setAnswers] = useState<AnswerResponse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompact, setIsCompact] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [opacity, setOpacity] = useState(0.95);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quickQuestion, setQuickQuestion] = useState("");
  const [isScreenModalOpen, setIsScreenModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [sttProvider, setSttProvider] = useState<"deepgram" | "gemini">(
    "deepgram",
  );

  const opacityRef = useRef<HTMLDivElement>(null);

  const { audioState, startListening, stopListening } = useAudioCapture();

  // Close opacity popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        opacityRef.current &&
        !opacityRef.current.contains(e.target as Node)
      ) {
        setShowOpacitySlider(false);
      }
    };
    if (showOpacitySlider) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showOpacitySlider]);

  // Subscribe to new answers and settings from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.getSettings().then((res) => {
      if (res.success && res.data && typeof res.data.opacity === "number") {
        setOpacity(res.data.opacity);
      }
    });

    const cleanup = window.electronAPI.onNewAnswer((newAns) => {
      setAnswers((prev) => [newAns, ...prev]);
      setCurrentIndex(0);
      setIsLoading(false);
    });

    const cleanupMode = window.electronAPI.onOverlayModeChange((compact) => {
      setIsCompact(compact);
    });

    const cleanupMinimized = window.electronAPI.onOverlayMinimizedChange?.(
      (minimized) => {
        setIsMinimized(minimized);
      },
    );

    const cleanupOpacity = window.electronAPI.onOverlayOpacityChange?.(
      (newOpacity) => {
        setOpacity(newOpacity);
      },
    );

    const cleanupAnalyzing = window.electronAPI.onScreenAnalyzing?.(() => {
      setIsLoading(true);
    });

    const cleanupScreenError = window.electronAPI.onScreenError?.((err) => {
      setIsLoading(false);
      setUploadMessage(`Screen error: ${err}`);
      setTimeout(() => setUploadMessage(null), 4000);
    });

    window.electronAPI?.resetZoom?.();
    window.electronAPI?.resetOverlaySize?.();

    window.electronAPI?.getSettings?.().then((res) => {
      if (res?.success && res.data?.sttProvider) {
        setSttProvider(res.data.sttProvider);
      }
    });

    return () => {
      cleanup();
      cleanupMode();
      cleanupMinimized?.();
      cleanupOpacity?.();
      cleanupAnalyzing?.();
      cleanupScreenError?.();
    };
  }, []);

  // Keyboard shortcuts:
  // - Escape: toggles between full overlay and minimized expand button
  // - Ctrl + Shift + S / Ctrl + Shift + A: Instant Capture & Analyze active screen (no mouse needed)
  // - Ctrl + Shift + Arrows: Widen, Narrow, Increase, or Decrease Height
  // - Ctrl + Arrows / Alt + Arrows: Widen, Narrow, Increase, or Decrease Height (when not in input)
  // - Ctrl + 0 / Alt + 0: Reset overlay to default size (460x470) and 100% zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (quickQuestion) {
          setQuickQuestion("");
          return;
        }
        if (document.activeElement?.tagName === "INPUT" && !isMinimized) {
          (document.activeElement as HTMLElement).blur();
          return;
        }
        if (isMinimized) {
          handleExpand();
        } else {
          handleMinimize();
        }
        return;
      }

      const isArrowRight =
        e.key === "ArrowRight" ||
        e.code === "ArrowRight" ||
        e.key === "Right";
      const isArrowLeft =
        e.key === "ArrowLeft" || e.code === "ArrowLeft" || e.key === "Left";
      const isArrowDown =
        e.key === "ArrowDown" || e.code === "ArrowDown" || e.key === "Down";
      const isArrowUp =
        e.key === "ArrowUp" || e.code === "ArrowUp" || e.key === "Up";

      const isInputFocused =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA";

      // Move Overlay Shortcuts (Alt + Arrows, Alt + Shift + Arrows, or Ctrl + Alt + Arrows)
      // Works in both expanded and bubble mode
      if (
        (e.altKey && !e.ctrlKey && !isInputFocused) ||
        (e.altKey && e.shiftKey) ||
        (e.ctrlKey && e.altKey)
      ) {
        const moveStep = e.shiftKey ? 80 : 40;
        if (isArrowLeft) {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI?.moveOverlayBy(-moveStep, 0);
          return;
        } else if (isArrowRight) {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI?.moveOverlayBy(moveStep, 0);
          return;
        } else if (isArrowUp) {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI?.moveOverlayBy(0, -moveStep);
          return;
        } else if (isArrowDown) {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI?.moveOverlayBy(0, moveStep);
          return;
        }
      }

      if (!isMinimized) {
        const isMinus =
          e.key === "-" ||
          e.key === "_" ||
          e.code === "Minus" ||
          e.code === "NumpadSubtract";
        const isPlus =
          e.key === "+" ||
          e.key === "=" ||
          e.code === "Equal" ||
          e.code === "NumpadAdd";
        const isZero =
          e.key === "0" || e.code === "Digit0" || e.code === "Numpad0";

        // Shortcut to instantly capture & analyze active screen (Ctrl + Shift + S or Ctrl + Shift + A or Ctrl + Alt + S)
        if (
          (e.ctrlKey && e.shiftKey && (e.key === "S" || e.key === "s" || e.key === "A" || e.key === "a")) ||
          (e.ctrlKey && e.altKey && (e.key === "S" || e.key === "s"))
        ) {
          e.preventDefault();
          e.stopPropagation();
          handleScreenCapture();
          return;
        }

        // Shortcut to clear text / clear screen (Ctrl + L or Ctrl + K)
        if (
          (e.ctrlKey || e.metaKey) &&
          (e.key === "l" || e.key === "L" || e.key === "k" || e.key === "K") &&
          !isInputFocused
        ) {
          e.preventDefault();
          handleClearText();
          return;
        }

        // Intercept and completely block browser zoom scaling on Ctrl + / -
        if (e.ctrlKey && (isMinus || isPlus)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Reset to default dimensions (460 x 470) and 100% zoom on Ctrl + 0 or Ctrl + Shift + 0 or Alt + 0
        if ((e.ctrlKey || e.altKey) && isZero) {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI?.resetZoom?.();
          window.electronAPI?.resetOverlaySize?.();
          return;
        }

        // 1. Resize Overlay Shortcuts:
        // Ctrl + Shift + Arrows (works everywhere, including inside input with preventDefault)
        if (e.ctrlKey && e.shiftKey) {
          if (isArrowRight) {
            e.preventDefault();
            window.electronAPI?.resizeOverlayBy(30, 0); // Widen
          } else if (isArrowLeft) {
            e.preventDefault();
            window.electronAPI?.resizeOverlayBy(-30, 0); // Narrow
          } else if (isArrowDown) {
            e.preventDefault();
            window.electronAPI?.resizeOverlayBy(0, 30); // Taller / Increase height
          } else if (isArrowUp) {
            e.preventDefault();
            window.electronAPI?.resizeOverlayBy(0, -30); // Shorter / Decrease height
          }
        }
        // 3. Ctrl + Arrows (when not focused in text input)
        else if (e.ctrlKey && !isInputFocused) {
          if (isArrowRight) {
            e.preventDefault();
            window.electronAPI?.resizeOverlayBy(30, 0); // Widen
          } else if (isArrowLeft) {
            e.preventDefault();
            window.electronAPI?.resizeOverlayBy(-30, 0); // Narrow
          } else if (isArrowDown) {
            e.preventDefault();
            window.electronAPI?.resizeOverlayBy(0, 30); // Increase height
          } else if (isArrowUp) {
            e.preventDefault();
            window.electronAPI?.resizeOverlayBy(0, -30); // Decrease height
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [isMinimized]);

  const activeAnswer = answers[currentIndex] || null;

  const handleClearText = () => {
    setAnswers([]);
    setCurrentIndex(0);
    setQuickQuestion("");
    setUploadMessage(null);
  };

  const handleRegenerate = async () => {
    if (!activeAnswer || isLoading || !window.electronAPI) return;
    setIsLoading(true);
    try {
      const res = await window.electronAPI.generateAnswer({
        question: activeAnswer.question,
      });
      if (res.success && res.data) {
        setAnswers((prev) => [res.data!, ...prev]);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error("Regenerate error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuestion.trim() || isLoading || !window.electronAPI) return;
    const q = quickQuestion.trim();
    setQuickQuestion("");
    setIsLoading(true);
    try {
      const res = await window.electronAPI.generateAnswer({ question: q });
      if (res.success && res.data) {
        setAnswers((prev) => [res.data!, ...prev]);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error("Quick ask error:", err);
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

  const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
    if (!window.electronAPI) return;
    await window.electronAPI.saveSettings(newSettings);
    if (newSettings.opacity !== undefined) {
      setOpacity(newSettings.opacity);
    }
    if (newSettings.sttProvider) {
      setSttProvider(newSettings.sttProvider);
    }
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

  // Stealth corner drag-to-resize support (mouse cursor stays normal arrow pointer, no double-arrow cursor)
  const isResizingRef = useRef(false);
  const resizeStartPosRef = useRef({ screenX: 0, screenY: 0 });

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isResizingRef.current = true;
    resizeStartPosRef.current = { screenX: e.screenX, screenY: e.screenY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingRef.current) return;
    const dw = e.screenX - resizeStartPosRef.current.screenX;
    const dh = e.screenY - resizeStartPosRef.current.screenY;

    if (Math.abs(dw) >= 1 || Math.abs(dh) >= 1) {
      resizeStartPosRef.current = { screenX: e.screenX, screenY: e.screenY };
      window.electronAPI?.resizeOverlayBy(dw, dh);
    }
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
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
      console.error("Screen capture error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for rendering markdown & code
  const renderFormattedAnswer = (text: string) => {
    const codeBlockRegex = /```([a-zA-Z0-9_\-]*)\r?\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (
        matchIndex > lastIndex &&
        text.substring(lastIndex, matchIndex).trim()
      ) {
        parts.push(
          <div
            key={`p-${lastIndex}`}
            className="space-y-1.5 whitespace-pre-wrap leading-relaxed text-dark-100"
          >
            {text.substring(lastIndex, matchIndex)}
          </div>,
        );
      }
      const lang = match[1] || "javascript";
      const code = match[2];
      parts.push(
        <CodeBlock
          key={`c-${matchIndex}`}
          language={lang}
          code={code}
          hideCopy={true}
        />,
      );
      lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < text.length && text.substring(lastIndex).trim()) {
      parts.push(
        <div
          key={`p-${lastIndex}`}
          className="space-y-1.5 whitespace-pre-wrap leading-relaxed text-dark-100"
        >
          {text.substring(lastIndex)}
        </div>,
      );
    }

    return parts;
  };

  if (isMinimized) {
    return (
      <div
        style={{ cursor: "default" }}
        className="drag-region w-screen h-screen flex items-center justify-center bg-transparent select-none p-1 cursor-default"
      >
        <button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            backgroundColor: `rgba(13, 17, 23, ${Math.max(0.85, opacity)})`,
            cursor: "default",
          }}
          className="no-drag group relative flex items-center justify-center w-12 h-12 rounded-2xl border border-brand-500/80 text-brand-400 hover:text-white hover:bg-brand-600 shadow-2xl backdrop-blur-xl transition-colors hover:scale-105 active:scale-95 cursor-default select-none"
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
      style={{
        backgroundColor: `rgba(13, 17, 23, ${opacity})`,
        borderColor: `rgba(48, 54, 61, ${Math.min(1, Math.max(0.18, opacity + 0.15))})`,
        backdropFilter: opacity < 0.98 ? "blur(16px)" : undefined,
        WebkitBackdropFilter: opacity < 0.98 ? "blur(16px)" : undefined,
      }}
      className="flex flex-col h-screen w-screen overflow-hidden rounded-2xl border text-dark-100 shadow-2xl transition-colors"
    >
      {/* Draggable Titlebar */}
      <div
        style={{
          backgroundColor: `rgba(22, 27, 34, ${Math.min(1, Math.max(0.25, opacity + 0.1))})`,
          borderBottomColor: `rgba(48, 54, 61, ${Math.min(1, Math.max(0.2, opacity + 0.15))})`,
          cursor: "default",
        }}
        className="drag-region flex items-center justify-between px-3.5 py-2.5 border-b cursor-default select-none shrink-0"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400/80 animate-pulse" />
          {answers.length > 0 && (
            <span className="text-[10px] text-dark-400 px-1.5 py-0.5 rounded bg-dark-700 font-mono">
              {currentIndex + 1}/{answers.length}
            </span>
          )}
        </div>

        {/* Window controls */}
        <div className="no-drag flex items-center gap-1">
          {/* Live Audio Listening Toggle */}
          <button
            onClick={audioState.isListening ? stopListening : startListening}
            className={`p-1 rounded transition-colors ${audioState.isListening
              ? "text-rose-400 hover:text-rose-300 bg-rose-500/20"
              : "text-dark-400 hover:text-purple-400 hover:bg-dark-700"
              }`}
          >
            {audioState.isListening ? (
              <span className="relative flex items-center justify-center">
                <Mic className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
              </span>
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Screen Analysis */}
          <button
            onClick={() => setIsScreenModalOpen(true)}
            className="p-1 rounded text-dark-400 hover:text-emerald-400 hover:bg-dark-700 transition-colors"
            title="Screen Analysis (Shortcut: Ctrl + Shift + S)"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>

          {/* Clear Text / Reset Screen */}
          {answers.length > 0 && (
            <button
              onClick={handleClearText}
              className="p-1 rounded text-dark-400 hover:text-rose-400 hover:bg-dark-700 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Opacity Quick Slider Button */}
          <div ref={opacityRef} className="relative">
            <button
              onClick={() => setShowOpacitySlider((prev) => !prev)}
              className={`p-1 rounded transition-colors ${showOpacitySlider
                ? "text-brand-400 bg-dark-700"
                : "text-dark-400 hover:text-white hover:bg-dark-700"
                }`}
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
            {showOpacitySlider && (
              <div
                style={{
                  backgroundColor: "rgba(22, 27, 34, 0.98)",
                  borderColor: "rgba(48, 54, 61, 0.9)",
                }}
                className="absolute right-0 top-full mt-2 w-44 p-3 rounded-xl border shadow-2xl z-50 space-y-2 backdrop-blur-xl animate-fade-in"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3 h-3 text-brand-400" />
                    Overlay Opacity
                  </span>
                  <span className="font-mono text-brand-400">
                    {Math.round(opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setOpacity(val);
                    window.electronAPI?.setOverlayOpacity(val);
                  }}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Compact View */}
          <button
            onClick={toggleCompact}
            className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
          >
            {isCompact ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Minimize */}
          <button
            onClick={handleMinimize}
            className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Close / Hide */}
          <button
            onClick={() => window.electronAPI?.hideOverlay()}
            className="p-1 rounded text-dark-400 hover:text-rose-400 hover:bg-dark-700 transition-colors"
            title="Hide Overlay (Ctrl + Shift + Space to restore)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 select-text">
        {uploadMessage && (
          <div className="p-2.5 rounded-xl bg-brand-950/50 border border-brand-800/60 text-xs text-brand-300 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{uploadMessage}</span>
          </div>
        )}

        {audioState.isListening && (
          <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              <span>Listening to meeting audio for questions...</span>
            </div>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-dark-800/90 text-dark-200 border border-dark-700">
              {sttProvider === "deepgram"
                ? "⚡ Deepgram Nova-2"
                : "✨ Gemini Audio"}
            </span>
          </div>
        )}
        {isLoading && (
          <div className="p-3 rounded-xl bg-brand-950/30 border border-brand-800/40 flex items-center gap-2.5 text-xs text-brand-300">
            <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Formulating conversational, beginner-friendly answer...</span>
          </div>
        )}

        {activeAnswer && (
          <div className="space-y-2.5">
            {/* Question Bar */}
            <div
              style={{
                backgroundColor: `rgba(22, 27, 34, ${Math.min(1, Math.max(0.3, opacity + 0.08))})`,
                borderColor: `rgba(48, 54, 61, ${Math.min(1, Math.max(0.25, opacity + 0.15))})`,
              }}
              className="flex items-start justify-between gap-2 p-2.5 rounded-xl border"
            >
              <div className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                  {activeAnswer.source === "screen"
                    ? "Screen Question"
                    : activeAnswer.source === "audio"
                      ? "Spoken Question"
                      : "Prompt"}
                </span>
                <p className="text-xs font-semibold text-white leading-snug">
                  {activeAnswer.question}
                </p>
              </div>

              {/* Actions */}
              <div className="no-drag flex items-center gap-1 shrink-0">
                <button
                  onClick={handleRegenerate}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
                >
                  <RotateCw
                    className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
                  />
                </button>
                <button
                  onClick={handleClearText}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-dark-700 hover:bg-rose-950/50 hover:text-rose-300 text-dark-300 transition-colors"
                >
                  <Trash2 className="w-3 h-3 text-dark-400" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Answer Body */}
            <div className="text-xs text-dark-100 font-medium leading-relaxed font-sans pr-1">
              {renderFormattedAnswer(activeAnswer.answer)}
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation & Quick Input */}
      <div
        style={{
          backgroundColor: `rgba(22, 27, 34, ${Math.min(1, Math.max(0.25, opacity + 0.1))})`,
          borderTopColor: `rgba(48, 54, 61, ${Math.min(1, Math.max(0.2, opacity + 0.15))})`,
        }}
        className="shrink-0 p-2.5 border-t space-y-2"
      >
        {answers.length > 1 && (
          <div className="flex items-center justify-between text-[11px] text-dark-400 px-1">
            <button
              onClick={() =>
                setCurrentIndex((prev) =>
                  Math.min(prev + 1, answers.length - 1),
                )
              }
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
        <form
          onSubmit={handleQuickAsk}
          className="relative flex items-center cursor-default"
        >
          <input
            type="text"
            value={quickQuestion}
            onChange={(e) => setQuickQuestion(e.target.value)}
            disabled={isLoading}
            style={{
              backgroundColor: `rgba(13, 17, 23, ${Math.min(1, Math.max(0.35, opacity + 0.15))})`,
              borderColor: `rgba(48, 54, 61, ${Math.min(1, Math.max(0.25, opacity + 0.2))})`,
              cursor: "default",
            }}
            className="w-full pl-3 pr-20 py-1.5 rounded-lg border text-xs text-white placeholder-dark-400 focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans cursor-default caret-brand-400"
          />
          {quickQuestion && (
            <button
              type="button"
              onClick={() => setQuickQuestion("")}
              className="absolute right-14 p-1 text-dark-400 hover:text-white transition-colors cursor-default"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading || !quickQuestion.trim()}
            className="absolute right-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white transition-all flex items-center gap-1 cursor-default"
          >
            <Send className="w-3 h-3" />
            <span>Ask</span>
          </button>
        </form>

        {/* Stealth Corner Resize Grip (Mouse stays normal arrow pointer, zero double-arrow cursor!) */}
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          style={{ cursor: "default" }}
          className="no-drag absolute bottom-0.5 right-0.5 w-4 h-4 flex items-end justify-end p-0.5 select-none opacity-30 hover:opacity-90 transition-opacity cursor-default z-40"
        >
          <div className="w-1.5 h-1.5 border-r border-b border-dark-400 rounded-br pointer-events-none" />
        </div>
      </div>

      {/* Screen Selection Modal in Overlay */}
      <ScreenCaptureModal
        isOpen={isScreenModalOpen}
        onClose={() => setIsScreenModalOpen(false)}
        onCapture={handleScreenCapture}
      />

      {/* Settings Modal in Overlay */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
};
