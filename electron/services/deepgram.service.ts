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

    // Construct optimal transcription parameters for technical interview speech recognition
    const params = new URLSearchParams({
      model: 'nova-2',
      language: 'en',
      smart_format: 'true',
      punctuate: 'true',
      numerals: 'true',
      filler_words: 'false',
    });

    // Technical interview vocabulary boost: ensures Deepgram accurately transcribes technical jargon.
    // Deepgram Nova-2 keywords MUST NOT contain spaces or slashes (format: TOKEN or TOKEN:INTENSIFIER).
    const rawKeywords = [
      'loop:3',
      'loops:3',
      'looping:3',
      'iteration:3',
      'iterate:3',
      'iterable:3',
      'optimization:3',
      'optimize:3',
      'optimizing:3',
      'performance:3',
      'memoization:3',
      'caching:3',
      'profiling:3',
      'JavaScript:3',
      'JS:3',
      'TypeScript:3',
      'TS:3',
      'React:3',
      'Native:3',
      'Firebase:3',
      'Firestore:3',
      'NodeJS:3',
      'Express:2',
      'Redux:3',
      'MongoDB:2',
      'PostgreSQL:2',
      'SQL:2',
      'Docker:2',
      'Kubernetes:2',
      'GraphQL:2',
      'REST:2',
      'API:2',
      'JWT:2',
      'OAuth:2',
      'algorithm:2',
      'closure:3',
      'closures:3',
      'debounce:3',
      'debouncing:3',
      'throttle:3',
      'throttling:3',
      'microservices:2',
      'async:3',
      'await:3',
      'promise:3',
      'callback:3',
      'prototype:3',
      'hoisting:3',
      'scope:3',
      'event:2',
      'handler:2',
      'handling:2',
      'props:2',
      'state:2',
      'hook:2',
      'hooks:2',
      'component:2',
      'render:2',
      'rerender:2',
      'lifecycle:2',
      'Tailwind:2',
      'NextJS:2',
      'Vue:2',
      'Angular:2',
    ];

    const sanitizedKeywords: string[] = [];
    const keywordRegex = /^[a-zA-Z0-9_\-]+(:[0-9]+)?$/;

    for (const kw of rawKeywords) {
      if (keywordRegex.test(kw)) {
        sanitizedKeywords.push(kw);
      }
    }

    try {
      const resume = storageService.getResume();
      if (resume && Array.isArray(resume.skills)) {
        for (const skill of resume.skills.slice(0, 20)) {
          // Split multi-word skills like "System Design" or "CI/CD" into valid tokens
          const tokens = skill.trim().split(/[\s/+,&]+/);
          for (const token of tokens) {
            const cleanToken = token.replace(/[^a-zA-Z0-9_-]/g, '');
            if (
              cleanToken.length >= 2 &&
              !sanitizedKeywords.some((k) => k.split(':')[0].toLowerCase() === cleanToken.toLowerCase())
            ) {
              sanitizedKeywords.push(`${cleanToken}:2`);
            }
          }
        }
      }
    } catch {
      // Ignore if resume is not loaded
    }

    for (const kw of sanitizedKeywords) {
      params.append('keywords', kw);
    }

    const url = `https://api.deepgram.com/v1/listen?${params.toString()}`;

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

