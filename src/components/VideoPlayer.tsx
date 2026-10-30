/**
 * VideoPlayer Component:
 * Manages video sources (Webcam, Uploaded mp4/webm file, Sample Motion),
 * handles playback control, mirror toggle, and overlays SkeletonCanvas.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CameraView, ExerciseType, Landmark } from '../types/pose';
import { SkeletonCanvas } from './SkeletonCanvas';
import { createSampleMotionStream } from '../utils/sampleMedia';
import {
  Camera,
  Upload,
  Play,
  Pause,
  RotateCcw,
  FlipHorizontal,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Sparkles,
  Video as VideoIcon,
} from 'lucide-react';
import { soundController } from '../utils/audio';

interface VideoPlayerProps {
  exercise: ExerciseType;
  cameraView: CameraView;
  onExerciseChange: (exercise: ExerciseType) => void;
  onCameraViewChange: (view: CameraView) => void;
  onFrame: (video: HTMLVideoElement, timestampMs: number) => void;
  landmarks: Landmark[] | null;
  angles: Record<string, number | null>;
  dominantSide: 'left' | 'right';
  hasViolations: boolean;
  isModelReady: boolean;
  modelLoadingMessage: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  exercise,
  cameraView,
  onExerciseChange,
  onCameraViewChange,
  onFrame,
  landmarks,
  angles,
  dominantSide,
  hasViolations,
  isModelReady,
  modelLoadingMessage,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sourceType, setSourceType] = useState<'sample' | 'webcam' | 'upload'>('sample');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [showAngles, setShowAngles] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: 640,
    height: 480,
  });
  const [cameraError, setCameraError] = useState<string | null>(null);

  const sampleStreamCleanupRef = useRef<(() => void) | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Sync sound controller state
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundController.enabled = next;
  };

  // Cleanup active streams
  const stopCurrentSource = useCallback(() => {
    if (sampleStreamCleanupRef.current) {
      sampleStreamCleanupRef.current();
      sampleStreamCleanupRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  // Initialize sample motion stream
  const initSampleStream = useCallback(() => {
    stopCurrentSource();
    setCameraError(null);
    if (!hiddenCanvasRef.current || !videoRef.current) return;

    const { stop, getStream } = createSampleMotionStream(exercise, hiddenCanvasRef.current, 30);
    sampleStreamCleanupRef.current = stop;

    const stream = getStream();
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [exercise, stopCurrentSource]);

  // Initialize webcam
  const initWebcam = useCallback(async () => {
    stopCurrentSource();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
        setIsMirrored(true); // Default mirror for webcam
      }
    } catch (err) {
      console.error('Camera access denied or unavailable:', err);
      setCameraError('Unable to access camera. Please check permissions or upload a video.');
    }
  }, [stopCurrentSource]);

  // Initialize uploaded video
  const initUploadedVideo = useCallback(
    (url: string) => {
      stopCurrentSource();
      setCameraError(null);
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.loop = true;
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
        setIsMirrored(false);
      }
    },
    [stopCurrentSource]
  );

  // Trigger source switch
  useEffect(() => {
    if (sourceType === 'sample') {
      initSampleStream();
    } else if (sourceType === 'webcam') {
      initWebcam();
    } else if (sourceType === 'upload' && uploadedVideoUrl) {
      initUploadedVideo(uploadedVideoUrl);
    }
    return () => {
      stopCurrentSource();
    };
  }, [sourceType, uploadedVideoUrl, initSampleStream, initWebcam, initUploadedVideo, stopCurrentSource]);

  // Video metadata loaded -> update dimensions
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth || 640,
        height: videoRef.current.videoHeight || 480,
      });
    }
  };

  // Continuous frame processing loop
  useEffect(() => {
    let active = true;

    const processLoop = (now: number) => {
      if (!active) return;

      const video = videoRef.current;
      if (video && !video.paused && !video.ended && video.readyState >= 2) {
        onFrame(video, now);
      }

      animFrameIdRef.current = requestAnimationFrame(processLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(processLoop);

    return () => {
      active = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [onFrame]);

  // Handle uploaded video file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedVideoUrl(url);
      setSourceType('upload');
    }
  };

  // Play/pause controls
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true));
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleRestart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().then(() => setIsPlaying(true));
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Top Configuration Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg backdrop-blur-md">
        {/* Exercise Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exercise:</span>
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => onExerciseChange('squat')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                exercise === 'squat'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Squat
            </button>
            <button
              onClick={() => onExerciseChange('pushup')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                exercise === 'pushup'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Push-up
            </button>
          </div>
        </div>

        {/* Camera View Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">View:</span>
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            {(['lateral', 'frontal', 'diagonal'] as CameraView[]).map((view) => (
              <button
                key={view}
                onClick={() => onCameraViewChange(view)}
                className={`px-2.5 py-1 text-xs font-medium capitalize rounded-md transition-all ${
                  cameraView === view
                    ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {/* Source Mode Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setSourceType('sample')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              sourceType === 'sample'
                ? 'bg-purple-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Use built-in simulated motion stream"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sample Demo</span>
          </button>

          <button
            onClick={() => setSourceType('webcam')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              sourceType === 'webcam'
                ? 'bg-purple-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Use live webcam feed"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Webcam</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              sourceType === 'upload'
                ? 'bg-purple-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Upload MP4 or WebM video file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Video</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center group">
        {/* Hidden Canvas for Sample Stream Generation */}
        <canvas ref={hiddenCanvasRef} className="hidden" />

        {/* Video Element */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          onLoadedMetadata={handleLoadedMetadata}
          className={`w-full h-full object-contain ${isMirrored ? 'scale-x-[-1]' : ''}`}
        />

        {/* Skeleton Canvas Overlay */}
        <SkeletonCanvas
          landmarks={landmarks}
          width={videoDimensions.width}
          height={videoDimensions.height}
          isMirrored={isMirrored}
          angles={angles}
          dominantSide={dominantSide}
          hasViolations={hasViolations}
          showAngles={showAngles}
          showSkeleton={showSkeleton}
        />

        {/* Model Initialization Overlay */}
        {!isModelReady && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <h4 className="text-white font-semibold text-sm">Initializing PoseLandmarker...</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">{modelLoadingMessage}</p>
          </div>
        )}

        {/* Camera Permission / Error Warning */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
            <VideoIcon className="w-10 h-10 text-rose-400 mb-2" />
            <p className="text-sm font-semibold text-rose-300">{cameraError}</p>
            <button
              onClick={() => setSourceType('sample')}
              className="mt-4 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition"
            >
              Switch to Sample Motion Demo
            </button>
          </div>
        )}

        {/* Video HUD Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/80 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE POSE
          </div>
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/80 px-2.5 py-1 rounded-md text-[11px] font-mono text-slate-300">
            {sourceType.toUpperCase()}
          </div>
        </div>

        {/* Bottom Floating Control Bar */}
        <div className="absolute bottom-3 inset-x-3 bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-2 flex items-center justify-between text-slate-300 transition-all opacity-90 group-hover:opacity-100 z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={handleRestart}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="Restart Video"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* Mirror Toggle */}
            <button
              onClick={() => setIsMirrored((m) => !m)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
                isMirrored ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'
              }`}
              title="Mirror Video Feed"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mirror</span>
            </button>

            {/* Skeleton Overlay Toggle */}
            <button
              onClick={() => setShowSkeleton((s) => !s)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
                showSkeleton ? 'bg-slate-700 text-emerald-400' : 'hover:bg-slate-800 text-slate-400'
              }`}
              title="Toggle Skeleton Overlay"
            >
              {showSkeleton ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Skeleton</span>
            </button>

            {/* Joint Angles Toggle */}
            <button
              onClick={() => setShowAngles((a) => !a)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
                showAngles ? 'bg-slate-700 text-sky-400' : 'hover:bg-slate-800 text-slate-400'
              }`}
              title="Toggle Angles Display"
            >
              <span className="font-mono font-bold text-xs">∠</span>
              <span className="hidden sm:inline">Angles</span>
            </button>

            {/* Audio Cue Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-1.5 rounded-lg transition ${
                soundEnabled ? 'text-emerald-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'
              }`}
              title={soundEnabled ? 'Mute Audio Cues' : 'Enable Audio Cues'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
