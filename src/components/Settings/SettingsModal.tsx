import React, { useState, useEffect } from 'react';
import { Settings, Key, Sliders, Shield, X, Check, Eye, EyeOff, Mic } from 'lucide-react';
import { AppSettings } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Partial<AppSettings>) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [deepgramKey, setDeepgramKey] = useState('');
  const [sttProvider, setSttProvider] = useState<'deepgram' | 'gemini'>('deepgram');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [opacity, setOpacity] = useState(0.95);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [showDeepgramKey, setShowDeepgramKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && window.electronAPI) {
      window.electronAPI.getSettings().then((res) => {
        if (res.success && res.data) {
          setApiKey(res.data.geminiApiKey || '');
          setDeepgramKey(res.data.deepgramApiKey || '');
          setSttProvider(res.data.sttProvider || 'deepgram');
          const loadedModel = res.data.geminiModel;
          if (
            !loadedModel ||
            loadedModel === 'gemini-1.5-flash' ||
            loadedModel === 'gemini-2.0-flash' ||
            loadedModel === 'gemini-1.5-pro'
          ) {
            setModel('gemini-2.5-flash');
          } else {
            setModel(loadedModel);
          }
          setOpacity(res.data.opacity ?? 0.95);
          setAlwaysOnTop(res.data.alwaysOnTop ?? true);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        geminiApiKey: apiKey.trim(),
        geminiModel: model,
        deepgramApiKey: deepgramKey.trim(),
        sttProvider,
        opacity,
        alwaysOnTop,
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-fade-in overflow-hidden">
          <div className="w-full max-w-lg max-h-[85vh] rounded-2xl bg-dark-900 border border-dark-700 shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-dark-700 bg-dark-800/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Application Settings</h3>
                    <p className="text-xs text-dark-400">Configure AI credentials and overlay behavior</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

                {/* Scrollable Content */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                  {/* Gemini API Key */}
                  <div>
                    <label className="block text-xs font-semibold text-dark-200 mb-1.5 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-brand-400" />
                      <span>Google Gemini API Key</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-xs text-white placeholder-dark-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono cursor-default"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 text-dark-400 hover:text-dark-200"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-dark-400 mt-1">
                      Your key is stored securely on your local device only.
                    </p>
                  </div>

                  {/* Speech-to-Text Provider (Deepgram / Gemini) */}
                  <div>
                    <label className="block text-xs font-semibold text-dark-200 mb-1.5 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-brand-400" />
                      <span>Speech-to-Text (STT) Engine</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSttProvider('deepgram')}
                        className={`p-2.5 rounded-xl border text-left transition-colors ${sttProvider === 'deepgram'
                          ? 'bg-brand-500/15 border-brand-500/60 text-white'
                          : 'bg-dark-800 border-dark-700 text-dark-300 hover:text-white'
                          }`}
                      >
                        <div className="text-xs font-semibold flex items-center gap-1.5 text-brand-300">
                          <span>⚡ Deepgram Nova-2</span>
                        </div>
                        <p className="text-[10px] text-dark-400 mt-0.5">Ultra-fast sub-second transcription (Recommended)</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSttProvider('gemini')}
                        className={`p-2.5 rounded-xl border text-left transition-colors ${sttProvider === 'gemini'
                          ? 'bg-brand-500/15 border-brand-500/60 text-white'
                          : 'bg-dark-800 border-dark-700 text-dark-300 hover:text-white'
                          }`}
                      >
                        <div className="text-xs font-semibold flex items-center gap-1.5 text-brand-300">
                          <span>✨ Gemini Audio</span>
                        </div>
                        <p className="text-[10px] text-dark-400 mt-0.5">Multimodal direct audio chunk analysis</p>
                      </button>
                    </div>
                  </div>

                  {/* Deepgram API Key */}
                  <div>
                    <label className="block text-xs font-semibold text-dark-200 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-brand-400" />
                        <span>Deepgram API Key</span>
                      </span>
                      <span className="text-[10px] text-dark-400">console.deepgram.com</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showDeepgramKey ? 'text' : 'password'}
                        value={deepgramKey}
                        onChange={(e) => setDeepgramKey(e.target.value)}
                        placeholder="Enter Deepgram API Key..."
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-xs text-white placeholder-dark-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono cursor-default"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDeepgramKey(!showDeepgramKey)}
                        className="absolute right-3 text-dark-400 hover:text-dark-200"
                      >
                        {showDeepgramKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-dark-400 mt-1">
                      Used for instantaneous speech-to-text with Deepgram Nova-2 during live meetings.
                    </p>
                  </div>

                  {/* Model Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-dark-200 mb-1.5 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-brand-400" />
                      <span>Gemini Model</span>
                    </label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast, Recommended for live interview)</option>
                      <option value="gemini-3.8-flash">Gemini 3.8 Flash (Latest speed & reasoning)</option>
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (High speed & intelligence)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep complex problem solving)</option>
                    </select>
                  </div>

                  {/* Overlay Opacity */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-dark-200 mb-1.5">
                      <span>Floating Overlay Opacity</span>
                      <span className="font-mono text-brand-400">{Math.round(opacity * 100)}%</span>
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
                    <p className="text-[11px] text-dark-400 mt-1">
                      Changes background transparency. Text, questions, and code remain 100% solid and crisp.
                    </p>
                  </div>

                  {/* Screen Share Protection (Stealth Mode) */}
                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs space-y-1.5">
                    <div className="font-semibold text-emerald-300 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span>Screen Share Protection (Stealth Mode)</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-dark-300 leading-relaxed">
                      Native capture exclusion is active. When you share your screen in <strong>Google Meet, Zoom, Teams, Discord, or Slack</strong>, this overlay is completely invisible to the opposite person while remaining fully visible to you.
                    </p>
                  </div>

                  {/* Shortcut note */}
                  <div className="p-3.5 rounded-xl bg-dark-800/80 border border-dark-700 text-xs space-y-1">
                    <div className="font-medium text-dark-200 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>Keyboard Shortcut & Privacy</span>
                    </div>
                    <p className="text-[11px] text-dark-400 leading-relaxed">
                      Press <kbd className="px-1.5 py-0.5 rounded bg-dark-700 text-white font-mono text-[10px] border border-dark-600">Ctrl + Shift + Space</kbd> at any time to instantly show or hide the floating interview overlay.
                    </p>
                  </div>
                </div>

                {/* Footer */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-t border-dark-700 bg-dark-800/80 shrink-0">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-dark-300 hover:text-white hover:bg-dark-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white transition-all shadow-sm"
                    >
                      {savedSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Saved!</span>
                        </>
                      ) : isSaving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Save Settings</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              );
};

