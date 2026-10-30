/**
 * Joint Angle & Biomechanical Calculations
 * Scales normalized landmark coordinates to video pixel space to prevent aspect ratio distortion.
 */

import { Landmark } from '../types/pose';

export const VISIBILITY_THRESHOLD = 0.5;

/**
 * Computes the interior angle at vertex `b` formed by points a, b, c in degrees [0, 180].
 * Scales normalized coordinates by video width and height for accurate euclidean angle.
 * Returns null if any landmark is missing or has visibility < 0.5.
 */
export function calculateAngle(
  a?: Landmark | null,
  b?: Landmark | null,
  c?: Landmark | null,
  width = 1,
  height = 1,
  minVisibility = VISIBILITY_THRESHOLD
): number | null {
  if (!a || !b || !c) return null;

  if (
    (a.visibility !== undefined && a.visibility < minVisibility) ||
    (b.visibility !== undefined && b.visibility < minVisibility) ||
    (c.visibility !== undefined && c.visibility < minVisibility)
  ) {
    return null;
  }

  // Scale coordinates to video pixel space
  const ax = a.x * width;
  const ay = a.y * height;
  const bx = b.x * width;
  const by = b.y * height;
  const cx = c.x * width;
  const cy = c.y * height;

  // Vector ba: from b to a
  const baX = ax - bx;
  const baY = ay - by;

  // Vector bc: from b to c
  const bcX = cx - bx;
  const bcY = cy - by;

  const dotProduct = baX * bcX + baY * bcY;
  const magBA = Math.hypot(baX, baY);
  const magBC = Math.hypot(bcX, bcY);

  if (magBA === 0 || magBC === 0) return null;

  const cosine = Math.max(-1, Math.min(1, dotProduct / (magBA * magBC)));
  const angleRad = Math.acos(cosine);
  const angleDeg = (angleRad * 180) / Math.PI;

  return Math.round(angleDeg * 10) / 10;
}

/**
 * Computes torso inclination angle relative to vertical (in degrees [0, 90+]).
 * Scales normalized coordinates by video width and height.
 * 0 degrees = upright vertical spine.
 */
export function calculateTorsoInclination(
  shoulder?: Landmark | null,
  hip?: Landmark | null,
  width = 1,
  height = 1,
  minVisibility = VISIBILITY_THRESHOLD
): number | null {
  if (!shoulder || !hip) return null;

  if (
    (shoulder.visibility !== undefined && shoulder.visibility < minVisibility) ||
    (hip.visibility !== undefined && hip.visibility < minVisibility)
  ) {
    return null;
  }

  const dx = (shoulder.x - hip.x) * width;
  const dy = (hip.y - shoulder.y) * height; // Positive when shoulder is above hip

  const angleRad = Math.atan2(Math.abs(dx), Math.abs(dy));
  const angleDeg = (angleRad * 180) / Math.PI;

  return Math.round(angleDeg * 10) / 10;
}

/**
 * Computes signed hip deviation for push-up posture:
 * Perpendicular distance of the hip from the shoulder-ankle line, normalized by torso length.
 * Negative = sag (hip dropped below line towards floor)
 * Positive = pike (hip raised above line towards ceiling)
 */
export function calculateSignedHipDeviation(
  shoulder?: Landmark | null,
  hip?: Landmark | null,
  ankle?: Landmark | null,
  width = 1,
  height = 1,
  minVisibility = VISIBILITY_THRESHOLD
): number | null {
  if (!shoulder || !hip || !ankle) return null;

  if (
    (shoulder.visibility !== undefined && shoulder.visibility < minVisibility) ||
    (hip.visibility !== undefined && hip.visibility < minVisibility) ||
    (ankle.visibility !== undefined && ankle.visibility < minVisibility)
  ) {
    return null;
  }

  const sx = shoulder.x * width;
  const sy = shoulder.y * height;
  const hx = hip.x * width;
  const hy = hip.y * height;
  const ax = ankle.x * width;
  const ay = ankle.y * height;

  const torsoLength = Math.hypot(hx - sx, hy - sy);
  if (torsoLength < 1) return null;

  const lineDx = ax - sx;
  const lineDy = ay - sy;
  const lineLength = Math.hypot(lineDx, lineDy);
  if (lineLength < 1) return null;

  // Project hip onto shoulder-ankle line
  const t = ((hx - sx) * lineDx + (hy - sy) * lineDy) / (lineLength * lineLength);
  const projY = sy + t * lineDy;

  // Floor is +y in canvas coordinate space.
  // If hip has sagged towards the floor: hy > projY => (projY - hy) is negative.
  // If hip has piked towards ceiling: hy < projY => (projY - hy) is positive.
  const cosTheta = Math.abs(lineDx) / lineLength;
  const perpendicularDist = (projY - hy) * cosTheta;

  const signedDeviation = perpendicularDist / torsoLength;
  return Math.round(signedDeviation * 1000) / 1000;
}

/**
 * Determines whether the left or right side is more visible in the current frame.
 */
export function getDominantSide(
  landmarks: Landmark[],
  minVisibility = VISIBILITY_THRESHOLD
): 'left' | 'right' {
  const leftIndices = [11, 23, 25, 27];
  const rightIndices = [12, 24, 26, 28];

  const leftVis = leftIndices.reduce((sum, idx) => sum + (landmarks[idx]?.visibility ?? 0), 0);
  const rightVis = rightIndices.reduce((sum, idx) => sum + (landmarks[idx]?.visibility ?? 0), 0);

  return leftVis >= rightVis ? 'left' : 'right';
}
