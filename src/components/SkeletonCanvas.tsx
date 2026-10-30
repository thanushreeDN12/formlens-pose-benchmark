/**
 * SkeletonCanvas: Renders MediaPipe 33-landmark pose skeleton,
 * joint points, and live angle annotations directly over video frames.
 */

import React, { useEffect, useRef } from 'react';
import { Landmark } from '../types/pose';

interface SkeletonCanvasProps {
  landmarks: Landmark[] | null;
  width: number;
  height: number;
  isMirrored?: boolean;
  angles?: Record<string, number | null>;
  dominantSide?: 'left' | 'right';
  hasViolations?: boolean;
  showAngles?: boolean;
  showSkeleton?: boolean;
}

const POSE_CONNECTIONS: [number, number][] = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // Shoulders & Torso
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  // Arms
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  // Legs
  [23, 25], [25, 27],
  [24, 26], [26, 28],
  // Feet
  [27, 29], [29, 31],
  [28, 30], [30, 32],
];

export const SkeletonCanvas: React.FC<SkeletonCanvasProps> = ({
  landmarks,
  width,
  height,
  isMirrored = false,
  angles = {},
  dominantSide = 'left',
  hasViolations = false,
  showAngles = true,
  showSkeleton = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length === 0 || !showSkeleton) {
      return;
    }

    const mapX = (x: number) => (isMirrored ? (1 - x) * width : x * width);
    const mapY = (y: number) => y * height;

    // Line styles
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Base color depending on violations
    const primaryColor = hasViolations ? '#ef4444' : '#10b981';
    const secondaryColor = hasViolations ? '#f87171' : '#38bdf8';

    // 1. Draw connections
    for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];

      if (!p1 || !p2) continue;
      if ((p1.visibility ?? 1) < 0.4 || (p2.visibility ?? 1) < 0.4) continue;

      const x1 = mapX(p1.x);
      const y1 = mapY(p1.y);
      const x2 = mapX(p2.x);
      const y2 = mapY(p2.y);

      // Distinguish torso vs limbs
      const isDominant =
        dominantSide === 'left'
          ? [11, 13, 15, 23, 25, 27].includes(startIdx) && [11, 13, 15, 23, 25, 27].includes(endIdx)
          : [12, 14, 16, 24, 26, 28].includes(startIdx) && [12, 14, 16, 24, 26, 28].includes(endIdx);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isDominant ? primaryColor : secondaryColor;
      ctx.shadowColor = isDominant ? primaryColor : secondaryColor;
      ctx.shadowBlur = 6;
      ctx.stroke();
    }

    // Reset shadow
    ctx.shadowBlur = 0;

    // 2. Draw keypoints
    landmarks.forEach((lm, index) => {
      if ((lm.visibility ?? 1) < 0.4) return;
      const x = mapX(lm.x);
      const y = mapY(lm.y);

      // Skip facial detail points except nose (0) for cleaner display
      if (index > 0 && index < 11) return;

      const isMajorJoint = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(index);
      const radius = isMajorJoint ? 5.5 : 3.5;

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
      ctx.fillStyle = hasViolations ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)';
      ctx.fill();

      // Solid center dot
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isMajorJoint ? '#ffffff' : primaryColor;
      ctx.fill();
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 3. Draw live angle labels at key joints
    if (showAngles && angles) {
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const sideIndex = dominantSide === 'left' ? 0 : 1;

      // Knee angle label
      const kneeIdx = sideIndex === 0 ? 25 : 26;
      if (angles['knee_angle'] !== null && landmarks[kneeIdx] && (landmarks[kneeIdx].visibility ?? 1) >= 0.5) {
        drawAngleBadge(
          ctx,
          mapX(landmarks[kneeIdx].x),
          mapY(landmarks[kneeIdx].y) + 18,
          `Knee: ${Math.round(angles['knee_angle']!)}°`,
          hasViolations && angles['knee_angle']! > 100 ? '#ef4444' : '#10b981'
        );
      }

      // Hip angle label
      const hipIdx = sideIndex === 0 ? 23 : 24;
      if (angles['hip_angle'] !== null && landmarks[hipIdx] && (landmarks[hipIdx].visibility ?? 1) >= 0.5) {
        drawAngleBadge(
          ctx,
          mapX(landmarks[hipIdx].x) - 30,
          mapY(landmarks[hipIdx].y),
          `Hip: ${Math.round(angles['hip_angle']!)}°`,
          '#38bdf8'
        );
      }

      // Elbow angle label (for push-ups or general)
      const elbowIdx = sideIndex === 0 ? 13 : 14;
      if (angles['elbow_angle'] !== null && landmarks[elbowIdx] && (landmarks[elbowIdx].visibility ?? 1) >= 0.5) {
        drawAngleBadge(
          ctx,
          mapX(landmarks[elbowIdx].x),
          mapY(landmarks[elbowIdx].y) - 18,
          `Elbow: ${Math.round(angles['elbow_angle']!)}°`,
          hasViolations ? '#ef4444' : '#10b981'
        );
      }

      // Signed hip deviation (push-up)
      if (angles['signed_hip_deviation'] !== undefined && angles['signed_hip_deviation'] !== null && landmarks[hipIdx] && (landmarks[hipIdx].visibility ?? 1) >= 0.5) {
        const dev = angles['signed_hip_deviation']!;
        const isBad = dev < -0.10 || dev > 0.12;
        const signStr = dev > 0 ? `+${dev.toFixed(2)}` : dev.toFixed(2);
        drawAngleBadge(
          ctx,
          mapX(landmarks[hipIdx].x),
          mapY(landmarks[hipIdx].y) - 22,
          `Offset: ${signStr}`,
          isBad ? '#ef4444' : '#10b981'
        );
      } else if (angles['body_line_angle'] !== null && landmarks[hipIdx] && (landmarks[hipIdx].visibility ?? 1) >= 0.5) {
        const isSagging = (angles['body_line_angle'] ?? 180) < 160;
        drawAngleBadge(
          ctx,
          mapX(landmarks[hipIdx].x),
          mapY(landmarks[hipIdx].y) - 22,
          `Line: ${Math.round(angles['body_line_angle']!)}°`,
          isSagging ? '#ef4444' : '#10b981'
        );
      }

      // Torso inclination badge
      const shoulderIdx = sideIndex === 0 ? 11 : 12;
      if (angles['torso_inclination'] !== null && landmarks[shoulderIdx] && (landmarks[shoulderIdx].visibility ?? 1) >= 0.5) {
        const isExcessive = (angles['torso_inclination'] ?? 0) > 42;
        drawAngleBadge(
          ctx,
          mapX(landmarks[shoulderIdx].x) + 32,
          mapY(landmarks[shoulderIdx].y),
          `Torso: ${Math.round(angles['torso_inclination']!)}°`,
          isExcessive ? '#f59e0b' : '#38bdf8'
        );
      }
    }
  }, [landmarks, width, height, isMirrored, angles, dominantSide, hasViolations, showAngles, showSkeleton]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none w-full h-full"
    />
  );
};

function drawAngleBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  badgeColor: string
) {
  const paddingX = 8;
  const paddingY = 4;
  const metrics = ctx.measureText(text);
  const bgWidth = metrics.width + paddingX * 2;
  const bgHeight = 20;

  // Background pill
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight, 4);
  ctx.fill();

  // Border with color
  ctx.strokeStyle = badgeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}
