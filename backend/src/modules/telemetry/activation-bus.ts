import { Injectable } from '@nestjs/common';

export interface ActivationEvent {
  trainerId: string;
  seq: number;
  monoUs: number;
  recordedAt: Date;
  revCount: number;
  dtUs: number;
  hrBpm: number | null;
}

type ActivationListener = (event: ActivationEvent) => void;

@Injectable()
export class ActivationBus {
  private readonly listeners = new Set<ActivationListener>();

  subscribe(listener: ActivationListener): void {
    this.listeners.add(listener);
  }

  emit(event: ActivationEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
