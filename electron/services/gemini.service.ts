import { GoogleGenerativeAI } from '@google/generative-ai';
import { storageService } from './storage.service';
import { AnswerResponse, JobDescriptionData, ResumeData } from '../../src/types';

export const SYSTEM_INSTRUCTION = `You are my personal technical interview assistant.

Your goal is to give top-tier, practical, interview-ready answers tailored to the exact category of the question:

1. FOR INTEGRATION, SETUP, AND "HOW-TO" QUESTIONS (e.g. "How to integrate Firebase in React Native", "How to set up Redux", "How to connect MongoDB"):
- Provide a COMPLETE, practical, step-by-step integration guide. DO NOT give a vague 2-line summary or dummy empty config objects.
- Structure clearly:
  - Brief Overview: 1-2 sentences on what the integration accomplishes.
  - Step 1: Install Dependencies (exact CLI commands e.g. \`npm install @react-native-firebase/app @react-native-firebase/auth\`).
  - Step 2: Platform Configuration (Android \`google-services.json\` & build.gradle, iOS \`GoogleService-Info.plist\` & \`pod install\`, environment variables).
  - Step 3: Initialization & Setup (real, working code without dummy empty brackets \`const config = {};\`).
  - Step 4: Practical Usage Example (realistic component or service code showing real methods in action).
  - Step 5: Key Interview Talking Points (2-3 bullet points of best practices, caveats, or optimization tips to mention verbally).

2. FOR ALGORITHM & CODING CHALLENGES (e.g. "Find largest number in array", "Reverse a string", "Debounce function"):
- Directly output the simplest, most beginner-friendly JavaScript code.
- Declare a sample input variable at the top (e.g. \`let arr = [1, 4, 5, 67, 8, 9];\`).
- Use basic variables and simple loops (prefer for loops, while loops, if/else). Avoid complex one-liners, reduce, or advanced tricks when a simple loop works.
- End with a console.log showing the result and a comment with the answer (e.g. \`console.log(largest); // 67\`).
- No long introductory text, multi-step tutorials, or conversational pleasantries.

3. FOR SHORT CONCEPTUAL & DEFINITION QUESTIONS (e.g. "What is an object?", "What is an array?", "What is closure?"):
- Keep the definition to exactly 2 to 3 very simple sentences in plain everyday English:
  - Sentence 1: What it is used for in plain English.
  - Sentence 2: How it works simply.
  - Sentence 3: Why it helps or why we use it.
- Follow immediately with a short, simple practical code example (2 to 4 lines).
- Keep it concise, direct, and easy to speak out loud.

4. FOR BEHAVIORAL & RESUME QUESTIONS (e.g. "Tell me about yourself", "Tell me about a challenging project"):
- Speak in the first person ("In my previous experience...", "I built...").
- Ground the answer in the candidate's uploaded resume, skills, and projects when available.
- Use the STAR framework (Situation, Task, Action, Result) in a natural, conversational way.

GENERAL STYLE:
- Make every answer natural, practical, and easy to explain in an interview.
- Never use unnecessarily complicated vocabulary or empty placeholders like \`const config = {};\`.`;

export type QuestionCategory = 'integration' | 'algorithm' | 'concept' | 'behavioral' | 'general';

export function classifyQuestion(question: string): QuestionCategory {
  const q = (question || '').toLowerCase().trim();

  // 1. Integration / Setup / "How-to" / Implementation / Architecture Guide
  const integrationPatterns = [
    /\b(integrate|integration|integrating)\b/i,
    /\b(set\s*up|setup|configuring|configure|configuration)\b/i,
    /\b(install|installing|connect|connecting|connection)\b/i,
    /\b(deploy|deploying|deployment|pipeline|ci\/?cd|dockerize|docker)\b/i,
    /\b(architecture\s+of|lifecycle\s+of|flow\s+of|workflow\s+of)\b/i,
    /\b(steps\s+to|guide\s+to)\b/i,
    /^(how\s+to|how\s+do\s+i|how\s+can\s+i|how\s+would\s+you)\b/i,
  ];

  const hasIntegrationKeyword = integrationPatterns.some((pattern) => pattern.test(q));

  // 2. Pure Algorithm / Data Structure Coding Challenges
  const algoPatterns = [
    /\b(find\s+)?(largest|smallest|maximum|minimum)\b/i,
    /\b(reverse\s+(a\s+)?(string|array|linked\s*list|number|words|list))\b/i,
    /\b(palindrome|anagram|fibonacci|two\s*sum|three\s*sum|fizz\s*buzz)\b/i,
    /\b(debounce|throttle|currying|flatten\s+(array|object))\b/i,
    /\b(binary\s*search|linked\s*list|merge\s*sort|quick\s*sort|bubble\s*sort)\b/i,
    /\b(remove\s+duplicates|find\s+duplicate|missing\s+number)\b/i,
    /\b(valid\s+parentheses|roman\s+to\s+integer|climbing\s+stairs)\b/i,
    /^(write|implement|create)\s+(a\s+)?(function|program|algorithm|code)\s+to\b/i,
  ];

  const isAlgo = algoPatterns.some((pattern) => pattern.test(q));

  if (isAlgo && !hasIntegrationKeyword) {
    return 'algorithm';
  }

if (hasIntegrationKeyword) {
  return 'integration';
}

// 3. Behavioral / Resume / Experience Questions
const behavioralPatterns = [
  /\b(tell\s+me\s+about\s+yourself|introduce\s+yourself|walk\s+me\s+through\s+your\s+resume)\b/i,
  /\b(tell\s+me\s+about\s+a\s+(project|time|challenge|conflict|bug|failure|success))\b/i,
  /\b(what\s+was\s+your\s+role|your\s+responsibilities|experience\s+with)\b/i,
  /\b(strengths\s+and\s+weaknesses|why\s+should\s+we\s+hire\s+you)\b/i,
];

if (behavioralPatterns.some((pattern) => pattern.test(q))) {
  return 'behavioral';
}

// 4. Conceptual / Definition Questions
const conceptPatterns = [
  /^(what\s+is|what\s+are|what\s+do\s+you\s+mean\s+by)\b/i,
  /^(explain|describe|define)\b/i,
  /\b(difference\s+between|versus|vs\.?)\b/i,
  /\b(why\s+do\s+we\s+use|pros\s+and\s+cons|advantages\s+of)\b/i,
];

if (conceptPatterns.some((pattern) => pattern.test(q))) {
  return 'concept';
}

return 'general';
}

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
   * Remove block comments and heavy step tutorial comments from code.
   */
  stripCommentsAndTests(code: string): string {
    // Remove multi-line block comments /* ... */
    let cleaned = code.replace(/\/\*[\s\S]*?\*\//g, '');

    const lines = cleaned.split('\n');
    const filtered: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      // Skip multi-step tutorial comments
      if (
        trimmed.startsWith('// Step ') ||
        trimmed.startsWith('// First, let\'s') ||
        trimmed.startsWith('// Let\'s check') ||
        trimmed.startsWith('// Let\'s test')
      ) {
        continue;
      }

      filtered.push(rawLine);
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
      const codeBlockRegex = /```([a-zA-Z0-9_\-]*)\r?\n([\s\S]*?)```/g;
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
        isCodingQuestion(question: string, _responseText ?: string): boolean {
          return classifyQuestion(question) === 'algorithm';
        }

        /**
         * Sanitize AI answer to ensure coding solutions are cleanly displayed without comments or test runs,
         * while preserving full multi-step explanations, commands, and code blocks for integration and conceptual guides.
         */
        sanitizeAnswer(question: string, responseText: string): { isCoding: boolean; cleanedAnswer: string } {
          const category = classifyQuestion(question);

          if (category === 'algorithm') {
            return {
              isCoding: true,
              cleanedAnswer: this.cleanCodingSolution(responseText),
            };
          }

          const codeBlockRegex = /```([a-zA-Z0-9_\-]*)\r?\n([\s\S]*?)```/g;
          const cleanedAnswer = responseText.replace(codeBlockRegex, (_match, lang, code) => {
            const cleaned = category === 'concept' ? this.stripCommentsAndTests(code) : code.trim();
            return '```' + (lang || 'javascript') + '\n' + cleaned + '\n```';
          });

            return {
              isCoding: false,
              cleanedAnswer,
            };
          }

  /**
   * Generate an interview answer based on Question, Resume, and Job Description.
   */
  async generateInterviewAnswer(params: {
          question: string;
          source?: 'manual' | 'audio' | 'screen';
        }): Promise < AnswerResponse > {
          const ai = this.getClient();
          const model = ai.getGenerativeModel({
            model: this.getModelName(),
            systemInstruction: SYSTEM_INSTRUCTION,
          });

          const resume = storageService.getResume();
          const jd = storageService.getJobDescription();

          const category = classifyQuestion(params.question);

          let formatInstruction = '';
          switch(category) {
      case 'integration':
          formatInstruction = `
LANGUAGE & FORMAT INSTRUCTION:
This is an INTEGRATION / SETUP / HOW-TO question.
Provide a COMPLETE, practical, step-by-step integration guide. DO NOT give a vague 2-line summary or empty config objects.
Structure your answer clearly:
1. Brief Overview: 1-2 sentences on what this integration achieves.
2. Step 1: Install Dependencies (exact npm/yarn/pnpm commands with full package names).
3. Step 2: Platform Configuration (detail configuration files, Android google-services.json & build.gradle, iOS GoogleService-Info.plist & pod install, env variables).
4. Step 3: Initialization & Setup (complete, valid code without empty dummy brackets).
5. Step 4: Practical Usage Example (realistic React Native / frontend / backend component or hook code showing real methods in action).
6. Key Interview Talking Points: 2-3 concise bullet points of best practices, caveats, or optimization tips to mention verbally.`;
          break;

          case 'algorithm':
          formatInstruction = `
LANGUAGE & FORMAT INSTRUCTION:
This is an ALGORITHM / CODING CHALLENGE.
Output ONLY the simplest, beginner-friendly JavaScript code inside a single markdown code block (\`\`\`javascript ... \`\`\`).
- Declare a sample input variable at the top (e.g. let arr = [1, 4, 5, 67, 8, 9];).
- Use basic variables and simple loops (for, while, if/else). Avoid complex one-liners, reduce, or advanced tricks when a simple loop works.
- End with a console.log showing the result and a comment with the answer (e.g. console.log(largest); // 67).
- No long introductory text, multi-step tutorials, or conversational pleasantries.`;
          break;

          case 'concept':
          formatInstruction = `
LANGUAGE & FORMAT INSTRUCTION:
This is a CONCEPTUAL / DEFINITION question.
Answer in exactly 2 to 3 very simple sentences in plain everyday English:
- Sentence 1: What it is used for in plain English.
- Sentence 2: How it works simply.
- Sentence 3: Why it helps or why we use it.
Follow immediately with a short, simple practical code example (2 to 4 lines).
Keep it concise, direct, and easy to speak out loud.`;
          break;

          case 'behavioral':
          formatInstruction = `
LANGUAGE & FORMAT INSTRUCTION:
This is an EXPERIENCE / BEHAVIORAL question.
- Speak in the first person ("In my previous experience...", "I built...").
- Ground the answer in the candidate's uploaded resume, skills, and projects when available.
- Use the STAR framework (Situation, Task, Action, Result) in a natural, conversational way.`;
          break;

      default:
    formatInstruction = `
LANGUAGE & FORMAT INSTRUCTION:
Answer in clear, simple English that is natural and easy to explain out loud in an interview.
Provide practical, complete explanations and realistic code examples where applicable.`;
  break;
}

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
  'Provide your response following all SYSTEM INSTRUCTIONS. Keep it direct, natural, and simple.' + formatInstruction
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
  async analyzeResumeText(rawText: string): Promise < Partial < ResumeData >> {
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
): Promise < JobDescriptionData > {
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
  async analyzeScreenImage(base64Image: string, mimeType: string = 'image/png'): Promise < AnswerResponse > {
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
): Promise < { detectedQuestion?: string; answer?: AnswerResponse } > {
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

    if(parsed.isQuestion && parsed.detectedQuestion && parsed.detectedQuestion.length > 5) {
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
): Promise < { detectedQuestion?: string; answer?: AnswerResponse } > {
  const trimmed = (transcript || '').trim();
  // Ignore empty or extremely short inputs
  if(!trimmed || trimmed.length < 10) {
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

