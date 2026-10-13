import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { Bike } from '../../shared/api/types';
import { ErrorText, Hint } from '../../shared/ui/controls';
import { DeleteAction } from '../../shared/ui/delete-action';
import { recordedRides } from '../../shared/utils/format';
import { keptForHistory } from '../../shared/utils/setup';

export function BikesPage() {
  const queryClient = useQueryClient();
  const bikes = useQuery({ queryKey: ['bikes'], queryFn: () => api<Bike[]>('/api/v1/bikes') });
  const [failedId, setFailedId] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/v1/bikes/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setFailedId(null);
      await queryClient.invalidateQueries({ queryKey: ['bikes'] });
    },
    onError: (_error, id) => setFailedId(id),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Bikes</h1>
        <Link className="rounded-full bg-signal px-4 py-2 text-sm text-ink" to="/bikes/new">
          New bike
        </Link>
      </div>
      {bikes.isError ? <ErrorText>{bikes.error.message}</ErrorText> : null}
      {bikes.isPending ? <Hint>Loading bikes…</Hint> : null}
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {bikes.data?.map((bike) => {
          const blocked = bike.rideCount > 0 ? keptForHistory('bike', recordedRides(bike.rideCount)) : null;
          return (
            <li key={bike.id}>
              <div className="flex items-center gap-2 pr-2">
                <Link className="min-w-0 flex-1 px-4 py-4 hover:bg-panel" to={`/bikes/${bike.id}`}>
                  <p className="text-lg">{bike.name}</p>
                  <p className="text-sm text-muted">
                    {bike.wheelCircumferenceMm} mm · {bike.chainringTeeth.join('/')} × {bike.cogTeeth.join('-')}
                    {bike.rideCount > 0 ? ` · ${recordedRides(bike.rideCount)}` : ''}
                  </p>
                </Link>
                <DeleteAction
                  variant="icon"
                  name={bike.name}
                  blockedReason={blocked}
                  isPending={remove.isPending && remove.variables === bike.id}
                  onDelete={() => remove.mutate(bike.id)}
                />
              </div>
              {failedId === bike.id && remove.error ? (
                <div className="px-4 pb-3">
                  <ErrorText>{remove.error.message}</ErrorText>
                </div>
              ) : null}
            </li>
          );
        })}
        {bikes.data?.length === 0 ? (
          <li className="px-4 py-6 text-muted">Add the bike that is on the trainer.</li>
        ) : null}
      </ul>
    </div>
  );
}
