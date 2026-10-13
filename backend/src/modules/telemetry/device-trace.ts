import { Injectable } from '@nestjs/common';

export interface DeviceTraceSample {
  atMs: number;
  seq: number;
  monoUs: number;
  revCount: number;
  dtUs: number;
  wheelRpm: number | null;
}

const TRACE_LIMIT = 30;

@Injectable()
export class DeviceTrace {
  private readonly samples = new Map<string, DeviceTraceSample[]>();

  note(trainerId: string, sample: DeviceTraceSample): void {
    const list = this.samples.get(trainerId) ?? [];
    list.push(sample);
    if (list.length > TRACE_LIMIT) {
      list.splice(0, list.length - TRACE_LIMIT);
    }
    this.samples.set(trainerId, list);
  }

  list(trainerId: string): DeviceTraceSample[] {
    return [...(this.samples.get(trainerId) ?? [])];
  }
}
