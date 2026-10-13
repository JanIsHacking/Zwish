export interface PlanSegmentClock {
  durationSeconds: number;
  targetKind: 'power' | 'heart_rate';
  zone: number;
  notes: string | null;
}

export interface ActiveSegment {
  index: number;
  count: number;
  notes: string | null;
  remainingSeconds: number;
  targetKind: 'power' | 'heart_rate';
  zone: number;
  finished: boolean;
}

export function segmentAt(segments: PlanSegmentClock[], elapsedSeconds: number): ActiveSegment | null {
  if (segments.length === 0) {
    return null;
  }
  let cursor = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment) {
      continue;
    }
    const end = cursor + segment.durationSeconds;
    if (elapsedSeconds < end) {
      return {
        index,
        count: segments.length,
        notes: segment.notes,
        remainingSeconds: Math.max(0, Math.ceil(end - elapsedSeconds)),
        targetKind: segment.targetKind,
        zone: segment.zone,
        finished: false,
      };
    }
    cursor = end;
  }
  const last = segments[segments.length - 1];
  return {
    index: segments.length - 1,
    count: segments.length,
    notes: last?.notes ?? null,
    remainingSeconds: 0,
    targetKind: last?.targetKind ?? 'power',
    zone: last?.zone ?? 2,
    finished: true,
  };
}
