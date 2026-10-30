/**
 * FeedbackPanel: Live coaching feedback messages with green/amber/red status,
 * real-time violation callouts, and rule compliance checklist.
 */

import React from 'react';
import { FormRule, ExerciseConfig } from '../types/pose';
import { CheckCircle2, AlertTriangle, AlertCircle, ShieldCheck, Info } from 'lucide-react';

interface FeedbackPanelProps {
  config: ExerciseConfig;
  activeViolations: FormRule[];
  feedback: {
    message: string;
    type: 'success' | 'warning' | 'error';
    remedy?: string;
  };
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({
  config,
  activeViolations,
  feedback,
}) => {
  const isGood = feedback.type === 'success';
  const isError = feedback.type === 'error';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Real-time Biomechanical Feedback</span>
        </h4>
        <span
          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
            isGood
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : isError
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}
        >
          {isGood ? 'Form: Good' : 'Form: Corrective Cue'}
        </span>
      </div>

      {/* Main Feedback Banner */}
      <div
        className={`rounded-lg p-3.5 border transition-all ${
          isGood
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            : isError
            ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
            : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {isGood && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
          {isError && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />}
          {!isGood && !isError && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}

          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold tracking-tight">{feedback.message}</p>
            {feedback.remedy && (
              <p className="text-xs opacity-90 text-slate-300 mt-0.5 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Coach Tip: {feedback.remedy}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Biomechanics Rule Compliance Checklist */}
      <div className="flex flex-col gap-1.5 mt-1">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Exercise Form Guardrails
        </span>
        <div className="grid grid-cols-1 gap-1.5">
          {config.rules.map((rule) => {
            const isViolated = activeViolations.some((v) => v.id === rule.id);

            return (
              <div
                key={rule.id}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                  isViolated
                    ? 'bg-rose-950/30 border-rose-600/40 text-rose-300'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isViolated ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="font-medium">{rule.name}</span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-slate-500">
                    {rule.condition.operator} {rule.condition.threshold}
                    {Math.abs(rule.condition.threshold) > 1 ? '°' : ''}
                  </span>
                  <span
                    className={`font-semibold ${
                      isViolated ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {isViolated ? 'VIOLATED' : 'PASS'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
