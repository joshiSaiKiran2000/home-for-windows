import { ipcMain } from 'electron';
import { screenService } from '../services/screen.service';
import { broadcastToAllWindows } from '../main';

export function registerScreenIpc(): void {
  ipcMain.handle('screen:get-sources', async () => {
    try {
      const sources = await screenService.getScreenSources();
      return { success: true, data: sources };
    } catch (err: any) {
      console.error('Error getting screen sources:', err);
      return { success: false, error: err.message || 'Failed to list screen capture sources.' };
    }
  });

  ipcMain.handle('screen:capture-analyze', async (_event, sourceId?: string) => {
    try {
      const answer = await screenService.captureAndAnalyze(sourceId);
      broadcastToAllWindows('app:new-answer', answer);
      return { success: true, data: answer };
    } catch (err: any) {
      console.error('Error analyzing screen:', err);
      return { success: false, error: err.message || 'Failed to capture or analyze screen.' };
    }
  });

  ipcMain.handle('screen:quick-capture', async () => {
    try {
      broadcastToAllWindows('app:screen-analyzing');
      const answer = await screenService.captureAndAnalyze();
      broadcastToAllWindows('app:new-answer', answer);
      return { success: true, data: answer };
    } catch (err: any) {
      console.error('Error analyzing screen via quick capture:', err);
      broadcastToAllWindows('app:screen-error', err.message || 'Failed to capture or analyze screen.');
      return { success: false, error: err.message || 'Failed to capture or analyze screen.' };
    }
  });
}

