import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { ErrorText } from '../../shared/ui/controls';
import { formatDistance, formatWatts } from '../../shared/utils/format';

interface WorkoutDetail {
  id: string;
  kind: string;
  zoneTestProtocol: 'ramp' | 'twenty_minute' | null;
  startedAt: string;
  endedAt: string | null;
  distanceM: number;
  avgPowerW: number | null;
  avgCadenceRpm: number | null;
  avgHrBpm: number | null;
  estimatedFtp: number | null;
  samples: { powerW: number | null; recordedAt: string }[];
  planSession: { name: string } | null;
}

export function WorkoutPage() {
  const { id = '' } = useParams();
  const workout = useQuery({
    queryKey: ['workout', id],
    queryFn: () => api<WorkoutDetail>(`/api/v1/workouts/${id}`),
  });
  const data = workout.data;
  if (workout.isError) {
    return (
      <p className="p-10">
        <ErrorText>{workout.error.message}</ErrorText>
      </p>
    );
  }
  if (!data) {
    return <p className="p-10 text-muted">Loading…</p>;
  }
  const powers = data.samples.map((sample) => sample.powerW ?? 0);
  const max = Math.max(1, ...powers);
  const points = powers
    .map((power, index) => {
      const x = powers.length === 1 ? 0 : (index / (powers.length - 1)) * 300;
      return `${x},${100 - (power / max) * 90}`;
    })
    .join(' ');

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-10">
      <Link className="text-sm text-signal" to="/">
        Back
      </Link>
      <h1 className="text-3xl">{workoutTitle(data)}</h1>
      <p className="text-muted">{format(new Date(data.startedAt), 'd MMM yyyy HH:mm')}</p>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Avg power" value={formatWatts(data.avgPowerW)} />
        <Stat label="Avg cadence" value={data.avgCadenceRpm ? String(Math.round(data.avgCadenceRpm)) : '—'} />
        <Stat label="Avg HR" value={data.avgHrBpm ? String(Math.round(data.avgHrBpm)) : '—'} />
        <Stat label="Distance" value={formatDistance(data.distanceM)} />
      </dl>
      {data.estimatedFtp ? <p className="text-xl">Estimated FTP {Math.round(data.estimatedFtp)} W</p> : null}
      {data.kind === 'zone_test' && data.estimatedFtp === null ? (
        <p className="text-xl">No FTP was saved.</p>
      ) : null}
      {powers.length > 1 ? (
        <svg viewBox="0 0 300 100" className="h-32 w-full rounded-2xl border border-line bg-panel">
          <polyline fill="none" stroke="var(--color-signal)" strokeWidth="1.5" points={points} />
        </svg>
      ) : (
        <p className="text-sm text-muted">This ride has no power trace yet.</p>
      )}
    </div>
  );
}

function workoutTitle(data: WorkoutDetail): string {
  if (data.planSession?.name) {
    return data.planSession.name;
  }
  if (data.zoneTestProtocol === 'ramp') {
    return 'Ramp test';
  }
  if (data.zoneTestProtocol === 'twenty_minute') {
    return '20-minute test';
  }
  return data.kind === 'zone_test' ? 'Zone test' : data.kind;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line p-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="num text-3xl">{value}</dd>
    </div>
  );
}
