import { ipcMain } from 'electron';
import { resumeService } from '../services/resume.service';
import { storageService } from '../services/storage.service';
import { JobDescriptionData } from '../../src/types';

export function registerResumeIpc(): void {
  ipcMain.handle('resume:upload-pdf', async () => {
    try {
      const data = await resumeService.uploadAndAnalyzePdf();
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
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

