import { Injectable, OnModuleInit } from '@nestjs/common';
import { closesRevolution } from '../../domain/wheel-hold';
import {
  cadenceRpm,
  distanceDeltaM,
  scaledPower,
  speedMps,
  wheelRpmFromDelta,
} from '../../domain/kinematics';
import { addWeighted } from '../../domain/weighted';
import { CalibrationService } from '../calibration/calibration.service';
import { ChartWriter } from '../rides/chart-writer';
import { followDisplay, snapDisplay } from '../rides/ride-display';
import { RideRegistry } from '../rides/ride-registry';
import { RideState } from '../rides/ride-state';
import { ActivationBus, ActivationEvent } from './activation-bus';
import { DeviceTrace } from './device-trace';

interface WheelCursor {
  lastRevCount: number | null;
  previousDtUs: number;
  awaitingInterval: boolean;
}

@Injectable()
export class ActivationMetrics implements OnModuleInit {
  private readonly wheels = new Map<string, WheelCursor>();

  constructor(
    private readonly bus: ActivationBus,
    private readonly rides: RideRegistry,
    private readonly calibration: CalibrationService,
    private readonly trace: DeviceTrace,
    private readonly charts: ChartWriter,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe((event) => this.apply(event));
  }

  private apply(event: ActivationEvent): void {
    const wheel = this.cursor(event.trainerId);
    const baseline = wheel.lastRevCount === null || event.revCount < wheel.lastRevCount;
    const delta = baseline ? null : event.revCount - (wheel.lastRevCount ?? event.revCount);
    const ride = this.rides.getByTrainer(event.trainerId);
    if (ride && event.hrBpm !== null) {
      ride.latestHr = event.hrBpm;
    }
    if (baseline) {
      wheel.lastRevCount = event.revCount;
      wheel.previousDtUs = 0;
      wheel.awaitingInterval = true;
      this.note(event, null);
      return;
    }
    if (delta === null || delta <= 0) {
      this.note(event, null);
      return;
    }
    wheel.lastRevCount = event.revCount;
    if (!closesRevolution(event.dtUs, wheel.previousDtUs, wheel.awaitingInterval)) {
      wheel.awaitingInterval = true;
      this.note(event, null);
      if (ride) {
        snapDisplay(ride);
      }
      return;
    }
    const rpm = wheelRpmFromDelta(delta, event.dtUs);
    wheel.awaitingInterval = false;
    wheel.previousDtUs = event.dtUs;
    this.note(event, rpm);
    this.calibration.append(event.trainerId, {
      monoUs: event.monoUs,
      wheelRpm: rpm,
      atMs: Date.now(),
      dtUs: event.dtUs,
    });
    if (ride) {
      this.fold(ride, event, rpm, delta);
    }
  }

  private fold(ride: RideState, event: ActivationEvent, rpm: number, deltaRevs: number): void {
    const dtSec = event.dtUs / 1_000_000;
    const cadence =
      ride.chainringTeeth && ride.cogTeeth ? cadenceRpm(rpm, ride.cogTeeth, ride.chainringTeeth) : null;
    const speed = speedMps(rpm, ride.circumferenceMm);
    const power = ride.knots ? scaledPower(ride.knots, rpm, ride.powerScale) : null;
    ride.distanceM += distanceDeltaM(deltaRevs, ride.circumferenceMm);
    const powerTotal = addWeighted(
      { sum: ride.powerWeightedSum, weightSec: ride.powerWeightSec },
      power,
      dtSec,
    );
    ride.powerWeightedSum = powerTotal.sum;
    ride.powerWeightSec = powerTotal.weightSec;
    const cadenceTotal = addWeighted(
      { sum: ride.cadenceWeightedSum, weightSec: ride.cadenceWeightSec },
      cadence,
      dtSec,
    );
    ride.cadenceWeightedSum = cadenceTotal.sum;
    ride.cadenceWeightSec = cadenceTotal.weightSec;
    const hrTotal = addWeighted({ sum: ride.hrWeightedSum, weightSec: ride.hrWeightSec }, event.hrBpm, dtSec);
    ride.hrWeightedSum = hrTotal.sum;
    ride.hrWeightSec = hrTotal.weightSec;
    ride.lastSampleAtMs = Date.now();
    ride.lastDtUs = event.dtUs;
    followDisplay(ride, { rpm, speed, cadence, power, dtSec });
    const second = Math.floor(event.recordedAt.getTime() / 1000);
    if (ride.bucket && ride.bucket.second !== second) {
      this.charts.enqueue(ride);
    }
    if (!ride.bucket) {
      ride.bucket = {
        second,
        points: [],
        distanceM: ride.distanceM,
        resistanceLevelId: ride.resistanceLevelId,
        chainringTeeth: ride.chainringTeeth,
        cogTeeth: ride.cogTeeth,
      };
    }
    ride.bucket.points.push({ dtSec, wheelRpm: rpm, speed, power, cadence, hr: event.hrBpm });
    ride.bucket.distanceM = ride.distanceM;
    ride.bucket.resistanceLevelId = ride.resistanceLevelId;
    ride.bucket.chainringTeeth = ride.chainringTeeth;
    ride.bucket.cogTeeth = ride.cogTeeth;
  }

  private note(event: ActivationEvent, wheelRpm: number | null): void {
    this.trace.note(event.trainerId, {
      atMs: Date.now(),
      seq: event.seq,
      monoUs: event.monoUs,
      revCount: event.revCount,
      dtUs: event.dtUs,
      wheelRpm,
    });
  }

  private cursor(trainerId: string): WheelCursor {
    const existing = this.wheels.get(trainerId);
    if (existing) {
      return existing;
    }
    const created: WheelCursor = { lastRevCount: null, previousDtUs: 0, awaitingInterval: true };
    this.wheels.set(trainerId, created);
    return created;
  }
}
