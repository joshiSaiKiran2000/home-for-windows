import { geminiService } from './gemini.service';
import { deepgramService } from './deepgram.service';
import { storageService } from './storage.service';

export class AudioService {
  private lastTranscribedQuestion: string = '';

  resetBuffer(): void {
    this.lastTranscribedQuestion = '';
  }

  getBuffer(): string {
    return this.lastTranscribedQuestion;
  }

  /**
   * Processes incoming cumulative audio utterance from renderer.
   * Transcribes via Deepgram Nova-2 with full context preservation.
   * DOES NOT automatically generate an AI answer. The candidate reviews the complete question
   * in the input box and clicks "Ask" (or hits Enter) to send to Gemini AI.
   */
  async processChunk(
    audioBase64: string,
    mimeType: string,
      isFinal ?: boolean
  ): Promise < { detectedQuestion?: string; isFinal?: boolean } > {
      const settings = storageService.getSettings();

    if (!audioBase64 || audioBase64.length === 0) {
      return {};
    }

        // 1. Primary Engine: Deepgram Nova-2
        if (settings.deepgramApiKey) {
          try {
            const transcript = await deepgramService.transcribeAudio(audioBase64, mimeType);
            let clean = (transcript || '').trim();

              if (clean.length === 0) {
                return {};
              }

              // Polish sentence capitalization
              if (clean.length > 0) {
                clean = clean.charAt(0).toUpperCase() + clean.slice(1);
              }

              // When the speaker pauses and the utterance completes:
              if (isFinal) {
                // If sentence starts with an interrogative / question word, ensure it ends with '?'
                const isQuestion =
                  /^(how|what|why|can|could|would|should|will|do|does|did|is|are|was|were|which|where|when|who|explain|tell|describe|difference)\b/i.test(
                    clean
                  );

                  if (isQuestion && !clean.endsWith('?')) {
                    clean = clean.replace(/[.,!]+$/, '') + '?';
                  }

              this.lastTranscribedQuestion = clean;
              return {
                detectedQuestion: clean,
                isFinal: true,
              };
            }

            // While speaking: return live progress transcript
            this.lastTranscribedQuestion = clean;
            return {
              detectedQuestion: clean,
              isFinal: false,
            };
          } catch (err: any) {
            console.error('Deepgram transcription error:', err);
            return {
              detectedQuestion: `(Deepgram error: ${err.message || 'Check Deepgram API key'})`,
              isFinal: false,
            };
          }
        }

        // 2. Fallback only if Deepgram API key is not configured
        try {
          const fallbackRes = await geminiService.processAudioChunk(audioBase64, mimeType);
          return {
            detectedQuestion: fallbackRes.detectedQuestion,
            isFinal: true,
          };
        } catch {
          return {};
        }
      }
}

    export const audioService = new AudioService();
