import React, { useState } from 'react';
import { Briefcase, Check, AlertTriangle, Sparkles, Tag, Layers } from 'lucide-react';
import { JobDescriptionData, ResumeData } from '../../types';

interface JobDescriptionSectionProps {
  jobDescription: JobDescriptionData | null;
  resume: ResumeData | null;
  isLoading: boolean;
  onAnalyze: (text: string) => void;
}

export const JobDescriptionSection: React.FC<JobDescriptionSectionProps> = ({
  jobDescription,
  resume,
  isLoading,
  onAnalyze
}) => {
  const [inputText, setInputText] = useState(jobDescription?.rawText || '');
  const [isEditing, setIsEditing] = useState(!jobDescription);

  const handleAnalyze = () => {
    if (!inputText.trim()) return;
    onAnalyze(inputText.trim());
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800/60 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between pb-3 border-b border-dark-700/60 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Target Job Description</h3>
            <p className="text-xs text-dark-400">Match skills, identify requirements, and personalize answers</p>
          </div>
        </div>

        {jobDescription && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs px-2.5 py-1.5 rounded-lg text-dark-300 hover:text-white hover:bg-dark-700/60 transition-colors"
          >
            {isEditing ? 'Cancel Edit' : 'Edit Description'}
          </button>
        )}
      </div>

      {/* Input or View Mode */}
      {isEditing || !jobDescription ? (
        <div className="space-y-3">
          <textarea
            rows={5}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste target job description here (e.g. Senior Frontend Engineer requirements, required tech stack, responsibilities)..."
            className="w-full rounded-xl bg-dark-900/80 border border-dark-700 p-3.5 text-xs text-dark-200 placeholder-dark-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all font-sans leading-relaxed"
          />
          <div className="flex justify-end">
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !inputText.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-all shadow-sm"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing Match...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analyze & Save Job Description</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Skill Matching Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Matching Skills */}
            <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-2">
                <Check className="w-3.5 h-3.5" />
                <span>Matching Skills in Resume ({jobDescription.matchingSkills?.length || 0})</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {jobDescription.matchingSkills && jobDescription.matchingSkills.length > 0 ? (
                  jobDescription.matchingSkills.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-[11px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-dark-400 italic">No exact skill matches identified yet</span>
                )}
              </div>
            </div>

            {/* Missing Skills */}
            <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Skills To Emphasize / Missing ({jobDescription.missingSkills?.length || 0})</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {jobDescription.missingSkills && jobDescription.missingSkills.length > 0 ? (
                  jobDescription.missingSkills.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-[11px] rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-dark-400 italic">All key JD skills covered in resume</span>
                )}
              </div>
            </div>
          </div>

          {/* Required Skills & Technologies */}
          <div className="p-3 rounded-lg bg-dark-900/60 border border-dark-700/60">
            <div className="flex items-center gap-1.5 text-xs font-medium text-dark-300 mb-2">
              <Tag className="w-3.5 h-3.5 text-brand-400" />
              <span>Required Skills & Tools</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...(jobDescription.requiredSkills || []), ...(jobDescription.toolsAndTech || [])].map((item, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-[11px] rounded bg-dark-700/70 text-dark-200 border border-dark-600/50"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Core Responsibilities */}
          {jobDescription.responsibilities && jobDescription.responsibilities.length > 0 && (
            <div className="p-3 rounded-lg bg-dark-900/40 border border-dark-700/40 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-dark-300 mb-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-400" />
                <span>Core Responsibilities</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-dark-400 text-[11px]">
                {jobDescription.responsibilities.slice(0, 4).map((resp, idx) => (
                  <li key={idx} className="line-clamp-1">{resp}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

