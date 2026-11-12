import { desktopCapturer, screen } from 'electron';
import { geminiService } from './gemini.service';
import { AnswerResponse, ScreenSource } from '../../src/types';

export class ScreenService {
  /**
   * Identifies the current active display based on mouse cursor position.
   */
  private getCurrentDisplay(): Electron.Display {
    try {
      const cursorPoint = screen.getCursorScreenPoint();
      if (cursorPoint) {
        const display = screen.getDisplayNearestPoint(cursorPoint);
        if (display) return display;
      }
    } catch (err) {
      console.warn('Failed to get display at cursor point:', err);
    }
    return screen.getPrimaryDisplay();
  }

  /**
   * Matches the current display to its corresponding DesktopCapturerSource.
   */
  private findCurrentScreenSource(
    screenSources: Electron.DesktopCapturerSource[],
    currentDisplay: Electron.Display
  ): Electron.DesktopCapturerSource | undefined {
    if (!screenSources || screenSources.length === 0) return undefined;
    if (screenSources.length === 1) return screenSources[0];

    const currentDisplayIdStr = String(currentDisplay.id);

    // 1. Try matching by display_id property
    const byDisplayId = screenSources.find(
      s => s.display_id && String(s.display_id) === currentDisplayIdStr
    );
    if (byDisplayId) return byDisplayId;

    // 2. Try matching by id string (e.g. screen:12345:0)
    const byId = screenSources.find(
      s => s.id === `screen:${currentDisplayIdStr}:0` || s.id.includes(`:${currentDisplayIdStr}:`)
    );
    if (byId) return byId;

    // 3. Try matching display index in getAllDisplays()
    try {
      const allDisplays = screen.getAllDisplays();
      const displayIndex = allDisplays.findIndex(d => String(d.id) === currentDisplayIdStr);
      if (displayIndex >= 0 && screenSources[displayIndex]) {
        return screenSources[displayIndex];
      }
    } catch {
      // ignore
    }

    // 4. Fallback: if current display is primary display
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      if (String(currentDisplay.id) === String(primaryDisplay.id)) {
        const primarySource = screenSources.find(
          s => s.name.toLowerCase().includes('entire') || s.id.endsWith(':0:0')
        );
        if (primarySource) return primarySource;
      }
    } catch {
      // ignore
    }

    return screenSources[0];
  }

  /**
   * Retrieves available screens and windows for the user to choose from.
   * Only includes the current screen instead of all connected screens.
   */
  async getScreenSources(): Promise<ScreenSource[]> {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });

    const currentDisplay = this.getCurrentDisplay();
    const screenSources = sources.filter(s => s.id.startsWith('screen:'));
    const windowSources = sources.filter(s => !s.id.startsWith('screen:'));

    const currentScreen = this.findCurrentScreenSource(screenSources, currentDisplay);

    const result: ScreenSource[] = [];

    // ONLY display the current screen (filters out all other secondary/external screens)
    if (currentScreen) {
      result.push({
        id: currentScreen.id,
        name: `Current Screen (${currentDisplay.bounds.width}×${currentDisplay.bounds.height})`,
        thumbnail: currentScreen.thumbnail.toDataURL(),
      });
    }

    // Append open windows (excluding the assistant app itself)
    for (const win of windowSources) {
      if (win.name === 'Host Process for Windows Services' || win.name === 'Host Process') {
        continue;
      }
      result.push({
        id: win.id,
        name: win.name,
        thumbnail: win.thumbnail.toDataURL(),
      });
    }

    return result;
  }

  /**
   * Captures the selected screen or window at high quality and sends to Gemini for analysis.
   */
  async captureAndAnalyze(sourceId?: string): Promise<AnswerResponse> {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    const currentDisplay = this.getCurrentDisplay();
    const screenSources = sources.filter(s => s.id.startsWith('screen:'));
    const currentScreen = this.findCurrentScreenSource(screenSources, currentDisplay);

    let targetSource = currentScreen || sources[0];
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

