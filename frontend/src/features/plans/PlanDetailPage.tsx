import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { RiderSetup, TrainingPlan } from '../../shared/api/types';
import { useAuth } from '../../shared/auth/auth-context';
import { Button, ErrorText, Hint } from '../../shared/ui/controls';
import { formatDuration, weekdayName } from '../../shared/utils/format';
import { missingSetupMessage } from '../../shared/utils/setup';

export function PlanDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasFtp = user?.ftpWatts != null && user.ftpWatts > 0;
  const plan = useQuery({ queryKey: ['plan', id], queryFn: () => api<TrainingPlan>(`/api/v1/plans/${id}`) });
  const setup = useQuery({ queryKey: ['setup'], queryFn: () => api<RiderSetup>('/api/v1/setup') });
  const start = useMutation({
    mutationFn: (planSessionId: string) => {
      if (!setup.data?.bikeId || !setup.data.trainerId) {
        throw new Error('Choose a bike and trainer on the home screen first');
      }
      return api<{ id: string }>('/api/v1/workouts', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'planned',
          planSessionId,
          bikeId: setup.data.bikeId,
          trainerId: setup.data.trainerId,
          resistanceLevelId: setup.data.resistanceLevelId ?? undefined,
          chainringTeeth: setup.data.chainringTeeth ?? undefined,
          cogTeeth: setup.data.cogTeeth ?? undefined,
        }),
      });
    },
    onSuccess: (workout) => navigate(`/ride/${workout.id}`),
  });
  const needsFtp = (plan.data?.sessions ?? []).some((session) => sessionNeedsFtp(session));
  const setupHint = missingSetupMessage(setup.data);
  const weeks = new Map<number, NonNullable<TrainingPlan['sessions']>>();
  for (const session of plan.data?.sessions ?? []) {
    const list = weeks.get(session.weekIndex) ?? [];
    list.push(session);
    weeks.set(session.weekIndex, list);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-8 py-10">
      <h1 className="text-3xl">{plan.data?.name ?? 'Plan'}</h1>
      {plan.isError ? <ErrorText>{plan.error.message}</ErrorText> : null}
      {needsFtp && !hasFtp ? (
        <p className="text-muted">
          Power workouts need an FTP. Run a zone test or enter it on{' '}
          <Link className="text-signal" to="/zone-tests">
            Zones
          </Link>
          .
        </p>
      ) : null}
      {setupHint ? <Hint>{setupHint}</Hint> : null}
      {start.error ? <ErrorText>{start.error.message}</ErrorText> : null}
      {[...weeks.entries()].map(([week, sessions]) => (
        <section key={week} className="space-y-3">
          <h2 className="text-lg text-muted">Week {week}</h2>
          {sessions.map((session) => (
            <article key={session.id} className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl">{session.name}</p>
                  <p className="text-sm text-muted">{weekdayName(session.dayOfWeek)}</p>
                </div>
                <Button
                  disabled={(sessionNeedsFtp(session) && !hasFtp) || Boolean(setupHint) || start.isPending}
                  onClick={() => start.mutate(session.id)}
                >
                  {start.isPending ? 'Starting…' : 'Start'}
                </Button>
              </div>
              <ol className="mt-3 space-y-1 text-sm text-muted">
                {session.segments?.map((segment) => (
                  <li key={segment.id}>
                    {formatDuration(segment.durationSeconds)} · {segment.targetKind === 'power' ? 'power' : 'heart rate'} Z
                    {segment.zone}
                    {segment.notes ? ` · ${segment.notes}` : ''}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function sessionNeedsFtp(session: { segments?: { targetKind: string }[] }): boolean {
  return session.segments?.some((segment) => segment.targetKind === 'power') ?? false;
}
