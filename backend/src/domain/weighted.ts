export interface WeightedTotal {
  sum: number;
  weightSec: number;
}

export function addWeighted(total: WeightedTotal, value: number | null, dtSec: number): WeightedTotal {
  if (value === null || dtSec <= 0) {
    return total;
  }
  return { sum: total.sum + value * dtSec, weightSec: total.weightSec + dtSec };
}

export function weightedMean(sum: number, weightSec: number): number | null {
  if (weightSec <= 0) {
    return null;
  }
  return sum / weightSec;
}

export function rideAverages(totals: {
  powerWeightedSum: number;
  powerWeightSec: number;
  cadenceWeightedSum: number;
  cadenceWeightSec: number;
  hrWeightedSum: number;
  hrWeightSec: number;
}): { avgPowerW: number | null; avgCadenceRpm: number | null; avgHrBpm: number | null } {
  return {
    avgPowerW: weightedMean(totals.powerWeightedSum, totals.powerWeightSec),
    avgCadenceRpm: weightedMean(totals.cadenceWeightedSum, totals.cadenceWeightSec),
    avgHrBpm: weightedMean(totals.hrWeightedSum, totals.hrWeightSec),
  };
}
