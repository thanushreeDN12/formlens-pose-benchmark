/**
 * FormLens Pose & Biomechanics Types
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type ExerciseType = 'squat' | 'pushup';
export type CameraView = 'lateral' | 'frontal' | 'diagonal';

export interface PoseEngine {
  readonly name: string;
  init: () => Promise<void>;
  detect: (
    image: HTMLVideoElement | HTMLCanvasElement,
    timestampMs: number
  ) => Promise<Landmark[] | null>;
  destroy: () => void;
  isReady: () => boolean;
}

export type ComparisonOperator = '<' | '<=' | '>' | '>=';

export interface AngleDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'joint_3pt' | 'vertical_inclination';
  // 3 landmark indices: [a, b, c] where b is vertex (e.g., [hip, knee, ankle])
  leftLandmarks?: [number, number, number];
  rightLandmarks?: [number, number, number];
  // for vertical inclination: [shoulder, hip]
  leftVertical?: [number, number];
  rightVertical?: [number, number];
  idealRange?: [number, number];
  unit?: string;
}

export interface PhaseDefinition {
  id: string;
  name: string;
  color: string;
  // Trigger condition to enter or identify this phase
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
  // When should this rule be evaluated?
  // 'bottom' (only evaluated at lowest depth), 'all' (evaluated every frame during movement)
  triggerPhase?: string;
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
  cyclePhases: string[]; // sequence e.g. ['standing', 'descending', 'bottom', 'ascending']
  bottomPhaseId: string;
  topPhaseId: string;
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
  timestampMs: number;
  keypoints: Landmark[];
  angles: Record<string, number | null>;
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
}

export interface SessionExportData {
  app: string;
  version: string;
  exercise: ExerciseType | string;
  cameraView: CameraView;
  exportedAt: string;
  metrics: SessionMetrics;
  reps: RepResult[];
  frames: FrameData[];
}
