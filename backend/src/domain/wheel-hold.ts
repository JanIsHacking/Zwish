const MIN_HOLD_MS = 800;
export const MAX_HOLD_MS = 3_000;

/**
 * Ride screen only. A revolution may take this many times as long as the last one (a hard
 * slowdown, or a missed magnet) and the packet may still be this late. The old ride window was
 * 1.5× the last gap, clamped to 0.8–3 s, and it used the same limit to drop the late edge. The
 * screen snapped to 0 before that pulse arrived, then ignored it, so power stayed 0 until the
 * next revolution closed.
 */
const RIDE_DECELERATION_FACTOR = 3;
const RIDE_NETWORK_SLACK_MS = 2_500;
const RIDE_MIN_HOLD_MS = 3_000;
const RIDE_MAX_HOLD_MS = 8_000;

/** How long a coast-down waits after the last pulse before the wheel counts as stopped. */
export function wheelHoldMs(lastDtUs: number): number {
  const fromGap = (lastDtUs / 1000) * 1.5;
  return Math.min(MAX_HOLD_MS, Math.max(MIN_HOLD_MS, fromGap));
}

export function wheelHasStopped(lastSampleAtMs: number | null, nowMs: number, lastDtUs: number): boolean {
  if (lastSampleAtMs === null) {
    return false;
  }
  return nowMs - lastSampleAtMs >= wheelHoldMs(lastDtUs);
}

/**
 * How long the ride screen keeps the last power. Silence is measured from when the server
 * received the pulse, so a Wi-Fi stall counts; the slack covers that, and the factor covers a
 * much slower next revolution arriving under its own dt.
 */
export function rideHoldMs(lastDtUs: number): number {
  const fromGap = (lastDtUs / 1000) * RIDE_DECELERATION_FACTOR + RIDE_NETWORK_SLACK_MS;
  return Math.min(RIDE_MAX_HOLD_MS, Math.max(RIDE_MIN_HOLD_MS, fromGap));
}

export function rideHasStopped(lastSampleAtMs: number | null, nowMs: number, lastDtUs: number): boolean {
  if (lastSampleAtMs === null) {
    return false;
  }
  return nowMs - lastSampleAtMs >= rideHoldMs(lastDtUs);
}

/**
 * A revolution closes unless its interval is already long enough that the ride screen would
 * have called the wheel stopped. After a break, the next edge starts the interval and only
 * another hold-cap gap keeps it open.
 */
export function closesRevolution(dtUs: number, previousDtUs: number, awaitingInterval: boolean): boolean {
  if (dtUs <= 0) {
    return false;
  }
  const limitMs = awaitingInterval || previousDtUs <= 0 ? RIDE_MAX_HOLD_MS : rideHoldMs(previousDtUs);
  return dtUs / 1000 < limitMs;
}
