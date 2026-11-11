import React from 'react';
import { Mic, MicOff, Radio, AlertCircle, ShieldCheck } from 'lucide-react';
import { AudioCaptureState } from '../../types';

interface AudioControllerProps {
  audioState: AudioCaptureState;
  onStart: () => void;
  onStop: () => void;
}

export const AudioController: React.FC<AudioControllerProps> = ({
  audioState,
  onStart,
  onStop
}) => {
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800/60 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between pb-3 border-b border-dark-700/60 mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-lg border transition-colors ${
              audioState.isListening
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            }`}
          >
            {audioState.isListening ? <Radio className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">Meeting Audio Listener</h3>
              {audioState.isListening && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-dark-400">Captures speech, detects interview questions, and displays answers in overlay</p>
          </div>
        </div>

        <div>
          {audioState.isListening ? (
            <button
              onClick={onStop}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm"
            >
              <MicOff className="w-3.5 h-3.5" />
              <span>Stop Listening</span>
            </button>
          ) : (
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-sm"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Start Listening</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Information */}
      <div className="space-y-3">
        {audioState.errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{audioState.errorMessage}</span>
          </div>
        )}

        {audioState.isListening && (
          <div className="p-3 rounded-lg bg-dark-900/60 border border-dark-700/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-dark-200">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {audioState.status === 'processing'
                  ? 'Transcribing and detecting question...'
                  : 'Monitoring conversation for interview questions...'}
              </span>
            </div>
            {audioState.lastDetectedQuestion && (
              <span className="text-[11px] text-brand-300 truncate max-w-xs font-mono">
                Last: "{audioState.lastDetectedQuestion}"
              </span>
            )}
          </div>
        )}

        {/* Privacy Note */}
        <div className="flex items-center gap-1.5 text-[11px] text-dark-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            Privacy Notice: Audio is only captured when explicitly activated by you. Speech audio chunks are evaluated strictly to detect interview questions and provide answers.
          </span>
        </div>
      </div>
    </div>
  );
};

