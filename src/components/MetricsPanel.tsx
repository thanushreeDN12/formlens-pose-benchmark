/**
 * MetricsPanel: Live FPS counter, per-frame inference latency,
 * current exercise phase badge, rep counter, and joint angle monitors.
 */

import React from 'react';
import { ExerciseConfig, PhaseDefinition } from '../types/pose';
import { Activity, Gauge, Flame, Compass } from 'lucide-react';

interface MetricsPanelProps {
  fps: number;
  inferenceTimeMs: number;
  currentPhase: PhaseDefinition;
  angles: Record<string, number | null>;
  config: ExerciseConfig;
  repCount: number;
  goodReps: number;
  badReps: number;
  currentRepProgress: number;
  dominantSide: 'left' | 'right';
  minAngleInCurrentRep: number | null;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  fps,
  inferenceTimeMs,
  currentPhase,
  angles,
  config,
  repCount,
  goodReps,
  badReps,
  currentRepProgress,
  dominantSide,
  minAngleInCurrentRep,
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* Top Telemetry & Rep Counter Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Rep Counter */}
        <div className="col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-3.5 shadow-md flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Total Reps</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-white font-mono">{repCount}</span>
              <div className="text-[11px] font-mono flex items-center gap-2">
                <span className="text-emerald-400 font-semibold">{goodReps} good</span>
                <span className="text-slate-600">|</span>
                <span className="text-rose-400 font-semibold">{badReps} form alert</span>
              </div>
            </div>
          </div>

          {/* Rep Progress Arc / Meter */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Depth ROM</span>
            <div className="w-20 bg-slate-800 rounded-full h-2.5 mt-1 overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-75"
                style={{ width: `${currentRepProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
              {minAngleInCurrentRep ? `Min: ${minAngleInCurrentRep}°` : `${currentRepProgress}%`}
            </span>
          </div>
        </div>

        {/* Live FPS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span className="uppercase tracking-wider">FPS</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {fps.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">fps</span>
          </div>
        </div>

        {/* Inference Latency */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span className="uppercase tracking-wider">Inference</span>
            <Gauge className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-sky-400">
              {inferenceTimeMs.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">ms</span>
          </div>
        </div>
      </div>

      {/* Current Phase Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Phase:</span>
          <div
            className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm"
            style={{
              backgroundColor: `${currentPhase.color}20`,
              color: currentPhase.color,
              borderColor: `${currentPhase.color}50`,
              borderWidth: 1,
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: currentPhase.color }}
            />
            {currentPhase.name}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <Compass className="w-3.5 h-3.5 text-slate-400" />
          <span className="capitalize">{dominantSide} Side Tracked</span>
        </div>
      </div>

      {/* Joint Angles Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {config.angles.map((def) => {
          const val = angles[def.id];
          const hasVal = val !== null && val !== undefined;
          const displayVal = hasVal ? `${Math.round(val!)}${def.unit || '°'}` : '--';

          // Ideal target range
          const idealMin = def.idealRange?.[0] ?? 60;
          const idealMax = def.idealRange?.[1] ?? 120;
          const isWithinIdeal = hasVal && val! >= idealMin && val! <= idealMax;

          // Normalized percentage for progress bar (0 to 180 deg)
          const pct = hasVal ? Math.min(100, Math.max(0, (val! / 180) * 100)) : 0;

          return (
            <div
              key={def.id}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h5 className="text-xs font-semibold text-slate-300">{def.name}</h5>
                  <p className="text-[10px] text-slate-500">{def.description}</p>
                </div>
                <span
                  className={`text-lg font-bold font-mono ${
                    !hasVal
                      ? 'text-slate-600'
                      : isWithinIdeal
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {displayVal}
                </span>
              </div>

              {/* Angle visualization track */}
              <div className="mt-2.5">
                <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      isWithinIdeal ? 'bg-emerald-400' : 'bg-sky-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                  <span>0°</span>
                  {def.idealRange && (
                    <span className="text-emerald-500 font-medium">
                      Target: {idealMin}° - {idealMax}°
                    </span>
                  )}
                  <span>180°</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
