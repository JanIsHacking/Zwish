import { deltaToBand, powerZonesFromFtp, ZoneBound, zoneBounds } from '../../domain/zones';
import {
  assessRamp,
  rampHoldBand,
  rampHoldWarning,
  rampTargetWatts,
  RAMP_OVER_NOTE,
  RAMP_STOP_NOTE,
  RAMP_UNDER_NOTE,
  RAMP_WARMUP_NOTE,
  twentyMinutePhase,
  ZoneTestProtocol,
} from '../../domain/ramp';
import { segmentAt } from '../../domain/segments';
import { rideAverages } from '../../domain/weighted';
import { HrZoneBound } from '../users/public-user';
import { RideState } from './ride-state';

export interface LiveSnapshot {
  workoutId: string;
  kind: RideState['kind'];
  zoneTestProtocol: ZoneTestProtocol | null;
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
  powerZones: ZoneBound[] | null;
  hrZones: HrZoneBound[] | null;
  calibrated: boolean;
}

export function buildSnapshot(ride: RideState, nowMs: number): LiveSnapshot {
  const elapsedSeconds = Math.max(0, (nowMs - ride.startedAtMs) / 1000);
  const powerZones = ride.ftpWatts ? powerZonesFromFtp(ride.ftpWatts) : null;
  const snapshot: LiveSnapshot = {
    workoutId: ride.workoutId,
    kind: ride.kind,
    zoneTestProtocol: ride.zoneTestProtocol,
    elapsedSeconds,
    finished: false,
    sessionName: ride.sessionName,
    segmentIndex: null,
    segmentCount: null,
    segmentNotes: null,
    remainingSeconds: null,
    targetKind: null,
    targetZone: null,
    targetWatts: null,
    zoneLow: null,
    zoneHigh: null,
    delta: null,
    powerW: ride.displayPower,
    cadenceRpm:
      ride.latestCadence ??
      (ride.chainringTeeth && ride.cogTeeth && ride.latestRpm === 0 ? 0 : null),
    hrBpm: ride.latestHr,
    speedMps: ride.latestSpeed,
    distanceM: ride.distanceM,
    wheelRpm: ride.latestRpm,
    ...rideAverages(ride),
    resistanceLevelId: ride.resistanceLevelId,
    resistanceLabel: ride.resistanceLabel,
    chainringTeeth: ride.chainringTeeth,
    cogTeeth: ride.cogTeeth,
    ftpWatts: ride.ftpWatts,
    powerZones,
    hrZones: ride.hrZones,
    calibrated: ride.knots !== null && ride.knots.length > 0,
  };

  const protocol =
    ride.zoneTestProtocol ??
    (ride.kind === 'zone_test' && ride.zoneTestStartW !== null ? 'ramp' : null);
  if (ride.kind === 'zone_test' && protocol === 'ramp' && ride.zoneTestStartW !== null) {
    applyRamp(snapshot, ride, elapsedSeconds);
    return snapshot;
  }
  if (ride.kind === 'zone_test' && protocol === 'twenty_minute') {
    applyTwentyMinute(snapshot, elapsedSeconds, ride.ftpWatts);
    return snapshot;
  }

  if (ride.segments) {
    const active = segmentAt(ride.segments, elapsedSeconds);
    if (!active) {
      return snapshot;
    }
    snapshot.finished = active.finished;
    snapshot.segmentIndex = active.index;
    snapshot.segmentCount = active.count;
    snapshot.segmentNotes = active.notes;
    snapshot.remainingSeconds = active.remainingSeconds;
    snapshot.targetKind = active.targetKind;
    snapshot.targetZone = active.zone;
    applyZoneTarget(snapshot, active.targetKind, active.zone, powerZones, ride.hrZones);
  }

  return snapshot;
}

function applyRamp(snapshot: LiveSnapshot, ride: RideState, elapsedSeconds: number): void {
  const startWatts = ride.zoneTestStartW;
  if (startWatts === null) {
    return;
  }
  const ramp = rampTargetWatts(elapsedSeconds, startWatts);
  snapshot.targetKind = 'watts';
  snapshot.targetWatts = ramp.targetWatts;
  snapshot.remainingSeconds = Math.ceil(ramp.remainingSeconds);
  snapshot.sessionName = ramp.phase === 'warmup' ? 'Warmup' : 'Ramp';
  if (ramp.phase === 'warmup') {
    snapshot.segmentNotes = RAMP_WARMUP_NOTE;
    if (snapshot.powerW !== null) {
      snapshot.delta = snapshot.powerW - ramp.targetWatts;
    }
    return;
  }
  const band = rampHoldBand(ramp.targetWatts);
  snapshot.zoneLow = band.low;
  snapshot.zoneHigh = band.high;
  const warning = rampHoldWarning(snapshot.powerW, ramp.targetWatts);
  snapshot.segmentNotes =
    warning === 'under' ? RAMP_UNDER_NOTE : warning === 'over' ? RAMP_OVER_NOTE : RAMP_STOP_NOTE;
  if (snapshot.powerW !== null) {
    snapshot.delta = deltaToBand(snapshot.powerW, band.low, band.high);
  }
  snapshot.finished = assessRamp(ride.zoneTestSeries, startWatts).failed;
}

function applyTwentyMinute(
  snapshot: LiveSnapshot,
  elapsedSeconds: number,
  ftpWatts: number | null,
): void {
  const phase = twentyMinutePhase(elapsedSeconds, ftpWatts);
  snapshot.finished = phase.phase === 'done';
  snapshot.remainingSeconds = Math.ceil(phase.remainingSeconds);
  snapshot.targetWatts = phase.targetWatts;
  snapshot.targetKind = phase.targetWatts === null ? null : 'watts';
  if (phase.phase === 'warmup') {
    snapshot.sessionName = 'Warmup';
    snapshot.segmentNotes = 'Warm up thoroughly. The 20-minute effort starts after this.';
    if (snapshot.powerW !== null && phase.targetWatts !== null) {
      snapshot.delta = snapshot.powerW - phase.targetWatts;
    }
    return;
  }
  snapshot.sessionName = '20-minute effort';
  snapshot.segmentNotes =
    phase.phase === 'done' ? 'Effort complete.' : 'Ride as hard as you can for the full 20 minutes.';
}

function applyZoneTarget(
  snapshot: LiveSnapshot,
  kind: 'power' | 'heart_rate',
  zone: number,
  powerZones: ZoneBound[] | null,
  hrZones: HrZoneBound[] | null,
): void {
  if (kind === 'power' && powerZones) {
    const band = zoneBounds(powerZones, zone);
    if (!band) {
      return;
    }
    snapshot.zoneLow = band.min;
    snapshot.zoneHigh = band.max;
    snapshot.targetWatts = band.min;
    if (snapshot.powerW !== null) {
      snapshot.delta = deltaToBand(snapshot.powerW, band.min, band.max);
    }
    return;
  }
  if (kind === 'heart_rate' && hrZones) {
    const band = hrZones.find((item) => item.zone === zone);
    if (!band) {
      return;
    }
    snapshot.zoneLow = band.minBpm;
    snapshot.zoneHigh = band.maxBpm;
    if (snapshot.hrBpm !== null) {
      snapshot.delta = deltaToBand(snapshot.hrBpm, band.minBpm, band.maxBpm);
    }
  }
}
