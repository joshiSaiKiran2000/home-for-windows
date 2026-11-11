import fs from 'fs';
import { dialog } from 'electron';
import pdfParse from 'pdf-parse';
import { geminiService } from './gemini.service';
import { storageService } from './storage.service';
import { ResumeData } from '../../src/types';

export class ResumeService {
  /**
   * Prompts user to pick a PDF file, extracts text, analyzes with Gemini, and saves locally.
   */
  async uploadAndAnalyzePdf(): Promise<ResumeData> {
    const dialogResult = await dialog.showOpenDialog({
      title: 'Select Resume PDF',
      properties: ['openFile'],
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    });

    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      throw new Error('PDF selection was canceled.');
    }

    const filePath = dialogResult.filePaths[0];
    const dataBuffer = fs.readFileSync(filePath);

    // Parse PDF text
    const parsedPdf = await pdfParse(dataBuffer);
    const rawText = parsedPdf.text ? parsedPdf.text.trim() : '';

    if (!rawText || rawText.length < 20) {
      throw new Error('Unable to extract text from PDF. The file might be empty, scanned image-only, or corrupted.');
    }

    // Analyze with Gemini
    const analysis = await geminiService.analyzeResumeText(rawText);

    const resumeData: ResumeData = {
      rawText,
      name: analysis.name || '',
      skills: Array.isArray(analysis.skills) ? analysis.skills : [],
      languages: Array.isArray(analysis.languages) ? analysis.languages : [],
      frameworks: Array.isArray(analysis.frameworks) ? analysis.frameworks : [],
      experience: Array.isArray(analysis.experience) ? analysis.experience : [],
      projects: Array.isArray(analysis.projects) ? analysis.projects : [],
      education: Array.isArray(analysis.education) ? analysis.education : [],
      analyzedAt: new Date().toISOString(),
    };

    // Store locally
    storageService.saveResume(resumeData);

    return resumeData;
  }
}

export const resumeService = new ResumeService();

