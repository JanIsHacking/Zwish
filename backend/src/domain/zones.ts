export interface ZoneBound {
  zone: number;
  min: number;
  max: number | null;
}

export const POWER_ZONE_PCTS: readonly { zone: number; minPct: number; maxPct: number | null }[] = [
  { zone: 1, minPct: 0, maxPct: 55 },
  { zone: 2, minPct: 56, maxPct: 75 },
  { zone: 3, minPct: 76, maxPct: 90 },
  { zone: 4, minPct: 91, maxPct: 105 },
  { zone: 5, minPct: 106, maxPct: 120 },
  { zone: 6, minPct: 121, maxPct: 150 },
  { zone: 7, minPct: 151, maxPct: null },
];

export function powerZonesFromFtp(ftpWatts: number): ZoneBound[] {
  return POWER_ZONE_PCTS.map((zone) => ({
    zone: zone.zone,
    min: Math.round((ftpWatts * zone.minPct) / 100),
    max: zone.maxPct === null ? null : Math.round((ftpWatts * zone.maxPct) / 100),
  }));
}

export function zoneBounds(
  zones: ZoneBound[],
  zone: number,
): { min: number; max: number | null } | null {
  const found = zones.find((item) => item.zone === zone);
  if (!found) {
    return null;
  }
  return { min: found.min, max: found.max };
}

export function deltaToBand(value: number, min: number, max: number | null): number {
  if (value < min) {
    return value - min;
  }
  if (max !== null && value > max) {
    return value - max;
  }
  return 0;
}
