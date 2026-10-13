export const WARMUP_SECONDS = 300;
export const RAMP_STEP_WATTS = 20;
export const RAMP_HOLD_FLOOR = 0.9;
export const RAMP_HOLD_CEILING = 1.1;
export const RAMP_FAIL_SECONDS = 10;
export const RAMP_FTP_FACTOR = 0.75;

export const TWENTY_WARMUP_SECONDS = 10 * 60;
export const TWENTY_EFFORT_SECONDS = 20 * 60;
export const TWENTY_FTP_FACTOR = 0.95;

export const RAMP_STOP_NOTE = 'Stop the workout when you cannot hold the target any longer.';
export const RAMP_UNDER_NOTE = 'Below the step. Hold the target or this test will end.';
export const RAMP_OVER_NOTE =
  'Above the step. Ease back to the target. Extra watts do not raise the result.';
export const RAMP_WARMUP_NOTE =
  'Spin easy. When the ramp starts, stop the workout when you cannot hold the target any longer.';

export type ZoneTestProtocol = 'ramp' | 'twenty_minute';

export function parseZoneTestProtocol(value: string | null | undefined): ZoneTestProtocol | null {
  if (value === 'ramp' || value === 'twenty_minute') {
    return value;
  }
  return null;
}

export function zoneTestStartWatts(ftpWatts: number | null): number {
  if (ftpWatts === null || ftpWatts <= 0) {
    return 100;
  }
  return Math.max(100, Math.round((ftpWatts * 0.4) / 10) * 10);
}

export function rampTargetWatts(elapsedSeconds: number, startWatts: number): {
  phase: 'warmup' | 'ramp';
  targetWatts: number;
  remainingSeconds: number;
} {
  if (elapsedSeconds < WARMUP_SECONDS) {
    return {
      phase: 'warmup',
      targetWatts: Math.round(startWatts * 0.6),
      remainingSeconds: WARMUP_SECONDS - elapsedSeconds,
    };
  }
  const intoRamp = elapsedSeconds - WARMUP_SECONDS;
  const minute = Math.floor(intoRamp / 60);
  const remaining = 60 - (intoRamp % 60);
  return {
    phase: 'ramp',
    targetWatts: startWatts + RAMP_STEP_WATTS * minute,
    remainingSeconds: remaining,
  };
}

export interface RampAssessment {
  estimatedFtp: number | null;
  failed: boolean;
  completedMinutes: number;
}

export function assessRamp(
  oneSecondPower: ReadonlyArray<number | null>,
  startWatts: number,
): RampAssessment {
  let underStreak = 0;
  let completedMinutes = 0;
  let heldThisMinute = 0;
  let failed = false;
  const rampLength = Math.max(0, oneSecondPower.length - WARMUP_SECONDS);
  for (let offset = 0; offset < rampLength; offset += 1) {
    const minute = Math.floor(offset / 60);
    const target = startWatts + RAMP_STEP_WATTS * minute;
    const floor = target * RAMP_HOLD_FLOOR;
    const power = oneSecondPower[WARMUP_SECONDS + offset];
    if (typeof power === 'number' && power < floor) {
      underStreak += 1;
      if (underStreak >= RAMP_FAIL_SECONDS) {
        failed = true;
        break;
      }
    } else if (typeof power === 'number') {
      underStreak = 0;
      heldThisMinute += 1;
    }
    if (offset % 60 === 59) {
      // Missing samples are not a held step. A gap does not count as under.
      if (heldThisMinute > 0) {
        completedMinutes = minute + 1;
      }
      heldThisMinute = 0;
    }
  }
  const estimatedFtp =
    completedMinutes > 0
      ? Math.round((startWatts + RAMP_STEP_WATTS * (completedMinutes - 1)) * RAMP_FTP_FACTOR)
      : null;
  return { estimatedFtp, failed, completedMinutes };
}

export type RampWarning = 'under' | 'over';

export function rampHoldWarning(powerW: number | null, targetWatts: number): RampWarning | null {
  if (powerW === null) {
    return null;
  }
  if (powerW < targetWatts * RAMP_HOLD_FLOOR) {
    return 'under';
  }
  if (powerW > targetWatts * RAMP_HOLD_CEILING) {
    return 'over';
  }
  return null;
}

export function rampHoldBand(targetWatts: number): { low: number; high: number } {
  return {
    low: targetWatts * RAMP_HOLD_FLOOR,
    high: targetWatts * RAMP_HOLD_CEILING,
  };
}

export function twentyMinutePhase(elapsedSeconds: number, ftpWatts: number | null): {
  phase: 'warmup' | 'effort' | 'done';
  targetWatts: number | null;
  remainingSeconds: number;
} {
  if (elapsedSeconds < TWENTY_WARMUP_SECONDS) {
    return {
      phase: 'warmup',
      targetWatts: ftpWatts !== null && ftpWatts > 0 ? Math.round(ftpWatts * 0.55) : null,
      remainingSeconds: TWENTY_WARMUP_SECONDS - elapsedSeconds,
    };
  }
  const intoEffort = elapsedSeconds - TWENTY_WARMUP_SECONDS;
  if (intoEffort < TWENTY_EFFORT_SECONDS) {
    return {
      phase: 'effort',
      targetWatts: null,
      remainingSeconds: TWENTY_EFFORT_SECONDS - intoEffort,
    };
  }
  return { phase: 'done', targetWatts: null, remainingSeconds: 0 };
}

export function estimateTwentyMinuteFtp(oneSecondPower: ReadonlyArray<number | null>): number | null {
  const end = TWENTY_WARMUP_SECONDS + TWENTY_EFFORT_SECONDS;
  if (oneSecondPower.length < end) {
    return null;
  }
  let sum = 0;
  let count = 0;
  for (let index = TWENTY_WARMUP_SECONDS; index < end; index += 1) {
    const power = oneSecondPower[index];
    if (typeof power === 'number') {
      sum += power;
      count += 1;
    }
  }
  if (count === 0) {
    return null;
  }
  return Math.round((sum / count) * TWENTY_FTP_FACTOR);
}

export function alignPowerSeries(
  startedAtMs: number,
  samples: ReadonlyArray<{ recordedAtMs: number; powerW: number | null }>,
  elapsedSeconds: number,
): (number | null)[] {
  const series: (number | null)[] = Array.from({ length: Math.max(0, elapsedSeconds) }, () => null);
  for (const sample of samples) {
    const second = Math.floor((sample.recordedAtMs - startedAtMs) / 1000);
    if (second >= 0 && second < series.length) {
      series[second] = sample.powerW;
    }
  }
  return series;
}
