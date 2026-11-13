import { ipcMain } from 'electron';
import { geminiService } from '../services/gemini.service';
import { storageService } from '../services/storage.service';
import { broadcastToAllWindows } from '../main';

export function registerAiIpc(): void {
  ipcMain.handle('ai:generate-answer', async (_event, params: { question: string }) => {
    try {
      if (!params || !params.question || !params.question.trim()) {
        return { success: false, error: 'Question cannot be empty.' };
      }

      const answer = await geminiService.generateInterviewAnswer({
        question: params.question.trim(),
        source: 'manual',
      });

      // Broadcast new answer to all active windows (Main and Overlay)
      broadcastToAllWindows('app:new-answer', answer);

      return { success: true, data: answer };
    } catch (err: any) {
      console.error('Error generating answer:', err);
      return { success: false, error: err.message || 'Failed to generate answer from Gemini.' };
    }
  });

  ipcMain.handle('ai:analyze-jd', async (_event, jdText: string) => {
    try {
      if (!jdText || jdText.trim().length < 20) {
        return { success: false, error: 'Job description text is too short. Please paste a full job description.' };
      }

      const resume = storageService.getResume();
      const analyzed = await geminiService.analyzeJobDescriptionText(jdText.trim(), resume);
      storageService.saveJobDescription(analyzed);

      return { success: true, data: analyzed };
    } catch (err: any) {
      console.error('Error analyzing job description:', err);
      return { success: false, error: err.message || 'Failed to analyze job description.' };
    }
  });

  ipcMain.handle('ai:clear-history', () => {
    try {
      geminiService.clearConversationHistory();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ai:get-history', () => {
    try {
      const history = geminiService.getConversationHistory();
      return { success: true, data: history };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

