/**
 * Rep Counting State Machine
 * Driven strictly by exercise phase transitions and config parameters.
 * Eliminates duplicate interface definitions and hardcoded thresholds.
 */

import { ExerciseConfig, FormRule, PhaseDefinition, RepResult, RepState } from '../types/pose';

export class RepCounter {
  private config: ExerciseConfig;
  private repNumber = 0;
  private state: 'READY' | 'DESCENDING' | 'BOTTOM' | 'ASCENDING' = 'READY';

  private repStartTime: number | null = null;
  private minAngleReached = 999;
  private maxAngleReached = 0;
  private reachedBottom = false;
  private repViolations = new Set<string>();

  private completedReps: RepResult[] = [];
  private onRepCompleteCallback?: (rep: RepResult) => void;

  constructor(config: ExerciseConfig, onRepComplete?: (rep: RepResult) => void) {
    this.config = config;
    this.onRepCompleteCallback = onRepComplete;
  }

  setConfig(config: ExerciseConfig) {
    this.config = config;
    this.reset();
  }

  setOnRepComplete(callback: (rep: RepResult) => void) {
    this.onRepCompleteCallback = callback;
  }

  /**
   * Process a frame's phase, primary angle, and any active violations.
   * Returns updated RepState and completed RepResult if a rep finished on this frame.
   */
  processFrame(
    phase: PhaseDefinition,
    angles: Record<string, number | null>,
    activeViolations: FormRule[],
    timestampMs: number
  ): {
    repState: RepState;
    newRep: RepResult | null;
  } {
    const primaryAngle = angles[this.config.primaryAngleId];
    let newRep: RepResult | null = null;

    if (primaryAngle !== null && !isNaN(primaryAngle)) {
      if (this.state !== 'READY') {
        this.minAngleReached = Math.min(this.minAngleReached, primaryAngle);
        this.maxAngleReached = Math.max(this.maxAngleReached, primaryAngle);
      }
    }

    // Accumulate violations that have satisfied persistence criteria during movement
    if (this.state !== 'READY') {
      for (const v of activeViolations) {
        this.repViolations.add(v.message);
      }
    }

    const topPhaseId = this.config.topPhaseId;
    const bottomPhaseId = this.config.bottomPhaseId;
    const descendingPhaseId = this.config.descendingPhaseId;
    const ascendingPhaseId = this.config.ascendingPhaseId;
    const reboundAngle = this.config.reboundAngle ?? 105;
    const minRomAngle = this.config.minRomAngle ?? 145;

    switch (this.state) {
      case 'READY': {
        if (phase.id === descendingPhaseId || phase.id === bottomPhaseId) {
          this.state = 'DESCENDING';
          this.repStartTime = timestampMs;
          this.minAngleReached = primaryAngle ?? 180;
          this.maxAngleReached = primaryAngle ?? 180;
          this.reachedBottom = phase.id === bottomPhaseId;
          this.repViolations.clear();
        }
        break;
      }

      case 'DESCENDING': {
        if (phase.id === bottomPhaseId) {
          this.state = 'BOTTOM';
          this.reachedBottom = true;
        } else if (phase.id === ascendingPhaseId) {
          this.state = 'ASCENDING';
        } else if (phase.id === topPhaseId) {
          this.state = 'READY';
          this.repStartTime = null;
        }
        break;
      }

      case 'BOTTOM': {
        if (phase.id === ascendingPhaseId || (primaryAngle !== null && primaryAngle > reboundAngle)) {
          this.state = 'ASCENDING';
        }
        break;
      }

      case 'ASCENDING': {
        if (phase.id === topPhaseId) {
          const duration = this.repStartTime
            ? Math.max(0.5, Math.round(((timestampMs - this.repStartTime) / 1000) * 10) / 10)
            : 1.5;

          // Check bottom depth requirement
          const bottomRule = this.config.rules.find((r) => r.triggerPhase === 'bottom_requirement');
          if (bottomRule && !this.reachedBottom) {
            const { threshold, operator } = bottomRule.condition;
            const met =
              operator === '<='
                ? this.minAngleReached <= threshold
                : this.minAngleReached < threshold;
            if (!met) {
              this.repViolations.add(bottomRule.message);
            }
          }

          // Count valid rep only if minimum ROM angle was attained
          if (this.minAngleReached < minRomAngle) {
            this.repNumber += 1;
            const violationsArray = Array.from(this.repViolations);
            const formLabel: 'good_form' | 'bad_form' =
              violationsArray.length === 0 ? 'good_form' : 'bad_form';

            newRep = {
              repNumber: this.repNumber,
              startTime: this.repStartTime ?? timestampMs - 1500,
              endTime: timestampMs,
              durationSeconds: duration,
              minAngleReached: Math.round(this.minAngleReached * 10) / 10,
              formLabel,
              violations: violationsArray,
              timestamp: new Date().toLocaleTimeString(),
            };

            this.completedReps.push(newRep);
            if (this.onRepCompleteCallback) {
              this.onRepCompleteCallback(newRep);
            }
          }

          this.state = 'READY';
          this.repStartTime = null;
          this.minAngleReached = 999;
          this.repViolations.clear();
          this.reachedBottom = false;
        }
        break;
      }
    }

    // Compute progress of current rep: 0% at top, 100% at bottom target
    let currentRepProgress = 0;
    if (primaryAngle !== null && !isNaN(primaryAngle)) {
      const topThresh =
        this.config.phases.find((p) => p.id === topPhaseId)?.condition.threshold ?? 160;
      const botThresh =
        this.config.phases.find((p) => p.id === bottomPhaseId)?.condition.threshold ?? 90;
      const totalRange = topThresh - botThresh;
      if (totalRange > 0) {
        const currentDiff = topThresh - primaryAngle;
        currentRepProgress = Math.min(
          100,
          Math.max(0, Math.round((currentDiff / totalRange) * 100))
        );
      }
    }

    const goodReps = this.completedReps.filter((r) => r.formLabel === 'good_form').length;
    const badReps = this.completedReps.filter((r) => r.formLabel === 'bad_form').length;

    return {
      repState: {
        repCount: this.repNumber,
        goodReps,
        badReps,
        currentRepProgress,
        isMoving: this.state !== 'READY',
        minAngleInCurrentRep:
          this.state !== 'READY' && this.minAngleReached < 900
            ? Math.round(this.minAngleReached)
            : null,
      },
      newRep,
    };
  }

  getCompletedReps(): RepResult[] {
    return this.completedReps;
  }

  reset() {
    this.repNumber = 0;
    this.state = 'READY';
    this.repStartTime = null;
    this.minAngleReached = 999;
    this.maxAngleReached = 0;
    this.reachedBottom = false;
    this.repViolations.clear();
    this.completedReps = [];
  }
}
