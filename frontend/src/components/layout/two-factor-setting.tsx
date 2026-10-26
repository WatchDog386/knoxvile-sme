import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck } from 'lucide-react';
import { authApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PasswordInput } from '@/features/auth/components/password-input';
import { RecoveryCodes, TwoFactorSetupStep } from '@/features/auth/components/two-factor';
import { BubbleTile } from './profile-visuals';

type Flow = 'enable' | 'codes' | 'disable';

const TITLES: Record<Flow, { title: string; subtitle: string }> = {
  enable: { title: 'Turn on two-factor', subtitle: 'Sign-in will also ask for a code from your phone.' },
  codes: { title: 'Save your recovery codes', subtitle: 'Two-factor sign-in is on. Keep these codes safe.' },
  disable: { title: 'Turn off two-factor', subtitle: 'Enter your password to confirm.' },
};

/**
 * Settings row for optional two-factor sign-in. The switch opens a full-screen
 * page styled like the sign-in screen: set up the authenticator app (then
 * save recovery codes), or confirm the password to turn it off.
 */
export function TwoFactorSetting({ tile = false }: { tile?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const on = Boolean(user?.twoFactorEnabled);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setFlow(null);
    setPassword('');
    setError(null);
  };

  const turnOff = async () => {
    if (!password || pending) return;
    setPending(true);
    setError(null);
    try {
      await authApi.twoFactorDisableMe(password);
      if (user) setUser({ ...user, twoFactorEnabled: false });
      close();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {tile ? (
        <BubbleTile
          icon={ShieldCheck}
          title="Two-factor"
          description={on ? 'On' : 'Off'}
          compact
          onClick={() => setFlow(on ? 'disable' : 'enable')}
        />
      ) : (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setFlow(on ? 'disable' : 'enable')}
        className={cn(
          'relative text-left transition-[transform,background-color] active:scale-[0.98]',
          tile
            ? 'flex flex-col items-start gap-2.5 rounded-2xl bg-surface p-3.5 shadow-sm'
            : '-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-3 rounded-xl px-1 py-2.5 active:bg-surface-3',
        )}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center bg-emerald-600 text-white',
            tile ? 'h-10 w-10 rounded-xl' : 'h-[30px] w-[30px] rounded-[9px]',
          )}
        >
          <ShieldCheck className={cn(tile ? 'h-5 w-5' : 'h-4 w-4')} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block leading-snug text-foreground', tile ? 'text-[14px] font-medium' : 'text-[15px]')}>
            {tile ? 'Two-factor' : 'Two-factor sign-in'}
          </span>
          <span className={cn('block leading-snug text-foreground-3', tile ? 'mt-0.5 text-[11.5px]' : 'truncate text-xs')}>
            {tile
              ? on
                ? 'On'
                : 'Off'
              : on
                ? 'On: sign-in asks for a code from your phone'
                : 'Off: add a code from your phone at sign-in'}
          </span>
        </span>
        {!tile && (
          <span className={cn('relative h-7 w-[52px] shrink-0 rounded-full transition-colors duration-200', on ? 'bg-brand-600' : 'bg-edge-2')} aria-hidden>
            <span
              className={cn(
                'absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200',
                on ? 'translate-x-6' : 'translate-x-0',
              )}
            />
          </span>
        )}
      </button>
      )}

      {flow &&
        createPortal(
          // White page like the sign-in screen, above the Settings layer
          <div className="fixed inset-0 z-[80] overflow-y-auto bg-white text-slate-800 animate-fade-in">
            <div className="mx-auto w-full max-w-sm px-6 pb-10 pt-[max(1.25rem,var(--sat))]">
              {flow !== 'codes' && (
                <button
                  type="button"
                  onClick={close}
                  className="flex h-11 w-auto items-center justify-start px-1 text-[14px] font-semibold text-foreground-2 active:opacity-60"
                  aria-label="Back"
                >
                  Back
                </button>
              )}

              <div className="mt-8">
                <h1 className="text-3xl font-normal tracking-tight text-slate-800">{TITLES[flow].title}</h1>
                <p className="mt-1 text-sm text-slate-500">{TITLES[flow].subtitle}</p>
              </div>

              {/* Same muted, borderless fields as the sign-in page */}
              <div className="mt-6 [&_input]:!rounded-lg [&_input]:!border-transparent [&_input]:!bg-slate-100 [&_input]:!text-slate-700 [&_input]:!shadow-none [&_input]:placeholder:text-slate-400 [&_label]:sr-only">
                {flow === 'enable' && (
                  <TwoFactorSetupStep
                    start={authApi.twoFactorSetupMe}
                    enable={authApi.twoFactorEnableMe}
                    onEnabled={(recoveryCodes) => {
                      setCodes(recoveryCodes);
                      if (user) setUser({ ...user, twoFactorEnabled: true });
                      setFlow('codes');
                    }}
                    onRestart={close}
                  />
                )}

                {flow === 'codes' && <RecoveryCodes codes={codes} continueLabel="Done" onContinue={close} />}

                {flow === 'disable' && (
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void turnOff();
                    }}
                  >
                    {error && <Alert variant="error" inline>{error}</Alert>}
                    <label htmlFor="tfa-password">Password</label>
                    <PasswordInput
                      id="tfa-password"
                      autoComplete="current-password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 px-4 text-sm"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      loading={pending}
                      disabled={!password}
                      className="mt-2 h-14 w-full rounded-2xl bg-red-600 text-[18px] font-medium text-white shadow-none hover:bg-red-700 disabled:bg-[#BFC1C3] disabled:opacity-100"
                    >
                      Turn off two-factor
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
