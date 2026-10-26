import { Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigationType, useOutlet } from 'react-router-dom';
import { SpeedWheel } from '@/components/ui/workspace-loader';

/** How long the loader stays up before the next screen is revealed. */
const LOADING_MS = 420;

/** Full-screen loader shown while the app moves to another page. */
function RouteLoader() {
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-white [.dark_&]:bg-[#121212]"
    >
      <SpeedWheel />
    </div>,
    document.body,
  );
}

/**
 * Route content with an app-style entrance: on phones the new screen arrives
 * behind a short loader instead of sliding in, so it never appears half-drawn.
 */
export function AnimatedOutlet() {
  const outlet = useOutlet();
  const location = useLocation();
  const navigationType = useNavigationType();
  const back = navigationType === 'POP';
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  // New screens start at the top, like a native app
  useEffect(() => {
    if (!back) window.scrollTo({ top: 0 });
  }, [location.pathname, back]);

  // Every move to another page shows the loader first; the screen behind it is
  // already mounted and loaded, so it opens the moment the loader lifts
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), LOADING_MS);
    return () => window.clearTimeout(timer);
  }, [location.key]);

  return (
    <>
      <div className={loading ? 'invisible' : 'animate-fade-in'} aria-hidden={loading || undefined}>
        <Suspense fallback={<RouteChunkFallback />}>{outlet}</Suspense>
      </div>
      {loading && <RouteLoader />}
    </>
  );
}

function RouteChunkFallback() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center px-6 text-sm text-foreground-4">
      Loading page…
    </div>
  );
}
