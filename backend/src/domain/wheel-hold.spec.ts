import { closesRevolution, rideHasStopped, rideHoldMs, wheelHasStopped, wheelHoldMs } from './wheel-hold';

describe('wheel hold', () => {
  it('waits at least one extra half-revolution before calling a coast stopped', () => {
    expect(wheelHoldMs(1_000_000)).toBe(1_500);
    expect(wheelHoldMs(100_000)).toBe(800);
    expect(wheelHoldMs(4_000_000)).toBe(3_000);
  });

  it('stays rolling until that coast hold elapses', () => {
    expect(wheelHasStopped(1_000, 1_700, 500_000)).toBe(false);
    expect(wheelHasStopped(1_000, 1_800, 500_000)).toBe(true);
    expect(wheelHasStopped(null, 5_000, 500_000)).toBe(false);
  });

  it('keeps ride power through a hard slowdown and a short delivery stall', () => {
    expect(rideHoldMs(200_000)).toBe(3_100);
    expect(rideHoldMs(500_000)).toBe(4_000);
    expect(rideHoldMs(2_000_000)).toBe(8_000);
    expect(rideHasStopped(0, 2_000, 200_000)).toBe(false);
    expect(rideHasStopped(0, 3_100, 200_000)).toBe(true);
    expect(rideHasStopped(null, 10_000, 200_000)).toBe(false);
  });

  it('counts a slowed revolution, and only a gap past the ride hold needs a fresh interval', () => {
    expect(closesRevolution(2_000_000, 500_000, false)).toBe(true);
    expect(closesRevolution(400_000, 500_000, false)).toBe(true);
    expect(closesRevolution(4_000_000, 500_000, false)).toBe(false);
    expect(closesRevolution(1_200_000, 500_000, true)).toBe(true);
    expect(closesRevolution(9_000_000, 0, true)).toBe(false);
  });
});
