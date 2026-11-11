# AI Desktop Interview Assistant

A cross-platform, AI-powered desktop application built with **Electron**, **React**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Google Gemini API**.

The application acts as a real-time copilot for technical interviews: it understands your actual resume and target job description, listens to meeting audio to detect interview questions, inspects screen problems via computer vision, and generates simple, natural, conversational answers directly in a sleek, floating always-on-top desktop overlay.

---

## Folder Location
```
C:\Users\sai\Desktop\ai-interview-assistant
```

---

## Key Features

1. **Desktop Floating Overlay**:
   - Always stays on top of video conferencing apps (Zoom, Google Meet, Teams, etc.).
   - Frameless, modern dark-themed window with custom draggable title bar.
   - Resizable, minimizable, and supports ultra-compact mode.
   - Global keyboard shortcut: **`Ctrl + Shift + Space`** to toggle visibility at any time.
   - Adjustable opacity (40% to 100%) for discreet positioning.

2. **Personalized AI Answering Engine**:
   - Enforces specific interview instructions: answers sound like a real developer speaking naturally in simple English.
   - Prioritizes beginner-friendly solutions for coding questions (uses simple `for` loops, `if/else`, basic array methods; avoids complex one-liners).
   - Explains code step-by-step with expected output and time/space complexity.
   - References actual projects and responsibilities from your uploaded resume.

3. **Resume PDF Upload & Analysis**:
   - Extracts raw text using `pdf-parse` in the Node.js main process.
   - Analyzes skills, programming languages, frameworks, work history, projects, and education using Gemini.
   - Stores extracted data locally in JSON format (no external database required).

4. **Target Job Description Intelligence**:
   - Compares the target job description against your resume.
   - Computes matching skills vs. missing skills to help you highlight relevant strengths.
   - Saved locally so you don't need to re-enter it every session.

5. **Meeting Audio Understanding**:
   - Real-time audio capture via microphone or meeting output.
   - Audio chunks processed by Gemini to transcribe and detect meaningful interview questions.
   - Automatically pushes suggested answers to the overlay and main window.
   - Full user control with start/stop buttons and clear privacy boundaries.

6. **Screen Vision & Code Problem Solving**:
   - Built-in screen capture to inspect coding challenges, online tests (LeetCode, HackerRank), error messages, or IDE windows.
   - Analyzes the image with Gemini's vision model.
   - Produces simple, step-by-step JavaScript solutions.

---

## Project Structure

```
ai-interview-assistant/
│
├── electron/
│   ├── main.ts                     # Main process (window creation, global shortcuts, IPC)
│   ├── preload.ts                  # Secure contextBridge API
│   ├── ipc/
│   │   ├── ai.ipc.ts               # Gemini answer generation & JD analysis IPC
│   │   ├── resume.ipc.ts           # PDF upload & local storage IPC
│   │   ├── screen.ipc.ts           # Screen capture & vision analysis IPC
│   │   └── audio.ipc.ts            # Audio chunk processing IPC
│   └── services/
│       ├── gemini.service.ts       # Gemini API client with exact interview instructions
│       ├── resume.service.ts       # PDF parsing & text extraction
│       ├── screen.service.ts       # Screen source listing & screenshot capture
│       ├── audio.service.ts        # Audio chunk transcription & question detector
│       └── storage.service.ts      # Local JSON file storage for resume, JD & settings
│
├── src/
│   ├── components/
│   │   ├── Navigation/
│   │   │   └── Header.tsx          # Top bar with controls & status
│   │   ├── Overlay/
│   │   │   └── OverlayWindow.tsx   # Floating always-on-top compact overlay
│   │   ├── ResumeUpload/
│   │   │   └── ResumeSection.tsx   # PDF upload & parsed resume viewer
│   │   ├── JobDescription/
│   │   │   └── JobDescriptionSection.tsx # JD analyzer & skill matching matrix
│   │   ├── QuestionInput/
│   │   │   └── ManualQuestionInput.tsx   # Manual question bar with suggestions
│   │   ├── AnswerDisplay/
│   │   │   ├── AnswerCard.tsx      # Formatted answer card with copy & regenerate
│   │   │   └── CodeBlock.tsx       # Syntax highlighted code block with copy
│   │   ├── Controls/
│   │   │   ├── AudioController.tsx # Audio recording controls & status
│   │   │   └── ScreenCaptureModal.tsx # Screen/window selector for vision analysis
│   │   └── Settings/
│   │       └── SettingsModal.tsx   # Gemini API key & model settings
│   ├── hooks/
│   │   └── useAudioCapture.ts      # Audio capture & MediaRecorder management
│   ├── pages/
│   │   └── DashboardPage.tsx       # Main dashboard layout
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces and IPC signatures
│   ├── App.tsx                     # Route switch between Dashboard and Overlay
│   ├── main.tsx                    # React entry point
│   └── index.css                   # Tailwind styles and custom scrollbar
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.cjs
├── tsconfig.json
└── README.md
```

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v22)
- **npm**
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

### 2. Running in Development Mode
From the project folder (`C:\Users\sai\Desktop\ai-interview-assistant`):
```bash
npm run dev
```
This starts the Vite development server and launches the Electron application with hot module replacement (HMR).

### 3. Entering your Gemini API Key
1. Click the **Settings (gear icon)** in the top right of the application.
2. Paste your Google Gemini API Key.
3. Select your preferred model (e.g. `gemini-1.5-flash` or `gemini-2.0-flash`).
4. Click **Save Settings**. (The key is stored strictly on your local disk in `%APPDATA%/ai-interview-assistant/data/settings.json`).

---

## How to Use

### A. Resume Upload
1. Click **Upload Resume PDF** in the Candidate Resume section.
2. Select your resume file.
3. The system extracts the text and uses Gemini to parse your technical skills, programming languages, experience, and projects.

### B. Job Description Analysis
1. Paste the job description in the Target Job Description section.
2. Click **Analyze & Save Job Description**.
3. View the **Matching Skills** and **Skills to Emphasize** matrix.

### C. Asking Questions Manually
1. Type any technical question (e.g. *"Explain how React useEffect works"* or *"Write a function to check if two strings are anagrams"*) in the input bar.
2. Press **Enter** or click **Ask**.
3. The answer will be displayed in the Answer Feed and synchronized to the Floating Overlay.

### D. Using the Floating Overlay During Interviews
1. Click **Toggle Floating Overlay** or press **`Ctrl + Shift + Space`**.
2. Drag the overlay to a comfortable position on your screen.
3. Use the **Compact Mode** button for an ultra-small view or adjust the opacity slider.

### E. Meeting Audio Listening
1. Click **Start Listening** in the Meeting Audio Listener section.
2. When the interviewer speaks, the audio is analyzed to detect questions.
3. Answers appear automatically in the Floating Overlay.
4. Click **Stop Listening** when done.

### F. Screen Analysis
1. Click **Screen Analysis** in the header or inside the Floating Overlay.
2. Select the screen or window containing a coding problem or code snippet.
3. Click **Capture & Analyze**.
4. Gemini will inspect the problem and provide a beginner-friendly JavaScript solution with step-by-step explanations.

---

## Building and Packaging (.exe)

To generate the standalone Windows package:
```bash
npm run pack
```
This builds the unpacked standalone distribution in `release\win-unpacked\AI Interview Assistant.exe`.

To generate the complete Windows installer (`.exe` setup):
```bash
npm run dist
```
The installer will be generated in the `release/` directory.

---

## Security & Architecture Principles
- **No authentication or cloud database**: All data (resume and job description) is stored solely in local JSON files.
- **Sandboxed renderer**: `nodeIntegration: false` and `contextIsolation: true` prevent renderer code from directly executing arbitrary Node system commands.
- **Secure IPC bridge**: All communication between the frontend and main process passes through validated IPC handlers in `electron/preload.ts`.
- **Explicit audio & screen capture**: No background recording occurs without direct user activation.
