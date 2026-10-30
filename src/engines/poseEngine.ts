/**
 * MediaPipe Pose Landmarker Engine
 * Implements standard PoseEngine interface for modular, pluggable architecture.
 * Loads the local model from /models/pose_landmarker_lite.task with pinned CDN WASM.
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { Landmark, PoseEngine, PoseEngineResult } from '../types/pose';

// Pinned to installed @mediapipe/tasks-vision version 1.2.0
const WASM_CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm';
const MODEL_ASSET_PATH = '/models/pose_landmarker_lite.task';

export class MediaPipePoseEngine implements PoseEngine {
  readonly name = 'MediaPipe PoseLandmarker Lite';
  private landmarker: PoseLandmarker | null = null;
  private initializing = false;
  private ready = false;

  async init(): Promise<void> {
    if (this.ready && this.landmarker) return;
    if (this.initializing) return;

    this.initializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN_URL);

      const createLandmarker = async (delegate: 'GPU' | 'CPU') => {
        return await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate,
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      };

      // Try GPU delegate first for maximum performance, fallback to CPU
      try {
        this.landmarker = await createLandmarker('GPU');
      } catch (gpuError) {
        console.warn('GPU delegate failed, falling back to CPU delegate:', gpuError);
        this.landmarker = await createLandmarker('CPU');
      }

      this.ready = true;
    } catch (error) {
      console.error('Failed to initialize MediaPipe PoseLandmarker:', error);
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  async detect(
    image: HTMLVideoElement | HTMLCanvasElement,
    timestampMs: number
  ): Promise<PoseEngineResult | null> {
    if (!this.ready || !this.landmarker) {
      return null;
    }

    try {
      const result = this.landmarker.detectForVideo(image, Math.round(timestampMs));
      if (result && result.landmarks && result.landmarks.length > 0) {
        return {
          landmarks: result.landmarks[0] as Landmark[],
          worldLandmarks:
            result.worldLandmarks && result.worldLandmarks.length > 0
              ? (result.worldLandmarks[0] as Landmark[])
              : null,
        };
      }
      return null;
    } catch (err) {
      console.debug('MediaPipe frame detection error:', err);
      return null;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  destroy(): void {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
    this.ready = false;
  }
}
