import { useState, useRef, useCallback } from 'react';
import { AudioCaptureState } from '../types';

/**
 * Resamples Float32 audio samples to 16,000 Hz and encodes them into a 44-byte RIFF/WAV format.
 * Deepgram Nova-2 natively prefers 16kHz linear16 PCM WAV, providing sub-second transcription with no demux overhead.
 */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const targetSampleRate = 16000;
  let resampled: Float32Array;

  if (sampleRate === targetSampleRate) {
    resampled = samples;
  } else {
    const ratio = sampleRate / targetSampleRate;
    const newLength = Math.round(samples.length / ratio);
    resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIdx = i * ratio;
      const idx1 = Math.floor(srcIdx);
      const idx2 = Math.min(idx1 + 1, samples.length - 1);
      const frac = srcIdx - idx1;
      resampled[i] = samples[idx1] * (1 - frac) + samples[idx2] * frac;
    }
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataByteLength = resampled.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeAscii(view, 8, 'WAVE');

  // fmt sub-chunk (16 for PCM)
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Write 16-bit signed PCM samples
  let offset = 44;
  for (let i = 0; i < resampled.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

function writeAscii(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunkSize, len)) as any
    );
  }
  return btoa(binary);
}

export function useAudioCapture(onQuestionDetected?: (question: string) => void) {
  const [audioState, setAudioState] = useState<AudioCaptureState>({
    isListening: false,
    status: 'idle',
  });

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rawStreamsRef = useRef<MediaStream[]>([]);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const muteNodeRef = useRef<GainNode | null>(null);

  // Cumulative utterance management: accumulates continuous speech for the entire sentence
  const utteranceChunksRef = useRef<Float32Array[]>([]);
  const utteranceSampleCountRef = useRef<number>(0);
  const isUtteranceActiveRef = useRef<boolean>(false);
  const speechDetectedInWindowRef = useRef<boolean>(false);
  const consecutiveSilenceTicksRef = useRef<number>(0);
  const isSendingRef = useRef<boolean>(false);
  const intervalRef = useRef<any>(null);

  const startListening = useCallback(async () => {
    try {
      setAudioState(prev => ({ ...prev, status: 'listening', errorMessage: undefined }));

      // Fetch user settings to check preferred audio source ('both' | 'system' | 'mic')
      const settingsRes = await window.electronAPI?.getSettings();
      const audioSource = settingsRes?.data?.audioSource || 'both';

      let systemStream: MediaStream | null = null;
      let micStream: MediaStream | null = null;
      let finalStream: MediaStream | null = null;
      rawStreamsRef.current = [];

      // 1. Capture system loopback audio (captures interviewer speech in headphones from Meet, Zoom, Teams)
      if (audioSource === 'both' || audioSource === 'system') {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          // Stop video track immediately since only audio is needed
          displayStream.getVideoTracks().forEach((track) => track.stop());
          const audioTracks = displayStream.getAudioTracks();
          if (audioTracks.length > 0) {
            systemStream = new MediaStream(audioTracks);
            rawStreamsRef.current.push(systemStream);
          }
        } catch (loopbackErr) {
          console.warn('System loopback capture not granted or unavailable, falling back to mic:', loopbackErr);
        }
      }

      // 2. Capture microphone audio
      if (audioSource === 'both' || audioSource === 'mic' || !systemStream) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          rawStreamsRef.current.push(micStream);
        } catch (micErr) {
          console.warn('Microphone capture not available:', micErr);
        }
      }

      // 3. Audio Context & Mixing
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioContextRef.current = ctx;

      const dest = ctx.createMediaStreamDestination();

        if (systemStream) {
          const sysSource = ctx.createMediaStreamSource(systemStream);
          sysSource.connect(dest);
        }
        if (micStream) {
          const micSource = ctx.createMediaStreamSource(micStream);
          micSource.connect(dest);
        }

        finalStream = dest.stream;

        if (!finalStream || finalStream.getAudioTracks().length === 0) {
          throw new Error('No audio available. Please verify microphone or system sound permissions.');
        }

        streamRef.current = finalStream;

        // 4. Connect Web Audio Pipeline: Source -> ScriptProcessor -> MuteGain -> Destination
        const sourceNode = ctx.createMediaStreamSource(finalStream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorNodeRef.current = processor;

        utteranceChunksRef.current = [];
        utteranceSampleCountRef.current = 0;
        isUtteranceActiveRef.current = false;
        speechDetectedInWindowRef.current = false;
        consecutiveSilenceTicksRef.current = 0;
        isSendingRef.current = false;

        // Sensitive Voice Activity Detection (RMS threshold)
        const RMS_SPEECH_THRESHOLD = 0.006;

        processor.onaudioprocess = (e) => {
          const channelData = e.inputBuffer.getChannelData(0);

          // Calculate energy
          let sum = 0;
          for (let i = 0; i < channelData.length; i++) {
            sum += channelData[i] * channelData[i];
          }
            const rms = Math.sqrt(sum / channelData.length);

            if (rms > RMS_SPEECH_THRESHOLD) {
              speechDetectedInWindowRef.current = true;
              consecutiveSilenceTicksRef.current = 0;
              if (!isUtteranceActiveRef.current) {
                isUtteranceActiveRef.current = true;
              }
            }

              // Accumulate audio samples while an utterance is active
              if (isUtteranceActiveRef.current) {
                utteranceChunksRef.current.push(new Float32Array(channelData));
                utteranceSampleCountRef.current += channelData.length;
              }
            };

            const muteNode = ctx.createGain();
            muteNode.gain.value = 0; // Mute playback so no feedback echoes to candidate's speakers
            muteNodeRef.current = muteNode;

            sourceNode.connect(processor);
            processor.connect(muteNode);
            muteNode.connect(ctx.destination);

            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }

              // 5. Intelligent Utterance Polling & Finalization (every 1000ms)
              // Accumulates continuous sentence audio so Deepgram sees full context without clipped words
              intervalRef.current = setInterval(async () => {
                if (isSendingRef.current) return;
                if (!isUtteranceActiveRef.current) return;

              const hadSpeech = speechDetectedInWindowRef.current;
              speechDetectedInWindowRef.current = false;

              if (!hadSpeech) {
                consecutiveSilenceTicksRef.current++;
              } else {
                consecutiveSilenceTicksRef.current = 0;
              }

              // Need at least ~0.6s of speech audio before sending first transcription
              const minSamples = Math.round(ctx.sampleRate * 0.6);
              if (utteranceSampleCountRef.current < minSamples) {
                return;
              }

              // When silence persists for ~1.5 - 2.0s after speech, the question is complete!
              const isSilenceFinal = consecutiveSilenceTicksRef.current >= 2;

                // Safety cap: max 15 seconds per single sentence
                const maxSamples = Math.round(ctx.sampleRate * 15);
                const isMaxFinal = utteranceSampleCountRef.current >= maxSamples;

                const isFinal = isSilenceFinal || isMaxFinal;

                const chunks = utteranceChunksRef.current;
                const totalLength = utteranceSampleCountRef.current;
                if (chunks.length === 0 || totalLength === 0) return;

                // Merge full audio from the start of the current sentence
                const merged = new Float32Array(totalLength);
                let writeOffset = 0;
                for (const c of chunks) {
                  merged.set(c, writeOffset);
                  writeOffset += c.length;
                }

                  // If finalized, reset utterance buffer for the NEXT question
                  if (isFinal) {
                    utteranceChunksRef.current = [];
                    utteranceSampleCountRef.current = 0;
                    isUtteranceActiveRef.current = false;
                    consecutiveSilenceTicksRef.current = 0;
                  }

              // Send full utterance audio to Deepgram Nova-2
              try {
                isSendingRef.current = true;
                setAudioState(prev => ({ ...prev, status: isFinal ? 'processing' : 'listening' }));

                  const wavBuffer = encodeWav(merged, ctx.sampleRate);
                  const base64Wav = arrayBufferToBase64(wavBuffer);

                  if (base64Wav && window.electronAPI) {
                    const res = await window.electronAPI.processAudioChunk(base64Wav, 'audio/wav', isFinal);
                    if (res.success && res.data && res.data.detectedQuestion) {
                      const detectedQ = res.data.detectedQuestion;
                      setAudioState(prev => ({
                        ...prev,
                        lastDetectedQuestion: detectedQ,
                        status: 'listening',
                      }));
                      if (onQuestionDetected) {
                        onQuestionDetected(detectedQ);
                      }
                    }
                  }
                } catch (err) {
                  console.error('Error processing audio utterance:', err);
                } finally {
                  isSendingRef.current = false;
                  setAudioState(prev => ({ ...prev, status: 'listening' }));
                }
}, 1000);

setAudioState({
  isListening: true,
  status: 'listening',
});
    } catch (err: any) {
  console.error('Audio capture error:', err);
  let msg = err.message || 'Audio access denied or unavailable.';
  if (err.name === 'NotAllowedError') {
    msg = 'Audio permission was denied. Please allow audio access in Windows privacy settings.';
  }
  setAudioState({
    isListening: false,
    status: 'error',
    errorMessage: msg,
  });
}
  }, [onQuestionDetected]);

const stopListening = useCallback(() => {
  try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (processorNodeRef.current) {
        try {
          processorNodeRef.current.disconnect();
        } catch { }
        processorNodeRef.current = null;
      }
      if (muteNodeRef.current) {
        try {
          muteNodeRef.current.disconnect();
        } catch { }
        muteNodeRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      rawStreamsRef.current.forEach((s) => {
        try {
          s.getTracks().forEach((t) => t.stop());
        } catch { }
      });
    rawStreamsRef.current = [];
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    utteranceChunksRef.current = [];
    utteranceSampleCountRef.current = 0;
    isUtteranceActiveRef.current = false;
    speechDetectedInWindowRef.current = false;
    consecutiveSilenceTicksRef.current = 0;
    isSendingRef.current = false;

    if (window.electronAPI?.resetAudioBuffer) {
      window.electronAPI.resetAudioBuffer().catch(() => { });
    }
  } catch (err) {
    console.error('Error stopping audio:', err);
  } finally {
    streamRef.current = null;
    setAudioState(prev => ({ ...prev, isListening: false, status: 'idle' }));
  }
}, []);

return {
  audioState,
  startListening,
  stopListening,
};
}
