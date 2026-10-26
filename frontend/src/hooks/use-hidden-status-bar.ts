import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

/**
 * Hides the phone's status bar (clock, battery) while the page is open, in the
 * Android app only, and shows it again when the page closes. Browsers cannot
 * hide it, so on the web this does nothing.
 */
export function useHiddenStatusBar(enabled = true) {
  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return;
    void StatusBar.hide().catch(() => undefined);
    return () => {
      void StatusBar.show().catch(() => undefined);
    };
  }, [enabled]);
}
