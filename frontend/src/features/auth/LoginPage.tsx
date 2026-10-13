import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../shared/auth/auth-context';
import { Button, ErrorText, Field, TextInput } from '../../shared/ui/controls';

const schema = z.object({
  name: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', password: '' } });
  if (isLoading) {
    return null;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return (
    <div className="flex min-h-full items-center justify-center px-6">
      <form
        className="w-full max-w-sm space-y-5 rounded-3xl border border-line bg-panel p-8"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await login(values.name, values.password);
          } catch (error) {
            form.setError('root', { message: error instanceof Error ? error.message : 'Login failed' });
          }
        })}
      >
        <div>
          <p className="num text-5xl text-signal">Zwish</p>
          <p className="mt-2 text-sm text-muted">Sign in to your trainer.</p>
        </div>
        <Field label="Name">
          <TextInput autoComplete="username" {...form.register('name')} />
        </Field>
        <Field label="Password">
          <TextInput type="password" autoComplete="current-password" {...form.register('password')} />
        </Field>
        {form.formState.errors.root ? <ErrorText>{form.formState.errors.root.message}</ErrorText> : null}
        <Button className="w-full" type="submit">
          Log in
        </Button>
      </form>
    </div>
  );
}
