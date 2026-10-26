import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { Check, Copy, Download, ExternalLink, KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { authApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { AuthResult, TwoFactorSetup } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { cn } from '@/lib/utils';

/* White card so the steps read the same on the phone and desktop sign-in screens. */
const card = 'rounded-2xl border border-slate-200 bg-white p-5 text-left text-slate-800';
/** Same button as the phone sign-in page: tall, green, softly rounded. */
const primaryButton =
  'h-14 w-full rounded-2xl bg-brand-600 text-[18px] font-medium text-white shadow-none hover:bg-brand-700 active:bg-brand-700 disabled:bg-[#BFC1C3] disabled:opacity-100';
/** Body copy: solid dark grey at a readable size (the pale 13px text looked blurry). */
const body = 'text-[14px] leading-relaxed text-slate-700';

/** Shows the setup key in groups of four so it's easy to type. */
function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Same as the phone "Sign in" button (teal, 20px), and the charcoal pill on desktop. */
const signInButton =
  'h-14 w-full rounded-2xl bg-[#3A8F91] text-[20px] font-medium text-white shadow-none transition-colors hover:bg-[#2F7F81] active:bg-[#2F7F81] max-lg:fixed max-lg:inset-x-6 max-lg:bottom-[calc(4rem+var(--sab))] max-lg:z-10 max-lg:mx-auto max-lg:w-auto max-lg:max-w-sm lg:h-12 lg:rounded-full lg:bg-[#4a4a4a] lg:text-base lg:font-bold lg:uppercase lg:tracking-wide lg:shadow-lg lg:shadow-neutral-900/20 lg:hover:bg-[#3a3a3a]';

/** One wave across the boxes once all six digits are in, before checking the code. */
const WAVE_STAGGER = 0.07;
const WAVE_DURATION = 0.42;
const WAVE_MS = Math.round((5 * WAVE_STAGGER + WAVE_DURATION) * 1000);

/**
 * Six boxes, one per digit. A single invisible input sits on top so typing,
 * pasting and the phone's "fill code" suggestion all work. Digits pop in,
 * the current box glows with a blinking caret, a wave runs across the row
 * when the code is complete, and the row shakes on a wrong code (bump
 * `shake` to trigger it).
 */
function CodeField({
  value,
  onChange,
  onComplete,
  disabled,
  shake = 0,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  disabled?: boolean;
  shake?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const controls = useAnimationControls();
  const wave = useAnimationControls();
  const waveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!shake) return;
    void controls.start({ x: [0, -12, 12, -8, 8, -4, 4, 0], transition: { duration: 0.45 } });
    inputRef.current?.focus();
  }, [shake, controls]);

  useEffect(() => () => window.clearTimeout(waveTimer.current), []);

  const active = Math.min(value.length, 5);

  return (
    <div>
      <Label htmlFor="otp">6-digit code</Label>
      <motion.div animate={controls} className="relative" onClick={() => inputRef.current?.focus()}>
        <input
          ref={inputRef}
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus
          value={value}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
            onChange(digits);
            window.clearTimeout(waveTimer.current);
            if (digits.length === 6) {
              // Typed or pasted: let the wave finish, then check the code
              void wave.start((i: number) => ({
                y: [0, -10, 0],
                scale: [1, 1.08, 1],
                transition: { delay: i * WAVE_STAGGER, duration: WAVE_DURATION, ease: 'easeInOut' },
              }));
              waveTimer.current = window.setTimeout(() => onComplete(digits), WAVE_MS);
            }
          }}
          aria-label="6-digit code"
          // Invisible but on top, so taps and paste land here
          className="absolute inset-0 z-10 h-full w-full cursor-text !opacity-0 caret-transparent"
        />
        {/* Fixed square boxes, centred: they no longer stretch to the screen width */}
        <div className="flex justify-center gap-2" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => {
            const digit = value[i];
            const isActive = focused && !disabled && i === active && value.length < 6;
            return (
              <motion.div
                key={i}
                custom={i}
                animate={wave}
                className={cn(
                  'relative flex h-14 w-11 shrink-0 items-center min-[380px]:w-12 justify-center rounded-2xl border-2 bg-white text-[28px] font-medium tabular-nums text-slate-800 transition-colors',
                  isActive ? 'border-brand-600' : digit ? 'border-brand-200' : 'border-slate-200',
                  disabled && 'opacity-60',
                )}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {digit && (
                    <motion.span
                      key={digit + i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {digit}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.span
                    className="absolute h-6 w-0.5 rounded-full bg-brand-600"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Every sign-in after setup: enter the app code (or a recovery code) */
/* ------------------------------------------------------------------ */

export function TwoFactorVerify({
  mfaToken,
  onSignedIn,
  onRestart,
  onVerifying,
}: {
  mfaToken: string;
  onSignedIn: (result: AuthResult) => void;
  onRestart: () => void;
  /** Told when checking the code starts, and when it fails (to show the loader). */
  onVerifying?: (verifying: boolean) => void;
}) {
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async (value: string) => {
    if (pending || !value.trim()) return;
    setPending(true);
    setError(null);
    onVerifying?.(true);
    try {
      onSignedIn(await authApi.twoFactorVerify(mfaToken, value));
    } catch (err) {
      onVerifying?.(false);
      setError(apiErrorMessage(err));
      setCode('');
      setShake((n) => n + 1);
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(code);
      }}
      noValidate
    >
      {useRecovery && (
        <div className={cn(card, 'flex items-center gap-3')}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <p className={body}>
            Enter one of the recovery codes you saved when you set up two-factor sign-in. Each works once.
          </p>
        </div>
      )}

      {error && <Alert variant="error" inline>{error}</Alert>}

      {useRecovery ? (
        <div>
          <Label htmlFor="recovery">Recovery code</Label>
          <Input
            id="recovery"
            autoFocus
            autoComplete="off"
            placeholder="xxxx-xxxx"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-12 rounded-full px-5 text-center font-mono text-sm tracking-widest"
          />
        </div>
      ) : (
        <CodeField value={code} onChange={setCode} onComplete={(v) => void submit(v)} disabled={pending} shake={shake} />
      )}

      <div className="flex items-center justify-between text-sm lg:order-last">
        <button
          type="button"
          className="auth-link font-medium text-[#2F7F81] hover:text-[#256A6C]"
          onClick={() => {
            setUseRecovery((v) => !v);
            setCode('');
            setError(null);
          }}
        >
          {useRecovery ? 'Use authenticator code' : 'Use a recovery code'}
        </button>
        <button type="button" className="auth-link font-medium text-slate-600" onClick={onRestart}>
          Start over
        </button>
      </div>

      {/* Matches the Sign in button; empty codes are ignored in submit() */}
      <Button type="submit" size="lg" className={signInButton} loading={pending}>
        Verify and continue
      </Button>
    </form>
  );
}

/* ---------------------------------------------------------------- */
/* Settings: connect an authenticator app (optional, user's choice) */
/* ---------------------------------------------------------------- */

export function TwoFactorSetupStep({
  start,
  enable,
  onEnabled,
  onRestart,
  restartLabel = 'Cancel',
}: {
  /** Gets a fresh secret to add to the app. */
  start: () => Promise<TwoFactorSetup>;
  /** Confirms the first code; resolves with the recovery codes. */
  enable: (code: string) => Promise<{ recoveryCodes: string[] }>;
  onEnabled: (recoveryCodes: string[]) => void;
  onRestart: () => void;
  restartLabel?: string;
}) {
  const isDesktop = useIsDesktop();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [shake, setShake] = useState(0);
  const [copied, setCopied] = useState(false);
  // Phones: the code entry appears once they've gone to the authenticator app
  // (or copied the key). Desktop scans the QR code, so it's there from the start.
  const [readyForCode, setReadyForCode] = useState(isDesktop);
  const started = useRef(false);

  // Ask for the secret exactly once (a second request would replace it)
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start()
      .then(async (data) => {
        setSetup(data);
        setQr(await QRCode.toDataURL(data.otpauthUrl, { margin: 1, width: 440, color: { dark: '#1E1E1E', light: '#FFFFFF' } }));
      })
      .catch((err) => setLoadError(apiErrorMessage(err)));
    // Runs once: a second request would replace the secret
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (value: string) => {
    if (pending || value.length !== 6) return;
    setPending(true);
    setError(null);
    try {
      onEnabled((await enable(value)).recoveryCodes);
    } catch (err) {
      setError(apiErrorMessage(err));
      setCode('');
      setShake((n) => n + 1);
    } finally {
      setPending(false);
    }
  };

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="error" inline>{loadError}</Alert>
        <Button className={primaryButton} onClick={onRestart}>
          {restartLabel}
        </Button>
      </div>
    );
  }

  const keyBlock = setup && (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-600">Setup key</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-[13px] font-semibold text-slate-800">{groupKey(setup.secret)}</code>
        <button
          type="button"
          onClick={async () => {
            setReadyForCode(true);
            if (await copyText(setup.secret)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            }
          }}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-sm active:scale-95"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-1.5 text-[12px] text-slate-600">Account: {setup.account} · Time-based</p>
    </div>
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(code);
      }}
      noValidate
    >
      {/* Phones: straight on the white page. Desktop keeps the card for contrast on the photo */}
      <div className={cn(card, 'max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:p-0 max-lg:shadow-none')}>
        {/* Step 1 */}
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">1</span>
          <p className={body}>
            Install <strong className="text-slate-800">Google Authenticator</strong> or{' '}
            <strong className="text-slate-800">Microsoft Authenticator</strong> on your phone.
          </p>
        </div>

        {/* Step 2 */}
        <div className="mt-4 flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">2</span>
          <div className="min-w-0 flex-1 space-y-3">
            {isDesktop ? (
              <>
                <p className={body}>
                  In the app, tap <strong className="text-slate-800">+</strong> then{' '}
                  <strong className="text-slate-800">Scan a QR code</strong>, and point your phone at this code.
                </p>
                <div className="flex justify-center">
                  {qr ? (
                    <motion.img
                      src={qr}
                      alt="QR code to add Knoxville to your authenticator app"
                      className="h-48 w-48 rounded-xl border border-slate-100"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    />
                  ) : (
                    <Skeleton className="h-48 w-48 rounded-xl" />
                  )}
                </div>
                <details className="text-[13px] text-slate-600">
                  <summary className="cursor-pointer font-medium text-slate-700">Can’t scan? Enter a key instead</summary>
                  <div className="mt-2">{keyBlock}</div>
                </details>
              </>
            ) : (
              <>
                <p className={body}>
                  Tap the button to add Knoxville to your authenticator app. If nothing opens, copy the key and add it in
                  the app with <strong className="text-slate-800">Enter a setup key</strong>.
                </p>
                {setup ? (
                  <a
                    href={setup.otpauthUrl}
                    onClick={() => setReadyForCode(true)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white active:bg-brand-700"
                  >
                    <Smartphone className="h-4 w-4" aria-hidden />
                    Open authenticator app
                    <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
                  </a>
                ) : (
                  <Skeleton className="h-12 w-full rounded-2xl" />
                )}
                {keyBlock ?? <Skeleton className="h-20 w-full rounded-xl" />}
              </>
            )}
          </div>
        </div>

        {/* Step 3 */}
        <div className="mt-4 flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">3</span>
          <p className={body}>Enter the 6-digit code the app shows for Knoxville.</p>
        </div>
      </div>

      {error && <Alert variant="error" inline>{error}</Alert>}

      <AnimatePresence initial={false}>
        {(readyForCode || isDesktop) && (
          <motion.div
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 16, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <CodeField value={code} onChange={setCode} onComplete={(v) => void submit(v)} disabled={pending || !setup} shake={shake} />
            <Button type="submit" size="lg" className={primaryButton} loading={pending} disabled={code.length !== 6 || !setup}>
              Turn on two-factor sign-in
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <button type="button" className="auth-link self-center text-sm font-medium text-slate-600" onClick={onRestart}>
        {restartLabel}
      </button>
    </form>
  );
}

/* --------------------------------------------------------------- */
/* After setup: recovery codes, shown once, must be saved          */
/* --------------------------------------------------------------- */

export function RecoveryCodes({
  codes,
  onContinue,
  continueLabel = 'Continue to Knoxville',
}: {
  codes: string[];
  onContinue: () => void;
  continueLabel?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `Knoxville recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join('\n')}\n`;

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knoxville-recovery-codes.txt';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <KeyRound className="h-5 w-5" aria-hidden />
          </span>
          <p className={body}>
            If you lose your phone, sign in with one of these codes. Each works <strong className="text-slate-800">once</strong>.
            They won’t be shown again.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {codes.map((c, i) => (
            <motion.code
              key={c}
              className="rounded-lg bg-slate-50 px-2 py-2 text-center font-mono text-[14px] font-semibold tracking-wider text-slate-800"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              {c}
            </motion.code>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={async () => {
              if (await copyText(text)) {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }
            }}
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy all'}
          </Button>
          <Button type="button" variant="outline" className="h-10" onClick={download}>
            <Download className="h-4 w-4" aria-hidden />
            Download
          </Button>
        </div>
      </div>

      {/* A button, not a native checkbox: the sign-in layout restyles every input and hides labels */}
      <button
        type="button"
        role="checkbox"
        aria-checked={saved}
        onClick={() => setSaved((v) => !v)}
        className={cn(card, 'flex items-center gap-3 py-4')}
      >
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
            saved ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white',
          )}
          aria-hidden
        >
          {saved && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
        <span className="text-[14px] font-medium text-slate-800">I’ve saved my recovery codes somewhere safe</span>
      </button>

      <Button size="lg" className={primaryButton} disabled={!saved} onClick={onContinue}>
        {continueLabel}
      </Button>
    </div>
  );
}
