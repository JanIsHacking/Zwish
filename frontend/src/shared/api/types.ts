export interface HrZone {
  zone: number;
  minBpm: number;
  maxBpm: number | null;
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'rider';
  ftpWatts: number | null;
  hrZoneBounds: HrZone[] | null;
}

export interface Bike {
  id: string;
  name: string;
  wheelCircumferenceMm: number;
  chainringTeeth: number[];
  cogTeeth: number[];
  rideCount: number;
}

export interface ResistanceLevel {
  id: string;
  label: string;
  sortOrder: number;
}

export interface RpmPoint {
  tSec: number;
  wheelRpm: number;
}

export type CoastFitKind = 'linear' | 'exponential' | 'quadratic';

export interface PowerCurve {
  id: string;
  bikeId: string;
  resistanceLevelId: string;
  knots: { wheelRpm: number; watts: number }[];
  tirePressureBar: number;
  isActive: boolean;
  fitKind: CoastFitKind;
  measured: RpmPoint[];
  fitted: RpmPoint[];
}

export interface TrainerPairing {
  bikeId: string;
  inertiaKgM2: number | null;
}

export interface Trainer {
  id: string;
  name: string;
  deviceId: string | null;
  online: boolean;
  rideCount: number;
  powerScale: number;
  resistanceLevels: ResistanceLevel[];
  pairings: TrainerPairing[];
  curves: PowerCurve[];
}

export interface RiderSetup {
  trainerId: string | null;
  bikeId: string | null;
  resistanceLevelId: string | null;
  chainringTeeth: number | null;
  cogTeeth: number | null;
}

export interface PlanSegment {
  id: string;
  sortOrder: number;
  durationSeconds: number;
  targetKind: 'power' | 'heart_rate';
  zone: number;
  notes: string | null;
}

export interface PlanSession {
  id: string;
  weekIndex: number;
  dayOfWeek: number;
  name: string;
  segments?: PlanSegment[];
}

export interface TrainingPlan {
  id: string;
  name: string;
  sessions: PlanSession[];
}

export interface WorkoutSummary {
  id: string;
  kind: 'free' | 'planned' | 'zone_test';
  status: string;
  startedAt: string;
  endedAt: string | null;
  distanceM: number;
  avgPowerW: number | null;
  avgCadenceRpm: number | null;
  avgHrBpm: number | null;
  estimatedFtp: number | null;
  planSession?: { name: string } | null;
  trainer?: { name: string } | null;
}

export interface LiveSnapshot {
  workoutId: string;
  kind: 'free' | 'planned' | 'zone_test';
  zoneTestProtocol: 'ramp' | 'twenty_minute' | null;
  elapsedSeconds: number;
  finished: boolean;
  sessionName: string | null;
  segmentIndex: number | null;
  segmentCount: number | null;
  segmentNotes: string | null;
  remainingSeconds: number | null;
  targetKind: 'power' | 'heart_rate' | 'watts' | null;
  targetZone: number | null;
  targetWatts: number | null;
  zoneLow: number | null;
  zoneHigh: number | null;
  delta: number | null;
  powerW: number | null;
  cadenceRpm: number | null;
  hrBpm: number | null;
  speedMps: number;
  distanceM: number;
  wheelRpm: number;
  avgPowerW: number | null;
  avgCadenceRpm: number | null;
  avgHrBpm: number | null;
  resistanceLevelId: string | null;
  resistanceLabel: string | null;
  chainringTeeth: number | null;
  cogTeeth: number | null;
  ftpWatts: number | null;
  calibrated: boolean;
}

export interface ZoneTestResult {
  id: string;
  protocol: 'ramp' | 'twenty_minute';
  estimatedFtp: number;
  createdAt: string;
  workout: { startedAt: string; endedAt: string | null; avgPowerW: number | null };
}

export interface DeviceTraceSample {
  atMs: number;
  seq: number;
  monoUs: number;
  revCount: number;
  dtUs: number;
  wheelRpm: number | null;
}

export interface DeviceTrace {
  online: boolean;
  samples: DeviceTraceSample[];
}

export interface CalibrationView {
  id: string;
  status: 'recording' | 'coasting' | 'review' | 'completed' | 'abandoned';
  bikeId: string;
  resistanceLevelId: string;
  tirePressureBar: number;
  targetRpm: number;
  holdSeconds: number;
  heldSeconds: number;
  latestRpm: number | null;
  wheelStopped: boolean;
  fitKind: CoastFitKind | null;
  recent: RpmPoint[];
  measured: RpmPoint[];
  fitted: RpmPoint[];
}
