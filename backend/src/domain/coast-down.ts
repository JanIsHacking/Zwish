import { PowerKnot } from './kinematics';
import { wheelHasStopped, wheelHoldMs } from './wheel-hold';

export const COAST_TARGET_RPM = 200;
export const COAST_HOLD_SECONDS = 5;
export const COAST_WINDOW_SECONDS = 30;

export const FIT_KINDS = ['linear', 'exponential', 'quadratic'] as const;
export type FitKind = (typeof FIT_KINDS)[number];

export interface CoastSample {
  monoUs: number;
  wheelRpm: number;
  atMs: number;
  dtUs: number;
}

export interface RpmPoint {
  tSec: number;
  wheelRpm: number;
}

export interface CoastFit {
  kind: FitKind;
  coeffs: number[];
}

export type CoastSlice =
  { status: 'open' } | { status: 'short' } | { status: 'ready'; points: RpmPoint[] };

const MIN_COAST_POINTS = 8;
const MIN_COAST_SECONDS = 2;
const RPM_FLOOR = 8;

export function isFitKind(value: unknown): value is FitKind {
  return FIT_KINDS.some((kind) => kind === value);
}

export function heldSeconds(samples: CoastSample[], targetRpm: number, nowMs: number): number {
  const ordered = byTime(samples);
  const last = ordered[ordered.length - 1];
  if (!last || last.wheelRpm < targetRpm || isWheelStopped(ordered, nowMs)) {
    return 0;
  }
  let start = last;
  for (let index = ordered.length - 2; index >= 0; index -= 1) {
    const sample = ordered[index];
    if (!sample || sample.wheelRpm < targetRpm) {
      break;
    }
    start = sample;
  }
  const spanSec = Math.max(0, (last.monoUs - start.monoUs) / 1_000_000);
  const tailSec = Math.min(1.5, Math.max(0, (nowMs - last.atMs) / 1000));
  return spanSec + tailSec;
}

export function recentRpm(
  samples: CoastSample[],
  nowMs: number,
  windowSec = COAST_WINDOW_SECONDS,
): RpmPoint[] {
  return byTime(samples)
    .filter((sample) => nowMs - sample.atMs <= windowSec * 1000 && nowMs - sample.atMs >= 0)
    .map((sample) => ({ tSec: (sample.atMs - nowMs) / 1000, wheelRpm: sample.wheelRpm }));
}

export function isWheelStopped(samples: CoastSample[], nowMs: number): boolean {
  const last = byTime(samples).at(-1);
  if (!last) {
    return false;
  }
  return last.wheelRpm <= 0 || wheelHasStopped(last.atMs, nowMs, last.dtUs);
}

export function sliceCoast(samples: CoastSample[], startMonoUs: number, nowMs: number): CoastSlice {
  const ordered = byTime(samples).filter((sample) => sample.monoUs >= startMonoUs);
  const last = ordered[ordered.length - 1];
  const first = ordered[0];
  if (!last || !first) {
    return { status: 'open' };
  }
  if (last.wheelRpm > 0 && !wheelHasStopped(last.atMs, nowMs, last.dtUs)) {
    return { status: 'open' };
  }
  const points = ordered.map((sample) => ({
    tSec: (sample.monoUs - first.monoUs) / 1_000_000,
    wheelRpm: sample.wheelRpm,
  }));
  if (last.wheelRpm > 0) {
    const holdUs = wheelHoldMs(last.dtUs) * 1000;
    points.push({ tSec: (last.monoUs + holdUs - first.monoUs) / 1_000_000, wheelRpm: 0 });
  }
  const end = points[points.length - 1];
  if (!end || points.length < MIN_COAST_POINTS || end.tSec < MIN_COAST_SECONDS) {
    return { status: 'short' };
  }
  return { status: 'ready', points };
}

export function fitCoast(points: RpmPoint[], kind: FitKind): CoastFit | null {
  if (points.length < MIN_COAST_POINTS) {
    return null;
  }
  if (kind === 'exponential') {
    return fitExponential(points);
  }
  const coeffs = polyFit(points, kind === 'linear' ? 1 : 2);
  if (!coeffs || coeffs.some((coeff) => !Number.isFinite(coeff))) {
    return null;
  }
  const slope = coeffs[1] ?? 0;
  if (kind === 'linear' && slope >= -0.05) {
    return null;
  }
  return { kind, coeffs };
}

export function sampleFit(fit: CoastFit, tEndSec: number, steps = 48): RpmPoint[] {
  if (tEndSec <= 0 || steps < 2) {
    return [];
  }
  const points: RpmPoint[] = [];
  for (let index = 0; index < steps; index += 1) {
    const tSec = (tEndSec * index) / (steps - 1);
    const wheelRpm = rpmAt(fit, tSec);
    if (Number.isFinite(wheelRpm)) {
      points.push({ tSec, wheelRpm });
    }
  }
  return points;
}

export function knotsFromFit(fit: CoastFit, tEndSec: number, inertiaKgM2: number): PowerKnot[] {
  if (inertiaKgM2 <= 0 || tEndSec <= 0) {
    return [];
  }
  const bins = new Map<number, { sum: number; count: number }>();
  const steps = 80;
  for (let index = 0; index < steps; index += 1) {
    const tSec = (tEndSec * index) / (steps - 1);
    const rpm = rpmAt(fit, tSec);
    const drpm = drpmAt(fit, tSec);
    if (rpm < RPM_FLOOR || drpm >= -0.05) {
      continue;
    }
    const omega = (rpm * 2 * Math.PI) / 60;
    const alpha = (drpm * 2 * Math.PI) / 60;
    const watts = inertiaKgM2 * omega * -alpha;
    const key = Math.round(rpm / 5) * 5;
    const bin = bins.get(key) ?? { sum: 0, count: 0 };
    bin.sum += watts;
    bin.count += 1;
    bins.set(key, bin);
  }
  const knots = [...bins.entries()]
    .map(([wheelRpm, bin]) => ({ wheelRpm, watts: bin.sum / bin.count }))
    .sort((a, b) => a.wheelRpm - b.wheelRpm);
  return knots.length >= 3 ? knots : [];
}

export function asRpmPoints(value: unknown): RpmPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const points: RpmPoint[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const tSec = (item as { tSec?: unknown }).tSec;
    const wheelRpm = (item as { wheelRpm?: unknown }).wheelRpm;
    if (typeof tSec === 'number' && typeof wheelRpm === 'number') {
      points.push({ tSec, wheelRpm });
    }
  }
  return points.sort((a, b) => a.tSec - b.tSec);
}

export function asFit(kind: unknown, coeffs: unknown): CoastFit | null {
  if (!isFitKind(kind) || !Array.isArray(coeffs)) {
    return null;
  }
  const numbers: number[] = [];
  for (const item of coeffs) {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      return null;
    }
    numbers.push(item);
  }
  if (numbers.length < 2) {
    return null;
  }
  return { kind, coeffs: numbers };
}

export function rpmAt(fit: CoastFit, tSec: number): number {
  const a = fit.coeffs[0] ?? 0;
  const b = fit.coeffs[1] ?? 0;
  const c = fit.coeffs[2] ?? 0;
  if (fit.kind === 'linear') {
    return a + b * tSec;
  }
  if (fit.kind === 'quadratic') {
    return a + b * tSec + c * tSec * tSec;
  }
  return a * Math.exp(-b * tSec);
}

function drpmAt(fit: CoastFit, tSec: number): number {
  const b = fit.coeffs[1] ?? 0;
  const c = fit.coeffs[2] ?? 0;
  if (fit.kind === 'linear') {
    return b;
  }
  if (fit.kind === 'quadratic') {
    return b + 2 * c * tSec;
  }
  return -b * rpmAt(fit, tSec);
}

function fitExponential(points: RpmPoint[]): CoastFit | null {
  // log(0) is undefined, so the synthetic stop at 0 rpm is left out of this fit.
  const usable = points.filter((point) => point.wheelRpm >= 1);
  if (usable.length < MIN_COAST_POINTS) {
    return null;
  }
  const coeffs = polyFit(
    usable.map((point) => ({ tSec: point.tSec, wheelRpm: Math.log(point.wheelRpm) })),
    1,
  );
  if (!coeffs) {
    return null;
  }
  const amplitude = Math.exp(coeffs[0] ?? 0);
  const decay = -(coeffs[1] ?? 0);
  if (!Number.isFinite(amplitude) || amplitude <= 0 || decay <= 0.001) {
    return null;
  }
  return { kind: 'exponential', coeffs: [amplitude, decay] };
}

function polyFit(points: RpmPoint[], degree: number): number[] | null {
  const size = degree + 1;
  const matrix = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const values = Array<number>(size).fill(0);
  for (const point of points) {
    const powers: number[] = [];
    let power = 1;
    for (let index = 0; index <= degree * 2; index += 1) {
      powers.push(power);
      power *= point.tSec;
    }
    for (let row = 0; row < size; row += 1) {
      values[row] = (values[row] ?? 0) + (powers[row] ?? 0) * point.wheelRpm;
      const matrixRow = matrix[row];
      if (!matrixRow) {
        continue;
      }
      for (let col = 0; col < size; col += 1) {
        matrixRow[col] = (matrixRow[col] ?? 0) + (powers[row + col] ?? 0);
      }
    }
  }
  return solveLinear(matrix, values);
}

function solveLinear(matrix: number[][], values: number[]): number[] | null {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index] ?? 0]);
  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(rows[row]?.[col] ?? 0) > Math.abs(rows[pivot]?.[col] ?? 0)) {
        pivot = row;
      }
    }
    if (pivot !== col) {
      const swap = rows[col] ?? [];
      rows[col] = rows[pivot] ?? [];
      rows[pivot] = swap;
    }
    const pivotRow = rows[col];
    const pivotValue = pivotRow?.[col] ?? 0;
    if (!pivotRow || Math.abs(pivotValue) < 1e-12) {
      return null;
    }
    for (let index = col; index <= size; index += 1) {
      pivotRow[index] = (pivotRow[index] ?? 0) / pivotValue;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === col) {
        continue;
      }
      const target = rows[row];
      if (!target) {
        continue;
      }
      const factor = target[col] ?? 0;
      for (let index = col; index <= size; index += 1) {
        target[index] = (target[index] ?? 0) - factor * (pivotRow[index] ?? 0);
      }
    }
  }
  return rows.map((row) => row[size] ?? 0);
}

function byTime(samples: CoastSample[]): CoastSample[] {
  return [...samples].sort((a, b) => a.monoUs - b.monoUs);
}
