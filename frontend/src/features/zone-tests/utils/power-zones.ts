const POWER_ZONE_PCTS: readonly { zone: number; minPct: number; maxPct: number | null }[] = [
  { zone: 1, minPct: 0, maxPct: 55 },
  { zone: 2, minPct: 56, maxPct: 75 },
  { zone: 3, minPct: 76, maxPct: 90 },
  { zone: 4, minPct: 91, maxPct: 105 },
  { zone: 5, minPct: 106, maxPct: 120 },
  { zone: 6, minPct: 121, maxPct: 150 },
  { zone: 7, minPct: 151, maxPct: null },
];

export interface PowerZoneWatts {
  zone: number;
  min: number;
  max: number | null;
}

export function powerZoneWatts(ftpWatts: number): PowerZoneWatts[] {
  return POWER_ZONE_PCTS.map((zone) => ({
    zone: zone.zone,
    min: Math.round((ftpWatts * zone.minPct) / 100),
    max: zone.maxPct === null ? null : Math.round((ftpWatts * zone.maxPct) / 100),
  }));
}
