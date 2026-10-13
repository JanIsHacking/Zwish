import type { RiderSetup } from '../api/types';

export function missingSetupMessage(setup: RiderSetup | undefined): string | null {
  if (!setup) {
    return null;
  }
  if (!setup.bikeId && !setup.trainerId) {
    return 'Choose a bike and a trainer on the home screen before starting.';
  }
  if (!setup.bikeId) {
    return 'Choose a bike on the home screen before starting.';
  }
  if (!setup.trainerId) {
    return 'Choose a trainer on the home screen before starting.';
  }
  return null;
}

export function keptForHistory(kind: 'bike' | 'trainer', rides: string): string {
  return `This ${kind} has ${rides}, so it stays attached to that history.`;
}
