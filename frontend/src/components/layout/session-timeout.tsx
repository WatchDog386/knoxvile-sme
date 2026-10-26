import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hourglass, LogIn } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

/** Idle time before the prompt appears, and the countdown shown on it. */
const IDLE_MS = 5 * 60 * 1000;
const COUNTDOWN_MS = 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
const LOGOUT_REQUEST = 'knoxville:request-logout';

/** Opens the log-out confirmation popup. Used by every Log Out button. */
export function requestLogout() {
  window.dispatchEvent(new Event(LOGOUT_REQUEST));
}

/**
 * Signed-in users see a "Stay logged in?" popup after 5 minutes without screen activity,
 * with a 60-second countdown. The same popup opens for Log Out buttons, asking to confirm.
 * Continue keeps the session; Log Out, or the countdown running out, signs out.
 */
export function SessionTimeout() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const lastActive = useRef(Date.now());
  // Set only while a countdown prompt is showing: the time the user is signed out
  const deadline = useRef(0);
  const [prompt, setPrompt] = useState<'idle' | 'confirm' | null>(null);
  const [now, setNow] = useState(Date.now());

  const signOut = () => {
    deadline.current = 0;
    setPrompt(null);
    logout();
    // Phones land on the mobile home page; desktop's "/" redirects to sign-in
    navigate('/', { replace: true });
  };

  useEffect(() => {
    if (!token) return;
    lastActive.current = Date.now();

    const onActivity = () => {
      if (!deadline.current) lastActive.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const onLogoutRequest = () => {
      // Confirm with the same popup; no countdown, so it waits for the user
      deadline.current = 0;
      setPrompt('confirm');
    };
    window.addEventListener(LOGOUT_REQUEST, onLogoutRequest);

    const tick = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (deadline.current) {
        if (t >= deadline.current) signOut();
      } else if (t - lastActive.current >= IDLE_MS) {
        deadline.current = t + COUNTDOWN_MS;
        setPrompt('idle');
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.removeEventListener(LOGOUT_REQUEST, onLogoutRequest);
      window.clearInterval(tick);
    };
    // signOut is recreated each render; the handlers only use stable store/router functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, logout, navigate]);

  if (!token || !prompt) return null;

  const seconds = Math.max(0, Math.ceil((deadline.current - now) / 1000));
  const confirming = prompt === 'confirm';

  const stay = () => {
    deadline.current = 0;
    lastActive.current = Date.now();
    setPrompt(null);
  };

  // Log Out button: light confirmation card
  if (confirming) {
    return (
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-5 animate-fade-in"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
      >
        <div className="w-full max-w-[340px] rounded-2xl bg-white px-6 pb-6 pt-6 text-center text-slate-900 shadow-2xl">
          <h2 id="logout-confirm-title" className="text-lg font-semibold">
            Log Out ?
          </h2>
          <LogIn className="mx-auto mt-6 h-20 w-20 text-[#7CB82F]" strokeWidth={1.6} aria-hidden />
          <p className="mt-6 text-[15px] text-slate-700">Are you sure you want to log out?</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={stay}
              className="h-12 rounded-xl border-2 border-[#7CB82F] bg-white text-[15px] font-medium text-slate-600 transition-transform active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={signOut}
              className="h-12 rounded-xl bg-[#7CB82F] text-[15px] font-medium text-white transition-transform active:scale-[0.98]"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-5 animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
    >
      <div className="w-full max-w-[340px] rounded-[28px] bg-black px-6 pb-6 pt-7 text-center text-white shadow-2xl">
        <div className="relative mx-auto h-14 w-14" aria-hidden>
          <motion.div
            className="h-14 w-14"
            animate={{ rotate: [0, 180, 180, 360] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 0.4, ease: [0.65, 0, 0.35, 1], times: [0, 0.35, 0.65, 1] }}
          >
            <Hourglass className="h-14 w-14 text-[#8BC53F]" strokeWidth={1.6} />
          </motion.div>
          {/* Sand stream falling through the neck; outside the rotating part so it always drops down */}
          <motion.span
            className="absolute left-1/2 top-[46%] h-2 w-[3px] -translate-x-1/2 rounded-full bg-[#8BC53F]"
            animate={{ y: [0, 9], opacity: [1, 1, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeIn', repeatDelay: 0.3 }}
          />
        </div>
        <h2 id="session-timeout-title" className="mt-4 text-[24px] font-semibold tracking-tight">
          {confirming ? 'Log out?' : 'Stay logged in?'}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/85">
          {confirming ? (
            'Are you sure you want to log out of your account?'
          ) : (
            <>
              Your session will time out in <strong className="font-bold text-white">{seconds} seconds</strong> to protect your account. Tap{' '}
              <strong className="font-bold text-white">Continue</strong> to stay logged in.
            </>
          )}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={signOut}
            className="h-14 rounded-2xl border-2 border-white text-[16px] font-medium text-white transition-transform active:scale-[0.98]"
          >
            Log Out
          </button>
          <button
            type="button"
            onClick={stay}
            className="h-14 rounded-2xl bg-[#8BC53F] text-[16px] font-medium text-white transition-transform active:scale-[0.98]"
          >
            {confirming ? 'Cancel' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
