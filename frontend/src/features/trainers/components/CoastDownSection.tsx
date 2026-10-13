import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../shared/api/client';
import type { Bike, CalibrationView, CoastFitKind, Trainer } from '../../../shared/api/types';
import { Button, ErrorText, Field, GhostButton, TextInput } from '../../../shared/ui/controls';
import { useCoastCountdown } from '../hooks/use-coast-countdown';
import { ActiveCurves } from './ActiveCurves';
import { CoastReview } from './CoastReview';
import { RpmChart } from './RpmChart';

export function CoastDownSection({ trainer }: { trainer: Trainer }) {
  const queryClient = useQueryClient();
  const bikes = useQuery({ queryKey: ['bikes'], queryFn: () => api<Bike[]>('/api/v1/bikes') });
  const run = useQuery({
    queryKey: ['trainer-calibration', trainer.id],
    queryFn: () => api<CalibrationView | null>(`/api/v1/calibrations/active/${trainer.id}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'recording' || status === 'coasting' ? 400 : false;
    },
  });
  const [bikeId, setBikeId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [pressure, setPressure] = useState('6.0');
  const [inertia, setInertia] = useState('');
  const capturedRun = useRef<string | null>(null);
  const current = run.data;
  const locked = current?.status === 'recording' || current?.status === 'coasting' || current?.status === 'review';
  const selectedBikeId = (locked ? current.bikeId : bikeId) || bikes.data?.[0]?.id || '';
  const selectedLevelId = (locked ? current.resistanceLevelId : levelId) || trainer.resistanceLevels[0]?.id || '';
  const pairing = trainer.pairings.find((item) => item.bikeId === selectedBikeId);
  const savedInertia = pairing?.inertiaKgM2 ?? null;

  useEffect(() => {
    setInertia(savedInertia === null ? '' : String(savedInertia));
  }, [savedInertia, selectedBikeId]);

  const remember = (next: CalibrationView | null) => {
    queryClient.setQueryData(['trainer-calibration', trainer.id], next);
  };
  const start = useMutation({
    mutationFn: () =>
      api<CalibrationView>('/api/v1/calibrations', {
        method: 'POST',
        body: JSON.stringify({
          trainerId: trainer.id,
          bikeId: selectedBikeId,
          resistanceLevelId: selectedLevelId,
          tirePressureBar: Number(pressure),
        }),
      }),
    onSuccess: remember,
  });
  const beginCoast = useMutation({
    mutationFn: () => api<CalibrationView>(`/api/v1/calibrations/${current?.id}/coast`, { method: 'POST' }),
    onSuccess: remember,
  });
  const capture = useMutation({
    mutationFn: () => api<CalibrationView>(`/api/v1/calibrations/${current?.id}/capture`, { method: 'POST' }),
    onSuccess: remember,
  });
  const selectFit = useMutation({
    mutationFn: (kind: CoastFitKind) =>
      api<CalibrationView>(`/api/v1/calibrations/${current?.id}/fit`, {
        method: 'POST',
        body: JSON.stringify({ kind }),
      }),
    onSuccess: remember,
  });
  const confirm = useMutation({
    mutationFn: () => api<CalibrationView>(`/api/v1/calibrations/${current?.id}/confirm`, { method: 'POST' }),
    onSuccess: async () => {
      remember(null);
      await queryClient.invalidateQueries({ queryKey: ['trainer', trainer.id] });
    },
  });
  const cancel = useMutation({
    mutationFn: () => api(`/api/v1/calibrations/${current?.id}/cancel`, { method: 'POST' }),
    onSuccess: () => remember(null),
  });
  const saveInertia = useMutation({
    mutationFn: () =>
      api(`/api/v1/trainers/${trainer.id}/inertia`, {
        method: 'PUT',
        body: JSON.stringify({ bikeId: selectedBikeId, inertiaKgM2: Number(inertia) }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainer', trainer.id] }),
  });
  const countdown = useCoastCountdown(current?.status, current?.heldSeconds ?? 0, current?.holdSeconds ?? 5, () => {
    if (!beginCoast.isPending) {
      beginCoast.mutate();
    }
  });

  useEffect(() => {
    if (!current || current.status !== 'coasting' || !current.wheelStopped) {
      capturedRun.current = null;
      return;
    }
    if (capturedRun.current === current.id || capture.isPending) {
      return;
    }
    capturedRun.current = current.id;
    capture.mutate();
  }, [capture, current]);

  const curves = trainer.curves.filter((curve) => curve.bikeId === selectedBikeId);
  const live = current?.status === 'recording' || current?.status === 'coasting';

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-2xl border border-line p-5">
        <h2 className="text-lg">Coast-down</h2>
        <p className="text-sm text-muted">
          Power is measured for this trainer and bike together. Spin up to the target speed, hold it, then stop
          pedaling when the countdown reaches 0.
        </p>
        {bikes.data?.length === 0 ? (
          <p className="text-sm">
            Add the bike that is on the trainer first. <Link className="text-signal" to="/bikes/new">New bike</Link>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bike">
              <select
                className="w-full rounded-xl border border-line bg-ink px-3 py-2"
                value={selectedBikeId}
                disabled={locked}
                onChange={(event) => setBikeId(event.target.value)}
              >
                {bikes.data?.map((bike) => (
                  <option key={bike.id} value={bike.id}>
                    {bike.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="space-y-2">
              <Field label="Moment of inertia (kg·m²)">
                <TextInput
                  value={inertia}
                  inputMode="decimal"
                  placeholder="0.10"
                  onChange={(event) => setInertia(event.target.value)}
                />
              </Field>
              <Button type="button" disabled={!selectedBikeId || saveInertia.isPending} onClick={() => saveInertia.mutate()}>
                Save inertia
              </Button>
            </div>
          </div>
        )}
        {saveInertia.error ? <ErrorText>{saveInertia.error.message}</ErrorText> : null}
        <p className="text-sm text-muted">
          Set the inertia once for this wheel on this trainer. It turns the coast-down deceleration into watts.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Resistance">
            <select
              className="w-full rounded-xl border border-line bg-ink px-3 py-2"
              value={selectedLevelId}
              disabled={locked}
              onChange={(event) => setLevelId(event.target.value)}
            >
              {trainer.resistanceLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rear tire pressure (bar)">
            <TextInput value={pressure} disabled={locked} onChange={(event) => setPressure(event.target.value)} />
          </Field>
        </div>
        {live && current ? (
          <LiveCoast
            run={current}
            countdown={countdown}
            error={beginCoast.error?.message ?? capture.error?.message ?? null}
            onCapture={() => capture.mutate()}
            onCancel={() => cancel.mutate()}
          />
        ) : null}
        {current?.status === 'review' ? (
          <CoastReview
            measured={current.measured}
            fitted={current.fitted}
            fitKind={current.fitKind}
            inertiaMissing={savedInertia === null}
            canConfirm={current.fitKind !== null && savedInertia !== null}
            isFitting={selectFit.isPending}
            isConfirming={confirm.isPending}
            error={selectFit.error?.message ?? confirm.error?.message ?? null}
            onSelect={(kind) => selectFit.mutate(kind)}
            onConfirm={() => confirm.mutate()}
            onCancel={() => cancel.mutate()}
          />
        ) : null}
        {!locked ? (
          <Button disabled={!selectedBikeId || !selectedLevelId || start.isPending} onClick={() => start.mutate()}>
            Start
          </Button>
        ) : null}
        {start.error && !locked ? <ErrorText>{start.error.message}</ErrorText> : null}
      </section>
      <ActiveCurves levels={trainer.resistanceLevels} curves={curves} />
    </div>
  );
}

function LiveCoast({
  run,
  countdown,
  error,
  onCapture,
  onCancel,
}: {
  run: CalibrationView;
  countdown: number | null;
  error: string | null;
  onCapture: () => void;
  onCancel: () => void;
}) {
  const above = (run.latestRpm ?? 0) >= run.targetRpm;
  return (
    <div className="space-y-3">
      <p className="text-2xl">
        {run.status === 'coasting'
          ? 'Stop pedaling. Let the wheel stop.'
          : countdown !== null
            ? 'Stop pedaling at 0'
            : `Accelerate to ${run.targetRpm} rpm and hold it.`}
      </p>
      {countdown !== null ? <p className="num text-8xl leading-none">{countdown}</p> : null}
      {run.status === 'recording' && countdown === null ? (
        <p className="text-sm text-muted">
          Held {run.heldSeconds.toFixed(1)} s of {run.holdSeconds} s
        </p>
      ) : null}
      <div className="flex items-stretch gap-4">
        <div className="min-w-0 flex-1">
          <RpmChart
            measured={run.recent}
            xDomain={{ min: -30, max: 0 }}
            guideRpm={run.status === 'recording' ? run.targetRpm : undefined}
          />
        </div>
        <div className="flex w-28 flex-col items-center justify-center">
          <p className={`num text-6xl leading-none ${above && run.status === 'recording' ? 'text-inzone' : ''}`}>
            {run.latestRpm === null ? '—' : Math.round(run.latestRpm)}
          </p>
          <p className="text-sm text-muted">rpm</p>
        </div>
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <div className="flex gap-3">
        {run.status === 'coasting' ? <GhostButton onClick={onCapture}>Wheel has stopped</GhostButton> : null}
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
      </div>
    </div>
  );
}
