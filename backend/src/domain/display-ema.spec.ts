import { stepEma } from './display-ema';

describe('display ema', () => {
  it('seeds from the first sample of an interval', () => {
    expect(stepEma(null, 180, 0.25)).toBe(180);
  });

  it('moves the same amount for one step as for two steps that cover the same time', () => {
    const once = stepEma(0, 100, 1, 2);
    const twice = stepEma(stepEma(0, 100, 0.5, 2), 100, 0.5, 2);
    expect(twice).toBeCloseTo(once);
  });

  it('gives a shorter revolution a smaller step', () => {
    const slow = stepEma(0, 100, 1, 2);
    const fast = stepEma(0, 100, 0.2, 2);
    expect(fast).toBeLessThan(slow);
  });
});
