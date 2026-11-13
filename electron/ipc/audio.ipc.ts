import { ipcMain } from 'electron';
import { audioService } from '../services/audio.service';
import { broadcastToAllWindows } from '../main';

export function registerAudioIpc(): void {
    ipcMain.handle('audio:process-chunk', async (_event, audioBase64: string, mimeType: string, isFinal?: boolean) => {
      try {
        const result = await audioService.processChunk(audioBase64, mimeType, isFinal);

        if (result.detectedQuestion) {
          broadcastToAllWindows('app:speech-question-detected', result.detectedQuestion);
        }

        return { success: true, data: result };
      } catch (err: any) {
        console.error('Error processing audio chunk:', err);
        return { success: false, error: err.message || 'Failed to process audio.' };
      }
    });

    ipcMain.handle('audio:reset', async () => {
      try {
        audioService.resetBuffer();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });
  }

