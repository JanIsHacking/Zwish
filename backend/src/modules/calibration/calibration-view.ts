import {
  asFit,
  asRpmPoints,
  COAST_HOLD_SECONDS,
  COAST_TARGET_RPM,
  heldSeconds,
  isWheelStopped,
  recentRpm,
  sampleFit,
  type CoastSample,
  type FitKind,
  type RpmPoint,
} from '../../domain/coast-down';

export interface CalibrationView {
  id: string;
  status: string;
  bikeId: string;
  resistanceLevelId: string;
  tirePressureBar: number;
  targetRpm: number;
  holdSeconds: number;
  heldSeconds: number;
  latestRpm: number | null;
  wheelStopped: boolean;
  fitKind: FitKind | null;
  recent: RpmPoint[];
  measured: RpmPoint[];
  fitted: RpmPoint[];
}

export function buildCalibrationView(input: {
  id: string;
  status: string;
  bikeId: string;
  resistanceLevelId: string;
  tirePressureBar: number;
  fitKind: unknown;
  fitCoeffs: unknown;
  coast: unknown;
  samples: CoastSample[];
  nowMs: number;
}): CalibrationView {
  const measured =
    input.status === 'review' || input.status === 'completed' ? asRpmPoints(input.coast) : [];
  const fit = asFit(input.fitKind, input.fitCoeffs);
  const tEnd = measured[measured.length - 1]?.tSec ?? 0;
  const stopped = isWheelStopped(input.samples, input.nowMs);
  const last = [...input.samples].sort((a, b) => a.monoUs - b.monoUs).at(-1);
  return {
    id: input.id,
    status: input.status,
    bikeId: input.bikeId,
    resistanceLevelId: input.resistanceLevelId,
    tirePressureBar: input.tirePressureBar,
    targetRpm: COAST_TARGET_RPM,
    holdSeconds: COAST_HOLD_SECONDS,
    heldSeconds:
      input.status === 'recording' ? heldSeconds(input.samples, COAST_TARGET_RPM, input.nowMs) : 0,
    latestRpm: last ? (stopped ? 0 : last.wheelRpm) : null,
    wheelStopped: input.status === 'coasting' && stopped,
    fitKind: fit?.kind ?? null,
    recent:
      input.status === 'recording' || input.status === 'coasting'
        ? recentRpm(input.samples, input.nowMs)
        : [],
    measured,
    fitted: fit && tEnd > 0 ? sampleFit(fit, tEnd) : [],
  };
}
