import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../../shared/api/client';
import type { User } from '../../shared/api/types';
import { Button, ErrorText, Field, Hint, TextInput } from '../../shared/ui/controls';
import { DeleteAction } from '../../shared/ui/delete-action';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or fewer'),
  password: z.string().min(8, 'Use at least 8 characters').max(200, 'Password must be 200 characters or fewer'),
});

type FormValues = z.infer<typeof schema>;

export function RidersPage() {
  const queryClient = useQueryClient();
  const riders = useQuery({ queryKey: ['riders'], queryFn: () => api<User[]>('/api/v1/users') });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', password: '' } });
  const create = useMutation({
    mutationFn: (values: FormValues) =>
      api<User>('/api/v1/users', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['riders'] });
    },
  });
  const [failedId, setFailedId] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/v1/users/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setFailedId(null);
      await queryClient.invalidateQueries({ queryKey: ['riders'] });
    },
    onError: (_error, id) => setFailedId(id),
  });

  return (
    <div className="mx-auto max-w-xl space-y-6 px-8 py-10">
      <h1 className="text-3xl">Riders</h1>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
        <Field label="Name">
          <TextInput {...form.register('name')} />
          {form.formState.errors.name ? <ErrorText>{form.formState.errors.name.message}</ErrorText> : null}
        </Field>
        <Field label="Password">
          <TextInput type="password" {...form.register('password')} />
          <Hint>At least 8 characters. Share it with the rider; it is not shown again.</Hint>
          {form.formState.errors.password ? <ErrorText>{form.formState.errors.password.message}</ErrorText> : null}
        </Field>
        {create.error ? <ErrorText>{create.error.message}</ErrorText> : null}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create rider'}
        </Button>
      </form>
      {riders.isError ? <ErrorText>{riders.error.message}</ErrorText> : null}
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {riders.data?.map((rider) => (
          <li key={rider.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span>
              {rider.name} <span className="text-muted">{rider.role}</span>
            </span>
            {rider.role === 'rider' ? (
              <span className="flex flex-col items-end gap-1">
                <DeleteAction
                  variant="button"
                  name={rider.name}
                  blockedReason={null}
                  isPending={remove.isPending && remove.variables === rider.id}
                  detail="Their bikes, plans, and rides are removed too."
                  onDelete={() => remove.mutate(rider.id)}
                />
                {failedId === rider.id && remove.error ? <ErrorText>{remove.error.message}</ErrorText> : null}
              </span>
            ) : (
              <Hint>The admin account stays.</Hint>
            )}
          </li>
        ))}
        {riders.data?.length === 0 ? <li className="px-4 py-6 text-muted">No riders yet.</li> : null}
      </ul>
    </div>
  );
}
