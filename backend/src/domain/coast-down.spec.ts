import {
  COAST_TARGET_RPM,
  fitCoast,
  heldSeconds,
  knotsFromFit,
  rpmAt,
  sliceCoast,
  type CoastSample,
} from './coast-down';

describe('coast-down', () => {
  it('counts a continuous hold above the target and resets when speed drops', () => {
    const samples = [0, 1, 2, 3, 4].map((second) =>
      sample(second * 1_000_000, second === 2 ? COAST_TARGET_RPM - 10 : 220, 1_000 + second * 1000),
    );
    expect(heldSeconds(samples, COAST_TARGET_RPM, 5_000)).toBeCloseTo(1, 1);
    expect(heldSeconds(samples.slice(0, 2), COAST_TARGET_RPM, 2_000)).toBeCloseTo(1, 1);
  });

  it('cuts the coast from the stop of pedaling through the first zero', () => {
    const samples = Array.from({ length: 12 }, (_, index) =>
      sample(index * 500_000, 180 - index * 12, 10_000 + index * 500),
    );
    const last = samples[samples.length - 1];
    const sliced = sliceCoast(samples, 1_000_000, (last?.atMs ?? 0) + 5_000);
    expect(sliced.status).toBe('ready');
    if (sliced.status !== 'ready') {
      return;
    }
    expect(sliced.points[0]?.wheelRpm).toBe(180 - 2 * 12);
    expect(sliced.points[sliced.points.length - 1]?.wheelRpm).toBe(0);
    expect(sliceCoast(samples, 1_000_000, last?.atMs ?? 0).status).toBe('open');
  });

  it('fits a straight deceleration and turns it into power proportional to rpm', () => {
    const points = Array.from({ length: 21 }, (_, index) => ({
      tSec: index * 0.5,
      wheelRpm: 200 - index * 10,
    }));
    const fit = fitCoast(points, 'linear');
    expect(fit?.coeffs[0]).toBeCloseTo(200, 4);
    expect(fit?.coeffs[1]).toBeCloseTo(-20, 4);
    if (!fit) {
      return;
    }
    const knots = knotsFromFit(fit, 10, 0.2);
    const at100 = knots.find((knot) => knot.wheelRpm === 100);
    const at160 = knots.find((knot) => knot.wheelRpm === 160);
    expect(at100?.watts).toBeCloseTo(4.386, 0);
    expect((at160?.watts ?? 0) / 160).toBeCloseTo((at100?.watts ?? 0) / 100, 1);
    expect(knotsFromFit(fit, 10, 0.4).find((knot) => knot.wheelRpm === 100)?.watts).toBeCloseTo(
      (at100?.watts ?? 0) * 2,
      1,
    );
  });

  it('fits an exponential decay', () => {
    const points = Array.from({ length: 30 }, (_, index) => {
      const tSec = index * 0.4;
      return { tSec, wheelRpm: 180 * Math.exp(-0.15 * tSec) };
    });
    const fit = fitCoast(points, 'exponential');
    expect(fit?.coeffs[0]).toBeCloseTo(180, 1);
    expect(fit?.coeffs[1]).toBeCloseTo(0.15, 2);
    if (!fit) {
      return;
    }
    expect(rpmAt(fit, 2)).toBeCloseTo(180 * Math.exp(-0.3), 1);
    expect(knotsFromFit(fit, 8, 0.15).length).toBeGreaterThanOrEqual(3);
  });

  it('fits a quadratic coast and rejects a line that does not slow down', () => {
    const points = Array.from({ length: 20 }, (_, index) => {
      const tSec = index * 0.5;
      return { tSec, wheelRpm: 160 - 8 * tSec - 0.4 * tSec * tSec };
    });
    const fit = fitCoast(points, 'quadratic');
    expect(fit?.coeffs[0]).toBeCloseTo(160, 2);
    expect(fit?.coeffs[1]).toBeCloseTo(-8, 2);
    expect(fit?.coeffs[2]).toBeCloseTo(-0.4, 2);
    expect(fitCoast(points, 'linear')).not.toBeNull();
    const flat = points.map((point) => ({ ...point, wheelRpm: 120 }));
    expect(fitCoast(flat, 'linear')).toBeNull();
    expect(fitCoast(points.slice(0, 3), 'quadratic')).toBeNull();
  });
});

function sample(monoUs: number, wheelRpm: number, atMs: number): CoastSample {
  return { monoUs, wheelRpm, atMs, dtUs: 250_000 };
}
