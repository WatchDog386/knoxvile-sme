import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { AuthLayout, AuthFooterLink } from './components/auth-layout';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      authApi.forgotPassword(values.email),
    onSuccess: (result) => {
      setSent(
        result.resetToken
          ? `In development, your reset token is: ${result.resetToken}`
          : 'If self-service reset is available, a reset link will be sent. If you have already used your password change, contact your administrator.',
      );
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <AuthLayout
      title="Forgot your password?"
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        {error && <Alert variant="error">{error}</Alert>}
        {sent && (
          <Alert variant="success" inline>
            <p>{sent}</p>
            <button
              type="button"
              onClick={() => navigate('/reset-password')}
              className="mt-2 font-medium underline"
            >
              Go to reset password
            </button>
          </Alert>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={errors.email ? true : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>
        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={mutation.isPending}
        >
          Send reset link
        </Button>
      </form>
      <AuthFooterLink text="Remembered it?" linkText="Log in" to="/login" />
    </AuthLayout>
  );
}
