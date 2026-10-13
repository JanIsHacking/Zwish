/// <reference types="vitest/globals" />
import { rideCue, targetBand } from './ride-cue';

describe('ride cue', () => {
  it('asks the rider to push when under the band', () => {
    expect(rideCue(-12.4, 'W')).toEqual({ verb: 'Push', amount: 12, unit: 'W' });
  });

  it('asks the rider to ease when over the band', () => {
    expect(rideCue(8, 'bpm')).toEqual({ verb: 'Ease', amount: 8, unit: 'bpm' });
  });

  it('holds inside the band and stays quiet without a delta', () => {
    expect(rideCue(0, 'W')).toEqual({ verb: 'Hold', amount: null, unit: 'W' });
    expect(rideCue(null, 'W')).toBeNull();
  });

  it('reads a power zone as a watt band and a ramp as one target', () => {
    expect(
      targetBand({ targetKind: 'power', targetZone: 4, targetWatts: 210, zoneLow: 210, zoneHigh: 255 }),
    ).toEqual({ zone: 'Z4', range: '210–255 W' });
    expect(
      targetBand({ targetKind: 'watts', targetZone: null, targetWatts: 180, zoneLow: null, zoneHigh: null }),
    ).toEqual({ zone: null, range: '180 W' });
    expect(
      targetBand({ targetKind: null, targetZone: null, targetWatts: null, zoneLow: null, zoneHigh: null }),
    ).toBeNull();
  });
});
