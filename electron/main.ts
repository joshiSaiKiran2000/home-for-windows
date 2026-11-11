import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
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

  mainWindow.on('minimize', (event: any) => {
    // Hide main window from taskbar when minimized if overlay is active
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function createOverlayWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  const overlayWidth = 460;
  const overlayHeight = 600;
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
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    hasShadow: false,
    title: '',
    opacity: settings.opacity ?? 0.96,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Always keep on top across all apps
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

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
    overlayWindow.focus();
  }
}

// Overlay bounds memory for minimize/expand
let lastOverlayBounds = { width: 460, height: 600, x: 0, y: 0 };

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
      overlayWindow.focus();
    }
  });

  ipcMain.handle('window:hide-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.hide();
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

        overlayWindow.setBounds({
          x: Math.max(0, newX),
          y: Math.max(0, newY),
          width: targetW,
          height: targetH,
        });
        broadcastToAllWindows('app:overlay-minimized-change', true);
      } else {
        const targetW = lastOverlayBounds.width >= 360 ? lastOverlayBounds.width : 460;
        const targetH = lastOverlayBounds.height >= 240 ? lastOverlayBounds.height : 600;
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

        overlayWindow.setBounds({
          x: finalX,
          y: finalY,
          width: targetW,
          height: targetH,
        });
        broadcastToAllWindows('app:overlay-minimized-change', false);
      }
    }
  });

  ipcMain.handle('window:move-overlay-by', (_event, dx: number, dy: number) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition();
      overlayWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
    }
  });

  ipcMain.handle('window:set-opacity', (_event, opacity: number) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const clamped = Math.max(0.3, Math.min(1.0, opacity));
      overlayWindow.setOpacity(clamped);
      storageService.saveSettings({ opacity: clamped });
    }
  });

  ipcMain.handle('window:set-compact', (_event, compact: boolean) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [w] = overlayWindow.getSize();
      if (compact) {
        overlayWindow.setSize(w, 240);
      } else {
        overlayWindow.setSize(w, 600);
      }
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
        win.hide();
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
        if (updated.opacity !== undefined) {
          overlayWindow.setOpacity(updated.opacity);
        }
        if (updated.alwaysOnTop !== undefined) {
          overlayWindow.setAlwaysOnTop(updated.alwaysOnTop, 'screen-saver');
        }
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

