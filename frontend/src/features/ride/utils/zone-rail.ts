export const RAIL_SPAN = 190;

export const RAIL_BANDS: { zone: number; from: number; to: number }[] = [
  { zone: 1, from: 0, to: 55 },
  { zone: 2, from: 55, to: 75 },
  { zone: 3, from: 75, to: 90 },
  { zone: 4, from: 90, to: 105 },
  { zone: 5, from: 105, to: 120 },
  { zone: 6, from: 120, to: 150 },
  { zone: 7, from: 150, to: 190 },
];

export function percentToRail(percentOfFtp: number): number {
  return Math.min(100, Math.max(0, (percentOfFtp / RAIL_SPAN) * 100));
}

export function zoneFrame(zone: number): { left: number; width: number } | null {
  const band = RAIL_BANDS.find((item) => item.zone === zone);
  if (!band) {
    return null;
  }
  return {
    left: percentToRail(band.from),
    width: percentToRail(band.to) - percentToRail(band.from),
  };
}

export function toneFromDelta(delta: number | null): 'under' | 'in' | 'over' | 'idle' {
  if (delta === null) {
    return 'idle';
  }
  if (delta < -1) {
    return 'under';
  }
  if (delta > 1) {
    return 'over';
  }
  return 'in';
}
