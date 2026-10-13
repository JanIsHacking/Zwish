import { stepEma } from '../../domain/display-ema';
import { RideState } from './ride-state';

export function snapDisplay(ride: RideState): void {
  ride.emaRpm = null;
  ride.emaSpeed = null;
  ride.emaCadence = null;
  ride.emaPower = null;
  ride.latestRpm = 0;
  ride.latestSpeed = 0;
  if (ride.latestCadence !== null) {
    ride.latestCadence = 0;
  }
  ride.displayPower = 0;
}

export function followDisplay(
  ride: RideState,
  sample: { rpm: number; speed: number; cadence: number | null; power: number | null; dtSec: number },
): void {
  ride.emaRpm = stepEma(ride.emaRpm, sample.rpm, sample.dtSec);
  ride.latestRpm = ride.emaRpm ?? sample.rpm;
  ride.emaSpeed = stepEma(ride.emaSpeed, sample.speed, sample.dtSec);
  ride.latestSpeed = ride.emaSpeed ?? sample.speed;
  if (sample.cadence !== null) {
    ride.emaCadence = stepEma(ride.emaCadence, sample.cadence, sample.dtSec);
    ride.latestCadence = ride.emaCadence;
  }
  if (sample.power !== null) {
    ride.emaPower = stepEma(ride.emaPower, sample.power, sample.dtSec);
    ride.displayPower = ride.emaPower;
  }
}
