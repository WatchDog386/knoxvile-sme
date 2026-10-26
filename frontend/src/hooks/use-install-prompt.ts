import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The browser fires this once per page load, possibly before this code loads:
// index.html keeps an early one on window.__installPromptEvent
let deferred: BeforeInstallPromptEvent | null =
  typeof window !== 'undefined'
    ? ((window as Window & { __installPromptEvent?: BeforeInstallPromptEvent }).__installPromptEvent ?? null)
    : null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((fn) => fn());
  });
}

/** Offers "Install app" when the browser allows installing Knoxville (Chrome/Edge, Android). */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(Boolean(deferred));

  useEffect(() => {
    const update = () => setCanInstall(Boolean(deferred));
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const install = async () => {
    const promptEvent = deferred;
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      // Browsers can revoke install eligibility before the user taps the button.
    } finally {
      if (deferred === promptEvent) {
        deferred = null;
        listeners.forEach((fn) => fn());
      }
    }
  };

  return { canInstall, install };
}
