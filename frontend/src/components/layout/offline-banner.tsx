import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Wifi, WifiOff } from 'lucide-react';

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** Snackbar-style notice when the connection drops, and briefly when it returns. */
export function OfflineBanner() {
  const online = useOnline();
  const [showBack, setShowBack] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      return;
    }
    if (!wasOffline) return;
    setShowBack(true);
    const timer = window.setTimeout(() => {
      setShowBack(false);
      setWasOffline(false);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [online, wasOffline]);

  const visible = !online || showBack;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,var(--sat))]"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
          <div
            className={
              online
                ? 'flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-lg'
                : 'flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg'
            }
          >
            {online ? <Wifi className="h-4 w-4" aria-hidden /> : <WifiOff className="h-4 w-4" aria-hidden />}
            {online ? 'Back online' : "You're offline — changes will fail until you reconnect"}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
