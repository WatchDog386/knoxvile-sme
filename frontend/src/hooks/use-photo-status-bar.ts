import { useEffect } from 'react';
import { scheduleSample } from '@/lib/theme';

/**
 * Full-screen photo pages (home, login, help). The Android app draws the
 * photo right up behind the status bar. In a browser the bar can't show the
 * photo, so lib/theme.ts colours it from the photo's top edge, the same way
 * every page's bar follows its header; this just asks for a fresh reading.
 */
export function usePhotoStatusBar(enabled = true): void {
  useEffect(() => {
    if (enabled) scheduleSample();
  }, [enabled]);
}
