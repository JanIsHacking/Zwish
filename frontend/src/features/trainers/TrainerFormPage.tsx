import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../../shared/api/client';
import type { Trainer } from '../../shared/api/types';
import { Button, ErrorText, Field, TextInput } from '../../shared/ui/controls';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or fewer'),
  deviceId: z.string().uuid('Device id must be a UUID').or(z.literal('')),
  resistanceLevelCount: z.number().int().min(1).max(15),
});

type FormValues = z.infer<typeof schema>;

export function TrainerFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', deviceId: '', resistanceLevelCount: 5 },
  });
  const count = form.watch('resistanceLevelCount');
  const save = useMutation({
    mutationFn: (values: FormValues) =>
      api<Trainer>('/api/v1/trainers', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          deviceId: values.deviceId || undefined,
          resistanceLevelCount: values.resistanceLevelCount,
        }),
      }),
    onSuccess: async (trainer) => {
      await queryClient.invalidateQueries({ queryKey: ['trainers'] });
      navigate(`/trainers/${trainer.id}`);
    },
  });

  return (
    <form className="mx-auto max-w-xl space-y-4 px-8 py-10" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
      <h1 className="text-3xl">New trainer</h1>
      <p className="text-sm text-muted">
        The device id is the UUID stored on the ESP32. It is the ingest credential. Paste it from the sensor setup page.
      </p>
      <Field label="Name">
        <TextInput {...form.register('name')} />
        {form.formState.errors.name ? <ErrorText>{form.formState.errors.name.message}</ErrorText> : null}
      </Field>
      <Field label="Device id">
        <TextInput placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" {...form.register('deviceId')} />
      </Field>
      <Field label="Resistance levels">
        <input
          type="range"
          min={1}
          max={15}
          step={1}
          className="w-full accent-signal"
          value={Number.isFinite(count) ? count : 5}
          onChange={(event) => form.setValue('resistanceLevelCount', Number(event.target.value), { shouldValidate: true })}
        />
        <span className="num text-2xl text-paper">{count}</span>
        <span className="block">Levels 1 to {count}</span>
      </Field>
      {form.formState.errors.deviceId ? <ErrorText>{form.formState.errors.deviceId.message}</ErrorText> : null}
      {save.error ? <ErrorText>{save.error.message}</ErrorText> : null}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
