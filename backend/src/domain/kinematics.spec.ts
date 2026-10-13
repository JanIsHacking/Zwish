import { cadenceRpm, interpolatePower, scaledPower, wheelRpmFromDelta } from './kinematics';

describe('kinematics', () => {
  it('derives wheel rpm from device interval', () => {
    expect(wheelRpmFromDelta(1, 250_000)).toBeCloseTo(240);
  });

  it('derives cadence from gear teeth', () => {
    expect(cadenceRpm(100, 25, 50)).toBeCloseTo(50);
  });

  it('interpolates power between knots and applies scale', () => {
    const knots = [
      { wheelRpm: 100, watts: 100 },
      { wheelRpm: 200, watts: 300 },
    ];
    expect(interpolatePower(knots, 150)).toBeCloseTo(200);
    expect(scaledPower(knots, 150, 1.5)).toBeCloseTo(300);
  });
});
