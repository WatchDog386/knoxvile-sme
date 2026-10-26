import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Home } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

/** Unknown links land here instead of silently bouncing to the start. */
export function NotFoundPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <div className="relative h-[46%] overflow-hidden">
        {/* Unsplash photo, bundled in public/images */}
        <motion.img
          src="/images/not-found.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-900/40 to-white" aria-hidden />
      </div>

      <motion.div
        className="relative -mt-16 flex flex-1 flex-col items-center px-8 text-center"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 26 }}
      >
        <p className="text-7xl font-bold tracking-tighter text-brand-600">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">This page has moved out</h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
          The link may be old or mistyped. Head back and carry on where you left off.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3 pb-[max(1.5rem,var(--sab))]">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(token ? '/dashboard' : '/', { replace: true })}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand-600 text-sm font-medium text-white shadow-lg shadow-brand-600/30"
          >
            <Home className="h-4 w-4" aria-hidden />
            {token ? 'Go to dashboard' : 'Go to start'}
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(-1)}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-slate-100 text-sm font-medium text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Go back
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
