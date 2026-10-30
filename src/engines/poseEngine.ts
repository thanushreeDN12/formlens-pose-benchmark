/**
 * MediaPipe Pose Landmarker Engine
 * Implements standard PoseEngine interface for modular, pluggable architecture.
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { Landmark, PoseEngine } from '../types/pose';

const WASM_CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

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

      // Try GPU delegate first for maximum FPS
      try {
        this.landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuError) {
        console.warn('GPU delegate failed, falling back to CPU delegate:', gpuError);
        this.landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_URL,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
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
  ): Promise<Landmark[] | null> {
    if (!this.ready || !this.landmarker) {
      return null;
    }

    try {
      // detectForVideo requires strictly monotonically increasing timestamp
      const result = this.landmarker.detectForVideo(image, Math.round(timestampMs));
      if (result && result.landmarks && result.landmarks.length > 0) {
        return result.landmarks[0] as Landmark[];
      }
      return null;
    } catch (err) {
      // In case of slight timestamp irregularities or frame drops
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
