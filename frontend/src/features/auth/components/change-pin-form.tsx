import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { notifySuccess } from '@/components/ui/popup-host';
import { useAuthStore } from '@/stores/auth';
import { deviceLabel, lastLogin, savePinDevice } from '@/lib/pin-device';
import { cn } from '@/lib/utils';
import { PasswordInput } from './password-input';

const pin = z.string().regex(/^\d{4}$/, 'Enter exactly 4 digits.');
const schema = z
  .object({ password: z.string().min(1, 'Enter your password.'), pin, confirmPin: z.string() })
  .refine((v) => v.pin === v.confirmPin, { message: "The PINs don't match.", path: ['confirmPin'] });

type FormValues = z.infer<typeof schema>;

/** Change PIN, as in a banking app: the password confirms it is really you. */
export function ChangePinForm({ dark = false }: { dark?: boolean }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: '', pin: '', confirmPin: '' } });

  const mutation = useMutation({
    mutationFn: (v: FormValues) => authApi.pinChange(v.password, v.pin, deviceLabel()),
    onSuccess: (result) => {
      // This device now opens with the new PIN
      savePinDevice({
        ...result.device,
        userId: result.user.id,
        fullName: result.user.fullName,
        login: lastLogin() || result.user.email,
      });
      setUser(result.user);
      setError(null);
      reset();
      notifySuccess('PIN changed', 'Use your new PIN the next time you sign in.');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const field = dark
    ? 'bg-white/10 text-white placeholder:text-white/40'
    : 'bg-field text-foreground placeholder:text-foreground-5';
  const label = cn('mb-1 block text-[12px] font-medium', dark ? 'text-white/80' : 'text-foreground-3');
  const fieldError = (message?: string) =>
    message && <p className={cn('mt-1 text-xs', dark ? 'text-red-300' : 'text-danger')}>{message}</p>;
  const pinInput = { type: 'password', inputMode: 'numeric' as const, maxLength: 4, autoComplete: 'off', className: field };

  return (
    <form className="space-y-3" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
      {error && (
        <p className={cn('rounded-xl px-4 py-3 text-[13px]', dark ? 'bg-red-500/15 text-red-200' : 'bg-danger-soft text-danger-text')}>
          {error}
        </p>
      )}
      <div>
        <Label htmlFor="pinPassword" className={label}>Password</Label>
        <PasswordInput id="pinPassword" autoComplete="current-password" placeholder="Your password" className={field} {...register('password')} />
        {fieldError(errors.password?.message)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="newPin" className={label}>New PIN</Label>
          <Input id="newPin" placeholder="4 digits" {...pinInput} {...register('pin')} />
          {fieldError(errors.pin?.message)}
        </div>
        <div>
          <Label htmlFor="confirmPin" className={label}>Confirm PIN</Label>
          <Input id="confirmPin" placeholder="Again" {...pinInput} {...register('confirmPin')} />
          {fieldError(errors.confirmPin?.message)}
        </div>
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className={cn(
          'flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60',
          dark ? 'bg-[#8BC53F]' : 'bg-accent',
        )}
      >
        {mutation.isPending ? 'Saving…' : 'Change PIN'}
      </button>
    </form>
  );
}
