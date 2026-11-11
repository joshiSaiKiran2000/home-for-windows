import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppSettings, JobDescriptionData, ResumeData } from '../../src/types';

export class StorageService {
  private dataDir: string;
  private resumeFile: string;
  private jdFile: string;
  private settingsFile: string;

  constructor() {
    try {
      this.dataDir = (app && typeof app.getPath === 'function')
        ? path.join(app.getPath('userData'), 'data')
        : path.join(process.cwd(), '.local-data');
    } catch {
      // Fallback if app is not yet ready or in test
      this.dataDir = path.join(process.cwd(), '.local-data');
    }

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.resumeFile = path.join(this.dataDir, 'resume.json');
    this.jdFile = path.join(this.dataDir, 'job_description.json');
    this.settingsFile = path.join(this.dataDir, 'settings.json');
  }

  getResume(): ResumeData | null {
    try {
      if (fs.existsSync(this.resumeFile)) {
        const raw = fs.readFileSync(this.resumeFile, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading resume.json:', err);
    }
    return null;
  }

  saveResume(data: ResumeData): void {
    try {
      fs.writeFileSync(this.resumeFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving resume.json:', err);
    }
  }

  getJobDescription(): JobDescriptionData | null {
    try {
      if (fs.existsSync(this.jdFile)) {
        const raw = fs.readFileSync(this.jdFile, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading job_description.json:', err);
    }
    return null;
  }

  saveJobDescription(data: JobDescriptionData): void {
    try {
      fs.writeFileSync(this.jdFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving job_description.json:', err);
    }
  }

  clearContext(): void {
    try {
      if (fs.existsSync(this.resumeFile)) {
        fs.unlinkSync(this.resumeFile);
      }
      if (fs.existsSync(this.jdFile)) {
        fs.unlinkSync(this.jdFile);
      }
    } catch (err) {
      console.error('Error clearing context:', err);
    }
  }

  getSettings(): AppSettings {
    const defaultSettings: AppSettings = {
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      geminiModel: 'gemini-2.5-flash',
      deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
      sttProvider: 'deepgram',
      alwaysOnTop: true,
      compactMode: false,
      opacity: 0.95,
      shortcut: 'CommandOrControl+Shift+Space'
    };

    try {
      if (fs.existsSync(this.settingsFile)) {
        const raw = fs.readFileSync(this.settingsFile, 'utf-8');
        const parsed = JSON.parse(raw);
        const settings: AppSettings = { ...defaultSettings, ...parsed };
        // Automatically migrate deprecated model names to current active stable model
        if (
          !settings.geminiModel ||
          settings.geminiModel === 'gemini-1.5-flash' ||
          settings.geminiModel === 'gemini-2.0-flash' ||
          settings.geminiModel === 'gemini-1.5-pro'
        ) {
          settings.geminiModel = 'gemini-2.5-flash';
        }
        return settings;
      }
    } catch (err) {
      console.error('Error reading settings.json:', err);
    }

    return defaultSettings;
  }

  saveSettings(partial: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...partial };
    try {
      fs.writeFileSync(this.settingsFile, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving settings.json:', err);
    }
    return updated;
  }
}

export const storageService = new StorageService();

