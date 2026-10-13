import {
  assessRamp,
  estimateTwentyMinuteFtp,
  rampHoldWarning,
  rampTargetWatts,
  twentyMinutePhase,
  TWENTY_EFFORT_SECONDS,
  TWENTY_WARMUP_SECONDS,
  WARMUP_SECONDS,
} from './ramp';

function rampSeries(minutes: number[], failAt?: { minute: number; second: number }): (number | null)[] {
  const series: (number | null)[] = Array.from({ length: WARMUP_SECONDS }, () => 60);
  for (let minute = 0; minute < minutes.length; minute += 1) {
    const target = minutes[minute] ?? 0;
    for (let second = 0; second < 60; second += 1) {
      const failing =
        failAt !== undefined && failAt.minute === minute && second < failAt.second;
      series.push(failing ? target * 0.5 : target);
    }
  }
  return series;
}

describe('ramp', () => {
  it('holds an easy warmup then steps up', () => {
    const warmup = rampTargetWatts(10, 100);
    expect(warmup.phase).toBe('warmup');
    expect(warmup.targetWatts).toBe(60);
    const first = rampTargetWatts(WARMUP_SECONDS, 100);
    expect(first.phase).toBe('ramp');
    expect(first.targetWatts).toBe(100);
    const next = rampTargetWatts(WARMUP_SECONDS + 60, 100);
    expect(next.targetWatts).toBe(120);
  });

  it('estimates FTP from the last completed step, ignoring watts above it', () => {
    const series = rampSeries([100, 200]);
    expect(assessRamp(series, 100)).toMatchObject({
      completedMinutes: 2,
      failed: false,
      estimatedFtp: Math.round(120 * 0.75),
    });
  });

  it('ends the test after 10 seconds under the floor and drops that minute', () => {
    const series = rampSeries([100, 120], { minute: 1, second: 10 });
    expect(assessRamp(series, 100)).toMatchObject({
      completedMinutes: 1,
      failed: true,
      estimatedFtp: Math.round(100 * 0.75),
    });
  });

  it('keeps a minute when the rider is under for less than 10 seconds', () => {
    const series = rampSeries([100], { minute: 0, second: 9 });
    expect(assessRamp(series, 100)).toMatchObject({
      completedMinutes: 1,
      failed: false,
      estimatedFtp: Math.round(100 * 0.75),
    });
  });

  it('counts a measured zero as under and ignores a gap', () => {
    const series = rampSeries([100]);
    const rampStart = WARMUP_SECONDS;
    for (let second = 0; second < 9; second += 1) {
      series[rampStart + second] = 0;
    }
    series[rampStart + 9] = null;
    expect(assessRamp(series, 100).failed).toBe(false);

    series[rampStart + 10] = 0;
    expect(assessRamp(series, 100)).toMatchObject({ failed: true, estimatedFtp: null });
  });

  it('does not award FTP when no ramp minute was held', () => {
    const series = Array.from({ length: WARMUP_SECONDS + 30 }, () => null);
    expect(assessRamp(series, 100)).toEqual({
      estimatedFtp: null,
      failed: false,
      completedMinutes: 0,
    });
  });

  it('warns outside the 90 to 110 percent band', () => {
    expect(rampHoldWarning(89, 100)).toBe('under');
    expect(rampHoldWarning(90, 100)).toBeNull();
    expect(rampHoldWarning(110, 100)).toBeNull();
    expect(rampHoldWarning(111, 100)).toBe('over');
    expect(rampHoldWarning(null, 100)).toBeNull();
  });
});

describe('twenty minute test', () => {
  it('warms up for 10 minutes then opens a 20 minute effort', () => {
    expect(twentyMinutePhase(0, null)).toMatchObject({ phase: 'warmup', targetWatts: null });
    expect(twentyMinutePhase(0, 200).targetWatts).toBe(110);
    expect(twentyMinutePhase(TWENTY_WARMUP_SECONDS, 200).phase).toBe('effort');
    expect(twentyMinutePhase(TWENTY_WARMUP_SECONDS + TWENTY_EFFORT_SECONDS, 200).phase).toBe('done');
  });

  it('estimates FTP as 95 percent of the effort average', () => {
    const series: (number | null)[] = Array.from(
      { length: TWENTY_WARMUP_SECONDS + TWENTY_EFFORT_SECONDS },
      (_, index) => (index < TWENTY_WARMUP_SECONDS ? 80 : index === TWENTY_WARMUP_SECONDS ? null : 200),
    );
    expect(estimateTwentyMinuteFtp(series)).toBe(Math.round(200 * 0.95));
  });

  it('returns nothing when the effort is cut short', () => {
    const series = Array.from({ length: TWENTY_WARMUP_SECONDS + TWENTY_EFFORT_SECONDS - 1 }, () => 200);
    expect(estimateTwentyMinuteFtp(series)).toBeNull();
  });
});
