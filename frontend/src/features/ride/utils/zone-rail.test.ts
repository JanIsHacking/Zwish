/// <reference types="vitest/globals" />
import { zoneFrame, percentToRail, toneFromDelta } from './zone-rail';

describe('zone rail', () => {
  it('places FTP at the top of zone 4', () => {
    expect(percentToRail(100)).toBeGreaterThan(percentToRail(90));
    expect(percentToRail(100)).toBeLessThan(percentToRail(105));
  });

  it('frames zone 2 between the neighboring bands', () => {
    const frame = zoneFrame(2);
    expect(frame?.left).toBeCloseTo(percentToRail(55));
    expect(frame && frame.left + frame.width).toBeCloseTo(percentToRail(75));
  });

  it('reads a signed delta as under, in, or over', () => {
    expect(toneFromDelta(-12)).toBe('under');
    expect(toneFromDelta(0)).toBe('in');
    expect(toneFromDelta(8)).toBe('over');
    expect(toneFromDelta(null)).toBe('idle');
  });
});
