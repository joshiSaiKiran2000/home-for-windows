import React from 'react';
import { FileText, Upload, CheckCircle2, User, Briefcase, GraduationCap, Code2, AlertCircle } from 'lucide-react';
import { ResumeData } from '../../types';

interface ResumeSectionProps {
  resume: ResumeData | null;
  isLoading: boolean;
  onUpload: () => void;
  onClear: () => void;
}

export const ResumeSection: React.FC<ResumeSectionProps> = ({
  resume,
  isLoading,
  onUpload,
  onClear
}) => {
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800/60 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between pb-3 border-b border-dark-700/60 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-brand-400 border border-indigo-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Candidate Resume</h3>
            <p className="text-xs text-dark-400">PDF extracted & analyzed by Gemini for personalization</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {resume && (
            <button
              onClick={onClear}
              className="text-xs px-2.5 py-1.5 rounded-lg text-dark-400 hover:text-rose-400 hover:bg-dark-700/60 transition-colors"
            >
              Remove
            </button>
          )}
          <button
            onClick={onUpload}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white transition-all shadow-sm"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Analyzing PDF...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>{resume ? 'Re-upload PDF' : 'Upload Resume PDF'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!resume ? (
        <div className="py-8 flex flex-col items-center justify-center text-center border-2 border-dashed border-dark-700/80 rounded-xl bg-dark-900/40 p-6">
          <div className="p-3 rounded-full bg-dark-800 text-dark-400 mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-medium text-dark-200">No Resume Uploaded</h4>
          <p className="text-xs text-dark-400 max-w-sm mt-1">
            Upload your PDF resume so the AI assistant can reference your real projects, skills, and work history.
          </p>
          <button
            onClick={onUpload}
            disabled={isLoading}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-dark-700 hover:bg-dark-600 text-white border border-dark-600 transition-colors"
          >
            Select PDF File
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-dark-900/60 border border-dark-700/60">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-medium text-white">{resume.name || 'Candidate'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Extracted & Cached Locally</span>
            </div>
          </div>

          {/* Skills Badges */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-dark-300 mb-2">
              <Code2 className="w-3.5 h-3.5 text-brand-400" />
              <span>Technical Skills & Frameworks</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {[...resume.languages, ...resume.frameworks, ...resume.skills].map((skill, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-[11px] rounded bg-dark-700/70 text-dark-200 border border-dark-600/50"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Experience Highlights */}
          {resume.experience && resume.experience.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-dark-300 mb-2">
                <Briefcase className="w-3.5 h-3.5 text-brand-400" />
                <span>Experience ({resume.experience.length} positions)</span>
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {resume.experience.map((exp, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-dark-900/40 border border-dark-700/40 text-xs">
                    <div className="flex items-center justify-between font-medium text-dark-100">
                      <span>{exp.role}</span>
                      <span className="text-dark-400 text-[11px]">{exp.company} {exp.duration ? `• ${exp.duration}` : ''}</span>
                    </div>
                    {exp.responsibilities && exp.responsibilities.length > 0 && (
                      <p className="mt-1 text-dark-400 line-clamp-2 text-[11px]">
                        {exp.responsibilities[0]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects Highlights */}
          {resume.projects && resume.projects.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-dark-300 mb-2">
                <GraduationCap className="w-3.5 h-3.5 text-brand-400" />
                <span>Featured Projects</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                {resume.projects.map((proj, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-dark-900/40 border border-dark-700/40 text-xs">
                    <span className="font-medium text-dark-200 block truncate">{proj.title}</span>
                    <p className="text-dark-400 text-[11px] line-clamp-2 mt-0.5">{proj.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

