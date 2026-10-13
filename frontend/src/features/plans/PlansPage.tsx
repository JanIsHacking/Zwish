import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { TrainingPlan } from '../../shared/api/types';
import { ErrorText } from '../../shared/ui/controls';

export function PlansPage() {
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<TrainingPlan[]>('/api/v1/plans') });
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-10">
      <h1 className="text-3xl">Plans</h1>
      <p className="text-muted">A fixed dummy plan is attached to every account so the ride screen can be tried.</p>
      {plans.isError ? <ErrorText>{plans.error.message}</ErrorText> : null}
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {plans.data?.map((plan) => (
          <li key={plan.id}>
            <Link className="block px-4 py-4 hover:bg-panel" to={`/plans/${plan.id}`}>
              <p className="text-lg">{plan.name}</p>
              <p className="text-sm text-muted">{plan.sessions.length} sessions</p>
            </Link>
          </li>
        ))}
        {plans.data?.length === 0 ? <li className="px-4 py-6 text-muted">No plan is attached to this account.</li> : null}
      </ul>
    </div>
  );
}
