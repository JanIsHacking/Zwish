import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '../../domain/access';
import {
  alignPowerSeries,
  assessRamp,
  estimateTwentyMinuteFtp,
  parseZoneTestProtocol,
  zoneTestStartWatts,
} from '../../domain/ramp';
import { PlanSegmentClock } from '../../domain/segments';
import { rideAverages } from '../../domain/weighted';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CalibrationService } from '../calibration/calibration.service';
import { ChartWriter } from '../rides/chart-writer';
import { blankRide, RideState } from '../rides/ride-state';
import { RideRegistry } from '../rides/ride-registry';
import { asKnots } from '../trainers/trainers.service';
import { asHrZones } from '../users/public-user';
import { SetupDto, StartWorkoutDto } from './dto/workout.dto';

const workoutInclude = {
  bike: true,
  trainer: { include: { resistanceLevels: true, curves: { where: { isActive: true } } } },
  planSession: { include: { segments: { orderBy: { sortOrder: 'asc' as const } } } },
  user: true,
} satisfies Prisma.WorkoutInclude;

type LoadedWorkout = Prisma.WorkoutGetPayload<{ include: typeof workoutInclude }>;

@Injectable()
export class WorkoutsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rides: RideRegistry,
    private readonly calibration: CalibrationService,
    private readonly charts: ChartWriter,
  ) {}

  async onModuleInit(): Promise<void> {
    const active = await this.prisma.workout.findMany({
      where: { status: 'active' },
      include: workoutInclude,
    });
    for (const workout of active) {
      this.rides.set(this.toRide(workout));
    }
  }

  list(userId: string) {
    return this.prisma.workout.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { planSession: { select: { name: true } }, trainer: { select: { name: true } } },
    });
  }

  async get(userId: string, id: string) {
    const workout = await this.prisma.workout.findUnique({
      where: { id },
      include: {
        samples: { orderBy: { recordedAt: 'asc' } },
        planSession: true,
        trainer: { select: { name: true } },
        bike: { select: { name: true } },
        zoneTest: true,
      },
    });
    if (!workout || workout.userId !== userId) {
      throw new DomainError('WORKOUT_NOT_FOUND', 404, 'Workout not found');
    }
    return workout;
  }

  async setup(userId: string) {
    const setup = await this.prisma.riderSetup.findUnique({ where: { userId } });
    return (
      setup ?? {
        userId,
        trainerId: null,
        bikeId: null,
        resistanceLevelId: null,
        chainringTeeth: null,
        cogTeeth: null,
      }
    );
  }

  async saveSetup(userId: string, input: SetupDto) {
    const ride = this.rides.getByUser(userId);
    if (ride && (input.bikeId || input.trainerId)) {
      throw new DomainError(
        'RIDE_IN_PROGRESS',
        409,
        'Bike and trainer stay fixed until the ride stops',
      );
    }
    const saved = await this.prisma.riderSetup.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
    if (ride) {
      await this.applySetupToRide(ride, input);
    }
    return saved;
  }

  async start(userId: string, input: StartWorkoutDto) {
    if (input.kind === 'planned' && !input.planSessionId) {
      throw new DomainError('PLAN_SESSION_REQUIRED', 422, 'Choose a plan session');
    }
    if (this.rides.getByUser(userId) || this.rides.getByTrainer(input.trainerId)) {
      throw new DomainError(
        'RIDE_IN_PROGRESS',
        409,
        'A ride is already active on this account or trainer',
      );
    }
    if (this.calibration.isRecording(input.trainerId)) {
      throw new DomainError('CALIBRATION_IN_PROGRESS', 409, 'Finish the coast-down before riding');
    }
    const bike = await this.prisma.bike.findUnique({ where: { id: input.bikeId } });
    if (!bike || bike.userId !== userId) {
      throw new DomainError('BIKE_NOT_FOUND', 404, 'Bike not found');
    }
    const trainer = await this.prisma.trainer.findUnique({
      where: { id: input.trainerId },
      include: {
        resistanceLevels: { orderBy: { sortOrder: 'asc' } },
        curves: { where: { isActive: true } },
      },
    });
    if (!trainer) {
      throw new DomainError('TRAINER_NOT_FOUND', 404, 'Trainer not found');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const session = input.planSessionId
      ? await this.prisma.planSession.findUnique({
          where: { id: input.planSessionId },
          include: { segments: { orderBy: { sortOrder: 'asc' } }, plan: true },
        })
      : null;
    if (input.kind === 'planned' && (!session || session.plan.userId !== userId)) {
      throw new DomainError('PLAN_NOT_FOUND', 404, 'Plan session not found');
    }
    if (
      input.kind === 'planned' &&
      session?.segments.some((segment) => segment.targetKind === 'power') &&
      (user.ftpWatts === null || user.ftpWatts <= 0)
    ) {
      throw new DomainError(
        'FTP_REQUIRED',
        422,
        'Set your FTP with a zone test or enter it before a power workout',
      );
    }
    if (input.kind === 'zone_test' && !parseZoneTestProtocol(input.zoneTestProtocol)) {
      throw new DomainError('ZONE_TEST_PROTOCOL_REQUIRED', 422, 'Choose a ramp or 20-minute test');
    }
    const zoneTestProtocol =
      input.kind === 'zone_test' ? parseZoneTestProtocol(input.zoneTestProtocol) : null;
    const chainring = input.chainringTeeth ?? bike.chainringTeeth[0] ?? null;
    const cog = input.cogTeeth ?? bike.cogTeeth[0] ?? null;
    const level =
      trainer.resistanceLevels.find((item) => item.id === input.resistanceLevelId) ??
      trainer.resistanceLevels[0] ??
      null;
    const started = await this.prisma.workout.create({
      data: {
        userId,
        trainerId: trainer.id,
        bikeId: bike.id,
        planSessionId: session?.id,
        kind: input.kind,
        status: 'active',
        resistanceLevelId: level?.id,
        chainringTeeth: chainring,
        cogTeeth: cog,
        zoneTestProtocol,
        zoneTestStartW: zoneTestProtocol === 'ramp' ? zoneTestStartWatts(user.ftpWatts) : null,
      },
      include: workoutInclude,
    });
    await this.prisma.riderSetup.upsert({
      where: { userId },
      create: {
        userId,
        trainerId: trainer.id,
        bikeId: bike.id,
        resistanceLevelId: level?.id,
        chainringTeeth: chainring,
        cogTeeth: cog,
      },
      update: {
        trainerId: trainer.id,
        bikeId: bike.id,
        resistanceLevelId: level?.id,
        chainringTeeth: chainring,
        cogTeeth: cog,
      },
    });
    this.rides.set(this.toRide(started));
    const { user: _user, ...publicWorkout } = started;
    return publicWorkout;
  }

  async stop(userId: string, workoutId: string) {
    const workout = await this.prisma.workout.findUnique({ where: { id: workoutId } });
    if (!workout || workout.userId !== userId) {
      throw new DomainError('WORKOUT_NOT_FOUND', 404, 'Workout not found');
    }
    if (workout.status === 'completed') {
      return this.get(userId, workoutId);
    }
    const ride = this.rides.getByWorkout(workoutId);
    if (ride) {
      this.rides.removeTrainer(ride.trainerId);
      this.charts.enqueue(ride);
      await this.charts.drain(ride.workoutId);
    }
    const samples = await this.prisma.workoutSample.findMany({
      where: { workoutId },
      orderBy: { recordedAt: 'asc' },
    });
    const averages = ride
      ? rideAverages(ride)
      : hasWeightedTotals(workout)
        ? rideAverages(workout)
        : {
            avgPowerW: average(samples.map((sample) => sample.powerW)),
            avgCadenceRpm: average(samples.map((sample) => sample.cadenceRpm)),
            avgHrBpm: average(samples.map((sample) => sample.hrBpm)),
          };
    const distanceM = ride ? ride.distanceM : (samples.at(-1)?.distanceM ?? workout.distanceM);
    let estimatedFtp: number | null = null;
    const zoneTestProtocol = parseZoneTestProtocol(workout.zoneTestProtocol);
    if (workout.kind === 'zone_test' && zoneTestProtocol) {
      const elapsedSeconds = Math.floor((Date.now() - workout.startedAt.getTime()) / 1000);
      const series = alignPowerSeries(
        workout.startedAt.getTime(),
        samples.map((sample) => ({
          recordedAtMs: sample.recordedAt.getTime(),
          powerW: sample.powerW,
        })),
        elapsedSeconds,
      );
      estimatedFtp =
        zoneTestProtocol === 'twenty_minute'
          ? estimateTwentyMinuteFtp(series)
          : workout.zoneTestStartW === null
            ? null
            : assessRamp(series, workout.zoneTestStartW).estimatedFtp;
      if (estimatedFtp !== null) {
        await this.prisma.zoneTest.upsert({
          where: { workoutId },
          create: { userId, workoutId, estimatedFtp, protocol: zoneTestProtocol },
          update: {},
        });
        await this.prisma.user.update({ where: { id: userId }, data: { ftpWatts: estimatedFtp } });
      }
    }
    await this.prisma.workout.update({
      where: { id: workoutId },
      data: {
        status: 'completed',
        endedAt: new Date(),
        ...averages,
        distanceM,
        estimatedFtp,
        ...(ride
          ? {
              powerWeightedSum: ride.powerWeightedSum,
              powerWeightSec: ride.powerWeightSec,
              cadenceWeightedSum: ride.cadenceWeightedSum,
              cadenceWeightSec: ride.cadenceWeightSec,
              hrWeightedSum: ride.hrWeightedSum,
              hrWeightSec: ride.hrWeightSec,
            }
          : {}),
      },
    });
    return this.get(userId, workoutId);
  }

  private async applySetupToRide(ride: RideState, input: SetupDto): Promise<void> {
    if (input.chainringTeeth) {
      ride.chainringTeeth = input.chainringTeeth;
    }
    if (input.cogTeeth) {
      ride.cogTeeth = input.cogTeeth;
    }
    if (input.resistanceLevelId) {
      const level = await this.prisma.resistanceLevel.findUnique({
        where: { id: input.resistanceLevelId },
      });
      if (!level || level.trainerId !== ride.trainerId) {
        throw new DomainError('LEVEL_NOT_FOUND', 404, 'Resistance level not found');
      }
      const curve = await this.prisma.powerCurve.findFirst({
        where: {
          trainerId: ride.trainerId,
          bikeId: ride.bikeId,
          resistanceLevelId: level.id,
          isActive: true,
        },
      });
      ride.resistanceLevelId = level.id;
      ride.resistanceLabel = level.label;
      ride.knots = curve ? asKnots(curve.knots) : null;
    }
    await this.prisma.workout.update({
      where: { id: ride.workoutId },
      data: {
        chainringTeeth: ride.chainringTeeth,
        cogTeeth: ride.cogTeeth,
        resistanceLevelId: ride.resistanceLevelId,
      },
    });
  }

  private toRide(workout: LoadedWorkout): RideState {
    const level = workout.trainer.resistanceLevels.find(
      (item) => item.id === workout.resistanceLevelId,
    );
    const curve = workout.trainer.curves.find(
      (item) =>
        item.bikeId === workout.bikeId && item.resistanceLevelId === workout.resistanceLevelId,
    );
    const segments: PlanSegmentClock[] | null = workout.planSession
      ? workout.planSession.segments.map((segment) => ({
          durationSeconds: segment.durationSeconds,
          targetKind: segment.targetKind === 'heart_rate' ? 'heart_rate' : 'power',
          zone: segment.zone,
          notes: segment.notes,
        }))
      : null;
    const ride = blankRide({
      workoutId: workout.id,
      userId: workout.userId,
      trainerId: workout.trainerId,
      bikeId: workout.bikeId,
      kind: workout.kind as RideState['kind'],
      startedAtMs: workout.startedAt.getTime(),
      circumferenceMm: workout.bike.wheelCircumferenceMm,
      powerScale: workout.trainer.powerScale,
      knots: curve ? asKnots(curve.knots) : null,
      ftpWatts: workout.user.ftpWatts,
      hrZones: asHrZones(workout.user.hrZoneBounds),
      segments,
      sessionName: workout.planSession?.name ?? null,
      zoneTestProtocol: parseZoneTestProtocol(workout.zoneTestProtocol),
      zoneTestStartW: workout.zoneTestStartW,
      resistanceLevelId: level?.id ?? null,
      resistanceLabel: level?.label ?? null,
      chainringTeeth: workout.chainringTeeth,
      cogTeeth: workout.cogTeeth,
      distanceM: workout.distanceM,
    });
    ride.powerWeightedSum = workout.powerWeightedSum;
    ride.powerWeightSec = workout.powerWeightSec;
    ride.cadenceWeightedSum = workout.cadenceWeightedSum;
    ride.cadenceWeightSec = workout.cadenceWeightSec;
    ride.hrWeightedSum = workout.hrWeightedSum;
    ride.hrWeightSec = workout.hrWeightSec;
    return ride;
  }
}

function hasWeightedTotals(workout: {
  powerWeightSec: number;
  cadenceWeightSec: number;
  hrWeightSec: number;
}): boolean {
  return workout.powerWeightSec > 0 || workout.cadenceWeightSec > 0 || workout.hrWeightSec > 0;
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) {
    return null;
  }
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

