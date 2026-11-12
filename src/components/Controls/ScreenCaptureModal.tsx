import React, { useState, useEffect } from 'react';
import { Monitor, X, Play, RefreshCw, AlertCircle, AppWindow, CheckCircle2 } from 'lucide-react';
import { ScreenSource } from '../../types';

interface ScreenCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (sourceId?: string) => Promise<void>;
}

export const ScreenCaptureModal: React.FC<ScreenCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'screen' | 'window' | 'all'>('screen');
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = async () => {
    if (!window.electronAPI) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await window.electronAPI.getScreenSources();
      if (res.success && res.data) {
        setSources(res.data);
        if (res.data.length > 0) {
          // Default selection to current screen
          setSelectedSourceId(res.data[0].id);
        }
      } else {
        setError(res.error || 'Failed to list screen capture sources.');
      }
    } catch (err: any) {
      setError(err.message || 'Error listing screen sources.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab('screen');
      fetchSources();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCapture = async () => {
    setIsCapturing(true);
    setError(null);
    try {
      await onCapture(selectedSourceId || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to capture or analyze screen.');
    } finally {
      setIsCapturing(false);
    }
  };

  const screenSources = sources.filter((s) => s.id.startsWith('screen:'));
  const windowSources = sources.filter((s) => !s.id.startsWith('screen:'));

  const filteredSources = sources.filter((src) => {
    if (activeTab === 'screen') return src.id.startsWith('screen:');
    if (activeTab === 'window') return !src.id.startsWith('screen:');
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-dark-900 border border-dark-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-dark-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Select Screen or Window</h3>
              <p className="text-xs text-dark-400">
                Gemini vision will analyze code snippets, problems, or errors • Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-dark-700 text-white font-mono text-[10px] border border-dark-600">Ctrl + Shift + S</kbd>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSources}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
              title="Refresh Sources"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 px-6 pt-2 bg-dark-900/90 border-b border-dark-700/60 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('screen');
              if (screenSources.length > 0) {
                setSelectedSourceId(screenSources[0].id);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-all ${activeTab === 'screen'
              ? 'border-brand-500 text-brand-400 font-semibold'
              : 'border-transparent text-dark-400 hover:text-dark-200'
              }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Current Screen</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('window');
              if (windowSources.length > 0 && selectedSourceId.startsWith('screen:')) {
                setSelectedSourceId(windowSources[0].id);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-all ${activeTab === 'window'
              ? 'border-brand-500 text-brand-400 font-semibold'
              : 'border-transparent text-dark-400 hover:text-dark-200'
              }`}
          >
            <AppWindow className="w-3.5 h-3.5" />
            <span>Windows ({windowSources.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-all ${activeTab === 'all'
              ? 'border-brand-500 text-brand-400 font-semibold'
              : 'border-transparent text-dark-400 hover:text-dark-200'
              }`}
          >
            <span>All Sources</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-dark-400">Scanning active screen and windows...</p>
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <p className="text-xs text-dark-400">No capture sources found in this category.</p>
            </div>
          ) : activeTab === 'screen' && screenSources.length === 1 ? (
            /* Featured Single Current Screen View */
            <div className="flex flex-col items-center justify-center py-2">
              <div
                onClick={() => setSelectedSourceId(screenSources[0].id)}
                onDoubleClick={handleCapture}
                className={`w-full max-w-lg cursor-pointer rounded-xl border p-3 transition-all flex flex-col gap-2.5 ${selectedSourceId === screenSources[0].id
                  ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/40 shadow-xl'
                  : 'border-dark-700 bg-dark-800/50 hover:border-dark-600 hover:bg-dark-800'
                  }`}
              >
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black/60 border border-dark-700/80">
                  {screenSources[0].thumbnail ? (
                    <img
                      src={screenSources[0].thumbnail}
                      alt={screenSources[0].name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-dark-500">
                      <Monitor className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-semibold shadow flex items-center gap-1 backdrop-blur-sm">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Current Display</span>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-white">
                    {screenSources[0].name}
                  </span>
                  <span className="text-[11px] text-dark-400">
                    Double-click to analyze
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {
                filteredSources.map((src) => {
                  const isSelected = selectedSourceId === src.id;
                  const isScreen = src.id.startsWith('screen:');
                  return (
                    <div
                      key={src.id}
                      onClick={() => setSelectedSourceId(src.id)}
                      onDoubleClick={handleCapture}
                      className={`cursor-pointer rounded-xl border p-2.5 transition-all text-left flex flex-col gap-2 ${isSelected
                        ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/50'
                        : 'border-dark-700 bg-dark-800/50 hover:border-dark-600 hover:bg-dark-800'
                        }`}
                    >
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-black/40 border border-dark-700/60">
                        {src.thumbnail ? (
                          <img
                            src={src.thumbnail}
                            alt={src.name}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-dark-500">
                            {isScreen ? <Monitor className="w-8 h-8" /> : <AppWindow className="w-8 h-8" />}
                          </div>
                        )}
                        {isScreen && (
                          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-emerald-500/80 text-white text-[9px] font-medium backdrop-blur-sm">
                            Current Screen
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-medium text-dark-200 truncate px-1">
                        {src.name}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-dark-700 bg-dark-800/80">
          <span className="text-xs text-dark-400">
            Selected: <span className="text-white font-medium">{sources.find(s => s.id === selectedSourceId)?.name || 'Current Screen'}</span>
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-dark-300 hover:text-white hover:bg-dark-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCapture}
              disabled={isCapturing || isLoading || !selectedSourceId}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-all shadow-sm"
            >
              {isCapturing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing Screen...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Capture & Analyze</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

