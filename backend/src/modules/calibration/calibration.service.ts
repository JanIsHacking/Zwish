import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '../../domain/access';
import {
  asFit,
  asRpmPoints,
  CoastSample,
  COAST_TARGET_RPM,
  FitKind,
  fitCoast,
  knotsFromFit,
  sliceCoast,
} from '../../domain/coast-down';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RideRegistry } from '../rides/ride-registry';
import { buildCalibrationView, CalibrationView } from './calibration-view';
import { StartCalibrationDto } from './dto/calibration.dto';

const OPEN_STATUSES = ['recording', 'coasting', 'review'];

interface Recording {
  runId: string;
  trainerId: string;
  samples: CoastSample[];
  coastStartMonoUs: number | null;
}

@Injectable()
export class CalibrationService implements OnModuleInit {
  private readonly active = new Map<string, Recording>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly rides: RideRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const open = await this.prisma.calibrationRun.findMany({
      where: { status: { in: OPEN_STATUSES } },
    });
    for (const run of open) {
      this.active.set(run.trainerId, {
        runId: run.id,
        trainerId: run.trainerId,
        samples: [],
        coastStartMonoUs: run.coastStartMonoUs,
      });
    }
  }

  isRecording(trainerId: string): boolean {
    return this.active.has(trainerId);
  }

  append(trainerId: string, sample: CoastSample): void {
    const recording = this.active.get(trainerId);
    if (!recording || recording.samples.length > 20_000) {
      return;
    }
    recording.samples.push(sample);
  }

  async start(userId: string, input: StartCalibrationDto): Promise<CalibrationView> {
    if (this.rides.getByTrainer(input.trainerId)) {
      throw new DomainError('RIDE_IN_PROGRESS', 409, 'Stop the ride before calibrating');
    }
    if (this.active.has(input.trainerId)) {
      throw new DomainError('CALIBRATION_IN_PROGRESS', 409, 'A coast-down is already running');
    }
    await this.ownedBike(userId, input.bikeId);
    const level = await this.prisma.resistanceLevel.findUnique({
      where: { id: input.resistanceLevelId },
    });
    if (!level || level.trainerId !== input.trainerId) {
      throw new DomainError('LEVEL_NOT_FOUND', 404, 'Resistance level not found');
    }
    const trainer = await this.prisma.trainer.findUnique({ where: { id: input.trainerId } });
    if (!trainer) {
      throw new DomainError('TRAINER_NOT_FOUND', 404, 'Trainer not found');
    }
    const run = await this.prisma.calibrationRun.create({
      data: {
        trainerId: input.trainerId,
        bikeId: input.bikeId,
        resistanceLevelId: input.resistanceLevelId,
        tirePressureBar: input.tirePressureBar,
        targetRpm: COAST_TARGET_RPM,
        status: 'recording',
      },
    });
    this.active.set(input.trainerId, {
      runId: run.id,
      trainerId: input.trainerId,
      samples: [],
      coastStartMonoUs: null,
    });
    return this.view(run.id);
  }

  async activeForTrainer(userId: string, trainerId: string): Promise<CalibrationView | null> {
    const recording = this.active.get(trainerId);
    const run = recording
      ? await this.prisma.calibrationRun.findUnique({ where: { id: recording.runId } })
      : await this.prisma.calibrationRun.findFirst({
          where: { trainerId, status: { in: OPEN_STATUSES } },
          orderBy: { startedAt: 'desc' },
        });
    if (!run) {
      return null;
    }
    const bike = await this.prisma.bike.findUnique({ where: { id: run.bikeId } });
    if (!bike || bike.userId !== userId) {
      return null;
    }
    return this.view(run.id);
  }

  get(userId: string, id: string): Promise<CalibrationView> {
    return this.ownedRun(userId, id).then(() => this.view(id));
  }

  async beginCoast(userId: string, id: string): Promise<CalibrationView> {
    const run = await this.ownedRun(userId, id);
    if (run.status === 'coasting' || run.status === 'review') {
      return this.view(id);
    }
    if (run.status !== 'recording') {
      throw new DomainError('CALIBRATION_CLOSED', 409, 'This coast-down is already finished');
    }
    const recording = this.recordingFor(id);
    const last = recording?.samples[recording.samples.length - 1];
    if (!recording || !last) {
      throw new DomainError(
        'NO_WHEEL_SPEED',
        422,
        'No wheel speed yet. Check that the sensor is online.',
      );
    }
    recording.coastStartMonoUs = last.monoUs;
    await this.prisma.calibrationRun.update({
      where: { id },
      data: { status: 'coasting', coastStartMonoUs: last.monoUs },
    });
    return this.view(id);
  }

  async capture(userId: string, id: string): Promise<CalibrationView> {
    const run = await this.ownedRun(userId, id);
    if (run.status === 'review') {
      return this.view(id);
    }
    if (run.status !== 'coasting') {
      throw new DomainError('COAST_NOT_STARTED', 409, 'The countdown has not reached zero yet');
    }
    const recording = this.recordingFor(id);
    const start = recording?.coastStartMonoUs ?? run.coastStartMonoUs;
    if (start === null || !recording) {
      throw new DomainError('COAST_NOT_STARTED', 409, 'The countdown has not reached zero yet');
    }
    const sliced = sliceCoast(recording.samples, start, Date.now());
    if (sliced.status === 'open') {
      throw new DomainError('WHEEL_STILL_TURNING', 422, 'The wheel is still turning');
    }
    if (sliced.status === 'short') {
      recording.coastStartMonoUs = null;
      await this.prisma.calibrationRun.update({
        where: { id },
        data: { status: 'recording', coastStartMonoUs: null },
      });
      throw new DomainError(
        'COAST_TOO_SHORT',
        422,
        'That coast was too short. Spin up again and let the wheel slow all the way down.',
      );
    }
    await this.prisma.calibrationRun.update({
      where: { id },
      data: {
        status: 'review',
        samples: recording.samples as unknown as Prisma.InputJsonValue,
        coast: sliced.points as unknown as Prisma.InputJsonValue,
      },
    });
    return this.view(id);
  }

  async selectFit(userId: string, id: string, kind: FitKind): Promise<CalibrationView> {
    const run = await this.ownedRun(userId, id);
    if (run.status !== 'review') {
      throw new DomainError('COAST_NOT_READY', 409, 'Wait until the wheel has stopped');
    }
    const fit = fitCoast(asRpmPoints(run.coast), kind);
    if (!fit) {
      throw new DomainError(
        'FIT_REJECTED',
        422,
        'That curve does not follow this coast. Try another.',
      );
    }
    await this.prisma.calibrationRun.update({
      where: { id },
      data: { fitKind: fit.kind, fitCoeffs: fit.coeffs as unknown as Prisma.InputJsonValue },
    });
    return this.view(id);
  }

  async confirm(userId: string, id: string): Promise<CalibrationView> {
    const run = await this.ownedRun(userId, id);
    if (run.status === 'completed') {
      return this.view(id);
    }
    if (run.status !== 'review') {
      throw new DomainError('COAST_NOT_READY', 409, 'Wait until the wheel has stopped');
    }
    const fit = asFit(run.fitKind, run.fitCoeffs);
    if (!fit) {
      throw new DomainError('FIT_REQUIRED', 422, 'Choose a curve fit first.');
    }
    const pairing = await this.prisma.trainerBike.findUnique({
      where: { trainerId_bikeId: { trainerId: run.trainerId, bikeId: run.bikeId } },
    });
    if (pairing?.inertiaKgM2 == null || pairing.inertiaKgM2 <= 0) {
      throw new DomainError(
        'INERTIA_REQUIRED',
        422,
        'Set the moment of inertia for this bike on this trainer before confirming.',
      );
    }
    const measured = asRpmPoints(run.coast);
    const knots = knotsFromFit(fit, measured[measured.length - 1]?.tSec ?? 0, pairing.inertiaKgM2);
    if (knots.length < 3) {
      throw new DomainError(
        'CURVE_NOT_FIT',
        422,
        'That fit does not give a usable power curve. Try another.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.calibrationRun.update({
        where: { id },
        data: { status: 'completed', endedAt: new Date() },
      }),
      this.prisma.powerCurve.updateMany({
        where: {
          trainerId: run.trainerId,
          bikeId: run.bikeId,
          resistanceLevelId: run.resistanceLevelId,
          isActive: true,
        },
        data: { isActive: false },
      }),
      this.prisma.powerCurve.create({
        data: {
          trainerId: run.trainerId,
          bikeId: run.bikeId,
          resistanceLevelId: run.resistanceLevelId,
          knots: knots as unknown as Prisma.InputJsonValue,
          coast: measured as unknown as Prisma.InputJsonValue,
          fitKind: fit.kind,
          fitCoeffs: fit.coeffs as unknown as Prisma.InputJsonValue,
          tirePressureBar: run.tirePressureBar,
          isActive: true,
          calibrationRunId: run.id,
        },
      }),
    ]);
    this.active.delete(run.trainerId);
    return this.view(id);
  }

  async cancel(userId: string, id: string): Promise<{ ok: true }> {
    const run = await this.ownedRun(userId, id);
    if (run.status === 'completed') {
      throw new DomainError('CALIBRATION_CLOSED', 409, 'This coast-down is already finished');
    }
    await this.prisma.calibrationRun.update({
      where: { id },
      data: { status: 'abandoned', endedAt: new Date() },
    });
    const recording = this.active.get(run.trainerId);
    if (recording?.runId === id) {
      this.active.delete(run.trainerId);
    }
    return { ok: true };
  }

  private async view(id: string): Promise<CalibrationView> {
    const run = await this.prisma.calibrationRun.findUnique({ where: { id } });
    if (!run) {
      throw new DomainError('CALIBRATION_NOT_FOUND', 404, 'Calibration not found');
    }
    const recording = this.recordingFor(id);
    return buildCalibrationView({
      id: run.id,
      status: run.status,
      bikeId: run.bikeId,
      resistanceLevelId: run.resistanceLevelId,
      tirePressureBar: run.tirePressureBar,
      fitKind: run.fitKind,
      fitCoeffs: run.fitCoeffs,
      coast: run.coast,
      samples: recording?.samples ?? [],
      nowMs: Date.now(),
    });
  }

  private recordingFor(runId: string): Recording | undefined {
    return [...this.active.values()].find((item) => item.runId === runId);
  }

  private async ownedRun(userId: string, id: string) {
    const run = await this.prisma.calibrationRun.findUnique({ where: { id } });
    if (!run) {
      throw new DomainError('CALIBRATION_NOT_FOUND', 404, 'Calibration not found');
    }
    await this.ownedBike(userId, run.bikeId);
    return run;
  }

  private async ownedBike(userId: string, bikeId: string): Promise<void> {
    const bike = await this.prisma.bike.findUnique({ where: { id: bikeId } });
    if (!bike || bike.userId !== userId) {
      throw new DomainError('BIKE_NOT_FOUND', 404, 'Bike not found');
    }
  }
}
