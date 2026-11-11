import { useState, useRef, useCallback } from 'react';
import { AudioCaptureState } from '../types';

export function useAudioCapture(onQuestionDetected?: (question: string) => void) {
  const [audioState, setAudioState] = useState<AudioCaptureState>({
    isListening: false,
    status: 'idle',
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);

  const startListening = useCallback(async () => {
    try {
      setAudioState(prev => ({ ...prev, status: 'listening', errorMessage: undefined }));

      // Request microphone / audio permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Determine mimeType
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
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

      // Slice audio in 7-second chunks to analyze speech cadence & detect questions
      recorder.start(7000);

      setAudioState({
        isListening: true,
        status: 'listening',
      });
    } catch (err: any) {
      console.error('Audio capture error:', err);
      let msg = err.message || 'Microphone access denied or unavailable.';
      if (err.name === 'NotAllowedError') {
        msg = 'Microphone permission was denied. Please allow microphone access in Windows privacy settings.';
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

