/** Seconds of smoothing for the ride screen. Independent of how often revolutions arrive. */
export const DISPLAY_TAU_SEC = 3;

export function stepEma(previous: number | null, sample: number, dtSec: number, tauSec = DISPLAY_TAU_SEC): number {
  if (previous === null || dtSec <= 0 || tauSec <= 0) {
    return sample;
  }
  const alpha = 1 - Math.exp(-dtSec / tauSec);
  return previous + alpha * (sample - previous);
}
