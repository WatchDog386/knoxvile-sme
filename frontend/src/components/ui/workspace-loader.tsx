import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { overrideStatusBarColor } from '@/lib/theme';
import { Brand } from '@/components/layout/brand';

/** Status lines shown in turn while signing in and loading the dashboard. */
const STEPS = [
  'Please wait…',
  'Verifying…',
  'Signing you in…',
  'Preparing your workspace…',
  'Loading your dashboard…',
  'Almost there…',
];
const STEP_MS = 1300;

/*
 * Signing in passes through several screens that each show this loader
 * (verify, sign-in success, workspace, dashboard data). Remember when it
 * started so each new mount carries on from the same status line: on screen
 * it is one continuous loader.
 */
let startedAt = 0;
let hiddenAt = 0;

/** How long the sign-in loader has been on screen, in milliseconds. */
export function loaderElapsed(): number {
  return startedAt ? Date.now() - startedAt : 0;
}

/**
 * Advanced version of the KUCCPS speeding wheel: the original ring (top and
 * bottom arcs in Knoxville navy, sides clear, spinning fast) with a green outer
 * ring turning the other way and a pulsing centre.
 */
/** `light` keeps the light-mode colours even in dark mode (the full-screen loader). */
export function SpeedWheel({ light = false }: { light?: boolean }) {
  const dk = (cls: string) => (light ? '' : ' ' + cls);
  return (
    <span className="relative flex h-[58px] w-[58px] items-center justify-center" aria-hidden>
      <style>{`
        @keyframes knoxville-wheel { to { transform: rotate(360deg); } }
        @keyframes knoxville-wheel-back { to { transform: rotate(-360deg); } }
        @keyframes knoxville-core { 0%, 100% { transform: scale(0.7); opacity: 0.55; } 50% { transform: scale(1); opacity: 1; } }
      `}</style>
      {/* Faint track */}
      <span className={'absolute inset-0 rounded-full border-2 border-[#0F2341]/[0.07]' + dk('[.dark_&]:border-white/[0.08]')} />
      {/* Outer ring: green left and right arcs, turning the other way */}
      <span
        className="absolute inset-0 rounded-full border-2 border-[#56A01B] border-y-transparent"
        style={{ animation: 'knoxville-wheel-back 900ms linear infinite' }}
      />
      {/* The original speeding wheel */}
      <span
        className={'absolute inset-[9px] rounded-full border-[2.5px] border-[#0F2341] border-x-transparent' + dk('[.dark_&]:border-[#5B8CFF] [.dark_&]:border-x-transparent')}
        style={{ animation: 'knoxville-wheel 425ms linear infinite' }}
      />
      {/* Pulsing centre */}
      <span
        className={'h-2 w-2 rounded-full bg-[#0F2341]' + dk('[.dark_&]:bg-[#5B8CFF]')}
        style={{ animation: 'knoxville-core 1.1s ease-in-out infinite' }}
      />
    </span>
  );
}

/**
 * Full-screen loader from "Verify and continue" until the dashboard is ready.
 * White screen with the Knoxville mark while signing in and loading the workspace.
 */
export function WorkspaceLoader() {
  const [now, setNow] = useState(() => {
    // Once per mount: a fresh start unless the previous loader just closed
    if (startedAt === 0 || Date.now() - hiddenAt > 600) startedAt = Date.now();
    return Date.now() - startedAt;
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() - startedAt), 150);
    return () => {
      window.clearInterval(timer);
      hiddenAt = Date.now();
    };
  }, []);

  // A white screen while signing in, with the status bar to match
  useEffect(() => overrideStatusBarColor('#FFFFFF'), []);

  const step = Math.min(STEPS.length - 1, Math.floor(now / STEP_MS));

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[99] flex flex-col items-center justify-center bg-white text-slate-900"
    >
      <Brand size="xl" compact />
      <div className="mt-6 flex h-7 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={step}
            className="text-[17px] font-medium text-slate-700"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {STEPS[step]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}

/** Set by the sign-in page just before it opens the dashboard. */
let revealPending = false;

/** Asks for the sign-in loader to fade away over the next page instead of vanishing. */
export function markSignInReveal() {
  revealPending = true;
}

/**
 * Mounted once at the app root. Right after sign-in it draws the same white
 * loading screen over the freshly opened dashboard and fades it out, so the
 * dashboard appears smoothly rather than snapping into place.
 */
export function SignInReveal() {
  const [phase, setPhase] = useState<'idle' | 'showing' | 'fading'>('idle');

  useEffect(() => {
    const check = window.setInterval(() => {
      if (!revealPending) return;
      revealPending = false;
      setPhase('showing');
    }, 50);
    return () => window.clearInterval(check);
  }, []);

  useEffect(() => {
    if (phase === 'idle') return;
    const restore = overrideStatusBarColor('#FFFFFF');
    if (phase === 'showing') {
      // Fade only once nothing underneath is still loading, so it uncovers a
      // finished dashboard (never longer than 4 s, whatever happens)
      const startedShowing = Date.now();
      let settledSince = 0;
      const t = window.setInterval(() => {
        const loading = document.querySelector('[role="status"][aria-live="polite"].fixed');
        const now = Date.now();
        settledSince = loading ? 0 : settledSince || now;
        if ((settledSince && now - settledSince >= 150) || now - startedShowing > 4000) setPhase('fading');
      }, 50);
      return () => {
        window.clearInterval(t);
        restore();
      };
    }
    const t = window.setTimeout(() => setPhase('idle'), 650);
    return () => {
      window.clearTimeout(t);
      restore();
    };
  }, [phase]);

  if (phase === 'idle') return null;
  return createPortal(
    <div
      aria-hidden
      className={
        'pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white transition-opacity duration-500 ease-out ' +
        (phase === 'fading' ? 'opacity-0' : 'opacity-100')
      }
    >
      <Brand size="xl" compact />
      <p className="mt-6 h-7 text-[17px] font-medium text-slate-700">{STEPS[STEPS.length - 1]}</p>
    </div>,
    document.body,
  );
}
