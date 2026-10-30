/**
 * Moving-Average Smoothing Filter for Joint Angles
 * Uses a sliding window of N frames (default 5) to remove jitter while preserving responsiveness.
 */

export class MovingAverageFilter {
  private windowSize: number;
  private history: Map<string, number[]>;

  constructor(windowSize = 5) {
    this.windowSize = windowSize;
    this.history = new Map();
  }

  /**
   * Filters an angle value for a specific angle ID.
   * If value is null, returns the most recent smoothed value or null if empty.
   */
  filter(angleId: string, value: number | null): number | null {
    if (!this.history.has(angleId)) {
      this.history.set(angleId, []);
    }

    const buffer = this.history.get(angleId)!;

    if (value !== null && !isNaN(value)) {
      buffer.push(value);
      if (buffer.length > this.windowSize) {
        buffer.shift();
      }
    } else {
      // If null/missing, we don't add to buffer, but if buffer is empty, return null
      if (buffer.length === 0) return null;
    }

    if (buffer.length === 0) return null;

    const sum = buffer.reduce((acc, curr) => acc + curr, 0);
    const avg = sum / buffer.length;

    return Math.round(avg * 10) / 10;
  }

  /**
   * Filters all angles in a record map.
   */
  filterAll(angles: Record<string, number | null>): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    for (const [id, value] of Object.entries(angles)) {
      result[id] = this.filter(id, value);
    }
    return result;
  }

  /**
   * Resets all history buffers (e.g., when switching exercises or resetting session).
   */
  reset(): void {
    this.history.clear();
  }
}
