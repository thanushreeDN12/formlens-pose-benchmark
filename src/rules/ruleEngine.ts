/**
 * Config-driven Rule & Biomechanics Engine
 * Fully decoupled from UI components.
 */

import {
  ExerciseConfig,
  FormRule,
  Landmark,
  PhaseDefinition,
} from '../types/pose';
import {
  calculateAngle,
  calculateTorsoInclination,
  calculateSignedHipDeviation,
  getDominantSide,
} from '../utils/angles';

export interface RuleEvaluationResult {
  currentPhase: PhaseDefinition;
  activeViolations: FormRule[];
  feedback: {
    message: string;
    type: 'success' | 'warning' | 'error';
    remedy?: string;
  };
  dominantSide: 'left' | 'right';
}

export class RuleEngine {
  private config: ExerciseConfig;
  private primaryAngleHistory: number[] = [];
  private consecutiveViolationCounts = new Map<string, number>();

  constructor(config: ExerciseConfig) {
    this.config = config;
  }

  setConfig(config: ExerciseConfig) {
    this.config = config;
    this.primaryAngleHistory = [];
    this.consecutiveViolationCounts.clear();
  }

  getConfig(): ExerciseConfig {
    return this.config;
  }

  /**
   * Computes all defined angles in config for the given frame landmarks.
   * Scales normalized coordinates by actual video pixel dimensions (width/height).
   */
  computeAngles(
    landmarks: Landmark[],
    width = 1,
    height = 1
  ): {
    angles: Record<string, number | null>;
    dominantSide: 'left' | 'right';
  } {
    const dominantSide = getDominantSide(landmarks);
    const angles: Record<string, number | null> = {};

    for (const def of this.config.angles) {
      if (def.type === 'joint_3pt') {
        const domLms = dominantSide === 'left' ? def.leftLandmarks : def.rightLandmarks;
        const altLms = dominantSide === 'left' ? def.rightLandmarks : def.leftLandmarks;

        let computed: number | null = null;
        if (domLms) {
          computed = calculateAngle(
            landmarks[domLms[0]],
            landmarks[domLms[1]],
            landmarks[domLms[2]],
            width,
            height
          );
        }
        if (computed === null && altLms) {
          computed = calculateAngle(
            landmarks[altLms[0]],
            landmarks[altLms[1]],
            landmarks[altLms[2]],
            width,
            height
          );
        }
        angles[def.id] = computed;
      } else if (def.type === 'vertical_inclination') {
        const domPair = dominantSide === 'left' ? def.leftVertical : def.rightVertical;
        const altPair = dominantSide === 'left' ? def.rightVertical : def.leftVertical;

        let computed: number | null = null;
        if (domPair) {
          computed = calculateTorsoInclination(
            landmarks[domPair[0]],
            landmarks[domPair[1]],
            width,
            height
          );
        }
        if (computed === null && altPair) {
          computed = calculateTorsoInclination(
            landmarks[altPair[0]],
            landmarks[altPair[1]],
            width,
            height
          );
        }
        angles[def.id] = computed;
      } else if (def.type === 'signed_hip_deviation') {
        const domTriplet = dominantSide === 'left' ? def.leftHipDeviation : def.rightHipDeviation;
        const altTriplet = dominantSide === 'left' ? def.rightHipDeviation : def.leftHipDeviation;

        let computed: number | null = null;
        if (domTriplet) {
          computed = calculateSignedHipDeviation(
            landmarks[domTriplet[0]],
            landmarks[domTriplet[1]],
            landmarks[domTriplet[2]],
            width,
            height
          );
        }
        if (computed === null && altTriplet) {
          computed = calculateSignedHipDeviation(
            landmarks[altTriplet[0]],
            landmarks[altTriplet[1]],
            landmarks[altTriplet[2]],
            width,
            height
          );
        }
        angles[def.id] = computed;
      }
    }

    return { angles, dominantSide };
  }

  /**
   * Determines the exercise phase based on angles and movement trajectory.
   * Completely config-driven without hardcoded phase string literals.
   */
  determinePhase(
    angles: Record<string, number | null>,
    previousPhaseId: string
  ): PhaseDefinition {
    const primaryAngle = angles[this.config.primaryAngleId];
    const phases = this.config.phases;

    if (primaryAngle === null || primaryAngle === undefined) {
      return (
        phases.find((p) => p.id === previousPhaseId) ||
        phases[0] || {
          id: 'unknown',
          name: 'Calibrating...',
          color: '#64748b',
          condition: { angleId: '', operator: '>=', threshold: 0 },
        }
      );
    }

    // Keep sliding window of primary angles to determine direction of movement
    this.primaryAngleHistory.push(primaryAngle);
    if (this.primaryAngleHistory.length > 8) {
      this.primaryAngleHistory.shift();
    }

    const first = this.primaryAngleHistory[0];
    const isDecreasing = primaryAngle < first - 2;
    const isIncreasing = primaryAngle > first + 2;

    const topPhase = phases.find((p) => p.id === this.config.topPhaseId) || phases[0];
    const bottomPhase = phases.find((p) => p.id === this.config.bottomPhaseId) || phases[2];
    const descendingPhase =
      phases.find((p) => p.id === this.config.descendingPhaseId) || phases[1];
    const ascendingPhase =
      phases.find((p) => p.id === this.config.ascendingPhaseId) || phases[3];

    const topThreshold = topPhase.condition.threshold;
    const bottomThreshold = bottomPhase.condition.threshold;

    if (primaryAngle >= topThreshold) {
      return topPhase;
    }

    if (primaryAngle <= bottomThreshold) {
      return bottomPhase;
    }

    if (
      previousPhaseId === bottomPhase.id ||
      previousPhaseId === ascendingPhase.id ||
      isIncreasing
    ) {
      return ascendingPhase;
    }

    if (
      previousPhaseId === topPhase.id ||
      previousPhaseId === descendingPhase.id ||
      isDecreasing
    ) {
      return descendingPhase;
    }

    return descendingPhase;
  }

  /**
   * Evaluates active rules and produces immediate real-time feedback.
   * Enforces violation persistence: flags a violation ONLY if it persists
   * for at least minViolationFrames consecutive frames (default 5).
   */
  evaluateRules(
    angles: Record<string, number | null>,
    currentPhase: PhaseDefinition
  ): {
    activeViolations: FormRule[];
    feedback: {
      message: string;
      type: 'success' | 'warning' | 'error';
      remedy?: string;
    };
  } {
    const activeViolations: FormRule[] = [];

    for (const rule of this.config.rules) {
      if (rule.triggerPhase === 'bottom_requirement') {
        continue;
      }

      if (
        rule.triggerPhase &&
        rule.triggerPhase !== 'all' &&
        rule.triggerPhase !== currentPhase.id
      ) {
        this.consecutiveViolationCounts.set(rule.id, 0);
        continue;
      }

      const angleVal = angles[rule.condition.angleId];
      if (angleVal === null || angleVal === undefined) {
        this.consecutiveViolationCounts.set(rule.id, 0);
        continue;
      }

      let isViolatedOnThisFrame = false;
      const { operator, threshold } = rule.condition;

      switch (operator) {
        case '>':
          isViolatedOnThisFrame = angleVal > threshold;
          break;
        case '>=':
          isViolatedOnThisFrame = angleVal >= threshold;
          break;
        case '<':
          isViolatedOnThisFrame = angleVal < threshold;
          break;
        case '<=':
          isViolatedOnThisFrame = angleVal <= threshold;
          break;
      }

      const currentCount = this.consecutiveViolationCounts.get(rule.id) || 0;
      if (isViolatedOnThisFrame) {
        const nextCount = currentCount + 1;
        this.consecutiveViolationCounts.set(rule.id, nextCount);

        const requiredFrames = rule.minViolationFrames ?? 5;
        if (nextCount >= requiredFrames) {
          activeViolations.push(rule);
        }
      } else {
        this.consecutiveViolationCounts.set(rule.id, 0);
      }
    }

    // Generate constructive real-time feedback
    if (activeViolations.length > 0) {
      const topViolation = activeViolations[0];
      return {
        activeViolations,
        feedback: {
          message: topViolation.message,
          type: topViolation.severity,
          remedy: topViolation.remedy,
        },
      };
    }

    if (currentPhase.id === this.config.topPhaseId) {
      return {
        activeViolations: [],
        feedback: {
          message: 'Ready: begin lowering with steady control',
          type: 'success',
        },
      };
    } else if (currentPhase.id === this.config.bottomPhaseId) {
      return {
        activeViolations: [],
        feedback: {
          message: 'Great depth reached! Drive upward powerfully',
          type: 'success',
        },
      };
    } else if (currentPhase.id === this.config.descendingPhaseId) {
      return {
        activeViolations: [],
        feedback: {
          message: 'Smooth descent: maintain posture and depth',
          type: 'success',
        },
      };
    } else {
      return {
        activeViolations: [],
        feedback: {
          message: 'Good ascent: return to full extension',
          type: 'success',
        },
      };
    }
  }

  reset() {
    this.primaryAngleHistory = [];
    this.consecutiveViolationCounts.clear();
  }
}
