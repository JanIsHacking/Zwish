import { weightedMean } from '../../domain/weighted';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BucketPoint, SampleBucket } from './ride-state';

export interface ChartFlush {
  workoutId: string;
  bucket: SampleBucket;
  distanceM: number;
  powerWeightedSum: number;
  powerWeightSec: number;
  cadenceWeightedSum: number;
  cadenceWeightSec: number;
  hrWeightedSum: number;
  hrWeightSec: number;
}

function weightedValue(points: BucketPoint[], pick: (point: BucketPoint) => number | null): number | null {
  let sum = 0;
  let weight = 0;
  for (const point of points) {
    const value = pick(point);
    if (value === null || point.dtSec <= 0) {
      continue;
    }
    sum += value * point.dtSec;
    weight += point.dtSec;
  }
  return weightedMean(sum, weight);
}

export function bucketPowerWatts(bucket: SampleBucket): number | null {
  return weightedValue(bucket.points, (point) => point.power);
}

export async function writeChartSample(prisma: PrismaService, flush: ChartFlush): Promise<void> {
  const { bucket } = flush;
  if (bucket.points.length === 0) {
    return;
  }
  await prisma.workoutSample.create({
    data: {
      workoutId: flush.workoutId,
      recordedAt: new Date(bucket.second * 1000),
      wheelRpm: weightedValue(bucket.points, (point) => point.wheelRpm) ?? 0,
      powerW: weightedValue(bucket.points, (point) => point.power),
      cadenceRpm: weightedValue(bucket.points, (point) => point.cadence),
      hrBpm: weightedValue(bucket.points, (point) => point.hr),
      distanceM: bucket.distanceM,
      speedMps: weightedValue(bucket.points, (point) => point.speed) ?? 0,
      resistanceLevelId: bucket.resistanceLevelId,
      chainringTeeth: bucket.chainringTeeth,
      cogTeeth: bucket.cogTeeth,
    },
  });
  await prisma.workout.update({
    where: { id: flush.workoutId },
    data: {
      distanceM: flush.distanceM,
      powerWeightedSum: flush.powerWeightedSum,
      powerWeightSec: flush.powerWeightSec,
      cadenceWeightedSum: flush.cadenceWeightedSum,
      cadenceWeightSec: flush.cadenceWeightSec,
      hrWeightedSum: flush.hrWeightedSum,
      hrWeightSec: flush.hrWeightSec,
      avgPowerW: weightedMean(flush.powerWeightedSum, flush.powerWeightSec) ?? undefined,
      avgCadenceRpm: weightedMean(flush.cadenceWeightedSum, flush.cadenceWeightSec) ?? undefined,
      avgHrBpm: weightedMean(flush.hrWeightedSum, flush.hrWeightSec) ?? undefined,
    },
  });
}
