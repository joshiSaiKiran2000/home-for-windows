import React, { useState, useEffect } from 'react';
import { Header } from '../components/Navigation/Header';
import { ResumeSection } from '../components/ResumeUpload/ResumeSection';
import { JobDescriptionSection } from '../components/JobDescription/JobDescriptionSection';
import { ManualQuestionInput } from '../components/QuestionInput/ManualQuestionInput';
import { AudioController } from '../components/Controls/AudioController';
import { AnswerCard } from '../components/AnswerDisplay/AnswerCard';
import { ScreenCaptureModal } from '../components/Controls/ScreenCaptureModal';
import { SettingsModal } from '../components/Settings/SettingsModal';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { AnswerResponse, AppSettings, JobDescriptionData, ResumeData } from '../types';
import { MessageSquare, Sparkles } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [jobDescription, setJobDescription] = useState<JobDescriptionData | null>(null);
  const [answers, setAnswers] = useState<AnswerResponse[]>([]);
  const [isResumeLoading, setIsResumeLoading] = useState(false);
  const [isJdLoading, setIsJdLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isScreenModalOpen, setIsScreenModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Audio capture hook
  const { audioState, startListening, stopListening } = useAudioCapture((detectedQuestion) => {
    // When question is detected from audio, it's processed and dispatched via IPC
  });

  // Load stored resume & JD on mount
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.getStoredResume().then((res) => {
      if (res.success && res.data) setResume(res.data);
    });

    window.electronAPI.getStoredJobDescription().then((res) => {
      if (res.success && res.data) setJobDescription(res.data);
    });

    // Listen for new answers broadcasted across windows
    const cleanup = window.electronAPI.onNewAnswer((newAns) => {
      setAnswers((prev) => [newAns, ...prev]);
    });

    const cleanupResume = window.electronAPI.onResumeUpdated?.((newResume) => {
      setResume(newResume);
    });

    const cleanupContext = window.electronAPI.onContextCleared?.(() => {
      setResume(null);
      setJobDescription(null);
    });

    return () => {
      cleanup();
      cleanupResume?.();
      cleanupContext?.();
    };
  }, []);

  // Handlers
  const handleResumeUpload = async () => {
    if (!window.electronAPI) return;
    setIsResumeLoading(true);
    setGlobalError(null);
    try {
      const res = await window.electronAPI.uploadResumePdf();
      if (res.success && res.data) {
        setResume(res.data);
        // If JD exists, re-analyze to recalculate matching
        if (jobDescription?.rawText) {
          handleJobDescriptionAnalyze(jobDescription.rawText);
        }
      } else {
        setGlobalError(res.error || 'Failed to upload or analyze resume.');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Error uploading resume.');
    } finally {
      setIsResumeLoading(false);
    }
  };

  const handleResumeClear = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.clearContext();
    setResume(null);
    setJobDescription(null);
  };

  const handleJobDescriptionAnalyze = async (text: string) => {
    if (!window.electronAPI) return;
    setIsJdLoading(true);
    setGlobalError(null);
    try {
      const res = await window.electronAPI.analyzeJobDescription(text);
      if (res.success && res.data) {
        setJobDescription(res.data);
      } else {
        setGlobalError(res.error || 'Failed to analyze job description.');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Error analyzing job description.');
    } finally {
      setIsJdLoading(false);
    }
  };

  const handleAskQuestion = async (question: string) => {
    if (!window.electronAPI) return;
    setIsAiLoading(true);
    setGlobalError(null);
    try {
      const res = await window.electronAPI.generateAnswer({ question });
      if (res.success && res.data) {
        setAnswers((prev) => [res.data!, ...prev]);
      } else {
        setGlobalError(res.error || 'Failed to generate answer.');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Error communicating with Gemini.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleScreenCapture = async (sourceId?: string) => {
    if (!window.electronAPI) return;
    setIsAiLoading(true);
    setGlobalError(null);
    try {
      const res = await window.electronAPI.captureAndAnalyzeScreen(sourceId);
      if (res.success && res.data) {
        setAnswers((prev) => [res.data!, ...prev]);
      } else {
        setGlobalError(res.error || 'Failed to capture or analyze screen.');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Error capturing screen.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveSettings = async (settings: Partial<AppSettings>) => {
    if (!window.electronAPI) return;
    await window.electronAPI.saveSettings(settings);
  };

  return (
    <div className="min-h-screen bg-dark-900 text-dark-100 flex flex-col font-sans">
      <Header
        onToggleOverlay={() => window.electronAPI?.toggleOverlay()}
        onOpenScreenCapture={() => setIsScreenModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClearHistory={() => setAnswers([])}
        hasAnswers={answers.length > 0}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Global Error Banner */}
        {globalError && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
            <span>{globalError}</span>
            <button
              onClick={() => setGlobalError(null)}
              className="px-2 py-1 rounded bg-rose-900/60 hover:bg-rose-900 text-white font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Context Section: Resume & Job Description */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResumeSection
            resume={resume}
            isLoading={isResumeLoading}
            onUpload={handleResumeUpload}
            onClear={handleResumeClear}
          />

          <JobDescriptionSection
            jobDescription={jobDescription}
            resume={resume}
            isLoading={isJdLoading}
            onAnalyze={handleJobDescriptionAnalyze}
          />
        </div>

        {/* Audio Capture & Real-Time Monitoring */}
        <AudioController
          audioState={audioState}
          onStart={startListening}
          onStop={stopListening}
        />

        {/* Manual Question Input */}
        <ManualQuestionInput
          onAsk={handleAskQuestion}
          isLoading={isAiLoading}
        />

        {/* Answer Feed / Conversation History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-dark-700/60">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-semibold text-white">Interview Answer Feed</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-dark-800 text-dark-400 font-mono">
                {answers.length}
              </span>
            </div>
          </div>

          {answers.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-dark-800 rounded-2xl bg-dark-900/40 p-6">
              <Sparkles className="w-8 h-8 text-dark-500 mb-2" />
              <h4 className="text-sm font-medium text-dark-300">No Answers Generated Yet</h4>
              <p className="text-xs text-dark-500 max-w-sm mt-1">
                Type a question above, start meeting audio listening, or trigger screen analysis to generate interview answers tailored to your experience.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {answers.map((ans) => (
                <AnswerCard
                  key={ans.id}
                  answer={ans}
                  onRegenerate={handleAskQuestion}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Screen Selection Modal */}
      <ScreenCaptureModal
        isOpen={isScreenModalOpen}
        onClose={() => setIsScreenModalOpen(false)}
        onCapture={handleScreenCapture}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
};

