/**
 * Joint Angle & Biomechanical Calculations
 * Follows standard 3-point joint angle math with landmark visibility checking.
 */

import { Landmark } from '../types/pose';

export const VISIBILITY_THRESHOLD = 0.5;

/**
 * Computes the interior angle at vertex `b` formed by points a, b, c in degrees [0, 180].
 * Returns null if any landmark is missing or has visibility < 0.5.
 */
export function calculateAngle(
  a?: Landmark | null,
  b?: Landmark | null,
  c?: Landmark | null,
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

  // Vector ba: from b to a
  const baX = a.x - b.x;
  const baY = a.y - b.y;

  // Vector bc: from b to c
  const bcX = c.x - b.x;
  const bcY = c.y - b.y;

  const dotProduct = baX * bcX + baY * bcY;
  const magBA = Math.sqrt(baX * baX + baY * baY);
  const magBC = Math.sqrt(bcX * bcX + bcY * bcY);

  if (magBA === 0 || magBC === 0) return null;

  // Clamp cosine to [-1, 1] to avoid NaN from floating point precision issues
  const cosine = Math.max(-1, Math.min(1, dotProduct / (magBA * magBC)));
  const angleRad = Math.acos(cosine);
  const angleDeg = (angleRad * 180) / Math.PI;

  return Math.round(angleDeg * 10) / 10;
}

/**
 * Computes torso inclination angle relative to vertical (in degrees [0, 90+]).
 * 0 degrees = perfectly upright (shoulder directly above hip).
 * As the torso bends forward, the angle increases towards 90 degrees.
 */
export function calculateTorsoInclination(
  shoulder?: Landmark | null,
  hip?: Landmark | null,
  minVisibility = VISIBILITY_THRESHOLD
): number | null {
  if (!shoulder || !hip) return null;

  if (
    (shoulder.visibility !== undefined && shoulder.visibility < minVisibility) ||
    (hip.visibility !== undefined && hip.visibility < minVisibility)
  ) {
    return null;
  }

  // In normalized screen coordinates, y increases downwards.
  // Vector from hip to shoulder:
  const dx = shoulder.x - hip.x;
  const dy = hip.y - shoulder.y; // Positive when shoulder is above hip

  // Angle with vertical line (where vertical is dx=0, dy>0)
  const angleRad = Math.atan2(Math.abs(dx), Math.abs(dy));
  const angleDeg = (angleRad * 180) / Math.PI;

  return Math.round(angleDeg * 10) / 10;
}

/**
 * Determines whether the left or right side is more visible in the current frame.
 * Falls back to 'left' if similar visibility.
 */
export function getDominantSide(
  landmarks: Landmark[],
  minVisibility = VISIBILITY_THRESHOLD
): 'left' | 'right' {
  // Key points: shoulder (11, 12), hip (23, 24), knee (25, 26), ankle (27, 28)
  const leftIndices = [11, 23, 25, 27];
  const rightIndices = [12, 24, 26, 28];

  const leftVis = leftIndices.reduce((sum, idx) => sum + (landmarks[idx]?.visibility ?? 0), 0);
  const rightVis = rightIndices.reduce((sum, idx) => sum + (landmarks[idx]?.visibility ?? 0), 0);

  return leftVis >= rightVis ? 'left' : 'right';
}
