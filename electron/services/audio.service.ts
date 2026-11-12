import { geminiService } from './gemini.service';
import { deepgramService } from './deepgram.service';
import { storageService } from './storage.service';
import { AnswerResponse } from '../../src/types';

export class AudioService {
  private speechBuffer: string = '';

  resetBuffer(): void {
    this.speechBuffer = '';
  }

  /**
   * Processes an incoming audio chunk (base64) from the renderer.
   * Transcribes via Deepgram Nova-2, accumulates the complete question text,
   * and only sends the completed question to Gemini to generate the answer.
   */
  async processChunk(
    audioBase64: string,
    mimeType: string
  ): Promise<{ detectedQuestion?: string; answer?: AnswerResponse }> {
      const settings = storageService.getSettings();

      // 1. If audio chunk is empty (silence/pause detected by client)
      if (!audioBase64 || audioBase64.length === 0) {
        if (this.speechBuffer.trim().length >= 8) {
          const fullQuestion = this.speechBuffer.trim();
          this.speechBuffer = '';
          const answer = await geminiService.generateInterviewAnswer({
            question: fullQuestion,
            source: 'audio',
          });
          return {
            detectedQuestion: fullQuestion,
            answer,
          };
        }
        return {};
      }

        // 2. Transcribe audio via Deepgram Nova-2
        if (settings.deepgramApiKey) {
          try {
            const transcript = await deepgramService.transcribeAudio(audioBase64, mimeType);
              const segment = (transcript || '').trim();

              if (segment.length > 0) {
                if (this.speechBuffer.length > 0) {
                  this.speechBuffer += ' ' + segment;
                } else {
                  this.speechBuffer = segment;
                }

                const currentFull = this.speechBuffer.trim();
                const wordCount = currentFull.split(/\s+/).length;

                // Check if speech has reached a natural sentence or question completion
                const endsWithQuestion = segment.endsWith('?');
                const endsWithSentence = segment.endsWith('.') || segment.endsWith('!');

                if (endsWithQuestion || (endsWithSentence && wordCount >= 3)) {
                  const completedQuestion = currentFull;
                  this.speechBuffer = '';

                  const answer = await geminiService.generateInterviewAnswer({
                    question: completedQuestion,
                    source: 'audio',
                  });

                  return {
                    detectedQuestion: completedQuestion,
                    answer,
                  };
                }

                // Still speaking in progress: show live transcript in UI, do NOT call Gemini yet
                return {
                  detectedQuestion: `(Listening: "${currentFull}...")`,
                };
              } else {
                // If Deepgram returned empty for this slice and previous buffer has speech, flush it
                if (this.speechBuffer.trim().length >= 8) {
                  const completedQuestion = this.speechBuffer.trim();
                  this.speechBuffer = '';
                  const answer = await geminiService.generateInterviewAnswer({
                    question: completedQuestion,
                    source: 'audio',
                  });
                  return {
                    detectedQuestion: completedQuestion,
                    answer,
                  };
                }
              }

              return {};
            } catch (err: any) {
              console.error('Deepgram transcription error:', err);
              return {
                detectedQuestion: `(Deepgram error: ${err.message || 'Check Deepgram API key'})`,
              };
            }
          }

    // 3. Fallback only if Deepgram API key is not configured at all
    return await geminiService.processAudioChunk(audioBase64, mimeType);
        }
      }

      export const audioService = new AudioService();

