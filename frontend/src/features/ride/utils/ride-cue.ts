import { toneFromDelta } from './zone-rail';

export interface RideCue {
  verb: 'Push' | 'Ease' | 'Hold';
  amount: number | null;
  unit: 'W' | 'bpm';
}

export interface TargetBand {
  zone: string | null;
  range: string;
}

export function rideCue(delta: number | null, unit: 'W' | 'bpm'): RideCue | null {
  const tone = toneFromDelta(delta);
  if (tone === 'idle' || delta === null) {
    return null;
  }
  if (tone === 'in') {
    return { verb: 'Hold', amount: null, unit };
  }
  return { verb: tone === 'under' ? 'Push' : 'Ease', amount: Math.abs(Math.round(delta)), unit };
}

export function targetBand(input: {
  targetKind: 'power' | 'heart_rate' | 'watts' | null;
  targetZone: number | null;
  targetWatts: number | null;
  zoneLow: number | null;
  zoneHigh: number | null;
}): TargetBand | null {
  if (input.targetKind === 'watts') {
    return input.targetWatts === null ? null : { zone: null, range: `${Math.round(input.targetWatts)} W` };
  }
  if (input.targetKind !== 'power' && input.targetKind !== 'heart_rate') {
    return null;
  }
  const zone = input.targetZone === null ? null : `Z${input.targetZone}`;
  if (input.zoneLow === null) {
    return zone ? { zone, range: '' } : null;
  }
  const low = Math.round(input.zoneLow);
  const unit = input.targetKind === 'heart_rate' ? 'bpm' : 'W';
  const range = input.zoneHigh === null ? `${low}+ ${unit}` : `${low}–${Math.round(input.zoneHigh)} ${unit}`;
  return { zone, range };
}
