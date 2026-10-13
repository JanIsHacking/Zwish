import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { bucketPowerWatts, writeChartSample } from './persist-bucket';
import { RideState, SampleBucket } from './ride-state';

@Injectable()
export class ChartWriter {
  private readonly logger = new Logger(ChartWriter.name);
  private readonly tails = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  enqueue(ride: RideState): void {
    const bucket = ride.bucket;
    if (!bucket || bucket.points.length === 0) {
      ride.bucket = null;
      return;
    }
    rememberRampSecond(ride, bucket);
    ride.bucket = null;
    const flush = {
      workoutId: ride.workoutId,
      bucket,
      distanceM: ride.distanceM,
      powerWeightedSum: ride.powerWeightedSum,
      powerWeightSec: ride.powerWeightSec,
      cadenceWeightedSum: ride.cadenceWeightedSum,
      cadenceWeightSec: ride.cadenceWeightSec,
      hrWeightedSum: ride.hrWeightedSum,
      hrWeightSec: ride.hrWeightSec,
    };
    const previous = this.tails.get(ride.workoutId) ?? Promise.resolve();
    const next = previous.then(() => writeChartSample(this.prisma, flush)).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`ride chart write failed: ${message}`);
    });
    this.tails.set(ride.workoutId, next);
  }

  async drain(workoutId: string): Promise<void> {
    let pending = this.tails.get(workoutId);
    while (pending) {
      await pending;
      const latest = this.tails.get(workoutId);
      if (latest === pending) {
        return;
      }
      pending = latest;
    }
  }
}

function rememberRampSecond(ride: RideState, bucket: SampleBucket): void {
  if (ride.kind !== 'zone_test' || ride.zoneTestProtocol !== 'ramp') {
    return;
  }
  const elapsed = Math.floor((bucket.second * 1000 - ride.startedAtMs) / 1000);
  if (elapsed < 0) {
    return;
  }
  while (ride.zoneTestSeries.length < elapsed) {
    ride.zoneTestSeries.push(null);
  }
  ride.zoneTestSeries[elapsed] = bucketPowerWatts(bucket);
}
