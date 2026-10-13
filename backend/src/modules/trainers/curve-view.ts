import {
  asFit,
  asRpmPoints,
  sampleFit,
  type FitKind,
  type RpmPoint,
} from '../../domain/coast-down';
import { PowerKnot } from '../../domain/kinematics';

export interface CurveView {
  id: string;
  bikeId: string;
  resistanceLevelId: string;
  knots: PowerKnot[];
  tirePressureBar: number;
  isActive: boolean;
  fitKind: FitKind;
  measured: RpmPoint[];
  fitted: RpmPoint[];
}

export function toCurveView(curve: {
  id: string;
  bikeId: string;
  resistanceLevelId: string;
  knots: unknown;
  tirePressureBar: number;
  isActive: boolean;
  fitKind: string;
  fitCoeffs: unknown;
  coast: unknown;
}): CurveView | null {
  const fit = asFit(curve.fitKind, curve.fitCoeffs);
  if (!fit) {
    return null;
  }
  const measured = asRpmPoints(curve.coast);
  const tEnd = measured[measured.length - 1]?.tSec ?? 0;
  return {
    id: curve.id,
    bikeId: curve.bikeId,
    resistanceLevelId: curve.resistanceLevelId,
    knots: asKnots(curve.knots),
    tirePressureBar: curve.tirePressureBar,
    isActive: curve.isActive,
    fitKind: fit.kind,
    measured,
    fitted: tEnd > 0 ? sampleFit(fit, tEnd) : [],
  };
}

export function asKnots(value: unknown): PowerKnot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const knots: PowerKnot[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const wheelRpm = (item as { wheelRpm?: unknown }).wheelRpm;
    const watts = (item as { watts?: unknown }).watts;
    if (typeof wheelRpm === 'number' && typeof watts === 'number') {
      knots.push({ wheelRpm, watts });
    }
  }
  return knots.sort((a, b) => a.wheelRpm - b.wheelRpm);
}
