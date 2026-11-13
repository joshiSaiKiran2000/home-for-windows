import { ipcMain } from 'electron';
import { resumeService } from '../services/resume.service';
import { storageService } from '../services/storage.service';
import { geminiService } from '../services/gemini.service';
import { broadcastToAllWindows } from '../main';
import { JobDescriptionData } from '../../src/types';

export function registerResumeIpc(): void {
  ipcMain.handle('resume:upload-pdf', async () => {
    try {
      const data = await resumeService.uploadAndAnalyzePdf();
      broadcastToAllWindows('app:resume-updated', data);
      return { success: true, data };
    } catch (err: any) {
      console.error('Error handling resume upload:', err);
      return { success: false, error: err.message || 'Failed to upload or analyze resume.' };
    }
  });

  ipcMain.handle('resume:get-stored', async () => {
    try {
      const data = storageService.getResume();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('jd:get-stored', async () => {
    try {
      const data = storageService.getJobDescription();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('jd:save', async (_event, jd: JobDescriptionData) => {
    try {
      storageService.saveJobDescription(jd);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('context:clear', async () => {
    try {
      storageService.clearContext();
      geminiService.clearConversationHistory();
      broadcastToAllWindows('app:context-cleared');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

