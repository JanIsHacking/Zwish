import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { RiderSetup, ZoneTestResult } from '../../shared/api/types';
import { useAuth } from '../../shared/auth/auth-context';
import { Button, ErrorText, Hint } from '../../shared/ui/controls';
import { missingSetupMessage } from '../../shared/utils/setup';
import { ManualFtp } from './components/ManualFtp';

type ZoneTestProtocol = 'ramp' | 'twenty_minute';

export function ZoneTestsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const setup = useQuery({ queryKey: ['setup'], queryFn: () => api<RiderSetup>('/api/v1/setup') });
  const history = useQuery({
    queryKey: ['zone-tests'],
    queryFn: () => api<ZoneTestResult[]>('/api/v1/zone-tests'),
  });
  const start = useMutation({
    mutationFn: (protocol: ZoneTestProtocol) => {
      if (!setup.data?.bikeId || !setup.data.trainerId) {
        throw new Error('Choose a bike and trainer on the home screen first');
      }
      return api<{ id: string }>('/api/v1/zone-tests', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'zone_test',
          zoneTestProtocol: protocol,
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
  const setupHint = missingSetupMessage(setup.data);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-10">
      <header>
        <h1 className="text-3xl">Zones</h1>
        <p className="text-muted">
          Power workouts need an FTP. Run a test, or enter the number yourself.
          {user?.ftpWatts ? ` Current FTP is ${Math.round(user.ftpWatts)} W.` : ' No FTP is set yet.'}
        </p>
      </header>
      <ManualFtp key={user?.ftpWatts ?? 'none'} ftpWatts={user?.ftpWatts ?? null} />
      {setup.isError ? <ErrorText>{setup.error.message}</ErrorText> : null}
      {history.isError ? <ErrorText>{history.error.message}</ErrorText> : null}
      {setupHint ? <Hint>{setupHint}</Hint> : null}
      <section className="grid gap-4 md:grid-cols-2">
        <TestCard
          title="20-minute test"
          body="Warm up thoroughly, then ride as hard as you can for 20 minutes. FTP is 95% of the average power from those 20 minutes."
          action="Start 20-minute"
          pending={start.isPending}
          disabled={Boolean(setupHint)}
          onStart={() => start.mutate('twenty_minute')}
        />
        <TestCard
          title="Ramp test"
          body="Five easy minutes, then the target rises 20 W each minute until you stop. Stop the workout when you cannot hold the target any longer. FTP is 75% of the last step you complete."
          action="Start ramp"
          pending={start.isPending}
          disabled={Boolean(setupHint)}
          onStart={() => start.mutate('ramp')}
        />
      </section>
      {start.error ? <ErrorText>{start.error.message}</ErrorText> : null}
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {history.data?.map((result) => (
          <li key={result.id} className="flex items-center justify-between px-4 py-3">
            <span>
              {format(new Date(result.createdAt), 'd MMM yyyy')}
              <span className="ml-3 text-sm text-muted">{protocolLabel(result.protocol)}</span>
            </span>
            <span className="num text-2xl text-signal">{Math.round(result.estimatedFtp)} W</span>
          </li>
        ))}
        {history.data?.length === 0 ? <li className="px-4 py-6 text-muted">No tests yet.</li> : null}
      </ul>
    </div>
  );
}

function protocolLabel(protocol: ZoneTestResult['protocol']): string {
  return protocol === 'twenty_minute' ? '20-minute' : 'Ramp';
}

function TestCard({
  title,
  body,
  action,
  pending,
  disabled,
  onStart,
}: {
  title: string;
  body: string;
  action: string;
  pending: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  return (
    <article className="flex flex-col justify-between gap-4 rounded-2xl border border-line p-4">
      <div>
        <h2 className="text-xl">{title}</h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
      </div>
      <Button disabled={disabled || pending} onClick={onStart}>
        {pending ? 'Starting…' : action}
      </Button>
    </article>
  );
}
