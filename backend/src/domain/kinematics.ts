export interface PowerKnot {
  wheelRpm: number;
  watts: number;
}

export function wheelRpmFromDelta(deltaRevs: number, dtUs: number): number {
  if (deltaRevs <= 0 || dtUs <= 0) {
    return 0;
  }
  return (deltaRevs / (dtUs / 1_000_000)) * 60;
}

export function cadenceRpm(wheelRpm: number, cogTeeth: number, chainringTeeth: number): number {
  if (chainringTeeth <= 0 || cogTeeth <= 0) {
    return 0;
  }
  return wheelRpm * (cogTeeth / chainringTeeth);
}

export function speedMps(wheelRpm: number, circumferenceMm: number): number {
  if (circumferenceMm <= 0) {
    return 0;
  }
  return (wheelRpm / 60) * (circumferenceMm / 1000);
}

export function distanceDeltaM(deltaRevs: number, circumferenceMm: number): number {
  if (deltaRevs <= 0 || circumferenceMm <= 0) {
    return 0;
  }
  return deltaRevs * (circumferenceMm / 1000);
}

export function interpolatePower(knots: PowerKnot[], wheelRpm: number): number | null {
  if (knots.length === 0 || wheelRpm < 0) {
    return null;
  }
  const sorted = [...knots].sort((a, b) => a.wheelRpm - b.wheelRpm);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) {
    return null;
  }
  if (wheelRpm <= first.wheelRpm) {
    return first.watts;
  }
  if (wheelRpm >= last.wheelRpm) {
    return last.watts;
  }
  for (let i = 1; i < sorted.length; i += 1) {
    const right = sorted[i];
    const left = sorted[i - 1];
    if (!right || !left) {
      continue;
    }
    if (wheelRpm <= right.wheelRpm) {
      const span = right.wheelRpm - left.wheelRpm;
      if (span <= 0) {
        return right.watts;
      }
      const t = (wheelRpm - left.wheelRpm) / span;
      return left.watts + t * (right.watts - left.watts);
    }
  }
  return last.watts;
}

export function scaledPower(knots: PowerKnot[], wheelRpm: number, powerScale: number): number | null {
  const raw = interpolatePower(knots, wheelRpm);
  if (raw === null) {
    return null;
  }
  return raw * powerScale;
}
