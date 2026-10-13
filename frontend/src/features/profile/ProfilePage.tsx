import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../shared/api/client';
import type { HrZone, User } from '../../shared/api/types';
import { useAuth } from '../../shared/auth/auth-context';
import { Button, ErrorText, Field, Hint, TextInput } from '../../shared/ui/controls';

function zonesFromMaxHr(maxHr: number): HrZone[] {
  const cuts = [0, 0.6, 0.7, 0.8, 0.9, 0.94, 0.97, 1];
  return cuts.slice(0, -1).map((start, index) => {
    const end = cuts[index + 1] ?? 1;
    const minBpm = Math.max(30, Math.round(maxHr * start));
    const rawMax = index === cuts.length - 2 ? null : Math.round(maxHr * end);
    return {
      zone: index + 1,
      minBpm,
      maxBpm: rawMax === null ? null : Math.max(minBpm + 1, rawMax),
    };
  });
}

function wholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  return Number(value);
}

export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [maxHr, setMaxHr] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (hrZoneBounds: HrZone[]) =>
      api<User>('/api/v1/users/me', { method: 'PATCH', body: JSON.stringify({ hrZoneBounds }) }),
    onSuccess: (next) => {
      queryClient.setQueryData(['me'], next);
      setMaxHr('');
    },
  });

  const onSave = () => {
    const max = wholeNumber(maxHr);
    if (max === null || max < 120 || max > 220) {
      setFormError('Max heart rate must be a whole number from 120 to 220.');
      return;
    }
    setFormError(null);
    save.mutate(zonesFromMaxHr(max));
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 px-8 py-10">
      <h1 className="text-3xl">Profile</h1>
      <p className="text-sm text-muted">Heart-rate zones are stored from the max heart rate you enter here.</p>
      <Field label="Max heart rate">
        <TextInput value={maxHr} onChange={(event) => setMaxHr(event.target.value)} placeholder="120–220" />
      </Field>
      {user?.hrZoneBounds?.length ? (
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {user.hrZoneBounds.map((zone) => (
            <li key={zone.zone} className="rounded-xl border border-line px-3 py-2">
              <span className="text-muted">Z{zone.zone}</span>
              <p className="num text-lg">
                {zone.minBpm}
                {zone.maxBpm === null ? '+' : `–${zone.maxBpm}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <Hint>No heart-rate zones yet.</Hint>
      )}
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {save.error ? <ErrorText>{save.error.message}</ErrorText> : null}
      <Button onClick={onSave} disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </Button>
      {save.isSuccess ? <p className="text-sm text-ok">Saved.</p> : null}
    </div>
  );
}
