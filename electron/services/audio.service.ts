import { geminiService } from './gemini.service';
import { deepgramService } from './deepgram.service';
import { storageService } from './storage.service';
import { AnswerResponse } from '../../src/types';

export class AudioService {
  /**
   * Processes an incoming audio chunk (base64) from the renderer,
   * transcribing via Deepgram Nova-2 (if configured/enabled) or falling back to Gemini Audio.
   */
  async processChunk(
    audioBase64: string,
    mimeType: string
  ): Promise<{ detectedQuestion?: string; answer?: AnswerResponse }> {
    if (!audioBase64) {
      throw new Error('Empty audio chunk received.');
    }

    const settings = storageService.getSettings();
    const sttProvider = settings.sttProvider || (settings.deepgramApiKey ? 'deepgram' : 'gemini');

    // Use Deepgram if selected and API key is present
    if (sttProvider === 'deepgram' && settings.deepgramApiKey) {
      try {
        const transcript = await deepgramService.transcribeAudio(audioBase64, mimeType);
        if (transcript && transcript.length > 0) {
          return await geminiService.evaluateTranscribedQuestion(transcript);
        }
        return {};
      } catch (err: any) {
        console.error('Deepgram processing failed, falling back to Gemini audio:', err);
      }
    }

    // Fallback or default: Gemini Multimodal Audio
    return await geminiService.processAudioChunk(audioBase64, mimeType);
  }
}

export const audioService = new AudioService();

