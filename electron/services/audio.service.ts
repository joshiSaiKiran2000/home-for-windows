import { geminiService } from './gemini.service';
import { AnswerResponse } from '../../src/types';

export class AudioService {
  /**
   * Processes an incoming audio chunk (base64) from the renderer,
   * sends it to Gemini for transcription and question detection.
   */
  async processChunk(
    audioBase64: string,
    mimeType: string
  ): Promise<{ detectedQuestion?: string; answer?: AnswerResponse }> {
    if (!audioBase64) {
      throw new Error('Empty audio chunk received.');
    }

    return await geminiService.processAudioChunk(audioBase64, mimeType);
  }
}

export const audioService = new AudioService();

