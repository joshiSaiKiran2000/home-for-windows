import { GoogleGenerativeAI } from '@google/generative-ai';
import { storageService } from './storage.service';
import { AnswerResponse, JobDescriptionData, ResumeData } from '../../src/types';

export const SYSTEM_INSTRUCTION = `You are my personal technical interview assistant.

Your job is to help me understand interview questions and prepare natural, confident answers.

ANSWER STYLE:

- Use simple, conversational English.
- Make answers sound like a real developer speaking in an interview.
- Avoid complicated vocabulary.
- Keep answers concise and clear.
- Prefer first-person responses for experience-based questions.
- Never invent projects, responsibilities or experience.
- Use my actual resume when answering experience-related questions.
- Connect answers to the job description when relevant.

TECHNICAL QUESTIONS:

- Start with a simple definition.
- Explain how it works.
- Give a practical example.
- Explain where it is used in real projects.

CODING QUESTIONS:

- Always prioritize beginner-friendly solutions.
- Use simple JavaScript code.
- Prefer for loops, forEach, if/else, basic functions and simple array methods.
- Avoid advanced shortcuts and unnecessarily complex methods.
- Avoid Set, Map, reduce and complex one-line solutions when a simpler approach exists.
- Write code that a beginner can understand and explain.
- Explain the code step by step.
- Include expected output.
- Include time and space complexity when relevant.
- If multiple solutions exist, show the easiest readable solution first.

PROJECT QUESTIONS:

- Use projects from my resume.
- Explain my actual responsibilities.
- Do not claim experience that I do not have.

IMPORTANT:

Make every answer accurate, natural, simple, practical and easy to explain in an interview.`;

export class GeminiService {
  private getClient(apiKey?: string): GoogleGenerativeAI {
    const key = apiKey || storageService.getSettings().geminiApiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('Gemini API key is missing. Please set your API key in Settings.');
    }
    return new GoogleGenerativeAI(key);
  }

  private getModelName(): string {
    const settings = storageService.getSettings();
    const model = settings.geminiModel;
    if (
      !model ||
      model === 'gemini-1.5-flash' ||
      model === 'gemini-2.0-flash' ||
      model === 'gemini-1.5-pro'
    ) {
      return 'gemini-2.5-flash';
    }
    return model;
  }

  /**
   * Generate an interview answer based on Question, Resume, and Job Description.
   */
  async generateInterviewAnswer(params: {
    question: string;
    source?: 'manual' | 'audio' | 'screen';
  }): Promise<AnswerResponse> {
    const ai = this.getClient();
    const model = ai.getGenerativeModel({
      model: this.getModelName(),
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const resume = storageService.getResume();
    const jd = storageService.getJobDescription();

    const promptContext = [
      '### CANDIDATE CONTEXT:',
      resume
        ? `RESUME DETAILS:\nName: ${resume.name || 'Candidate'}\nTechnical Skills: ${resume.skills.join(', ')}\nLanguages: ${resume.languages.join(', ')}\nFrameworks: ${resume.frameworks.join(', ')}\nWork Experience:\n${JSON.stringify(resume.experience, null, 2)}\nProjects:\n${JSON.stringify(resume.projects, null, 2)}`
        : 'RESUME: (No resume provided yet. Answer generally but stay beginner-friendly and realistic.)',
      '',
      jd
        ? `JOB DESCRIPTION CONTEXT:\nRequired Skills: ${jd.requiredSkills.join(', ')}\nResponsibilities: ${jd.responsibilities.join('; ')}\nTools: ${jd.toolsAndTech.join(', ')}`
        : 'JOB DESCRIPTION: (None specified)',
      '',
      `### INTERVIEW QUESTION:`,
      `"${params.question}"`,
      '',
      'Provide your response following all SYSTEM INSTRUCTIONS. Keep it direct, natural, conversational, and practical.'
    ].join('\n');

    const result = await model.generateContent(promptContext);
    const responseText = result.response.text();

    const isCoding =
      params.question.toLowerCase().includes('write code') ||
      params.question.toLowerCase().includes('function') ||
      params.question.toLowerCase().includes('algorithm') ||
      params.question.toLowerCase().includes('implement') ||
      responseText.includes('```javascript') ||
      responseText.includes('```js');

    return {
      id: 'ans-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      question: params.question,
      answer: responseText,
      source: params.source || 'manual',
      timestamp: Date.now(),
      isCodingQuestion: isCoding,
    };
  }

  /**
   * Analyze extracted resume text to extract structured information.
   */
  async analyzeResumeText(rawText: string): Promise<Partial<ResumeData>> {
    const ai = this.getClient();
    const model = ai.getGenerativeModel({
      model: this.getModelName(),
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `You are a resume analysis expert.
Extract all key details from the candidate resume text below.
DO NOT invent or assume skills, projects, or experience that are not explicitly present in the text.

RESUME TEXT:
"""
${rawText}
"""

Return valid JSON with exactly this structure:
{
  "name": "Candidate Name if found, otherwise empty string",
  "skills": ["Skill 1", "Skill 2"],
  "languages": ["Language 1", "Language 2"],
  "frameworks": ["Framework 1", "Framework 2"],
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Role",
      "duration": "Duration e.g. 2021-2023",
      "responsibilities": ["Responsibility 1", "Responsibility 2"]
    }
  ],
  "projects": [
    {
      "title": "Project Title",
      "techStack": ["Tech 1", "Tech 2"],
      "description": "Brief description of the project"
    }
  ],
  "education": [
    {
      "degree": "Degree e.g. B.Tech Computer Science",
      "school": "Institution Name",
      "year": "Graduation Year"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text();
    const parsed = JSON.parse(jsonStr);
    return parsed;
  }

  /**
   * Analyze a job description and compare with candidate resume.
   */
  async analyzeJobDescriptionText(
    jdText: string,
    resume: ResumeData | null
  ): Promise<JobDescriptionData> {
    const ai = this.getClient();
    const model = ai.getGenerativeModel({
      model: this.getModelName(),
      generationConfig: { responseMimeType: 'application/json' },
    });

    const resumeSummary = resume
      ? `Candidate Skills: ${[...resume.skills, ...resume.languages, ...resume.frameworks].join(', ')}\nExperience Summary: ${resume.experience.map(e => e.role + ' at ' + e.company).join(', ')}`
      : 'No candidate resume available.';

    const prompt = `You are an expert technical recruiter and interview coach.
Analyze the following job description and compare it against the candidate resume.

JOB DESCRIPTION:
"""
${jdText}
"""

CANDIDATE RESUME SUMMARY:
"""
${resumeSummary}
"""

Return valid JSON with exactly this structure:
{
  "requiredSkills": ["Skill 1", "Skill 2"],
  "preferredSkills": ["Skill 1", "Skill 2"],
  "responsibilities": ["Responsibility 1", "Responsibility 2"],
  "requiredExperience": "Years or description of experience required",
  "toolsAndTech": ["Tool 1", "Tool 2"],
  "keywords": ["Keyword 1", "Keyword 2"],
  "matchingSkills": ["Skills present in both JD and Candidate Resume"],
  "missingSkills": ["Required or preferred JD skills not mentioned in the Candidate Resume"]
}`;

    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text();
    const parsed = JSON.parse(jsonStr);

    return {
      rawText: jdText,
      requiredSkills: parsed.requiredSkills || [],
      preferredSkills: parsed.preferredSkills || [],
      responsibilities: parsed.responsibilities || [],
      requiredExperience: parsed.requiredExperience || '',
      toolsAndTech: parsed.toolsAndTech || [],
      keywords: parsed.keywords || [],
      matchingSkills: parsed.matchingSkills || [],
      missingSkills: parsed.missingSkills || [],
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Analyze a screen image/capture for coding questions or interview problems.
   */
  async analyzeScreenImage(base64Image: string, mimeType: string = 'image/png'): Promise<AnswerResponse> {
    const ai = this.getClient();
    const model = ai.getGenerativeModel({
      model: this.getModelName(),
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = `Analyze this screen capture from an interview or technical session.
1. Check if there is a coding challenge, algorithm problem, programming question, or technical test on screen.
2. If there IS a coding problem or question:
   - Identify the exact problem statement.
   - Provide a beginner-friendly, clean JavaScript solution.
   - Use simple loops (for, while, if/else, basic functions). Avoid complex one-liners, Set, Map, or reduce when a simple loop works.
   - Explain the code step-by-step.
   - Include expected output and time/space complexity.
3. If there is an error message, stack trace or bug:
   - Explain the cause in simple English and give the direct fix.
4. If there is NO coding problem on the screen:
   - Clearly summarize what is on the screen instead of inventing a question.
Keep the answer natural, practical, and interview-ready.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);

    const responseText = result.response.text();
    const isCoding =
      responseText.includes('```javascript') ||
      responseText.includes('```js') ||
      responseText.toLowerCase().includes('function') ||
      responseText.toLowerCase().includes('algorithm');

    return {
      id: 'screen-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      question: 'Screen Analysis / Code Problem',
      answer: responseText,
      source: 'screen',
      timestamp: Date.now(),
      isCodingQuestion: isCoding,
    };
  }

  /**
   * Process meeting audio chunk: transcribe and detect interview questions.
   */
  async processAudioChunk(
    base64Audio: string,
    mimeType: string
  ): Promise<{ detectedQuestion?: string; answer?: AnswerResponse }> {
    const ai = this.getClient();
    const model = ai.getGenerativeModel({
      model: this.getModelName(),
    });

    const prompt = `You are monitoring meeting audio for an interview candidate.
Analyze the audio in this recording.
Task 1: Transcribe the speech accurately.
Task 2: Determine if an interviewer is asking an interview question, technical question, behavioural question, or prompt directed at the candidate.
Task 3: If an actual question is asked, extract the exact question cleanly.
Task 4: If it is just casual chatter, background noise, or candidate speaking, do NOT treat it as a question.

Return JSON in this exact structure:
{
  "transcription": "Transcribed text",
  "isQuestion": true or false,
  "detectedQuestion": "The clean question if isQuestion is true, otherwise empty string"
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Audio,
          mimeType: mimeType || 'audio/webm',
        },
      },
    ]);

    let parsed: { transcription?: string; isQuestion?: boolean; detectedQuestion?: string } = {};
    try {
      const text = result.response.text().trim();
      // Remove any markdown code fence if wrapped
      const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      parsed = JSON.parse(cleaned);
    } catch {
      return {};
    }

    if (parsed.isQuestion && parsed.detectedQuestion && parsed.detectedQuestion.length > 5) {
      const answer = await this.generateInterviewAnswer({
        question: parsed.detectedQuestion,
        source: 'audio',
      });
      return {
        detectedQuestion: parsed.detectedQuestion,
        answer,
      };
    }

    return {
      detectedQuestion: parsed.transcription ? `(Transcribed: "${parsed.transcription}")` : undefined,
    };
  }

  /**
   * Evaluates text transcribed by Deepgram to detect if an interviewer asked a question directed at candidate.
   * If yes, generates a live personalized answer.
   */
  async evaluateTranscribedQuestion(
    transcript: string
  ): Promise<{ detectedQuestion?: string; answer?: AnswerResponse }> {
    if (!transcript || transcript.trim().length < 5) {
      return {};
    }

    const ai = this.getClient();
    const model = ai.getGenerativeModel({
      model: this.getModelName(),
    });

    const prompt = `You are an AI assistant for a candidate during a live job interview or technical meeting.
Here is speech transcribed from the meeting:
"${transcript}"

Task 1: Determine if an interviewer is asking an interview question, coding challenge, technical question, or behavioural prompt directed at the candidate.
Task 2: If YES, extract and clean up the exact question being asked.
Task 3: If NO (e.g. casual small talk, greeting, background noise, or candidate answering), set isQuestion to false.

Return JSON in this exact structure:
{
  "isQuestion": true or false,
  "detectedQuestion": "The clean question if isQuestion is true, otherwise empty string"
}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleaned);

      if (parsed.isQuestion && parsed.detectedQuestion && parsed.detectedQuestion.length > 5) {
        const answer = await this.generateInterviewAnswer({
          question: parsed.detectedQuestion,
          source: 'audio',
        });
        return {
          detectedQuestion: parsed.detectedQuestion,
          answer,
        };
      }

      return {
        detectedQuestion: `(Deepgram: "${transcript}")`,
      };
    } catch {
      return {
        detectedQuestion: `(Deepgram: "${transcript}")`,
      };
    }
  }
}

export const geminiService = new GeminiService();

