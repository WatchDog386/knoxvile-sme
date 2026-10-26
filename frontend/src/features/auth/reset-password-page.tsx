import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { authApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { PasswordInput } from './components/password-input';
import { AuthLayout, AuthFooterLink } from './components/auth-layout';

const schema = z.object({
  token: z.string().min(1, 'Enter the reset token.'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { token: searchParams.get('token') ?? '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      authApi.resetPassword(values.token, values.newPassword),
    onSuccess: () => setDone(true),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (done) {
    return (
      <AuthLayout
        title="Password updated"
      >
        <div className="space-y-4">
          <Alert variant="success">
            Your password has been changed successfully.
          </Alert>
          <Button className="w-full" size="lg" onClick={() => navigate('/login')}>
            Go to login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        {error && <Alert variant="error">{error}</Alert>}
        <div>
          <Label htmlFor="token">Reset token</Label>
          <input
            id="token"
            className="h-11 w-full rounded-full border border-edge bg-field px-4 font-mono text-sm focus:border-edge-2 focus:ring-0 outline-none"
            placeholder="Paste the token from the reset link"
            aria-invalid={errors.token ? true : undefined}
            {...register('token')}
          />
          {errors.token && (
            <p className="mt-1 text-xs text-red-600">{errors.token.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="newPassword">New password</Label>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            placeholder="8+ characters"
            aria-invalid={errors.newPassword ? true : undefined}
            {...register('newPassword')}
          />
          {errors.newPassword && (
            <p className="mt-1 text-xs text-red-600">
              {errors.newPassword.message}
            </p>
          )}
        </div>
        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={mutation.isPending}
        >
          Reset password
        </Button>
      </form>
      <AuthFooterLink text="Remembered it?" linkText="Log in" to="/login" />
    </AuthLayout>
  );
}