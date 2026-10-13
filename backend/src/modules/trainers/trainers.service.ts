import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { asFit, asRpmPoints, knotsFromFit } from '../../domain/coast-down';
import { DomainError } from '../../domain/access';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RideRegistry } from '../rides/ride-registry';
import { DevicePresence } from '../telemetry/device-presence';
import { DeviceTrace } from '../telemetry/device-trace';
import { asKnots, toCurveView } from './curve-view';
import { CreateTrainerDto, SetInertiaDto, UpdateTrainerDto } from './dto/trainer.dto';

export { asKnots };

const trainerInclude = {
  resistanceLevels: { orderBy: { sortOrder: 'asc' as const } },
  pairings: true,
  curves: { where: { isActive: true }, orderBy: { createdAt: 'desc' as const } },
  _count: { select: { workouts: true } },
} satisfies Prisma.TrainerInclude;

type LoadedTrainer = Prisma.TrainerGetPayload<{ include: typeof trainerInclude }>;

@Injectable()
export class TrainersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: DevicePresence,
    private readonly traceBuffer: DeviceTrace,
    private readonly rides: RideRegistry,
  ) {}

  async list() {
    const trainers = await this.prisma.trainer.findMany({
      orderBy: { name: 'asc' },
      include: this.include(),
    });
    return trainers.map((trainer) => this.present(trainer));
  }

  async get(id: string) {
    const trainer = await this.prisma.trainer.findUnique({
      where: { id },
      include: this.include(),
    });
    if (!trainer) {
      throw new DomainError('TRAINER_NOT_FOUND', 404, 'Trainer not found');
    }
    return this.present(trainer);
  }

  async create(input: CreateTrainerDto) {
    try {
      return this.present(
        await this.prisma.trainer.create({
          data: {
            name: input.name.trim(),
            deviceId: input.deviceId?.toLowerCase(),
            resistanceLevels: {
              create: Array.from({ length: input.resistanceLevelCount }, (_, sortOrder) => ({
                label: String(sortOrder + 1),
                sortOrder,
              })),
            },
          },
          include: this.include(),
        }),
      );
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
  }

  async update(id: string, input: UpdateTrainerDto) {
    await this.get(id);
    try {
      return this.present(
        await this.prisma.trainer.update({
          where: { id },
          data: {
            name: input.name?.trim(),
            deviceId:
              input.deviceId === undefined ? undefined : (input.deviceId?.toLowerCase() ?? null),
            powerScale: input.powerScale,
          },
          include: this.include(),
        }),
      );
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
  }

  async setInertia(userId: string, trainerId: string, input: SetInertiaDto) {
    await this.get(trainerId);
    const bike = await this.prisma.bike.findUnique({ where: { id: input.bikeId } });
    if (!bike || bike.userId !== userId) {
      throw new DomainError('BIKE_NOT_FOUND', 404, 'Bike not found');
    }
    await this.prisma.trainerBike.upsert({
      where: { trainerId_bikeId: { trainerId, bikeId: input.bikeId } },
      create: { trainerId, bikeId: input.bikeId, inertiaKgM2: input.inertiaKgM2 },
      update: { inertiaKgM2: input.inertiaKgM2 },
    });
    const curves = await this.prisma.powerCurve.findMany({
      where: { trainerId, bikeId: input.bikeId, isActive: true },
    });
    for (const curve of curves) {
      const fit = asFit(curve.fitKind, curve.fitCoeffs);
      const measured = asRpmPoints(curve.coast);
      const tEnd = measured[measured.length - 1]?.tSec ?? 0;
      if (!fit || tEnd <= 0) {
        continue;
      }
      const knots = knotsFromFit(fit, tEnd, input.inertiaKgM2);
      if (knots.length < 3) {
        continue;
      }
      await this.prisma.powerCurve.update({
        where: { id: curve.id },
        data: { knots: knots as unknown as Prisma.InputJsonValue },
      });
    }
    const ride = this.rides.getByTrainer(trainerId);
    if (ride?.bikeId === input.bikeId && ride.resistanceLevelId) {
      const curve = await this.prisma.powerCurve.findFirst({
        where: {
          trainerId,
          bikeId: input.bikeId,
          resistanceLevelId: ride.resistanceLevelId,
          isActive: true,
        },
      });
      ride.knots = curve ? asKnots(curve.knots) : null;
    }
    return this.get(trainerId);
  }

  async trace(id: string) {
    await this.get(id);
    return {
      online: this.presence.isOnline(id),
      samples: this.traceBuffer.list(id),
    };
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    const rides = await this.prisma.workout.count({ where: { trainerId: id } });
    if (rides > 0) {
      throw new DomainError(
        'TRAINER_IN_USE',
        409,
        'This trainer has recorded rides and cannot be deleted',
      );
    }
    await this.prisma.trainer.delete({ where: { id } });
  }

  private present(trainer: LoadedTrainer) {
    return {
      id: trainer.id,
      name: trainer.name,
      deviceId: trainer.deviceId,
      powerScale: trainer.powerScale,
      online: this.presence.isOnline(trainer.id),
      rideCount: trainer._count.workouts,
      resistanceLevels: trainer.resistanceLevels,
      pairings: trainer.pairings.map((pairing) => ({
        bikeId: pairing.bikeId,
        inertiaKgM2: pairing.inertiaKgM2,
      })),
      curves: trainer.curves.flatMap((curve) => {
        const view = toCurveView(curve);
        return view ? [view] : [];
      }),
    };
  }

  private include() {
    return trainerInclude;
  }

  private rethrowUnique(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new DomainError('DEVICE_TAKEN', 409, 'That device is already registered');
    }
  }
}
