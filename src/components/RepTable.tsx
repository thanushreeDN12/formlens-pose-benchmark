/**
 * RepTable: Displays chronological log of completed reps with duration,
 * minimum angle achieved, good/bad form status, and specific violations.
 */

import React from 'react';
import { RepResult } from '../types/pose';
import { CheckCircle2, XCircle, ListFilter, Clock } from 'lucide-react';

interface RepTableProps {
  reps: RepResult[];
}

export const RepTable: React.FC<RepTableProps> = ({ reps }) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <ListFilter className="w-4 h-4 text-sky-400" />
          <span>Rep History Log</span>
        </h4>
        <span className="text-xs text-slate-400 font-mono">
          {reps.length} {reps.length === 1 ? 'Rep' : 'Reps'} Recorded
        </span>
      </div>

      {reps.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center gap-1">
          <Clock className="w-5 h-5 text-slate-600 mb-1" />
          <p>No completed repetitions yet.</p>
          <p className="text-[11px] text-slate-600">
            Execute full down-and-up movement cycles to record reps.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <th className="py-2 px-2.5">Rep #</th>
                <th className="py-2 px-2.5">Status</th>
                <th className="py-2 px-2.5">Min Angle</th>
                <th className="py-2 px-2.5">Duration</th>
                <th className="py-2 px-2.5">Violations / Notes</th>
                <th className="py-2 px-2.5 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {reps.map((rep) => {
                const isGood = rep.formLabel === 'good_form';

                return (
                  <tr
                    key={rep.repNumber}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-2.5 font-bold text-white">#{rep.repNumber}</td>
                    <td className="py-2.5 px-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          isGood
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {isGood ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Good Form
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-400" />
                            Form Alert
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 font-bold text-white">
                      {rep.minAngleReached}°
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-400">
                      {rep.durationSeconds}s
                    </td>
                    <td className="py-2.5 px-2.5 max-w-[200px] truncate">
                      {rep.violations.length === 0 ? (
                        <span className="text-emerald-500/80 font-sans text-[11px]">
                          Clean repetition
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {rep.violations.map((v, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-rose-950/60 text-rose-300 border border-rose-900 px-1.5 py-0.5 rounded font-sans"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-slate-500 text-[11px]">
                      {rep.timestamp}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
