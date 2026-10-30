/**
 * FormLens: AI Fitness Form Analyzer
 * Phase 1: Real-time pose tracking, joint angle computation, config-driven rule engine,
 * rep counting state machine, biomechanical feedback, and JSON telemetry export.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CameraView,
  ExerciseConfig,
  ExerciseType,
  FrameData,
  Landmark,
  PhaseDefinition,
  RepResult,
  RepState,
} from './types/pose';
import squatConfigJson from './rules/squat.json';
import pushupConfigJson from './rules/pushup.json';
import { RuleEngine } from './rules/ruleEngine';
import { RepCounter } from './rules/repCounter';
import { MovingAverageFilter } from './utils/smoothing';
import { MediaPipePoseEngine } from './engines/poseEngine';
import { soundController } from './utils/audio';

import { VideoPlayer } from './components/VideoPlayer';
import { MetricsPanel } from './components/MetricsPanel';
import { FeedbackPanel } from './components/FeedbackPanel';
import { RepTable } from './components/RepTable';
import { SessionSummary } from './components/SessionSummary';
import { Dumbbell, Zap, Layers } from 'lucide-react';

const squatConfig = squatConfigJson as unknown as ExerciseConfig;
const pushupConfig = pushupConfigJson as unknown as ExerciseConfig;

export default function App() {
  const [exercise, setExercise] = useState<ExerciseType>('squat');
  const [cameraView, setCameraView] = useState<CameraView>('lateral');

  // Engine references
  const poseEngineRef = useRef<MediaPipePoseEngine | null>(null);
  const ruleEngineRef = useRef<RuleEngine>(new RuleEngine(squatConfig));
  const repCounterRef = useRef<RepCounter>(new RepCounter(squatConfig));
  const filterRef = useRef<MovingAverageFilter>(new MovingAverageFilter(5));

  // Model loading state
  const [isModelReady, setIsModelReady] = useState(false);
  const [modelLoadingMessage, setModelLoadingMessage] = useState(
    'Loading MediaPipe Pose Landmarker from /models/pose_landmarker_lite.task...'
  );

  // Video metadata
  const [videoMeta, setVideoMeta] = useState<{
    fileName: string | null;
    width: number;
    height: number;
  }>({
    fileName: null,
    width: 640,
    height: 480,
  });

  // Live telemetry states
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [angles, setAngles] = useState<Record<string, number | null>>({});
  const [dominantSide, setDominantSide] = useState<'left' | 'right'>('left');
  const [currentPhase, setCurrentPhase] = useState<PhaseDefinition>(squatConfig.phases[0]);
  // Ref for phase tracking to eliminate callback re-creation
  const currentPhaseRef = useRef<PhaseDefinition>(squatConfig.phases[0]);

  const [activeViolations, setActiveViolations] = useState(squatConfig.rules.slice(0, 0));
  const [feedback, setFeedback] = useState<{
    message: string;
    type: 'success' | 'warning' | 'error';
    remedy?: string;
  }>({
    message: 'Stand in view to begin analysis',
    type: 'success',
  });

  // Reps & Performance tracking
  const [reps, setReps] = useState<RepResult[]>([]);
  const [repState, setRepState] = useState<RepState>({
    repCount: 0,
    goodReps: 0,
    badReps: 0,
    currentRepProgress: 0,
    isMoving: false,
    minAngleInCurrentRep: null,
  });

  // Telemetry metrics
  const [fps, setFps] = useState<number>(0);
  const [inferenceTimeMs, setInferenceTimeMs] = useState<number>(0);
  // Full, un-decimated frame history
  const [recordedFrames, setRecordedFrames] = useState<FrameData[]>([]);

  // Telemetry accumulators
  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameTimesRef = useRef<number[]>([]);
  const inferenceTimesRef = useRef<number[]>([]);
  const frameCountRef = useRef<number>(0);
  const lastDrawnTimestampRef = useRef<number>(-1);

  const activeConfig = exercise === 'squat' ? squatConfig : pushupConfig;

  // Initialize Pose Landmarker on mount
  useEffect(() => {
    let isMounted = true;
    const engine = new MediaPipePoseEngine();
    poseEngineRef.current = engine;

    async function loadEngine() {
      try {
        setModelLoadingMessage('Initializing PoseLandmarker from local model assets...');
        await engine.init();
        if (isMounted) {
          setIsModelReady(true);
          setModelLoadingMessage('Model active and ready.');
        }
      } catch (err) {
        console.error('Pose landmarker initialization failed:', err);
        if (isMounted) {
          setModelLoadingMessage('Model initialization failed. Please check network/assets.');
        }
      }
    }

    loadEngine();

    return () => {
      isMounted = false;
      engine.destroy();
    };
  }, []);

  // Update rule and rep engine configs when exercise changes
  const handleExerciseChange = useCallback((newExercise: ExerciseType) => {
    setExercise(newExercise);
    const cfg = newExercise === 'squat' ? squatConfig : pushupConfig;

    ruleEngineRef.current.setConfig(cfg);
    repCounterRef.current.setConfig(cfg);
    filterRef.current.reset();

    currentPhaseRef.current = cfg.phases[0];
    setCurrentPhase(cfg.phases[0]);
    setActiveViolations([]);
    setLandmarks(null);
    setAngles({});
    setReps([]);
    setRecordedFrames([]);
    frameCountRef.current = 0;
    lastDrawnTimestampRef.current = -1;
    setRepState({
      repCount: 0,
      goodReps: 0,
      badReps: 0,
      currentRepProgress: 0,
      isMoving: false,
      minAngleInCurrentRep: null,
    });
    setFeedback({
      message: `Switched to ${cfg.name}. Prepare for rep 1.`,
      type: 'success',
    });
  }, []);

  // Set up rep completion audio trigger
  useEffect(() => {
    repCounterRef.current.setOnRepComplete((completedRep) => {
      setReps((prev) => [...prev, completedRep]);

      if (completedRep.formLabel === 'good_form') {
        soundController.playRepComplete();
      } else {
        soundController.playWarningAlert();
      }
    });
  }, []);

  // Frame-accurate processing callback
  const handleFrame = useCallback(
    async (video: HTMLVideoElement, timestampMs: number) => {
      const engine = poseEngineRef.current;
      if (!engine || !engine.isReady()) return;

      // Avoid redundant execution on identical video time
      if (timestampMs === lastDrawnTimestampRef.current && timestampMs !== 0) {
        return;
      }
      lastDrawnTimestampRef.current = timestampMs;

      // Real FPS calculation
      const now = performance.now();
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      if (delta > 0 && delta < 500) {
        frameTimesRef.current.push(1000 / delta);
        if (frameTimesRef.current.length > 20) frameTimesRef.current.shift();
        const avgFps =
          frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        setFps(avgFps);
      }

      // Detection with timing
      const infStart = performance.now();
      const detectionResult = await engine.detect(video, timestampMs);
      const infDuration = performance.now() - infStart;

      inferenceTimesRef.current.push(infDuration);
      if (inferenceTimesRef.current.length > 20) inferenceTimesRef.current.shift();
      const avgInf =
        inferenceTimesRef.current.reduce((a, b) => a + b, 0) /
        inferenceTimesRef.current.length;
      setInferenceTimeMs(avgInf);

      if (!detectionResult || !detectionResult.landmarks) {
        setLandmarks(null);
        return;
      }

      const detectedLandmarks = detectionResult.landmarks;
      const detectedWorldLandmarks = detectionResult.worldLandmarks;
      setLandmarks(detectedLandmarks);

      // 1. ANGLE ACCURACY: scale coordinates by video pixel dimensions
      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;

      const { angles: rawAngles, dominantSide: domSide } =
        ruleEngineRef.current.computeAngles(detectedLandmarks, videoWidth, videoHeight);
      setDominantSide(domSide);

      // Apply 5-frame moving average filter
      const filteredAngles = filterRef.current.filterAll(rawAngles);
      setAngles(filteredAngles);

      // 7. CLEANUP: Use ref for previous phase instead of state dependency
      const phase = ruleEngineRef.current.determinePhase(
        filteredAngles,
        currentPhaseRef.current.id
      );
      currentPhaseRef.current = phase;
      setCurrentPhase(phase);

      // Evaluate rules & persistent violation check (minViolationFrames)
      const ruleEval = ruleEngineRef.current.evaluateRules(filteredAngles, phase);
      setActiveViolations(ruleEval.activeViolations);
      setFeedback(ruleEval.feedback);

      // Feed into state machine RepCounter
      const { repState: nextRepState } = repCounterRef.current.processFrame(
        phase,
        filteredAngles,
        ruleEval.activeViolations,
        timestampMs
      );
      setRepState(nextRepState);

      // 3. FULL EXPORT: Record every processed frame (no decimation, no cap, no dropping)
      frameCountRef.current += 1;
      const frameRecord: FrameData = {
        frameIndex: frameCountRef.current,
        mediaTimeMs: Math.round(timestampMs * 10) / 10,
        landmarks: detectedLandmarks,
        worldLandmarks: detectedWorldLandmarks,
        rawAngles,
        smoothedAngles: filteredAngles,
        phase: phase.id,
        inferenceTimeMs: Math.round(infDuration * 10) / 10,
      };

      setRecordedFrames((prev) => [...prev, frameRecord]);
    },
    [] // Stable callback reference
  );

  const handleResetSession = useCallback(() => {
    repCounterRef.current.reset();
    ruleEngineRef.current.reset();
    filterRef.current.reset();
    setReps([]);
    setRecordedFrames([]);
    frameCountRef.current = 0;
    lastDrawnTimestampRef.current = -1;
    setRepState({
      repCount: 0,
      goodReps: 0,
      badReps: 0,
      currentRepProgress: 0,
      isMoving: false,
      minAngleInCurrentRep: null,
    });
    setFeedback({
      message: 'Session reset. Ready for rep 1.',
      type: 'success',
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#090d14] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navigation / App Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-30 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-sky-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white font-sans">
                  Form<span className="text-emerald-400">Lens</span>
                </h1>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                  Phase 1 Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                WASM/GPU Biomechanical Pose Analyzer & Rep Engine
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  isModelReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-300">
                {isModelReady ? 'PoseLandmarker Active' : 'Loading Engine...'}
              </span>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Zero Cloud / 100% In-Browser</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Applet Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Video Viewport & Rep History (7 cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <VideoPlayer
            exercise={exercise}
            cameraView={cameraView}
            onExerciseChange={handleExerciseChange}
            onCameraViewChange={setCameraView}
            onFrame={handleFrame}
            onVideoMetaChange={setVideoMeta}
            landmarks={landmarks}
            angles={angles}
            dominantSide={dominantSide}
            hasViolations={activeViolations.length > 0}
            isModelReady={isModelReady}
            modelLoadingMessage={modelLoadingMessage}
          />

          <RepTable reps={reps} />
        </div>

        {/* Right Column: Live Metrics, Biomechanical Feedback & Session Summary (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <MetricsPanel
            fps={fps}
            inferenceTimeMs={inferenceTimeMs}
            currentPhase={currentPhase}
            angles={angles}
            config={activeConfig}
            repCount={repState.repCount}
            goodReps={repState.goodReps}
            badReps={repState.badReps}
            currentRepProgress={repState.currentRepProgress}
            dominantSide={dominantSide}
            minAngleInCurrentRep={repState.minAngleInCurrentRep}
          />

          <FeedbackPanel
            config={activeConfig}
            activeViolations={activeViolations}
            feedback={feedback}
          />

          <SessionSummary
            exercise={exercise}
            cameraView={cameraView}
            reps={reps}
            recordedFrames={recordedFrames}
            videoMeta={videoMeta}
            modelName={poseEngineRef.current?.name || 'MediaPipe PoseLandmarker Lite'}
            fps={fps}
            onResetSession={handleResetSession}
          />
        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-500 py-3 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Extensible Architecture: Pluggable PoseEngine (MediaPipe / YOLOv8 ready)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono">Config-Driven Rules</span>
            <span>•</span>
            <span className="font-mono">Frame-Accurate rVFC</span>
            <span>•</span>
            <span className="font-mono">Uncapped Telemetry Export</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
