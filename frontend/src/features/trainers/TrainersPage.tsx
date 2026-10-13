import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { Trainer } from '../../shared/api/types';
import { ErrorText, Hint } from '../../shared/ui/controls';
import { DeleteAction } from '../../shared/ui/delete-action';
import { recordedRides } from '../../shared/utils/format';
import { keptForHistory } from '../../shared/utils/setup';

export function TrainersPage() {
  const queryClient = useQueryClient();
  const trainers = useQuery({
    queryKey: ['trainers'],
    queryFn: () => api<Trainer[]>('/api/v1/trainers'),
    refetchInterval: 2000,
  });
  const [failedId, setFailedId] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/v1/trainers/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setFailedId(null);
      await queryClient.invalidateQueries({ queryKey: ['trainers'] });
    },
    onError: (_error, id) => setFailedId(id),
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Trainers</h1>
        <Link className="rounded-full bg-signal px-4 py-2 text-sm text-ink" to="/trainers/new">
          New trainer
        </Link>
      </div>
      {trainers.isError ? <ErrorText>{trainers.error.message}</ErrorText> : null}
      {trainers.isPending ? <Hint>Loading trainers…</Hint> : null}
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {trainers.data?.map((trainer) => {
          const blocked = trainer.rideCount > 0 ? keptForHistory('trainer', recordedRides(trainer.rideCount)) : null;
          return (
            <li key={trainer.id}>
              <div className="flex items-center gap-2 pr-2">
                <Link className="min-w-0 flex-1 px-4 py-4 hover:bg-panel" to={`/trainers/${trainer.id}`}>
                  <p className="flex items-center gap-3 text-lg">
                    {trainer.name}
                    <DeviceStatus trainer={trainer} />
                  </p>
                  <p className="text-sm text-muted">
                    {trainer.resistanceLevels.length} levels
                    {trainer.deviceId ? ` · ${trainer.deviceId}` : ' · no device'}
                    {trainer.rideCount > 0 ? ` · ${recordedRides(trainer.rideCount)}` : ''}
                  </p>
                </Link>
                <DeleteAction
                  variant="icon"
                  name={trainer.name}
                  blockedReason={blocked}
                  isPending={remove.isPending && remove.variables === trainer.id}
                  onDelete={() => remove.mutate(trainer.id)}
                />
              </div>
              {failedId === trainer.id && remove.error ? (
                <div className="px-4 pb-3">
                  <ErrorText>{remove.error.message}</ErrorText>
                </div>
              ) : null}
            </li>
          );
        })}
        {trainers.data?.length === 0 ? (
          <li className="px-4 py-6 text-muted">Add the trainer the bike is mounted on.</li>
        ) : null}
      </ul>
    </div>
  );
}

function DeviceStatus({ trainer }: { trainer: Trainer }) {
  if (!trainer.deviceId) {
    return <span className="text-sm text-muted">No device</span>;
  }
  return (
    <span className={`text-sm ${trainer.online ? 'text-ok' : 'text-muted'}`}>
      {trainer.online ? 'Online' : 'Offline'}
    </span>
  );
}
