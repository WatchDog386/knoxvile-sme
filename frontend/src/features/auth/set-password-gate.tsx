import { KeyRound } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { ChangePasswordForm } from './components/change-password-form';

/**
 * Shown instead of the app while someone is still on a password the office
 * chose for them (a subscriber's first login after onboarding). They type that
 * temporary password once and pick their own before seeing anything.
 */
export function SetPasswordGate() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const first = user?.fullName.split(' ')[0] ?? '';

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white">
            <KeyRound className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-4 text-lg font-medium text-foreground">
            {first ? `${first}, set your password` : 'Set your password'}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-foreground-4">
            The office gave you a temporary password to get in. Set your own now; this is your one self-service password change. Contact your administrator for another reset.
          </p>
        </div>
        <ChangePasswordForm
          onDone={() => user && setUser({ ...user, mustChangePassword: false, selfServicePasswordChangeUsed: true })}
        />
        <p className="text-center text-[11px] text-foreground-4">
          The temporary password stops working the moment you set this one.
        </p>
      </div>
    </div>
  );
}
