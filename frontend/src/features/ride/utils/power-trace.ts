export interface PowerSample {
  atMs: number;
  powerW: number;
}

export const POWER_TRACE_WINDOW_MS = 30_000;

export interface TraceBand {
  y: number;
  height: number;
}

export interface TraceTick {
  watts: number;
  y: number;
}

export interface TraceGeometry {
  line: string;
  band: TraceBand | null;
  targetY: number | null;
  lastY: number;
  ticks: TraceTick[];
}

export function trimPowerTrace(samples: PowerSample[], nowMs: number, windowMs = POWER_TRACE_WINDOW_MS): PowerSample[] {
  const cutoff = nowMs - windowMs;
  return samples.filter((sample) => sample.atMs >= cutoff && sample.atMs <= nowMs);
}

export function appendPowerSample(samples: PowerSample[], next: PowerSample | null, nowMs: number): PowerSample[] {
  return trimPowerTrace(next ? [...samples, next] : samples, nowMs);
}

export function traceGeometry(
  samples: PowerSample[],
  nowMs: number,
  width: number,
  height: number,
  band: { low: number; high: number } | null,
  target: number | null,
): TraceGeometry | null {
  if (samples.length < 2) {
    return null;
  }
  const extras = [band?.low, band?.high, target].filter((value): value is number => value !== null && value !== undefined);
  const powers = samples.map((sample) => sample.powerW);
  let yMin = Math.min(...powers, ...extras);
  let yMax = Math.max(...powers, ...extras);
  if (yMin === yMax) {
    yMin -= 10;
    yMax += 10;
  }
  const pad = (yMax - yMin) * 0.08;
  yMin -= pad;
  yMax += pad;
  const start = nowMs - POWER_TRACE_WINDOW_MS;
  const yFor = (value: number) => height - ((value - yMin) / (yMax - yMin)) * height;
  const xFor = (atMs: number) => ((atMs - start) / POWER_TRACE_WINDOW_MS) * width;
  return {
    line: samples.map((sample) => `${xFor(sample.atMs)},${yFor(sample.powerW)}`).join(' '),
    band: band ? { y: yFor(band.high), height: Math.max(0, yFor(band.low) - yFor(band.high)) } : null,
    targetY: target === null ? null : yFor(target),
    lastY: yFor(samples.at(-1)?.powerW ?? yMin),
    ticks: powerTicks(yMin, yMax).map((watts) => ({ watts, y: yFor(watts) })),
  };
}

const TICK_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500];

export function powerTicks(yMin: number, yMax: number, maxTicks = 4): number[] {
  const span = yMax - yMin;
  if (!(span > 0)) {
    return [];
  }
  const step = TICK_STEPS.find((candidate) => span / candidate <= maxTicks) ?? TICK_STEPS.at(-1) ?? 500;
  const ticks: number[] = [];
  for (let value = Math.ceil(yMin / step) * step; value <= yMax; value += step) {
    if (value >= 0) {
      ticks.push(value);
    }
  }
  return ticks;
}
