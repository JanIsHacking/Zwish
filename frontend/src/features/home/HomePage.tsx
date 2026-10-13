import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { Bike, RiderSetup, Trainer, WorkoutSummary } from '../../shared/api/types';
import { Button, ErrorText, Hint } from '../../shared/ui/controls';
import { formatDistance, formatDuration } from '../../shared/utils/format';
import { missingSetupMessage } from '../../shared/utils/setup';

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bikes = useQuery({ queryKey: ['bikes'], queryFn: () => api<Bike[]>('/api/v1/bikes') });
  const trainers = useQuery({ queryKey: ['trainers'], queryFn: () => api<Trainer[]>('/api/v1/trainers') });
  const setup = useQuery({ queryKey: ['setup'], queryFn: () => api<RiderSetup>('/api/v1/setup') });
  const workouts = useQuery({
    queryKey: ['workouts'],
    queryFn: () => api<WorkoutSummary[]>('/api/v1/workouts'),
  });
  const saveSetup = useMutation({
    mutationFn: (body: Partial<RiderSetup>) =>
      api<RiderSetup>('/api/v1/setup', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (next) => queryClient.setQueryData(['setup'], next),
  });
  const start = useMutation({
    mutationFn: () => {
      const current = setup.data;
      if (!current?.bikeId || !current.trainerId) {
        throw new Error('Choose a bike and a trainer');
      }
      return api<{ id: string }>('/api/v1/workouts', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'free',
          bikeId: current.bikeId,
          trainerId: current.trainerId,
          resistanceLevelId: current.resistanceLevelId ?? undefined,
          chainringTeeth: current.chainringTeeth ?? undefined,
          cogTeeth: current.cogTeeth ?? undefined,
        }),
      });
    },
    onSuccess: (workout) => navigate(`/ride/${workout.id}`),
  });

  const bike = bikes.data?.find((item) => item.id === setup.data?.bikeId);
  const trainer = trainers.data?.find((item) => item.id === setup.data?.trainerId);
  const setupHint =
    setup.isSuccess && bikes.isSuccess && trainers.isSuccess
      ? missingSetupMessage({
          ...setup.data,
          bikeId: bike ? setup.data.bikeId : null,
          trainerId: trainer ? setup.data.trainerId : null,
        })
      : null;
  const loadError = bikes.error ?? trainers.error ?? setup.error ?? workouts.error;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-8 py-10">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl">Ready to ride</h1>
          <p className="text-muted">Free ride records speed, cadence, and power on the selected trainer.</p>
        </div>
        <Button disabled={!bike || !trainer || start.isPending} onClick={() => start.mutate()}>
          {start.isPending ? 'Starting…' : 'Start free ride'}
        </Button>
      </header>
      {loadError ? <ErrorText>{loadError.message}</ErrorText> : null}
      {setupHint ? <Hint>{setupHint}</Hint> : null}
      {saveSetup.error ? <ErrorText>{saveSetup.error.message}</ErrorText> : null}
      {start.error ? <ErrorText>{start.error.message}</ErrorText> : null}
      <section className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 rounded-2xl border border-line bg-panel p-4">
          <span className="text-sm text-muted">Bike</span>
          <select
            className="w-full bg-transparent text-lg"
            value={setup.data?.bikeId ?? ''}
            onChange={(event) => {
              const next = bikes.data?.find((item) => item.id === event.target.value);
              saveSetup.mutate({
                bikeId: next?.id,
                chainringTeeth: next?.chainringTeeth[0],
                cogTeeth: next?.cogTeeth[0],
              });
            }}
          >
            <option value="">Choose a bike</option>
            {bikes.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Link className="text-sm text-signal" to="/bikes/new">
            Add a bike
          </Link>
        </label>
        <label className="space-y-2 rounded-2xl border border-line bg-panel p-4">
          <span className="text-sm text-muted">Trainer</span>
          <select
            className="w-full bg-transparent text-lg"
            value={setup.data?.trainerId ?? ''}
            onChange={(event) => {
              const next = trainers.data?.find((item) => item.id === event.target.value);
              saveSetup.mutate({
                trainerId: next?.id,
                resistanceLevelId: next?.resistanceLevels[0]?.id,
              });
            }}
          >
            <option value="">Choose a trainer</option>
            {trainers.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Link className="text-sm text-signal" to="/trainers/new">
            Add a trainer
          </Link>
        </label>
      </section>
      <section>
        <h2 className="mb-3 text-lg">Recent rides</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {workouts.data?.length ? (
            workouts.data.map((workout) => (
              <li key={workout.id}>
                <Link className="flex items-center justify-between px-4 py-3 hover:bg-panel" to={`/workouts/${workout.id}`}>
                  <span>
                    {workout.planSession?.name ?? workout.kind} · {workout.trainer?.name}
                  </span>
                  <span className="text-sm text-muted">
                    {formatDuration((workout.endedAt ? Date.parse(workout.endedAt) - Date.parse(workout.startedAt) : 0) / 1000)}
                    {' · '}
                    {formatDistance(workout.distanceM)}
                  </span>
                </Link>
              </li>
            ))
          ) : (
            <li className="px-4 py-6 text-muted">No rides yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
