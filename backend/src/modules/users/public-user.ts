export interface HrZoneBound {
  zone: number;
  minBpm: number;
  maxBpm: number | null;
}

export interface PublicUser {
  id: string;
  name: string;
  role: 'admin' | 'rider';
  ftpWatts: number | null;
  hrZoneBounds: HrZoneBound[] | null;
}

export function asHrZones(value: unknown): HrZoneBound[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const zones: HrZoneBound[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      return null;
    }
    const zone = (item as { zone?: unknown }).zone;
    const minBpm = (item as { minBpm?: unknown }).minBpm;
    const maxBpm = (item as { maxBpm?: unknown }).maxBpm;
    if (typeof zone !== 'number' || typeof minBpm !== 'number') {
      return null;
    }
    zones.push({
      zone,
      minBpm,
      maxBpm: typeof maxBpm === 'number' ? maxBpm : null,
    });
  }
  return zones;
}
