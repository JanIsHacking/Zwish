import { deltaToBand, powerZonesFromFtp } from './zones';

describe('zones', () => {
  it('builds Coggan-style bounds from FTP', () => {
    const zones = powerZonesFromFtp(200);
    expect(zones.find((zone) => zone.zone === 2)).toEqual({ zone: 2, min: 112, max: 150 });
    expect(zones.find((zone) => zone.zone === 7)?.max).toBeNull();
  });

  it('reports signed distance to a target band', () => {
    expect(deltaToBand(100, 112, 150)).toBe(-12);
    expect(deltaToBand(130, 112, 150)).toBe(0);
    expect(deltaToBand(160, 112, 150)).toBe(10);
  });
});
