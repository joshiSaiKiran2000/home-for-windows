export interface ResumeData {
  rawText: string;
  name?: string;
  skills: string[];
  languages: string[];
  frameworks: string[];
  experience: Array<{
    company: string;
    role: string;
    duration?: string;
    responsibilities: string[];
  }>;
  projects: Array<{
    title: string;
    techStack?: string[];
    description: string;
  }>;
  education: Array<{
    degree: string;
    school: string;
    year?: string;
  }>;
  analyzedAt?: string;
}

export interface JobDescriptionData {
  rawText: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  requiredExperience?: string;
  toolsAndTech: string[];
  keywords: string[];
  matchingSkills: string[];
  missingSkills: string[];
  analyzedAt?: string;
}

export interface AnswerResponse {
  id: string;
  question: string;
  answer: string;
  source: 'manual' | 'audio' | 'screen';
  timestamp: number;
  isCodingQuestion?: boolean;
}

export interface AppSettings {
  geminiApiKey: string;
  geminiModel: string;
  alwaysOnTop: boolean;
  compactMode: boolean;
  opacity: number;
  shortcut: string;
}

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
}

export interface AudioCaptureState {
  isListening: boolean;
  lastTranscript?: string;
  lastDetectedQuestion?: string;
  status: 'idle' | 'listening' | 'processing' | 'error';
  errorMessage?: string;
}

export interface IPCResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Window Electron API exposed through contextBridge
export interface ElectronAPI {
  // AI APIs
  generateAnswer: (params: { question: string }) => Promise<IPCResult<AnswerResponse>>;
  analyzeJobDescription: (jdText: string) => Promise<IPCResult<JobDescriptionData>>;
  
  // Resume APIs
  uploadResumePdf: () => Promise<IPCResult<ResumeData>>;
  getStoredResume: () => Promise<IPCResult<ResumeData | null>>;
  getStoredJobDescription: () => Promise<IPCResult<JobDescriptionData | null>>;
  saveJobDescription: (jd: JobDescriptionData) => Promise<IPCResult<void>>;
  clearContext: () => Promise<IPCResult<void>>;

  // Screen APIs
  getScreenSources: () => Promise<IPCResult<ScreenSource[]>>;
  captureAndAnalyzeScreen: (sourceId?: string) => Promise<IPCResult<AnswerResponse>>;

  // Audio APIs
  processAudioChunk: (audioBase64: string, mimeType: string) => Promise<IPCResult<{ detectedQuestion?: string; answer?: AnswerResponse }>>;

  // Window & Overlay Controls
  toggleOverlay: () => Promise<void>;
  showOverlay: () => Promise<void>;
  hideOverlay: () => Promise<void>;
  showDashboard: () => Promise<void>;
  setOverlayOpacity: (opacity: number) => Promise<void>;
  setOverlayCompact: (compact: boolean) => Promise<void>;
  setOverlayMinimized: (minimized: boolean) => Promise<void>;
  moveOverlayBy: (dx: number, dy: number) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // Settings APIs
  getSettings: () => Promise<IPCResult<AppSettings>>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<IPCResult<AppSettings>>;

  // Event Listeners from Main to Renderer
  onNewAnswer: (callback: (answer: AnswerResponse) => void) => () => void;
  onAudioStatusUpdate: (callback: (status: AudioCaptureState) => void) => () => void;
  onOverlayModeChange: (callback: (isCompact: boolean) => void) => () => void;
  onOverlayMinimizedChange: (callback: (isMinimized: boolean) => void) => () => void;
  onOverlayOpacityChange: (callback: (opacity: number) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

