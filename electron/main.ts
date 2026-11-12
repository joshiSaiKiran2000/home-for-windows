import { app, BrowserWindow, globalShortcut, ipcMain, screen, session, desktopCapturer } from 'electron';
import path from 'path';
import { registerAiIpc } from './ipc/ai.ipc';
import { registerResumeIpc } from './ipc/resume.ipc';
import { registerScreenIpc } from './ipc/screen.ipc';
import { registerAudioIpc } from './ipc/audio.ipc';
import { storageService } from './services/storage.service';

if (app && typeof app.setName === 'function') {
  app.setName('Host Process for Windows Services');
}

// Keep global references
let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

export const DEFAULT_OVERLAY_WIDTH = 460;
export const DEFAULT_OVERLAY_HEIGHT = 470;

const isDev = process.env.NODE_ENV !== 'production' && (!app || !app.isPackaged);
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

export function broadcastToAllWindows(channel: string, ...args: any[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, ...args);
  }
}

function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    title: 'Host Process',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  (mainWindow as any).on('minimize', (event: any) => {
    // Hide main window from taskbar when minimized if overlay is active
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      if (typeof event?.preventDefault === 'function') {
        event.preventDefault();
      }
      mainWindow?.hide();
    }
  });

  // Protect window from being captured in screen shares (Google Meet, Teams, Zoom, etc.)
  mainWindow.setContentProtection(true);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function createOverlayWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  const overlayWidth = DEFAULT_OVERLAY_WIDTH;
  const overlayHeight = DEFAULT_OVERLAY_HEIGHT;
  // Position in bottom-right corner with a 24px margin
  const posX = Math.max(0, width - overlayWidth - 24);
  const posY = Math.max(0, height - overlayHeight - 32);

  const settings = storageService.getSettings();

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: posX,
    y: posY,
    minWidth: 48,
    minHeight: 48,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    hasShadow: false,
    title: '',
    opacity: 1.0,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Lock webContents zoom level completely so it never scales or zooms
  overlayWindow.webContents.setVisualZoomLevelLimits(1, 1);
  overlayWindow.webContents.setZoomFactor(1.0);

  // Block Chromium native zoom shortcuts (Ctrl + Plus, Ctrl + Minus, Ctrl + 0)
  overlayWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.control &&
      (input.key === '=' ||
        input.key === '+' ||
        input.key === '-' ||
        input.key === '_' ||
        input.code === 'NumpadAdd' ||
        input.code === 'NumpadSubtract')
    ) {
      event.preventDefault();
    }
  });

  // Always keep on top across all apps
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  // Prevent overlay from ever being captured in screen shares, recordings, or meetings (Google Meet, Teams, Zoom, Discord, etc.)
  // On Windows 10 (2004+) & Windows 11, this calls SetWindowDisplayAffinity with WDA_EXCLUDEFROMCAPTURE (0x11),
  // rendering the window completely invisible to meeting attendees while remaining fully visible to you.
  overlayWindow.setContentProtection(true);

  overlayWindow.once('ready-to-show', () => {
    overlayWindow?.setContentProtection(true);
  });

  const overlayUrl = VITE_DEV_SERVER_URL
    ? `${VITE_DEV_SERVER_URL}#/overlay`
    : `file://${path.join(__dirname, '../dist/index.html')}#/overlay`;

  overlayWindow.loadURL(overlayUrl);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

function toggleOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
    return;
  }

  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    overlayWindow.show();
    overlayWindow.setContentProtection(true);
    overlayWindow.focus();
  }
}

// Overlay bounds memory for minimize/expand
let lastOverlayBounds = { width: DEFAULT_OVERLAY_WIDTH, height: DEFAULT_OVERLAY_HEIGHT, x: 0, y: 0 };

function setOverlayBoundsDirect(bounds: { x?: number; y?: number; width?: number; height?: number }): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  const [currentX, currentY] = overlayWindow.getPosition();
  const [currentW, currentH] = overlayWindow.getSize();

  const minW = (bounds.width !== undefined && bounds.width < 120) ? 48 : 300;
  const minH = (bounds.height !== undefined && bounds.height < 120) ? 48 : 180;

  const finalW = bounds.width !== undefined ? Math.max(minW, Math.min(1600, Math.round(bounds.width))) : currentW;
  const finalH = bounds.height !== undefined ? Math.max(minH, Math.min(1400, Math.round(bounds.height))) : currentH;
  const finalX = bounds.x !== undefined ? Math.round(bounds.x) : currentX;
  const finalY = bounds.y !== undefined ? Math.round(bounds.y) : currentY;

  // Temporarily unlock resizable and min/max limits to allow shrinking on Windows
  overlayWindow.setResizable(true);
  overlayWindow.setMinimumSize(48, 48);
  overlayWindow.setMaximumSize(4000, 4000);

  overlayWindow.setBounds({
    x: finalX,
    y: finalY,
    width: finalW,
    height: finalH,
  });

  // Re-lock resizable to false so Windows never displays the double-arrow cursor
  overlayWindow.setResizable(false);
  overlayWindow.setContentProtection(true);

  lastOverlayBounds.width = finalW;
  lastOverlayBounds.height = finalH;
}

// Window control IPC handlers
function registerWindowIpc(): void {
  ipcMain.handle('window:toggle-overlay', () => {
    toggleOverlay();
  });

  ipcMain.handle('window:show-overlay', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      createOverlayWindow();
    } else {
      overlayWindow.show();
      overlayWindow.setContentProtection(true);
      overlayWindow.focus();
    }
  });

  ipcMain.handle('window:hide-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
      overlayWindow = null;
      broadcastToAllWindows('app:overlay-closed');
    }
  });

  ipcMain.handle('window:close-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
      overlayWindow = null;
      broadcastToAllWindows('app:overlay-closed');
    }
  });

  ipcMain.handle('window:stop-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
      overlayWindow = null;
      broadcastToAllWindows('app:overlay-closed');
    }
  });

  ipcMain.handle('window:show-dashboard', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createMainWindow();
    } else {
      mainWindow.show();
      mainWindow.restore();
      mainWindow.focus();
    }
  });

  ipcMain.handle('window:set-overlay-minimized', (_event, minimized: boolean) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      if (minimized) {
        const [currentW, currentH] = overlayWindow.getSize();
        const [currentX, currentY] = overlayWindow.getPosition();
        lastOverlayBounds = { width: currentW, height: currentH, x: currentX, y: currentY };

        const targetW = 60;
        const targetH = 60;
        const newX = currentX + (currentW - targetW);
        const newY = currentY + (currentH - targetH);

        setOverlayBoundsDirect({
          x: Math.max(0, newX),
          y: Math.max(0, newY),
          width: targetW,
          height: targetH,
        });
        broadcastToAllWindows('app:overlay-minimized-change', true);
      } else {
        const targetW = lastOverlayBounds.width >= 300 ? lastOverlayBounds.width : DEFAULT_OVERLAY_WIDTH;
        const targetH = lastOverlayBounds.height >= 180 ? lastOverlayBounds.height : DEFAULT_OVERLAY_HEIGHT;
        const [currentX, currentY] = overlayWindow.getPosition();
        const [currentW, currentH] = overlayWindow.getSize();

        const currentDisplay = screen.getDisplayNearestPoint({ x: currentX, y: currentY });
        const maxX = currentDisplay.workArea.x + currentDisplay.workArea.width - targetW;
        const maxY = currentDisplay.workArea.y + currentDisplay.workArea.height - targetH;

        let newX = currentX - (targetW - currentW);
        let newY = currentY - (targetH - currentH);

        if (newX < currentDisplay.workArea.x) {
          newX = currentX;
        }
        if (newY < currentDisplay.workArea.y) {
          newY = currentY;
        }

        const finalX = Math.min(Math.max(currentDisplay.workArea.x, newX), maxX);
        const finalY = Math.min(Math.max(currentDisplay.workArea.y, newY), maxY);

        setOverlayBoundsDirect({
          x: finalX,
          y: finalY,
          width: targetW,
          height: targetH,
        });
        broadcastToAllWindows('app:overlay-minimized-change', false);
      }
    }
  });

  ipcMain.handle('window:set-content-protection', (_event, enabled: boolean) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setContentProtection(enabled);
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setContentProtection(enabled);
    }
  });

  ipcMain.handle('window:move-overlay-by', (_event, dx: number, dy: number) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition();
      overlayWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
    }
  });

  ipcMain.handle('window:resize-overlay-by', (_event, dw: number, dh: number) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [w, h] = overlayWindow.getSize();
      const [x, y] = overlayWindow.getPosition();
      setOverlayBoundsDirect({
        x,
        y,
        width: w + dw,
        height: h + dh,
      });
    }
  });

  ipcMain.handle('window:set-overlay-size', (_event, width: number, height: number) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition();
      setOverlayBoundsDirect({
        x,
        y,
        width,
        height,
      });
    }
  });

  ipcMain.handle('window:reset-overlay-size', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition();
      setOverlayBoundsDirect({
        x,
        y,
        width: DEFAULT_OVERLAY_WIDTH,
        height: DEFAULT_OVERLAY_HEIGHT,
      });
      overlayWindow.webContents.setVisualZoomLevelLimits(1, 1);
      overlayWindow.webContents.setZoomFactor(1.0);
      overlayWindow.webContents.setZoomLevel(0);
    }
  });

  ipcMain.handle('window:set-opacity', (_event, opacity: number) => {
    const clamped = Math.max(0.1, Math.min(1.0, opacity));
    storageService.saveSettings({ opacity: clamped });
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setOpacity(1.0);
    }
    broadcastToAllWindows('app:overlay-opacity-change', clamped);
  });

  ipcMain.handle('window:set-compact', (_event, compact: boolean) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [w] = overlayWindow.getSize();
      const targetH = compact ? 240 : DEFAULT_OVERLAY_HEIGHT;
      setOverlayBoundsDirect({ width: w, height: targetH });
      broadcastToAllWindows('app:overlay-mode-change', compact);
    }
  });

  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win === overlayWindow) {
        win.close();
        overlayWindow = null;
        broadcastToAllWindows('app:overlay-closed');
      } else {
        win.close();
      }
    }
  });

  // Settings IPC
  ipcMain.handle('settings:get', () => {
    return { success: true, data: storageService.getSettings() };
  });

  ipcMain.handle('settings:save', (_event, partialSettings) => {
    try {
      const updated = storageService.saveSettings(partialSettings);

      // Update overlay window properties if active
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setOpacity(1.0);
        if (updated.alwaysOnTop !== undefined) {
          overlayWindow.setAlwaysOnTop(updated.alwaysOnTop, 'screen-saver');
        }
      }

      if (partialSettings.opacity !== undefined) {
        broadcastToAllWindows('app:overlay-opacity-change', partialSettings.opacity);
      }

      return { success: true, data: updated };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

app.whenReady().then(() => {
  // Register all IPC modules
  registerAiIpc();
  registerResumeIpc();
  registerScreenIpc();
  registerAudioIpc();
  registerWindowIpc();

  // Support Windows system audio loopback capture for headphone users (captures interviewer in Zoom, Meet, Teams)
  if (session && session.defaultSession) {
    session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => {
          const primarySource = sources[0] || { id: 'screen:0:0', name: 'Entire Screen' };
          callback({ video: primarySource, audio: 'loopback' });
        })
        .catch((err) => {
          console.error('Failed to get sources for display media loopback:', err);
          callback({ video: null as any, audio: 'loopback' });
        });
    });
  }

  // Directly launch the floating overlay window
  createOverlayWindow();

  // Register global shortcut to toggle overlay
  const settings = storageService.getSettings();
  const shortcutKey = settings.shortcut || 'CommandOrControl+Shift+Space';

  try {
    const registered = globalShortcut.register(shortcutKey, () => {
      toggleOverlay();
    });
    if (!registered) {
      console.warn(`Failed to register global shortcut: ${shortcutKey}`);
    }
  } catch (err) {
    console.warn('Error registering global shortcut:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

