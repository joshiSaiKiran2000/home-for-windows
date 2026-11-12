import { useState, useRef, useCallback } from 'react';
import { AudioCaptureState } from '../types';

export function useAudioCapture(onQuestionDetected?: (question: string) => void) {
  const [audioState, setAudioState] = useState<AudioCaptureState>({
    isListening: false,
    status: 'idle',
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rawStreamsRef = useRef<MediaStream[]>([]);
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

      // 3. Combine both streams if available, or pick the available one
      if (systemStream && micStream) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;
          const dest = ctx.createMediaStreamDestination();

          const sysSource = ctx.createMediaStreamSource(systemStream);
          sysSource.connect(dest);

          const micSource = ctx.createMediaStreamSource(micStream);
          micSource.connect(dest);

          finalStream = dest.stream;
        } catch (mixErr) {
          console.warn('Mixing audio streams failed, using system audio:', mixErr);
          finalStream = systemStream || micStream;
        }
      } else {
        finalStream = systemStream || micStream;
      }

      if (!finalStream || finalStream.getAudioTracks().length === 0) {
        throw new Error('No audio available. Please verify microphone or system sound permissions.');
      }

      streamRef.current = finalStream;

      // Determine mimeType
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      }

      const recorder = new MediaRecorder(finalStream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 2000) {
          try {
            setAudioState(prev => ({ ...prev, status: 'processing' }));
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Data = (reader.result as string).split(',')[1];
              if (base64Data && window.electronAPI) {
                const res = await window.electronAPI.processAudioChunk(base64Data, mimeType);
                if (res.success && res.data) {
                  if (res.data.detectedQuestion) {
                    setAudioState(prev => ({
                      ...prev,
                      lastDetectedQuestion: res.data?.detectedQuestion,
                      status: 'listening',
                    }));
                    if (onQuestionDetected) {
                      onQuestionDetected(res.data.detectedQuestion);
                    }
                  }
                }
              }
              setAudioState(prev => ({ ...prev, status: 'listening' }));
            };
            reader.readAsDataURL(e.data);
          } catch (err) {
            console.error('Error sending audio chunk:', err);
            setAudioState(prev => ({ ...prev, status: 'listening' }));
          }
        }
      };

      // Slice audio in 5-second chunks for responsive speech cadence & question detection
      recorder.start(5000);

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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      rawStreamsRef.current.forEach((s) => {
        try {
          s.getTracks().forEach((t) => t.stop());
        } catch {}
      });
      rawStreamsRef.current = [];
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    } catch (err) {
      console.error('Error stopping audio:', err);
    } finally {
      mediaRecorderRef.current = null;
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

