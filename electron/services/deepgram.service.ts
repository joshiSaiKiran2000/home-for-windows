import { storageService } from './storage.service';

export class DeepgramService {
  /**
   * Returns configured Deepgram API key or environment variable.
   */
  private getApiKey(): string {
    const settings = storageService.getSettings();
    return settings.deepgramApiKey || process.env.DEEPGRAM_API_KEY || '';
  }

  /**
   * Transcribe an incoming base64 audio chunk using Deepgram's Nova-2 model.
   * Nova-2 provides sub-second latency with high speech recognition accuracy.
   */
  async transcribeAudio(audioBase64: string, mimeType: string = 'audio/webm'): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Deepgram API key is not configured. Please add your key in Settings.');
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    if (!audioBuffer || audioBuffer.length === 0) {
      return '';
    }

    const cleanMime = mimeType.split(';')[0] || 'audio/webm';
    const url = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': cleanMime,
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Deepgram API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const transcript =
        data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

      return transcript.trim();
    } catch (err: any) {
      console.error('Deepgram transcription error:', err);
      throw err;
    }
  }
}

export const deepgramService = new DeepgramService();

