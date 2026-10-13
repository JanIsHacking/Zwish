/// <reference types="vitest/globals" />
import { appendPowerSample, POWER_TRACE_WINDOW_MS, powerTicks, traceGeometry, trimPowerTrace } from './power-trace';

describe('power trace', () => {
  it('drops samples older than 30 seconds', () => {
    const now = 20_000;
    const samples = trimPowerTrace(
      [
        { atMs: now - POWER_TRACE_WINDOW_MS - 1, powerW: 100 },
        { atMs: now - POWER_TRACE_WINDOW_MS, powerW: 120 },
        { atMs: now, powerW: 140 },
      ],
      now,
    );
    expect(samples.map((sample) => sample.powerW)).toEqual([120, 140]);
  });

  it('appends a sample and trims the window', () => {
    const kept = appendPowerSample([{ atMs: 0, powerW: 90 }], { atMs: 31_000, powerW: 110 }, 31_000);
    expect(kept).toEqual([{ atMs: 31_000, powerW: 110 }]);
  });

  it('draws a line once two points are in the window', () => {
    expect(traceGeometry([{ atMs: 1000, powerW: 100 }], 1000, 300, 50, null, null)).toBeNull();
    const geometry = traceGeometry(
      [
        { atMs: 0, powerW: 100 },
        { atMs: 30_000, powerW: 200 },
      ],
      30_000,
      300,
      50,
      { low: 120, high: 180 },
      null,
    );
    expect(geometry?.line.startsWith('0,')).toBe(true);
    expect(geometry?.line.endsWith(',')).toBe(false);
    expect(geometry?.line).toContain('300,');
    expect(geometry?.band).not.toBeNull();
    expect(geometry?.targetY).toBeNull();
    expect(geometry?.ticks.map((tick) => tick.watts)).toEqual([100, 150, 200]);
    expect(geometry?.lastY).toBeCloseTo(geometry?.ticks.at(-1)?.y ?? -1);
  });

  it('picks round watt steps for the axis', () => {
    expect(powerTicks(92, 208)).toEqual([100, 150, 200]);
    expect(powerTicks(180, 196)).toEqual([180, 185, 190, 195]);
    expect(powerTicks(100, 100)).toEqual([]);
  });
});
