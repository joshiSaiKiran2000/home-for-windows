import { contextBridge, ipcRenderer } from 'electron';
import {
  AnswerResponse,
  AppSettings,
  AudioCaptureState,
  JobDescriptionData,
  ResumeData,
  ScreenSource,
  IPCResult
} from '../src/types';

const api = {
  // AI APIs
  generateAnswer: (params: { question: string }): Promise<IPCResult<AnswerResponse>> =>
    ipcRenderer.invoke('ai:generate-answer', params),

  analyzeJobDescription: (jdText: string): Promise<IPCResult<JobDescriptionData>> =>
    ipcRenderer.invoke('ai:analyze-jd', jdText),

  // Resume & Context APIs
  uploadResumePdf: (): Promise<IPCResult<ResumeData>> =>
    ipcRenderer.invoke('resume:upload-pdf'),

  getStoredResume: (): Promise<IPCResult<ResumeData | null>> =>
    ipcRenderer.invoke('resume:get-stored'),

  getStoredJobDescription: (): Promise<IPCResult<JobDescriptionData | null>> =>
    ipcRenderer.invoke('jd:get-stored'),

  saveJobDescription: (jd: JobDescriptionData): Promise<IPCResult<void>> =>
    ipcRenderer.invoke('jd:save', jd),

  clearContext: (): Promise<IPCResult<void>> =>
    ipcRenderer.invoke('context:clear'),

  // Screen Analysis APIs
  getScreenSources: (): Promise<IPCResult<ScreenSource[]>> =>
    ipcRenderer.invoke('screen:get-sources'),

  captureAndAnalyzeScreen: (sourceId?: string): Promise<IPCResult<AnswerResponse>> =>
    ipcRenderer.invoke('screen:capture-analyze', sourceId),

  // Audio APIs
  processAudioChunk: (
    audioBase64: string,
    mimeType: string
  ): Promise<IPCResult<{ detectedQuestion?: string; answer?: AnswerResponse }>> =>
    ipcRenderer.invoke('audio:process-chunk', audioBase64, mimeType),

  // Window & Overlay Controls
  toggleOverlay: (): Promise<void> => ipcRenderer.invoke('window:toggle-overlay'),
  showOverlay: (): Promise<void> => ipcRenderer.invoke('window:show-overlay'),
  hideOverlay: (): Promise<void> => ipcRenderer.invoke('window:hide-overlay'),
  showDashboard: (): Promise<void> => ipcRenderer.invoke('window:show-dashboard'),
  setOverlayOpacity: (opacity: number): Promise<void> =>
    ipcRenderer.invoke('window:set-opacity', opacity),
  setOverlayCompact: (compact: boolean): Promise<void> =>
    ipcRenderer.invoke('window:set-compact', compact),
  setOverlayMinimized: (minimized: boolean): Promise<void> =>
    ipcRenderer.invoke('window:set-overlay-minimized', minimized),
  moveOverlayBy: (dx: number, dy: number): Promise<void> =>
    ipcRenderer.invoke('window:move-overlay-by', dx, dy),
  resizeOverlayBy: (dw: number, dh: number): Promise<void> =>
    ipcRenderer.invoke('window:resize-overlay-by', dw, dh),
  setOverlaySize: (width: number, height: number): Promise<void> =>
    ipcRenderer.invoke('window:set-overlay-size', width, height),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  setContentProtection: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('window:set-content-protection', enabled),

  // Settings
  getSettings: (): Promise<IPCResult<AppSettings>> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Partial<AppSettings>): Promise<IPCResult<AppSettings>> =>
    ipcRenderer.invoke('settings:save', settings),

  // Event Subscriptions
  onNewAnswer: (callback: (answer: AnswerResponse) => void) => {
    const handler = (_event: any, answer: AnswerResponse) => callback(answer);
    ipcRenderer.on('app:new-answer', handler);
    return () => {
      ipcRenderer.removeListener('app:new-answer', handler);
    };
  },

  onAudioStatusUpdate: (callback: (status: AudioCaptureState) => void) => {
    const handler = (_event: any, status: AudioCaptureState) => callback(status);
    ipcRenderer.on('app:audio-status', handler);
    return () => {
      ipcRenderer.removeListener('app:audio-status', handler);
    };
  },

  onOverlayModeChange: (callback: (isCompact: boolean) => void) => {
    const handler = (_event: any, isCompact: boolean) => callback(isCompact);
    ipcRenderer.on('app:overlay-mode-change', handler);
    return () => {
      ipcRenderer.removeListener('app:overlay-mode-change', handler);
    };
  },

  onOverlayMinimizedChange: (callback: (isMinimized: boolean) => void) => {
    const handler = (_event: any, isMinimized: boolean) => callback(isMinimized);
    ipcRenderer.on('app:overlay-minimized-change', handler);
    return () => {
      ipcRenderer.removeListener('app:overlay-minimized-change', handler);
    };
  },

  onOverlayOpacityChange: (callback: (opacity: number) => void) => {
    const handler = (_event: any, opacity: number) => callback(opacity);
    ipcRenderer.on('app:overlay-opacity-change', handler);
    return () => {
      ipcRenderer.removeListener('app:overlay-opacity-change', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

