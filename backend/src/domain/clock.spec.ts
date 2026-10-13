import { emptyClock, epochUs, observePong, recordedAtFromMono } from './clock';

describe('clock', () => {
  it('prefers the lowest round trip when mapping mono time to UTC', () => {
    const first = observePong(emptyClock(), {
      serverPingUs: 1_000_000,
      serverRecvUs: 1_050_000,
      monoUs: 500_000,
      nowMs: 1_000,
    });
    const ignored = observePong(first, {
      serverPingUs: 2_000_000,
      serverRecvUs: 2_200_000,
      monoUs: 1_400_000,
      nowMs: 2_000,
    });
    expect(ignored.offsetUs).toBe(first.offsetUs);
    const better = observePong(first, {
      serverPingUs: 3_000_000,
      serverRecvUs: 3_020_000,
      monoUs: 2_500_000,
      nowMs: 3_000,
    });
    expect(better.bestRttUs).toBe(20_000);
    const at = recordedAtFromMono(2_500_000, better.offsetUs ?? 0);
    expect(at.getTime()).toBeCloseTo((2_500_000 + (better.offsetUs ?? 0)) / 1000, 0);
    expect(epochUs(new Date(1_000))).toBe(1_000_000);
  });
});
