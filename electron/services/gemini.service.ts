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

- Directly output the clean, working JavaScript code solution inside a markdown code block (\`\`\`javascript ... \`\`\`).
- Do NOT include any comments (no inline comments, no step comments, no // comments, no /* */ comments) inside the code.
- Do NOT include example calls, test arrays, test cases, or console.log statements.
- Do NOT include conversational introductory filler, greetings, or concluding remarks before or after the code.
- Only provide the clean function or algorithm implementation.
- Always prioritize beginner-friendly solutions using simple loops (for, while, if/else, basic functions).
- Avoid advanced shortcuts, complex one-liners, Set, Map, or reduce when a simple loop works.
- Write pure, clean code that is ready to be pasted directly into a live coding test or technical interview editor.

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
   * Remove comments (both multi-line and single-line) and test execution blocks from code.
   */
  stripCommentsAndTests(code: string): string {
    // Remove multi-line comments /* ... */
    let cleaned = code.replace(/\/\*[\s\S]*?\*\//g, '');

    const lines = cleaned.split('\n');
    const filtered: string[] = [];
    let inTestSection = false;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      // Detect start of test section
      if (
        trimmed.toLowerCase().startsWith("// let's test") ||
        trimmed.toLowerCase().startsWith('// test') ||
        trimmed.toLowerCase().startsWith('// example') ||
        trimmed.toLowerCase().startsWith('// usage') ||
        trimmed.toLowerCase().startsWith('// sample') ||
        trimmed.toLowerCase().startsWith('// expected output')
      ) {
        inTestSection = true;
        continue;
      }

      if (inTestSection) {
        if (
          trimmed.startsWith('console.') ||
          trimmed.startsWith('const ') ||
          trimmed.startsWith('let ') ||
          trimmed.startsWith('var ') ||
          trimmed.startsWith('//') ||
          trimmed.length === 0 ||
          trimmed.endsWith(');')
        ) {
          continue;
        } else {
          if (
            trimmed.startsWith('function ') ||
            trimmed.startsWith('return ') ||
            trimmed.startsWith('export ') ||
            trimmed.startsWith('class ')
          ) {
            inTestSection = false;
          } else {
            continue;
          }
        }
      }

      // Skip standalone full-line comments
      if (trimmed.startsWith('//')) {
        continue;
      }

      // Skip standalone console logs
      if (
        trimmed.startsWith('console.log(') ||
        trimmed.startsWith('console.info(') ||
        trimmed.startsWith('console.warn(') ||
        trimmed.startsWith('console.error(') ||
        trimmed.startsWith('print(')
      ) {
        continue;
      }

      // Strip trailing inline comments (e.g. `return largest; // return result`)
      let lineContent = rawLine;
      const inlineCommentIndex = lineContent.indexOf(' //');
      if (inlineCommentIndex !== -1) {
        lineContent = lineContent.substring(0, inlineCommentIndex);
      }

      const semiCommentIndex = lineContent.indexOf(';//');
      if (semiCommentIndex !== -1) {
        lineContent = lineContent.substring(0, semiCommentIndex + 1);
      }

      filtered.push(lineContent);
    }

    return filtered
      .join('\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * For coding questions, extract code blocks, strip all comments and tests, and format directly.
   */
  cleanCodingSolution(text: string): string {
    const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
    const matches = [...text.matchAll(codeBlockRegex)];

    if (matches.length > 0) {
      const cleanedBlocks = matches.map(m => {
        const lang = m[1] || 'javascript';
        const cleaned = this.stripCommentsAndTests(m[2]);
        return '```' + lang + '\n' + cleaned + '\n```';
      });

      return cleanedBlocks.join('\n\n');
    }

    const cleaned = this.stripCommentsAndTests(text);
    return '```javascript\n' + cleaned + '\n```';
  }

  /**
   * Determine if a question is a coding question / challenge.
   */
  isCodingQuestion(question: string, responseText: string): boolean {
    const q = question.toLowerCase();

    const isExplanationOnly =
      (q.startsWith('explain ') || q.startsWith('what is ') || q.startsWith('what are ') || q.startsWith('difference between ')) &&
      !q.includes('write') &&
      !q.includes('implement') &&
      !q.includes('code');

    if (isExplanationOnly) {
      return false;
    }

    const codingKeywords = [
      'write code',
      'write a function',
      'function to',
      'write a program',
      'implement',
      'algorithm',
      'find largest',
      'find smallest',
      'find maximum',
      'find minimum',
      'reverse',
      'palindrome',
      'anagram',
      'fibonacci',
      'two sum',
      'debounce',
      'throttle',
      'flatten',
      'sort',
      'binary search',
      'linked list',
      'coding question'
    ];

    if (codingKeywords.some(kw => q.includes(kw))) {
      return true;
    }

    if (
      (q.includes('code') || q.includes('function') || q.includes('array') || q.includes('how to')) &&
      (responseText.includes('```javascript') || responseText.includes('```js') || responseText.includes('```typescript'))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Sanitize AI answer to ensure coding solutions are cleanly displayed without comments or test runs.
   */
  sanitizeAnswer(question: string, responseText: string): { isCoding: boolean; cleanedAnswer: string } {
    const isCoding = this.isCodingQuestion(question, responseText);
    if (isCoding) {
      return {
        isCoding: true,
        cleanedAnswer: this.cleanCodingSolution(responseText),
      };
    }

    const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
    const cleanedAnswer = responseText.replace(codeBlockRegex, (_match, lang, code) => {
      return '```' + (lang || 'javascript') + '\n' + this.stripCommentsAndTests(code) + '\n```';
    });

    return {
      isCoding: responseText.includes('```'),
      cleanedAnswer,
    };
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

    const isLikelyCoding =
      /write|function|algorithm|implement|code|program|solve|array|string|find|reverse|sort|duplicate|palindrome/i.test(params.question);

    const codingInstruction = isLikelyCoding
      ? '\nCRITICAL FOR CODING QUESTIONS: Directly provide ONLY the clean JavaScript code inside a markdown code block (```javascript ... ```). Do NOT include any comments (no // comments, no step comments) inside the code. Do NOT include test cases, example calls, or console.log statements. Do NOT include conversational pleasantries, introductory text, or concluding explanations.'
      : '';

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
      'Provide your response following all SYSTEM INSTRUCTIONS. Keep it direct, natural, conversational, and practical.' + codingInstruction
    ].join('\n');

    const result = await model.generateContent(promptContext);
    const responseText = result.response.text();

    const { isCoding, cleanedAnswer } = this.sanitizeAnswer(params.question, responseText);

    return {
      id: 'ans-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      question: params.question,
      answer: cleanedAnswer,
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
   - Directly provide the clean, beginner-friendly JavaScript code solution inside a markdown code block (\`\`\`javascript ... \`\`\`).
   - Do NOT include any comments (no inline comments, no step comments, no // comments) inside the code.
   - Do NOT include test cases, example arrays, or console.log statements.
   - Do NOT include conversational greetings or extra text before or after the code block.
   - Use simple loops (for, while, if/else, basic functions). Avoid complex one-liners, Set, Map, or reduce when a simple loop works.
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
    const { isCoding, cleanedAnswer } = this.sanitizeAnswer('Screen Analysis / Code Problem', responseText);

    return {
      id: 'screen-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      question: 'Screen Analysis / Code Problem',
      answer: cleanedAnswer,
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
    const trimmed = (transcript || '').trim();
    // Ignore empty or extremely short inputs
    if (!trimmed || trimmed.length < 10) {
      return {};
    }

    // Filter common filler and acknowledgments to avoid wasting Gemini tokens
    const lower = trimmed.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const commonFiller = [
      'yes', 'no', 'yeah', 'yep', 'nope', 'okay', 'ok', 'sure', 'alright',
      'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
      'thank you', 'thanks', 'cool', 'got it', 'i see', 'right', 'fine',
      'um', 'uh', 'hmm', 'can you hear me', 'am i audible', 'testing'
    ];

    if (commonFiller.includes(lower)) {
      return {
        detectedQuestion: `(Transcription: "${trimmed}")`,
      };
    }

    const words = lower.split(/\s+/);
    const questionStarters = [
      'what', 'why', 'how', 'explain', 'describe', 'tell', 'who', 'when',
      'where', 'can', 'could', 'would', 'is', 'are', 'do', 'does', 'write',
      'implement', 'walk', 'difference'
    ];
    const hasQuestionIndicator = trimmed.includes('?') || questionStarters.some(w => lower.includes(w));

    // If it's very short and contains no question indicators, it's casual chatter - don't waste tokens
    if (words.length < 4 && !hasQuestionIndicator) {
      return {
        detectedQuestion: `(Transcription: "${trimmed}")`,
      };
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

