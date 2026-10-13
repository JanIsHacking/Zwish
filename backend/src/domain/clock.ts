/**
 * Maps the ESP monotonic clock onto UTC.
 * offsetUs satisfies utcMicros = monoUs + offsetUs.
 * The lowest recent round trip wins so a WiFi spike does not move the clock.
 */
export interface ClockOffset {
  offsetUs: number | null;
  bestRttUs: number;
  bestAtMs: number;
}

export function emptyClock(): ClockOffset {
  return { offsetUs: null, bestRttUs: Number.POSITIVE_INFINITY, bestAtMs: 0 };
}

export function observePong(
  clock: ClockOffset,
  input: { serverPingUs: number; serverRecvUs: number; monoUs: number; nowMs: number },
): ClockOffset {
  const rttUs = input.serverRecvUs - input.serverPingUs;
  if (rttUs < 0) {
    return clock;
  }
  const stale = input.nowMs - clock.bestAtMs > 120_000;
  if (clock.offsetUs !== null && rttUs >= clock.bestRttUs && !stale) {
    return clock;
  }
  const utcAtSendUs = input.serverPingUs + rttUs / 2;
  return {
    offsetUs: utcAtSendUs - input.monoUs,
    bestRttUs: rttUs,
    bestAtMs: input.nowMs,
  };
}

export function recordedAtFromMono(monoUs: number, offsetUs: number): Date {
  return new Date((monoUs + offsetUs) / 1000);
}

export function epochUs(date: Date = new Date()): number {
  return date.getTime() * 1000;
}
