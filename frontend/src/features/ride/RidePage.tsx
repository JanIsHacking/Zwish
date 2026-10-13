import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { Bike, RiderSetup, Trainer } from '../../shared/api/types';
import { formatDuration } from '../../shared/utils/format';
import { Drivetrain } from './components/Drivetrain';
import { LiveStats } from './components/LiveStats';
import { PowerTrace } from './components/PowerTrace';
import { ResistanceLadder } from './components/ResistanceLadder';
import { StopConfirm } from './components/StopConfirm';
import { ZoneGuide } from './components/ZoneGuide';
import { ZoneRail } from './components/ZoneRail';
import { useLiveRide } from './hooks/use-live-ride';
import { usePowerTrace } from './hooks/use-power-trace';
import { chainringsLeftToRight, cogsLeftToRight, nextInOrder, nextResistanceId, type ShiftDirection } from './utils/gear-layout';

export function RidePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { snapshot, connected } = useLiveRide(id);
  const trace = usePowerTrace(snapshot);
  const [isConfirmingStop, setIsConfirmingStop] = useState(false);
  const workout = useQuery({
    queryKey: ['workout-label', id],
    queryFn: () => api<{ kind: string; planSession: { name: string } | null }>(`/api/v1/workouts/${id}`),
    staleTime: Infinity,
  });
  const setup = useQuery({ queryKey: ['setup'], queryFn: () => api<RiderSetup>('/api/v1/setup') });
  const bikes = useQuery({ queryKey: ['bikes'], queryFn: () => api<Bike[]>('/api/v1/bikes') });
  const trainers = useQuery({ queryKey: ['trainers'], queryFn: () => api<Trainer[]>('/api/v1/trainers') });
  const stop = useMutation({
    mutationFn: () => api(`/api/v1/workouts/${id}/stop`, { method: 'POST' }),
    onSuccess: () => navigate(`/workouts/${id}`),
  });
  const saveSetup = useMutation({
    mutationFn: (body: Partial<RiderSetup>) => api('/api/v1/setup', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setup'] }),
  });

  const stopping = useRef(false);
  useEffect(() => {
    if (snapshot?.finished && !stopping.current) {
      stopping.current = true;
      stop.mutate();
    }
  }, [snapshot?.finished, stop]);

  const bike = bikes.data?.find((item) => item.id === setup.data?.bikeId);
  const trainer = trainers.data?.find((item) => item.id === setup.data?.trainerId);
  const chainring = snapshot?.chainringTeeth ?? setup.data?.chainringTeeth ?? null;
  const cog = snapshot?.cogTeeth ?? setup.data?.cogTeeth ?? null;
  const resistanceId = snapshot?.resistanceLevelId ?? setup.data?.resistanceLevelId ?? null;
  const levels = trainer?.resistanceLevels ?? [];
  const levelLabel =
    snapshot?.resistanceLabel ?? levels.find((level) => level.id === resistanceId)?.label ?? null;
  const sessionName =
    snapshot?.sessionName ??
    (workout.data?.kind === 'zone_test' ? 'Zone test' : (workout.data?.planSession?.name ?? 'Free ride'));

  const shiftChainring = (direction: ShiftDirection) => {
    const next = nextInOrder(chainringsLeftToRight(bike?.chainringTeeth ?? []), chainring, direction);
    if (next !== null) {
      saveSetup.mutate({ chainringTeeth: next });
    }
  };
  const shiftCog = (direction: ShiftDirection) => {
    const next = nextInOrder(cogsLeftToRight(bike?.cogTeeth ?? []), cog, direction);
    if (next !== null) {
      saveSetup.mutate({ cogTeeth: next });
    }
  };
  const shiftResistance = (direction: ShiftDirection) => {
    const next = nextResistanceId(levels, resistanceId, direction);
    if (next !== null) {
      saveSetup.mutate({ resistanceLevelId: next });
    }
  };

  return (
    <div className="flex h-full min-h-full bg-ink">
      <div className="flex min-w-0 flex-1 flex-col gap-5 px-8 py-6">
        <header>
          <p className="text-sm uppercase tracking-[0.2em] text-muted">
            {sessionName}
            {snapshot?.segmentCount ? ` · ${(snapshot.segmentIndex ?? 0) + 1}/${snapshot.segmentCount}` : ''}
            {!connected ? ' · live link down' : ''}
          </p>
          <div className="mt-1 flex items-start gap-10">
            <p className="num shrink-0 text-5xl leading-none">
              {formatDuration(snapshot?.remainingSeconds ?? snapshot?.elapsedSeconds ?? 0)}
            </p>
            <div className="flex min-w-0 flex-1 justify-center">
              <LiveStats snapshot={snapshot} />
            </div>
          </div>
          {snapshot?.segmentNotes ? <p className="mt-2 text-lg text-paper">{snapshot.segmentNotes}</p> : null}
        </header>
        <ZoneGuide snapshot={snapshot} />
        <PowerTrace samples={trace} snapshot={snapshot} />
        {snapshot ? <ZoneRail snapshot={snapshot} /> : <div className="h-14 rounded-2xl bg-panel" />}
      </div>
      <aside className="flex w-max shrink-0 flex-col justify-between gap-6 border-l border-line px-4 py-6">
        <div className="flex flex-col gap-6">
          <Drivetrain
            chainringTeeth={bike?.chainringTeeth ?? []}
            cogTeeth={bike?.cogTeeth ?? []}
            activeChainring={chainring}
            activeCog={cog}
            onShiftChainring={shiftChainring}
            onShiftCog={shiftCog}
          />
          <ResistanceLadder levels={levels} activeId={resistanceId} activeLabel={levelLabel} onShift={shiftResistance} />
        </div>
        {saveSetup.error ? <p className="text-sm text-over">{saveSetup.error.message}</p> : null}
        {stop.error ? <p className="text-sm text-over">{stop.error.message}</p> : null}
        {isConfirmingStop ? (
          <StopConfirm
            isPending={stop.isPending}
            isZoneTest={snapshot?.kind === 'zone_test' || workout.data?.kind === 'zone_test'}
            onKeep={() => setIsConfirmingStop(false)}
            onStop={() => stop.mutate()}
          />
        ) : (
          <button
            className="rounded-full bg-over px-6 py-3 text-lg text-ink"
            onClick={() => setIsConfirmingStop(true)}
            type="button"
          >
            Stop
          </button>
        )}
      </aside>
    </div>
  );
}
