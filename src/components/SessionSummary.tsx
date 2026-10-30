/**
 * SessionSummary Component:
 * Summarizes workout performance (total reps, good-form %, common violations),
 * and handles JSON export of per-frame keypoints & biomechanical telemetry.
 * Computes true session averages from all processed frames.
 */

import React, { useState } from 'react';
import {
  CameraView,
  ExerciseType,
  FrameData,
  RepResult,
  SessionExportData,
  SessionMetrics,
} from '../types/pose';
import {
  Download,
  Award,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface SessionSummaryProps {
  exercise: ExerciseType;
  cameraView: CameraView;
  reps: RepResult[];
  recordedFrames: FrameData[];
  videoMeta: {
    fileName: string | null;
    width: number;
    height: number;
  };
  modelName: string;
  fps: number;
  onResetSession: () => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  exercise,
  cameraView,
  reps,
  recordedFrames,
  videoMeta,
  modelName,
  fps,
  onResetSession,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);

  const totalReps = reps.length;
  const goodReps = reps.filter((r) => r.formLabel === 'good_form').length;
  const badReps = reps.filter((r) => r.formLabel === 'bad_form').length;
  const goodFormPercentage = totalReps > 0 ? Math.round((goodReps / totalReps) * 100) : 0;

  // Calculate most common violation across reps
  const violationCounts: Record<string, number> = {};
  for (const r of reps) {
    for (const v of r.violations) {
      violationCounts[v] = (violationCounts[v] || 0) + 1;
    }
  }

  let mostCommonViolation: string | null = null;
  let maxCount = 0;
  for (const [v, count] of Object.entries(violationCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonViolation = v;
    }
  }

  // True session averages from all recorded frames
  const totalFrames = recordedFrames.length;
  let trueAvgFps = 0;
  let trueAvgInferenceTimeMs = 0;

  if (totalFrames > 0) {
    const sumInference = recordedFrames.reduce((acc, f) => acc + f.inferenceTimeMs, 0);
    trueAvgInferenceTimeMs = Math.round((sumInference / totalFrames) * 10) / 10;

    const firstTime = recordedFrames[0].mediaTimeMs;
    const lastTime = recordedFrames[totalFrames - 1].mediaTimeMs;
    const durationSec = (lastTime - firstTime) / 1000;
    if (durationSec > 0 && totalFrames > 1) {
      trueAvgFps = Math.round(((totalFrames - 1) / durationSec) * 10) / 10;
    } else {
      trueAvgFps = Math.round(fps * 10) / 10;
    }
  } else {
    trueAvgFps = Math.round(fps * 10) / 10;
  }

  const handleExport = () => {
    setDownloading(true);

    const sessionDurationSec =
      totalFrames > 0
        ? Math.round(
            ((recordedFrames[totalFrames - 1].mediaTimeMs - recordedFrames[0].mediaTimeMs) / 1000) *
              10
          ) / 10
        : 0;

    const metrics: SessionMetrics = {
      totalReps,
      goodReps,
      badReps,
      goodFormPercentage,
      mostCommonViolation,
      avgFps: trueAvgFps,
      avgInferenceTimeMs: trueAvgInferenceTimeMs,
      sessionDurationSec,
      totalFrames,
    };

    const exportPayload: SessionExportData = {
      header: {
        app: 'FormLens',
        version: '1.0.0',
        modelName,
        exercise,
        cameraView,
        videoFileName: videoMeta.fileName,
        videoWidth: videoMeta.width,
        videoHeight: videoMeta.height,
        fps: trueAvgFps,
        avgFps: trueAvgFps,
        avgInferenceTimeMs: trueAvgInferenceTimeMs,
        totalFrames,
        exportedAt: new Date().toISOString(),
      },
      metrics,
      reps,
      frames: recordedFrames,
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const safeName = videoMeta.fileName ? `-${videoMeta.fileName.replace(/\.[^/.]+$/, '')}` : '';
    a.download = `formlens-${exercise}-${cameraView}${safeName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloading(false);
    setExportedSuccess(true);

    setTimeout(() => {
      setExportedSuccess(false);
    }, 4000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-emerald-400" />
          <span>Session Performance Summary</span>
        </h4>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetSession}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Clear all recorded reps and reset session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={handleExport}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs rounded-lg transition shadow-md disabled:opacity-50"
          >
            {exportedSuccess ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Exported!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Session</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Reps */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Total Reps
          </span>
          <p className="text-2xl font-bold font-mono text-white mt-0.5">{totalReps}</p>
          <span className="text-[10px] text-slate-500 font-mono">
            {goodReps} clean / {badReps} alert
          </span>
        </div>

        {/* Good Form % */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Good-Form Rate
          </span>
          <p
            className={`text-2xl font-bold font-mono mt-0.5 ${
              totalReps === 0
                ? 'text-slate-600'
                : goodFormPercentage >= 80
                ? 'text-emerald-400'
                : goodFormPercentage >= 50
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {totalReps === 0 ? '--' : `${goodFormPercentage}%`}
          </p>
          <span className="text-[10px] text-slate-500">
            {goodFormPercentage >= 80 ? 'Excellent technique' : 'Refinement needed'}
          </span>
        </div>

        {/* Most Common Violation */}
        <div className="col-span-2 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Primary Form Bottleneck
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>

          <p className="text-xs font-semibold text-slate-200 mt-1 truncate">
            {mostCommonViolation ? (
              <span className="text-rose-300">{mostCommonViolation}</span>
            ) : totalReps > 0 ? (
              <span className="text-emerald-400">Zero violations recorded (Flawless form)</span>
            ) : (
              <span className="text-slate-500">Awaiting repetition data</span>
            )}
          </p>

          <span className="text-[10px] text-slate-500 font-mono mt-1">
            {totalFrames} full frames logged (avg {trueAvgFps} FPS • {trueAvgInferenceTimeMs}ms)
          </span>
        </div>
      </div>

      {/* Export explanation note */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/40 border border-slate-800/60 px-3 py-2 rounded-lg">
        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Export includes {totalFrames} un-decimated frame records with 33 normalized landmarks, 33 3D world landmarks, raw & smoothed angles, and session header metadata.
        </span>
      </div>
    </div>
  );
};
