import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Globe, MoreHorizontal, PhoneCall, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { Dialog } from '@/components/ui/dialog';
import { ONBOARDED_KEY } from './onboarding-state';

function markOnboarded() {
  try {
    localStorage.setItem(ONBOARDED_KEY, 'true');
  } catch {
    // Storage unavailable: the welcome page just shows again next time
  }
}

const SUPPORT_PHONE = '+254726818938';
const WEBSITE = 'https://knoxvilletechnologies.com';

/**
 * Isometric illustration in the style of Safaricom's "Pochi la Biashara":
 * a blue and an orange arrow circling between a green person and an
 * Knoxville router with its Wi-Fi arcs. Static: nothing moves.
 */
function Illustration() {
  return (
    <svg viewBox="0 -18 240 218" className="h-[207px] w-[228px]" aria-hidden>
      {/* Blue arrow, top left, curving towards the router */}
      <g>
        <path d="M44 96 C 40 66, 62 48, 92 50 L 92 40 L 114 58 L 92 76 L 92 66 C 72 64, 56 74, 54 96 Z" fill="#1F7AE0" />
        <path d="M54 96 C 56 74, 72 64, 92 66 L 92 70 C 74 70, 60 80, 58 98 Z" fill="#0F5BB5" />
      </g>

      {/* Router, top right: isometric box with antennas, lights and Wi-Fi arcs */}
      <g>
        <path d="M146 18 l6 -16" stroke="#3A3F44" strokeWidth="4" strokeLinecap="round" />
        <path d="M196 34 l6 -18" stroke="#3A3F44" strokeWidth="4" strokeLinecap="round" />
        <path d="M130 44 L 176 22 L 222 44 L 176 66 Z" fill="#3D4248" />
        <path d="M130 44 L 176 66 L 176 98 L 130 76 Z" fill="#2A2E33" />
        <path d="M176 66 L 222 44 L 222 76 L 176 98 Z" fill="#1E2125" />
        <circle cx="142" cy="66" r="2.6" fill="#2DA043" />
        <circle cx="151" cy="70.5" r="2.6" fill="#2DA043" />
        <circle cx="160" cy="75" r="2.6" fill="#E23B41" />
        <g
          fill="none"
          stroke="#2DA043"
          strokeWidth="4"
          strokeLinecap="round"
        >
          <path d="M160 14 a 22 22 0 0 1 32 0" />
          <path d="M150 4 a 36 36 0 0 1 52 0" />
        </g>
      </g>

      {/* Green person, bottom left, with a darker side for depth */}
      <g>
        <ellipse cx="74" cy="122" rx="20" ry="22" fill="#27B35E" />
        <path d="M80 102 a 20 22 0 0 1 14 20 a 20 22 0 0 1 -10 19 a 22 24 0 0 0 -4 -39 Z" fill="#1C8A47" />
        <path d="M40 186 C 40 156, 54 144, 74 144 C 96 144, 110 158, 112 182 L 98 192 L 52 192 Z" fill="#27B35E" />
        <path d="M98 192 L 112 182 C 110 160, 100 148, 86 145 C 98 154, 102 168, 98 192 Z" fill="#1C8A47" />
      </g>

      {/* Orange arrow, bottom right, curving back to the person */}
      <g>
        <path d="M196 116 C 200 146, 178 166, 146 166 L 146 176 L 124 158 L 146 140 L 146 150 C 166 150, 182 140, 186 116 Z" fill="#F5A623" />
        <path d="M186 116 C 182 140, 166 150, 146 150 L 146 146 C 164 146, 178 136, 182 116 Z" fill="#D9861A" />
      </g>
    </svg>
  );
}

/**
 * The one page between the launch splash and sign-in, in the style of
 * Safaricom's "Pochi la Biashara" opt-in: title, tagline, illustration,
 * what the app does, a terms checkbox and a button that unlocks once ticked.
 */
export function WelcomePage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [agreed, setAgreed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the ••• menu when tapping anywhere else
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  if (token) return <Navigate to="/dashboard" replace />;

  const finish = () => {
    markOnboarded();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white px-5 pb-[max(1.25rem,var(--sab))] pt-[max(0.75rem,var(--sat))] text-[#1A1A1A] [.dark_&]:bg-[#121212] [.dark_&]:text-white">
      {/* ••• | ✕ pill, top right */}
      <div className="flex justify-end">
        <div ref={menuRef} className="relative">
          <div className="flex h-10 items-center rounded-full border border-black/10 bg-white px-1 [.dark_&]:border-white/15 [.dark_&]:bg-[#1E1E1E]">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-10 items-center justify-center rounded-full active:bg-black/5"
              aria-label="More options"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            <span className="h-5 w-px bg-black/10 [.dark_&]:bg-white/15" aria-hidden />
            <button
              type="button"
              onClick={finish}
              className="flex h-8 w-10 items-center justify-center rounded-full active:bg-black/5"
              aria-label="Close"
            >
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-current">
                <X className="h-3 w-3" strokeWidth={3} />
              </span>
            </button>
          </div>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 z-10 w-56 overflow-hidden rounded-2xl border border-black/5 bg-white py-1 shadow-xl [.dark_&]:border-white/10 [.dark_&]:bg-[#1E1E1E]"
              >
                <a
                  href={WEBSITE}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-3 text-[15px] active:bg-black/5"
                >
                  <Globe className="h-4 w-4 text-brand-600" /> Visit knoxvilletechnologies.com
                </a>
                <a href={`tel:${SUPPORT_PHONE}`} className="flex items-center gap-3 px-4 py-3 text-[15px] active:bg-black/5">
                  <PhoneCall className="h-4 w-4 text-brand-600" /> Call support
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-[11vh] text-center text-[30px] font-bold tracking-tight"
      >
        Knoxville Home Fibre
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="mt-[8vh] text-center text-[20px] text-[#3C3C3C] [.dark_&]:text-white/80"
      >
        Run your internet business from one app.
      </motion.p>

      <div className="mt-[7vh] flex justify-center">
        <Illustration />
      </div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="mt-[5vh] text-center text-[18px] leading-snug text-[#3C3C3C] [.dark_&]:text-white/80"
      >
        Sell WiFi packages, track subscribers and renewals, record expenses and see your profit every day, in one
        secure workspace for the Knoxville team.
      </motion.p>

      <div className="flex-1" />

      {/* Terms checkbox */}
      <label className="mt-8 flex cursor-pointer items-start gap-3 px-2">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="peer sr-only" />
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 ${
            agreed ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#3C3C3C] [.dark_&]:border-white/60'
          }`}
          aria-hidden
        >
          {agreed && <Check className="h-4 w-4" strokeWidth={3} />}
        </span>
        <span className="text-[16px] leading-relaxed text-[#6B6B6B] [.dark_&]:text-white/60">
          By tapping “Opt in” you acknowledge that you have read and agreed to the{' '}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setTermsOpen(true);
            }}
            className="font-medium text-brand-600 [.dark_&]:text-brand-400"
          >
            Terms and Conditions.
          </button>
        </span>
      </label>

      <motion.button
        type="button"
        disabled={!agreed}
        onClick={finish}
        whileTap={agreed ? { scale: 0.98 } : undefined}
        className={`mt-6 h-14 w-full rounded-xl text-[20px] font-medium text-white transition-colors ${
          agreed ? 'bg-brand-600 active:bg-brand-700' : 'bg-[#BFC1C3] [.dark_&]:bg-[#3A3D40] [.dark_&]:text-white/50'
        }`}
      >
        Opt in
      </motion.button>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen} title="Terms and Conditions">
        <div className="space-y-3 text-[14px] leading-relaxed text-foreground-2">
          <p>This app is for Knoxville Technologies Ltd staff. By using it you agree to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Keep your password and authenticator app private, and never share your account.</li>
            <li>Record sales, payments and expenses truthfully and on time.</li>
            <li>Keep client details confidential and use them only for Knoxville work.</li>
            <li>Report a lost phone or suspicious sign-in to your manager straight away.</li>
          </ul>
          <button
            type="button"
            onClick={() => {
              setAgreed(true);
              setTermsOpen(false);
            }}
            className="mt-2 h-12 w-full rounded-xl bg-brand-600 text-[15px] font-medium text-white active:bg-brand-700"
          >
            I agree
          </button>
        </div>
      </Dialog>
    </div>
  );
}
