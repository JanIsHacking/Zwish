import { useEffect, useState } from 'react';
import type { LiveSnapshot } from '../../../shared/api/types';
import { appendPowerSample, type PowerSample } from '../utils/power-trace';

export function usePowerTrace(snapshot: LiveSnapshot | null): PowerSample[] {
  const [samples, setSamples] = useState<PowerSample[]>([]);
  const workoutId = snapshot?.workoutId;

  useEffect(() => {
    setSamples([]);
  }, [workoutId]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const atMs = Date.now();
    const next = snapshot.powerW === null ? null : { atMs, powerW: snapshot.powerW };
    setSamples((current) => appendPowerSample(current, next, atMs));
  }, [snapshot]);

  return samples;
}
