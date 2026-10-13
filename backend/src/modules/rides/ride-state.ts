import { PowerKnot } from '../../domain/kinematics';
import { ZoneTestProtocol } from '../../domain/ramp';
import { PlanSegmentClock } from '../../domain/segments';
import { HrZoneBound } from '../users/public-user';

export interface BucketPoint {
  dtSec: number;
  wheelRpm: number;
  speed: number;
  power: number | null;
  cadence: number | null;
  hr: number | null;
}

export interface SampleBucket {
  second: number;
  points: BucketPoint[];
  distanceM: number;
  resistanceLevelId: string | null;
  chainringTeeth: number | null;
  cogTeeth: number | null;
}

export type WorkoutKind = 'free' | 'planned' | 'zone_test';

export interface RideState {
  workoutId: string;
  userId: string;
  trainerId: string;
  kind: WorkoutKind;
  startedAtMs: number;
  circumferenceMm: number;
  powerScale: number;
  knots: PowerKnot[] | null;
  ftpWatts: number | null;
  hrZones: HrZoneBound[] | null;
  segments: PlanSegmentClock[] | null;
  sessionName: string | null;
  zoneTestProtocol: ZoneTestProtocol | null;
  zoneTestStartW: number | null;
  zoneTestSeries: (number | null)[];
  resistanceLevelId: string | null;
  resistanceLabel: string | null;
  bikeId: string;
  chainringTeeth: number | null;
  cogTeeth: number | null;
  distanceM: number;
  powerWeightedSum: number;
  powerWeightSec: number;
  cadenceWeightedSum: number;
  cadenceWeightSec: number;
  hrWeightedSum: number;
  hrWeightSec: number;
  bucket: SampleBucket | null;
  displayPower: number | null;
  emaRpm: number | null;
  emaCadence: number | null;
  emaSpeed: number | null;
  emaPower: number | null;
  latestRpm: number;
  latestCadence: number | null;
  latestHr: number | null;
  latestSpeed: number;
  lastSampleAtMs: number | null;
  lastDtUs: number;
  stopping: boolean;
}

export function blankRide(
  input: Omit<
    RideState,
    | 'powerWeightedSum'
    | 'powerWeightSec'
    | 'cadenceWeightedSum'
    | 'cadenceWeightSec'
    | 'hrWeightedSum'
    | 'hrWeightSec'
    | 'bucket'
    | 'displayPower'
    | 'emaRpm'
    | 'emaCadence'
    | 'emaSpeed'
    | 'emaPower'
    | 'latestRpm'
    | 'latestCadence'
    | 'latestHr'
    | 'latestSpeed'
    | 'lastSampleAtMs'
    | 'lastDtUs'
    | 'stopping'
    | 'distanceM'
    | 'zoneTestSeries'
  > & { distanceM?: number },
): RideState {
  return {
    ...input,
    distanceM: input.distanceM ?? 0,
    powerWeightedSum: 0,
    powerWeightSec: 0,
    cadenceWeightedSum: 0,
    cadenceWeightSec: 0,
    hrWeightedSum: 0,
    hrWeightSec: 0,
    bucket: null,
    displayPower: 0,
    emaRpm: null,
    emaCadence: null,
    emaSpeed: null,
    emaPower: null,
    latestRpm: 0,
    latestCadence: null,
    latestHr: null,
    latestSpeed: 0,
    lastSampleAtMs: null,
    lastDtUs: 0,
    stopping: false,
    zoneTestSeries: [],
  };
}
