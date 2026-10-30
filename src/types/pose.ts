/**
 * FormLens Pose & Biomechanics Types
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseEngineResult {
  landmarks: Landmark[] | null;
  worldLandmarks: Landmark[] | null;
}

export type ExerciseType = 'squat' | 'pushup';
export type CameraView = 'lateral' | 'frontal' | 'diagonal';

export interface PoseEngine {
  readonly name: string;
  init: () => Promise<void>;
  detect: (
    image: HTMLVideoElement | HTMLCanvasElement,
    timestampMs: number
  ) => Promise<PoseEngineResult | null>;
  destroy: () => void;
  isReady: () => boolean;
}

export type ComparisonOperator = '<' | '<=' | '>' | '>=';

export interface AngleDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'joint_3pt' | 'vertical_inclination' | 'signed_hip_deviation';
  // 3 landmark indices: [a, b, c] where b is vertex (e.g., [hip, knee, ankle])
  leftLandmarks?: [number, number, number];
  rightLandmarks?: [number, number, number];
  // for vertical inclination: [shoulder, hip]
  leftVertical?: [number, number];
  rightVertical?: [number, number];
  // for signed hip deviation: [shoulder, hip, ankle]
  leftHipDeviation?: [number, number, number];
  rightHipDeviation?: [number, number, number];
  idealRange?: [number, number];
  unit?: string;
}

export interface PhaseDefinition {
  id: string;
  name: string;
  color: string;
  condition: {
    angleId: string;
    operator: ComparisonOperator;
    threshold: number;
  };
}

export interface FormRule {
  id: string;
  name: string;
  message: string;
  severity: 'warning' | 'error';
  triggerPhase?: string;
  minViolationFrames?: number; // Flag rule only if violated for at least N consecutive frames
  condition: {
    angleId: string;
    operator: ComparisonOperator;
    threshold: number;
  };
  remedy?: string;
}

export interface ExerciseConfig {
  id: ExerciseType | string;
  name: string;
  description: string;
  primaryAngleId: string;
  angles: AngleDefinition[];
  phases: PhaseDefinition[];
  cyclePhases: string[];
  bottomPhaseId: string;
  topPhaseId: string;
  descendingPhaseId: string;
  ascendingPhaseId: string;
  reboundAngle: number;
  minRomAngle: number;
  rules: FormRule[];
}

export interface RepState {
  repCount: number;
  goodReps: number;
  badReps: number;
  currentRepProgress: number;
  isMoving: boolean;
  minAngleInCurrentRep: number | null;
}

export interface RepResult {
  repNumber: number;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  minAngleReached: number;
  formLabel: 'good_form' | 'bad_form';
  violations: string[];
  timestamp: string;
}

export interface FrameData {
  frameIndex: number;
  mediaTimeMs: number;
  landmarks: Landmark[];
  worldLandmarks: Landmark[] | null;
  rawAngles: Record<string, number | null>;
  smoothedAngles: Record<string, number | null>;
  phase: string;
  inferenceTimeMs: number;
}

export interface SessionMetrics {
  totalReps: number;
  goodReps: number;
  badReps: number;
  goodFormPercentage: number;
  mostCommonViolation: string | null;
  avgFps: number;
  avgInferenceTimeMs: number;
  sessionDurationSec: number;
  totalFrames: number;
}

export interface SessionExportHeader {
  app: string;
  version: string;
  modelName: string;
  exercise: ExerciseType | string;
  cameraView: CameraView;
  videoFileName: string | null;
  videoWidth: number;
  videoHeight: number;
  fps: number;
  avgFps: number;
  avgInferenceTimeMs: number;
  totalFrames: number;
  exportedAt: string;
}

export interface SessionExportData {
  header: SessionExportHeader;
  metrics: SessionMetrics;
  reps: RepResult[];
  frames: FrameData[];
}
