import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { Trainer } from '../../shared/api/types';
import { Button, ErrorText, Field, Hint, TextInput } from '../../shared/ui/controls';
import { DeleteAction } from '../../shared/ui/delete-action';
import { recordedRides } from '../../shared/utils/format';
import { keptForHistory } from '../../shared/utils/setup';
import { CoastDownSection } from './components/CoastDownSection';
import { SensorTrace } from './components/SensorTrace';

export function TrainerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const trainer = useQuery({
    queryKey: ['trainer', id],
    queryFn: () => api<Trainer>(`/api/v1/trainers/${id}`),
    refetchInterval: 2000,
  });
  const [scale, setScale] = useState<string | null>(null);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const updateScale = useMutation({
    mutationFn: (powerScale: number) =>
      api(`/api/v1/trainers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ powerScale }),
      }),
    onSuccess: async () => {
      setScale(null);
      await queryClient.invalidateQueries({ queryKey: ['trainer', id] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/api/v1/trainers/${id}`, { method: 'DELETE' }),
    onSuccess: () => navigate('/trainers'),
  });

  const data = trainer.data;
  const scaleValue = scale ?? (data ? String(data.powerScale) : '');
  const saveScale = () => {
    const powerScale = Number(scaleValue);
    if (!Number.isFinite(powerScale) || powerScale < 0.01 || powerScale > 100) {
      setScaleError('Power scale must be a number from 0.01 to 100.');
      return;
    }
    setScaleError(null);
    updateScale.mutate(powerScale);
  };
  if (trainer.isError) {
    return (
      <p className="p-10">
        <ErrorText>{trainer.error.message}</ErrorText>
      </p>
    );
  }
  if (!data) {
    return <p className="p-10 text-muted">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-8 py-10">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl">{data.name}</h1>
          <p className="text-sm text-muted">
            Device {data.deviceId ?? 'not linked'} · {data.deviceId ? (data.online ? 'online' : 'offline') : 'no device'} ·
            scale {data.powerScale}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <DeleteAction
            variant="button"
            name={data.name}
            blockedReason={data.rideCount > 0 ? keptForHistory('trainer', recordedRides(data.rideCount)) : null}
            isPending={remove.isPending}
            detail="This cannot be undone."
            onDelete={() => remove.mutate()}
          />
          {data.rideCount > 0 ? <Hint>{keptForHistory('trainer', recordedRides(data.rideCount))}</Hint> : null}
          {remove.error ? <ErrorText>{remove.error.message}</ErrorText> : null}
        </div>
      </header>
      <CoastDownSection trainer={data} />
      <SensorTrace trainerId={id} />
      <section className="flex items-end gap-3">
        <Field label="Power scale">
          <TextInput value={scaleValue} onChange={(event) => setScale(event.target.value)} />
          <Hint>1 leaves power unchanged. 1.05 raises every watt by 5%.</Hint>
        </Field>
        <Button onClick={saveScale} disabled={updateScale.isPending}>
          {updateScale.isPending ? 'Saving…' : 'Save scale'}
        </Button>
      </section>
      {scaleError ? <ErrorText>{scaleError}</ErrorText> : null}
      {updateScale.error ? <ErrorText>{updateScale.error.message}</ErrorText> : null}
      {updateScale.isSuccess ? <Hint>Power scale saved. New rides use this factor.</Hint> : null}
    </div>
  );
}
