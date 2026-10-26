import { useForm } from 'react-hook-form';
import { WorkspaceLoader } from '@/components/ui/workspace-loader';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authApi, businessesApi } from '@/api/endpoints';
import { ApiErrorShape, apiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useBusinessStore } from '@/stores/business';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InvalidDetailsArt } from '@/components/brand/invalid-details-art';
import { notifyError, notifyInfo } from '@/components/ui/popup-host';
import { ArrowLeft, Download, Lock, Mail } from 'lucide-react';
import { PasswordInput } from './components/password-input';
import { PinBoxes } from './components/pin-boxes';
import { HomePhoto } from '@/components/brand/home-photo';
import { clearPinDevice, lastLogin, lastName, readPinDevice, rememberLastLogin, rememberLastName } from '@/lib/pin-device';
import { AuthLayout } from './components/auth-layout';
import { TwoFactorVerify } from './components/two-factor';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { usePhotoStatusBar } from '@/hooks/use-photo-status-bar';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { useTheme } from '@/lib/theme';
import { useHiddenStatusBar } from '@/hooks/use-hidden-status-bar';
import { SHOW_MOBILE_HOME } from '@/lib/flags';
import type { AuthResult, MfaChallenge } from '@/api/types';

const schema = z.object({
  // Subscribers sign in with their username or account number; staff use their email
  identifier: z.string().trim().min(1, 'Enter your username or email.'),
  password: z.string().min(1, 'Enter your password.'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setBusinesses = useBusinessStore((s) => s.setBusinesses);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Two-factor is optional: people who turned it on in Settings enter a code next
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  // From "Verify and continue" until the dashboard opens, one loader covers everything
  const [verifying, setVerifying] = useState(false);
  const isDesktop = useIsDesktop();
  const [theme] = useTheme();
  const { canInstall, install } = useInstallPrompt();
  // A device where PIN sign-in was turned on opens on the PIN pad
  const [pinDevice, setPinDevice] = useState(readPinDevice);
  const [usePassword, setUsePassword] = useState(false);
  const [pin, setPin] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: readPinDevice()?.login ?? lastLogin() ?? '' },
  });

  /** Runs once the second factor has passed: store the session and go in. */
  const finishSignIn = async (result: AuthResult) => {
    setSigningIn(true);
    setAuth(result.accessToken, result.user);
    rememberLastName(result.user.fullName);
    // Invalidate first so dashboard bootstrap has fresh data, then go to loading/success
    await queryClient.invalidateQueries();
    try {
      const businesses = await businessesApi.mine();
      setBusinesses(businesses);
      const redirect = '/dashboard';
      navigate('/auth-success', {
        replace: true,
        state: { redirectTo: redirect, subtitle: 'Welcome back!' },
      });
    } catch {
      navigate('/auth-success', {
        replace: true,
        state: {
          redirectTo: '/dashboard',
          subtitle: 'Welcome back!',
        },
      });
    }
  };

  const restart = () => {
    setChallenge(null);
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      authApi.login(values.identifier, values.password),
    onSuccess: (result, values) => {
      rememberLastLogin(values.identifier);
      if ('accessToken' in result) void finishSignIn(result);
      else setChallenge(result);
    },
    // Raised the moment they press Sign in, not while they are still typing:
    // the picture only comes out when the details themselves were wrong
    onError: (err) => {
      if (err instanceof ApiErrorShape && err.code === 'INVALID_CREDENTIALS') {
        notifyError('Invalid Details', apiErrorMessage(err), {
          tone: 'dark',
          illustration: <InvalidDetailsArt />,
          actionLabel: 'Okay',
          duration: null,
        });
        return;
      }
      notifyError('Could not sign in', apiErrorMessage(err), { tone: 'dark', actionLabel: 'Okay' });
    },
  });

  const pinMutation = useMutation({
    mutationFn: (pin: string) => authApi.pinLogin(pinDevice!.deviceId, pinDevice!.deviceToken, pin),
    onSuccess: (result) => void finishSignIn(result),
    onError: (err) => {
      setPin('');
      const code = err instanceof ApiErrorShape ? err.code : '';
      if (code === 'DEVICE_NOT_RECOGNISED') {
        // PIN sign-in was turned off for this device (e.g. a new temporary password)
        clearPinDevice();
        setPinDevice(null);
      } else if (code === 'PIN_LOCKED') {
        setUsePassword(true);
      }
      notifyError(code === 'WRONG_PIN' ? 'Wrong PIN' : 'Could not sign in', apiErrorMessage(err), {
        tone: 'dark',
        actionLabel: 'Okay',
      });
    },
  });

  /** "Not you?": forget this device so the next person signs in with their own details. */
  const forgetDevice = () => {
    if (pinDevice) void authApi.pinForget(pinDevice.deviceId, pinDevice.deviceToken).catch(() => undefined);
    clearPinDevice();
    setPinDevice(null);
  };

  // Phone sign-in shows the photo right up behind the status bar (same as the home page)
  usePhotoStatusBar(!isDesktop && !challenge);
  // In the Android app the status bar is hidden on the login page, so the photo
  // fills the whole screen; it comes back as soon as the page closes
  useHiddenStatusBar(!isDesktop);

  // Strict flow: login -> loading/success -> dashboard. Don't jump to dashboard
  // ahead of success page — only redirect if already authenticated before this visit.
  const signingInNow = mutation.isPending || mutation.isSuccess || pinMutation.isPending || pinMutation.isSuccess;
  if (token && !signingInNow) return <Navigate to="/dashboard" replace />;

  if (challenge) {
    const title = 'Two-step verification';
    const subtitle = `Enter the code from your authenticator app for ${challenge.email}`;
    return (
      <AuthLayout
        title={title}
        desktopTitle={title}
        mobileTitle={title}
        subtitle={subtitle}
        desktopSubtitle={subtitle}
        hideLabelsOnMobile
        hideMobileFooter
      >
        <TwoFactorVerify
          mfaToken={challenge.mfaToken}
          onSignedIn={(result) => void finishSignIn(result)}
          onRestart={restart}
          onVerifying={setVerifying}
        />
        {(verifying || signingIn) && <WorkspaceLoader />}
      </AuthLayout>
    );
  }

  // On phones both sign-in forms sit on the same dark frosted panel, so the
  // username form looks like the M-PIN one
  const pinPanel = !isDesktop;
  const panelClass = 'rounded-3xl bg-black/60 px-4 pb-4 pt-6 backdrop-blur-md [&_.auth-link]:!text-[#9BD84F]';

  const form = (
      <form
        className={'flex flex-col gap-4 ' + (pinPanel ? panelClass : '')}
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <div>
          <Label htmlFor="email">Username or email</Label>
          <div className="relative">
            <Input
              id="email"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Username or email"
              aria-invalid={errors.identifier ? true : undefined}
              className="h-12 pl-12 pr-5 text-sm rounded-full"
              {...register('identifier')}
            />
            <Mail className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden />
          </div>
          {errors.identifier && (
            <p className="mt-1 text-xs font-medium text-danger">{errors.identifier.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Password"
              aria-invalid={errors.password ? true : undefined}
              className="h-12 pl-12 pr-12 text-sm rounded-full"
              {...register('password')}
            />
            <Lock className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden />
          </div>
          {errors.password && (
            <p className="mt-1 text-xs font-medium text-danger">
              {errors.password.message}
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            data-keep-color
            onClick={() => navigate('/forgot-password')}
            className="auth-link text-sm font-medium text-[#2F7F81] hover:text-[#256A6C]"
          >
            Forgot password?
          </button>
        </div>
        <Button
          type="submit"
          data-keep-color
          className="h-14 w-full rounded-2xl text-[20px] font-medium !text-white shadow-none transition-colors bg-[#3A8F91] hover:bg-[#2F7F81] active:bg-[#2F7F81]"
          size="lg"
          loading={mutation.isPending}
        >
          Sign in
        </Button>
        {signingIn && <WorkspaceLoader />}

      </form>
  );

  // Like the Co-op Bank app: a device with PIN sign-in opens on M-PIN, with
  // Username (username or email and password) one tap away
  const sheetDark = !isDesktop && theme === 'dark';
  const linkClass = 'auth-link text-sm font-medium !text-[#2F7F81] hover:!text-[#256A6C]';
  const tab = (active: boolean) =>
    'h-11 flex-1 rounded-full text-[15px] font-semibold transition-colors ' +
    (active
      ? '!text-white bg-gradient-to-b from-[#8BC53F] to-[#6C9E2A] shadow-sm'
      : sheetDark
        ? '!text-white/85 hover:!text-white'
        : '!text-slate-700 hover:!text-slate-900');

  const submitPin = () => {
    if (pin.length === 4 && !pinMutation.isPending) pinMutation.mutate(pin);
  };

  const forgotPin = () => {
    setUsePassword(true);
    notifyInfo(
      'Forgot your M-PIN?',
      'Sign in with your username and password, then set a new PIN under Profile → PIN.',
      { tone: 'dark', actionLabel: 'Okay' },
    );
  };

  // On phones the PIN sits on a dark frosted panel so the boxes stay clear over the photo
  const pinView = pinDevice ? (
    <div className={'flex flex-col gap-6 ' + (pinPanel ? panelClass : '')}>
      <PinBoxes
        value={pin}
        onChange={setPin}
        onSubmit={submitPin}
        dark={pinPanel}
        disabled={pinMutation.isPending || signingIn}
      />
      <Button
        type="button"
        data-keep-color
        onClick={submitPin}
        disabled={pin.length < 4}
        loading={pinMutation.isPending}
        className="h-14 w-full rounded-2xl text-[20px] font-medium !text-white shadow-none transition-colors bg-[#3A8F91] hover:bg-[#2F7F81] active:bg-[#2F7F81] disabled:opacity-60"
        size="lg"
      >
        Login
      </Button>
      <div className="flex items-center justify-between">
        <button type="button" data-keep-color onClick={forgotPin} className={linkClass}>
          Forgot M-PIN?
        </button>
        <button type="button" data-keep-color onClick={forgetDevice} className={linkClass}>
          Not you?
        </button>
      </div>
      {signingIn && <WorkspaceLoader />}
    </div>
  ) : null;

  const signIn = pinView ? (
    <>
      <div
        role="tablist"
        aria-label="Sign in with"
        className={'mb-6 flex gap-2 rounded-full p-1 ' + (sheetDark ? 'bg-white/10' : 'bg-white/70')}
      >
        <button type="button" role="tab" data-keep-color aria-selected={!usePassword} onClick={() => setUsePassword(false)} className={tab(!usePassword)}>
          M-PIN
        </button>
        <button type="button" role="tab" data-keep-color aria-selected={usePassword} onClick={() => setUsePassword(true)} className={tab(usePassword)}>
          Username
        </button>
      </div>
      {usePassword ? form : pinView}
    </>
  ) : (
    form
  );

  /** "Welcome back Felix" on a device that knows the person, as on a banking app. */
  // The PIN device's owner, else whoever last signed in on this device
  const firstName = (pinDevice?.fullName ?? lastName() ?? '').trim().split(/\s+/)[0];
  const welcome = firstName ? `Welcome back ${firstName}` : 'Welcome back!';

  const installAppButton = canInstall ? (
    <button
      type="button"
      onClick={() => void install()}
      className={
        'mx-auto mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-medium shadow-sm ' +
        (!isDesktop && theme === 'dark'
          ? 'border-white/45 bg-black/20 text-white'
          : 'border-[#3A8F91]/45 bg-white/75 text-slate-700')
      }
    >
      <Download className="h-4 w-4" aria-hidden />
      Install Knoxville app
    </button>
  ) : null;

  // Phones: photo header with the logo, and a sheet holding the form. The sheet
  // follows the chosen theme and its fields match the Statement / Deposit pills
  // on the subscriber dashboard.
  if (!isDesktop) {
    const dark = theme === 'dark';
    return (
      <div className="relative flex min-h-[100dvh] flex-col bg-white">
        {/* Photo covers the whole screen, from under the status bar down behind the sheet */}
        <HomePhoto featured className="fixed inset-0 h-full w-full object-cover" />
        <div className="relative flex min-h-[200px] w-full flex-1 items-center justify-center pb-10 pt-[var(--sat)]">
          {/* Back to the home page, sitting on the photo just above the sheet (while home is shown) */}
          {SHOW_MOBILE_HOME && <Link
            to="/"
            aria-label="Back to home"
            className="absolute bottom-4 left-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur-sm transition-transform active:scale-90"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>}
        </div>
        <main
          className={
            'relative flex shrink-0 flex-col rounded-t-3xl px-5 pb-[max(1.5rem,var(--sab))] pt-3 ' +
            (dark
              ? 'border-t border-white/15 bg-gradient-to-b from-black/70 via-black/45 to-black/75 text-white shadow-[0_-10px_24px_rgba(0,0,0,0.45)]'
              : 'bg-white/55 text-slate-900 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]')
          }
        >
          <div className={dark ? 'mx-auto h-1 w-12 rounded-full bg-white/40' : 'mx-auto h-1 w-12 rounded-full bg-slate-400'} aria-hidden />
          <h1 className={dark ? 'mt-5 text-center text-[22px] font-semibold tracking-tight text-white' : 'mt-5 text-center text-[22px] font-semibold tracking-tight text-slate-900'}>
            {welcome}
          </h1>
          <p className={dark ? 'mb-6 mt-1 text-center text-sm text-white/70' : 'mb-6 mt-1 text-center text-sm text-slate-700'}>
            Sign in to your Knoxville account.
          </p>
          {/* Fields drawn like the M-PIN boxes: clear, thin white outline, green when active */}
          <div className="login-dark-fields login-clear-fields mt-6 [&_input]:!h-14 [&_input]:!rounded-xl [&_input]:!border-2 [&_input]:!border-white/80 [&_input]:!bg-transparent [&_input]:!text-white [&_input]:!shadow-none [&_input]:placeholder:!text-white/60 [&_input:focus]:!border-[#8BC53F] [&_input:focus]:!ring-0 [&_button:not([data-keep-color])]:!text-white/70 [&_.text-danger]:!text-red-300 [&_label]:sr-only">
            {signIn}
          </div>
          {installAppButton}
        </main>
      </div>
    );
  }

  return (
    <AuthLayout
      title={welcome}
      mobileTitle={welcome}
      hideLabelsOnMobile
      hideMobileFooter
      hideFooterLinks
      forceMobileLayout
      centerTitle
      subtitle="Sign in to your Knoxville account."
    >
      <>
        {signIn}
        {installAppButton}
      </>
    </AuthLayout>
  );
}

