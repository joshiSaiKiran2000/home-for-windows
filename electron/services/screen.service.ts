import { desktopCapturer } from 'electron';
import { geminiService } from './gemini.service';
import { AnswerResponse, ScreenSource } from '../../src/types';

export class ScreenService {
  /**
   * Retrieves available screens and windows for the user to choose from.
   */
  async getScreenSources(): Promise<ScreenSource[]> {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });

    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  }

  /**
   * Captures the selected screen or window at high quality and sends to Gemini for analysis.
   */
  async captureAndAnalyze(sourceId?: string): Promise<AnswerResponse> {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    let targetSource = sources[0];
    if (sourceId) {
      const found = sources.find(s => s.id === sourceId);
      if (found) targetSource = found;
    }

    if (!targetSource) {
      throw new Error('No display or window source available for capture.');
    }

    const jpegBuffer = targetSource.thumbnail.toJPEG(85);
    const base64Data = jpegBuffer.toString('base64');

    return await geminiService.analyzeScreenImage(base64Data, 'image/jpeg');
  }
}

export const screenService = new ScreenService();

