import { Injectable } from '@nestjs/common';

@Injectable()
export class DevicePresence {
  private readonly connections = new Map<string, number>();

  connect(trainerId: string): void {
    this.connections.set(trainerId, (this.connections.get(trainerId) ?? 0) + 1);
  }

  disconnect(trainerId: string): void {
    const remaining = (this.connections.get(trainerId) ?? 1) - 1;
    if (remaining <= 0) {
      this.connections.delete(trainerId);
      return;
    }
    this.connections.set(trainerId, remaining);
  }

  isOnline(trainerId: string): boolean {
    return this.connections.has(trainerId);
  }
}
