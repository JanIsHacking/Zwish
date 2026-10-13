import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../shared/api/client';
import type { User } from '../../../shared/api/types';
import { Button, ErrorText, Field, TextInput } from '../../../shared/ui/controls';
import { powerZoneWatts } from '../utils/power-zones';

export function ManualFtp({ ftpWatts }: { ftpWatts: number | null }) {
  const queryClient = useQueryClient();
  const [ftp, setFtp] = useState(ftpWatts ? String(Math.round(ftpWatts)) : '');
  const watts = Number(ftp);
  const zones = Number.isFinite(watts) && watts >= 50 && watts <= 600 ? powerZoneWatts(watts) : null;
  const save = useMutation({
    mutationFn: () =>
      api<User>('/api/v1/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ ftpWatts: watts }),
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['me'], next);
    },
  });

  return (
    <section className="space-y-3 rounded-2xl border border-line p-4">
      <h2 className="text-xl">Enter FTP</h2>
      <p className="text-sm text-muted">Power zones are percentages of this number. A test overwrites it.</p>
      <Field label="FTP (watts)">
        <TextInput
          inputMode="numeric"
          value={ftp}
          onChange={(event) => setFtp(event.target.value)}
        />
      </Field>
      {ftp.trim() && !zones ? <ErrorText>FTP must be a whole number from 50 to 600.</ErrorText> : null}
      {zones ? (
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {zones.map((zone) => (
            <li key={zone.zone} className="rounded-xl bg-panel px-3 py-2">
              <span className="text-muted">Z{zone.zone}</span>
              <p className="num text-lg">
                {zone.min}
                {zone.max === null ? '+' : `–${zone.max}`} W
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <Button disabled={!zones || save.isPending} onClick={() => save.mutate()}>
        Save FTP
      </Button>
      {save.isSuccess ? <p className="text-sm text-ok">Saved. Power zones now use this FTP.</p> : null}
      {save.error ? <ErrorText>{save.error.message}</ErrorText> : null}
    </section>
  );
}
