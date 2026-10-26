import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { PasswordInput } from './password-input';
import { Label } from '@/components/ui/label';
import { notifySuccess } from '@/components/ui/popup-host';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Type the new password again.'),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword !== v.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'The two passwords do not match.' });
    }
    if (v.newPassword && v.newPassword === v.currentPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: 'Choose a password different from your current one.',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

/**
 * Change your own password. Used by the subscriber's account page and by the
 * staff profile. `dark` is for sitting on the subscriber's dark panels.
 */
export function ChangePasswordForm({ dark = false, onDone }: { dark?: boolean; onDone?: () => void }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => authApi.changePassword(values.currentPassword, values.newPassword),
    onSuccess: (result) => {
      // The old session stops working with the old password: switch to the new one
      setAuth(result.accessToken, result.user);
      setError(null);
      setDone(true);
      reset();
      notifySuccess('Password changed', 'Use your new password the next time you sign in.');
      onDone?.();
    },
    onError: (err) => {
      setError(apiErrorMessage(err));
      setDone(false);
    },
  });

  const field = dark
    ? 'bg-white/10 text-white placeholder:text-white/40'
    : 'bg-field text-foreground placeholder:text-foreground-5';

  return (
    <form className="space-y-3" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      {error && (
        <p
          className={cn(
            'rounded-xl px-4 py-3 text-[13px]',
            dark ? 'bg-red-500/15 text-red-200' : 'bg-danger-soft text-danger-text',
          )}
        >
          {error}
        </p>
      )}
      {done && !error && (
        <p
          className={cn(
            'rounded-xl px-4 py-3 text-[13px]',
            dark ? 'bg-white/10 text-white/80' : 'bg-success-soft text-success-text',
          )}
        >
          Your password has been changed.
        </p>
      )}

      <Field label="Current password" error={errors.currentPassword?.message} dark={dark}>
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          placeholder="Your password now"
          className={field}
          aria-invalid={errors.currentPassword ? true : undefined}
          {...register('currentPassword')}
        />
      </Field>

      <Field label="New password" error={errors.newPassword?.message} dark={dark}>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={field}
          aria-invalid={errors.newPassword ? true : undefined}
          {...register('newPassword')}
        />
      </Field>

      <Field label="Confirm new password" error={errors.confirmPassword?.message} dark={dark}>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="Type it again"
          className={field}
          aria-invalid={errors.confirmPassword ? true : undefined}
          {...register('confirmPassword')}
        />
      </Field>

      <button
        type="submit"
        disabled={mutation.isPending}
        className={cn(
          'flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60',
          dark ? 'bg-[#8BC53F]' : 'bg-accent',
        )}
      >
        {mutation.isPending ? 'Saving…' : 'Update password'}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  dark,
  children,
}: {
  label: string;
  error?: string;
  dark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label
        htmlFor={label}
        className={cn('mb-1 block text-[12px] font-medium', dark ? 'text-white/80' : 'text-foreground-3')}
      >
        {label}
      </Label>
      {children}
      {error && <p className={cn('mt-1 text-xs', dark ? 'text-red-300' : 'text-danger')}>{error}</p>}
    </div>
  );
}