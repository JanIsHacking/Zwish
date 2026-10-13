import type { ReactNode } from 'react';
import type { LiveSnapshot } from '../../../shared/api/types';
import { formatDistance, formatSpeed } from '../../../shared/utils/format';
import { CadenceIcon, DistanceIcon, HeartIcon, SpeedIcon } from './icons';

export function LiveStats({ snapshot }: { snapshot: LiveSnapshot | null }) {
  const avgSpeed =
    snapshot && snapshot.elapsedSeconds > 0 ? formatSpeed(snapshot.distanceM / snapshot.elapsedSeconds) : null;

  return (
    <section className="flex items-start gap-8">
      <Stat
        label="Cadence"
        icon={<CadenceIcon />}
        value={formatRound(snapshot?.cadenceRpm)}
        average={formatRound(snapshot?.avgCadenceRpm)}
      />
      <Stat
        label="Heart rate"
        icon={<HeartIcon />}
        value={formatRound(snapshot?.hrBpm)}
        average={formatRound(snapshot?.avgHrBpm)}
      />
      <Stat
        label="Speed"
        icon={<SpeedIcon />}
        value={snapshot ? formatSpeed(snapshot.speedMps) : '—'}
        unit="km/h"
        average={avgSpeed === null ? '—' : avgSpeed}
        averageUnit="km/h"
      />
      <Stat label="Distance" icon={<DistanceIcon />} value={snapshot ? formatDistance(snapshot.distanceM) : '—'} />
    </section>
  );
}

function Stat({
  label,
  icon,
  value,
  unit,
  average,
  averageUnit,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  unit?: string;
  average?: string;
  averageUnit?: string;
}) {
  return (
    <div aria-label={label}>
      <div className="flex items-center gap-2">
        <span className="text-muted">{icon}</span>
        <p className="num text-4xl leading-none">
          {value}
          {unit ? <span className="ml-1 text-lg text-muted">{unit}</span> : null}
        </p>
      </div>
      {average !== undefined ? (
        <p className="num mt-1 pl-9 text-lg leading-none text-muted">
          <span className="sr-only">average </span>
          <span aria-hidden="true">Ø </span>
          {average}
          {averageUnit ? ` ${averageUnit}` : ''}
        </p>
      ) : (
        <p className="mt-1 h-[1.125rem]" />
      )}
    </div>
  );
}

function formatRound(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return String(Math.round(value));
}
