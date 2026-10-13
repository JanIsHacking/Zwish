import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ActivationBus, ActivationEvent } from './activation-bus';

const FLUSH_MS = 200;
const FLUSH_COUNT = 50;
const PENDING_CAP = 5_000;

interface PendingActivation {
  trainerId: string;
  seq: number;
  monoUs: bigint;
  recordedAt: Date;
  revCount: number;
  dtUs: bigint;
}

@Injectable()
export class ActivationLog implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActivationLog.name);
  private readonly pending: PendingActivation[] = [];
  private timer: NodeJS.Timeout | null = null;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly bus: ActivationBus,
    private readonly prisma: PrismaService,
  ) {
    this.bus.subscribe((event) => this.enqueue(event));
  }

  onModuleInit(): void {
    this.timer = setInterval(() => this.kick(), FLUSH_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    for (let attempt = 0; attempt < 40 && this.pending.length > 0; attempt += 1) {
      const before = this.pending.length;
      this.kick();
      await this.tail;
      if (this.pending.length >= before) {
        return;
      }
    }
  }

  private enqueue(event: ActivationEvent): void {
    if (this.pending.some((row) => row.trainerId === event.trainerId && row.seq === event.seq)) {
      return;
    }
    this.pending.push({
      trainerId: event.trainerId,
      seq: event.seq,
      monoUs: BigInt(Math.trunc(event.monoUs)),
      recordedAt: event.recordedAt,
      revCount: event.revCount,
      dtUs: BigInt(Math.trunc(event.dtUs)),
    });
    if (this.pending.length >= FLUSH_COUNT) {
      this.kick();
    }
  }

  private kick(): void {
    this.tail = this.tail.then(() => this.flush()).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`activation log failed: ${message}`);
    });
  }

  private async flush(): Promise<void> {
    if (this.pending.length === 0) {
      return;
    }
    const batch = this.pending.splice(0, FLUSH_COUNT);
    try {
      await this.prisma.trainerActivation.createMany({ data: batch, skipDuplicates: true });
    } catch (error) {
      this.pending.unshift(...batch);
      if (this.pending.length > PENDING_CAP) {
        this.pending.splice(0, this.pending.length - PENDING_CAP);
      }
      throw error;
    }
  }
}
