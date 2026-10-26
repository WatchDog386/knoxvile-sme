import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share, SquarePlus, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/use-install-prompt';

const DISMISSED_KEY = 'ksa_install_prompt_dismissed_at';
/** After "Not now" the card stays away this long. */
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

function snoozed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) ?? 0) < SNOOZE_MS;
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Private mode: it just shows again next visit
  }
}

/** Already running as the installed app (home-screen icon or the Android APK). */
function runningAsApp(): boolean {
  return (
    Capacitor.isNativePlatform() ||
    window.matchMedia('(display-mode: standalone)').matches ||
    // Android home-screen installs open full screen (no status bar strip)
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const isPhone = () => window.matchMedia('(max-width: 1023px)').matches;
const isIosSafari = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);

/**
 * Opening Knoxville in a phone's browser offers to install it, like an app-store
 * prompt. Browsers never install silently: on Android one tap on Install
 * opens the browser's own install confirmation; iPhones don't allow that, so
 * Safari users get the two steps (Share, then Add to Home Screen).
 */
export function InstallAppPrompt() {
  const { canInstall, install } = useInstallPrompt();
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(false);

  // A short pause so the page settles before the card slides up
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  if (!ready || closed || runningAsApp() || !isPhone() || snoozed()) return null;
  const ios = isIosSafari();
  if (!canInstall && !ios) return null;

  const notNow = () => {
    snooze();
    setClosed(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-3 pb-[max(0.75rem,var(--sab))] animate-fade-in" role="dialog" aria-label="Install the Knoxville app">
      <div className="mx-auto max-w-md rounded-3xl bg-[#111112] p-5 text-white shadow-2xl ring-1 ring-white/10">
        <div className="flex items-start gap-4">
          <img src="/icons/launch-192.png" alt="" className="h-14 w-14 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold">Install the Knoxville app</p>
            <p className="mt-1 text-[13px] leading-relaxed text-white/75">
              Open it from your home screen, full screen and faster, like any other app.
            </p>
          </div>
          <button type="button" onClick={notNow} aria-label="Close" className="-mr-1 -mt-1 rounded-full p-1.5 text-white/60 hover:text-white">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {ios && !canInstall ? (
          <ol className="mt-4 space-y-2 rounded-2xl bg-white/5 p-4 text-[13px] text-white/85">
            <li className="flex items-center gap-2">
              1. Tap <Share className="h-4 w-4 text-[#8BC53F]" aria-label="Share" /> at the bottom of Safari
            </li>
            <li className="flex items-center gap-2">
              2. Choose <SquarePlus className="h-4 w-4 text-[#8BC53F]" aria-hidden /> <span className="font-semibold">Add to Home Screen</span>
            </li>
          </ol>
        ) : null}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={notNow}
            className="h-12 flex-1 rounded-2xl bg-white/10 text-[15px] font-medium text-white transition-transform active:scale-[0.98]"
          >
            Not now
          </button>
          {canInstall ? (
            <button
              type="button"
              onClick={() => {
                setClosed(true);
                void install();
              }}
              className="h-12 flex-1 rounded-2xl bg-gradient-to-b from-[#8BC53F] to-[#6C9E2A] text-[15px] font-semibold text-white transition-transform active:scale-[0.98]"
            >
              Install
            </button>
          ) : (
            <button
              type="button"
              onClick={notNow}
              className="h-12 flex-1 rounded-2xl bg-gradient-to-b from-[#8BC53F] to-[#6C9E2A] text-[15px] font-semibold text-white transition-transform active:scale-[0.98]"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
