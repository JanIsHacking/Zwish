import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import type { DeviceTrace, DeviceTraceSample } from '../../../shared/api/types';
import { ErrorText } from '../../../shared/ui/controls';

export function SensorTrace({ trainerId }: { trainerId: string }) {
  const trace = useQuery({
    queryKey: ['trainer-trace', trainerId],
    queryFn: () => api<DeviceTrace>(`/api/v1/trainers/${trainerId}/trace`),
    refetchInterval: 500,
  });
  const samples = [...(trace.data?.samples ?? [])].reverse();
  const newest = samples[0];
  const ageMs = newest ? Date.now() - newest.atMs : null;
  const isStale = ageMs !== null && ageMs > 3000;

  return (
    <section className="space-y-3 rounded-2xl border border-line p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg">Sensor</h2>
        <p className={`text-sm ${isStale ? 'text-over' : 'text-muted'}`}>
          {trace.data?.online ? 'Device online' : 'Device offline'}
          {ageMs === null ? '' : ` · last sample ${formatAge(ageMs)}`}
        </p>
      </div>
      <p className="text-sm text-muted">
        Each line is one message from the ESP: sequence, wheel revolutions, the gap it measured, and the rpm the
        server derived.
      </p>
      {trace.isError ? <ErrorText>{trace.error.message}</ErrorText> : null}
      {samples.length === 0 ? (
        <p className="text-sm text-muted">Nothing received yet.</p>
      ) : (
        <ol className="num max-h-64 space-y-1 overflow-auto text-sm">
          {samples.map((sample, index) => (
            <li key={`${sample.atMs}-${sample.seq}-${index}`}>{formatSample(sample)}</li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatSample(sample: DeviceTraceSample): string {
  const rpm = sample.wheelRpm === null ? '—' : `${Math.round(sample.wheelRpm)} rpm`;
  const gap = `${Math.round(sample.dtUs / 1000)} ms`;
  return `seq ${sample.seq} · rev ${sample.revCount} · dt ${gap} · ${rpm} · mono ${sample.monoUs}`;
}

function formatAge(ageMs: number): string {
  if (ageMs < 1000) {
    return `${Math.max(0, ageMs)} ms ago`;
  }
  return `${(ageMs / 1000).toFixed(1)} s ago`;
}
