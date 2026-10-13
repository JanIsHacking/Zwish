import { addWeighted, rideAverages, weightedMean } from './weighted';

describe('weighted mean', () => {
  it('weights a long revolution more than a short one', () => {
    let total = { sum: 0, weightSec: 0 };
    total = addWeighted(total, 100, 0.2);
    total = addWeighted(total, 200, 0.8);
    expect(weightedMean(total.sum, total.weightSec)).toBeCloseTo(180);
  });

  it('ignores a missing value', () => {
    const total = addWeighted({ sum: 50, weightSec: 1 }, null, 2);
    expect(total).toEqual({ sum: 50, weightSec: 1 });
    expect(weightedMean(0, 0)).toBeNull();
  });

  it('reads session averages from the running totals', () => {
    expect(
      rideAverages({
        powerWeightedSum: 300,
        powerWeightSec: 2,
        cadenceWeightedSum: 0,
        cadenceWeightSec: 0,
        hrWeightedSum: 140,
        hrWeightSec: 1,
      }),
    ).toEqual({ avgPowerW: 150, avgCadenceRpm: null, avgHrBpm: 140 });
  });
});
