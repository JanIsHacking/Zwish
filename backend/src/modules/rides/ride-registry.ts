import { Injectable } from '@nestjs/common';
import { RideState } from './ride-state';

@Injectable()
export class RideRegistry {
  private readonly byTrainer = new Map<string, RideState>();

  set(ride: RideState): void {
    this.byTrainer.set(ride.trainerId, ride);
  }

  getByTrainer(trainerId: string): RideState | null {
    return this.byTrainer.get(trainerId) ?? null;
  }

  getByUser(userId: string): RideState | null {
    for (const ride of this.byTrainer.values()) {
      if (ride.userId === userId) {
        return ride;
      }
    }
    return null;
  }

  getByWorkout(workoutId: string): RideState | null {
    for (const ride of this.byTrainer.values()) {
      if (ride.workoutId === workoutId) {
        return ride;
      }
    }
    return null;
  }

  removeTrainer(trainerId: string): void {
    this.byTrainer.delete(trainerId);
  }

  all(): RideState[] {
    return [...this.byTrainer.values()];
  }
}
