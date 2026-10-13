import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../../shared/api/client';
import type { Bike } from '../../shared/api/types';
import { Button, ErrorText, Field, Hint, TextInput } from '../../shared/ui/controls';
import { DeleteAction } from '../../shared/ui/delete-action';
import { recordedRides } from '../../shared/utils/format';
import { keptForHistory } from '../../shared/utils/setup';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or fewer'),
  wheelCircumferenceMm: z
    .number('Enter the wheel circumference in millimetres')
    .int('Circumference must be a whole number of millimetres')
    .min(500, 'Circumference must be at least 500 mm')
    .max(3000, 'Circumference must be at most 3000 mm'),
  chainrings: z.string().min(1, 'Enter at least one chainring'),
  cogs: z.string().min(1, 'Enter at least one cog'),
});

type FormValues = z.infer<typeof schema>;

function teeth(value: string): number[] {
  return value
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number(part));
}

function teethError(value: string, noun: string, min: number, max: number, limit: number): string | null {
  const parts = teeth(value);
  if (parts.length < 1) {
    return `Enter at least one ${noun}.`;
  }
  if (parts.length > limit) {
    return `Enter at most ${limit} ${noun}s.`;
  }
  if (parts.some((part) => part < min || part > max)) {
    return `Each ${noun} must be a whole number from ${min} to ${max}.`;
  }
  return null;
}

export function BikeFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: ['bike', id],
    enabled: Boolean(id),
    queryFn: () => api<Bike>(`/api/v1/bikes/${id}`),
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: existing.data
      ? {
          name: existing.data.name,
          wheelCircumferenceMm: existing.data.wheelCircumferenceMm,
          chainrings: existing.data.chainringTeeth.join(', '),
          cogs: existing.data.cogTeeth.join(', '),
        }
      : undefined,
    defaultValues: { name: '', wheelCircumferenceMm: 2105, chainrings: '50, 34', cogs: '28, 24, 21, 19, 17, 15, 13' },
  });
  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const chainringError = teethError(values.chainrings, 'chainring', 20, 70, 4);
      const cogError = teethError(values.cogs, 'cog', 8, 50, 13);
      if (chainringError || cogError) {
        throw new Error(chainringError ?? cogError ?? 'Check the gears');
      }
      const body = {
        name: values.name,
        wheelCircumferenceMm: values.wheelCircumferenceMm,
        chainringTeeth: teeth(values.chainrings),
        cogTeeth: teeth(values.cogs),
      };
      return api<Bike>(id ? `/api/v1/bikes/${id}` : '/api/v1/bikes', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bikes'] });
      navigate('/bikes');
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/api/v1/bikes/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bikes'] });
      navigate('/bikes');
    },
  });

  return (
    <form
      className="mx-auto max-w-xl space-y-4 px-8 py-10"
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
    >
      <h1 className="text-3xl">{id ? 'Edit bike' : 'New bike'}</h1>
      <Field label="Name">
        <TextInput {...form.register('name')} />
        {form.formState.errors.name ? <ErrorText>{form.formState.errors.name.message}</ErrorText> : null}
      </Field>
      <Field label="Rear wheel circumference (mm)">
        <TextInput type="number" {...form.register('wheelCircumferenceMm', { valueAsNumber: true })} />
        <Hint>Measure the rear tire you actually ride. A 700×25c is about 2105 mm.</Hint>
        {form.formState.errors.wheelCircumferenceMm ? (
          <ErrorText>{form.formState.errors.wheelCircumferenceMm.message}</ErrorText>
        ) : null}
      </Field>
      <Field label="Chainrings, largest first">
        <TextInput {...form.register('chainrings')} />
        <Hint>Separate teeth with commas. Each ring is 20–70.</Hint>
        {form.formState.errors.chainrings ? <ErrorText>{form.formState.errors.chainrings.message}</ErrorText> : null}
      </Field>
      <Field label="Cassette, largest first">
        <TextInput {...form.register('cogs')} />
        <Hint>Separate teeth with commas. Each cog is 8–50.</Hint>
        {form.formState.errors.cogs ? <ErrorText>{form.formState.errors.cogs.message}</ErrorText> : null}
      </Field>
      {existing.isError ? <ErrorText>{existing.error.message}</ErrorText> : null}
      {save.error ? <ErrorText>{save.error.message}</ErrorText> : null}
      {remove.error ? <ErrorText>{remove.error.message}</ErrorText> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        {id ? (
          <DeleteAction
            variant="button"
            name={existing.data?.name ?? 'this bike'}
            blockedReason={
              existing.data && existing.data.rideCount > 0
                ? keptForHistory('bike', recordedRides(existing.data.rideCount))
                : null
            }
            isPending={remove.isPending}
            detail="This cannot be undone."
            onDelete={() => remove.mutate()}
          />
        ) : null}
      </div>
      {existing.data && existing.data.rideCount > 0 ? (
        <Hint>{keptForHistory('bike', recordedRides(existing.data.rideCount))}</Hint>
      ) : null}
    </form>
  );
}
