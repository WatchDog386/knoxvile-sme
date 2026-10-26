import { useEffect, useState } from 'react';
import { animate, motion } from 'framer-motion';
import { Check, Fingerprint, Package, RefreshCw, ShieldCheck, TrendingUp, Users } from 'lucide-react';

/*
 * Frosted "product moments" that float over each welcome photo, showing the
 * app doing its job: a sale landing, a budget filling, profit climbing.
 */

const glass =
  'rounded-[1.4rem] border border-white/20 bg-white/[0.12] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] backdrop-blur-2xl backdrop-saturate-150';

const spring = { type: 'spring' as const, stiffness: 260, damping: 24 };

/** Counts from 0 to `to` once mounted. */
function useCountUp(to: number, delay = 0.3, duration = 1.4) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const controls = animate(0, to, {
      delay,
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [to, delay, duration]);
  return value;
}

/** Gentle idle bob so cards feel alive while the slide is showing. */
const float = {
  animate: { y: [0, -6, 0] },
  transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' as const, delay: 1.2 },
};

function Chip({ children, delay, className = '' }: { children: React.ReactNode; delay: number; className?: string }) {
  return (
    <motion.div
      className={`${glass} flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-white ${className}`}
      initial={{ opacity: 0, y: 14, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.div>
  );
}

export function SaleMoment() {
  const amount = useCountUp(25000, 0.45);
  return (
    <motion.div className="relative w-[280px]" {...float}>
      <motion.div
        className={`${glass} p-4`}
        initial={{ opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...spring, delay: 0.15 }}
      >
        <div className="flex items-center gap-3">
          <motion.span
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-emerald-950"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ delay: 0.35, duration: 0.5 }}
          >
            <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
          </motion.span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">Sale recorded</p>
            <p className="text-[11px] text-white/65">Riverside Hotel · M-Pesa</p>
          </div>
        </div>
        <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-white/55">Amount received</p>
        <p className="mt-0.5 text-[30px] font-semibold tabular-nums tracking-tight text-white">
          Ksh {amount.toLocaleString('en-KE')}
        </p>
      </motion.div>
      <Chip delay={1.1} className="absolute -bottom-5 -right-3">
        <Package className="h-3.5 w-3.5 text-sky-300" aria-hidden />
        Stock updated · −2 units
      </Chip>
    </motion.div>
  );
}

export function SpendMoment() {
  const used = useCountUp(84, 0.5, 1.6);
  return (
    <motion.div className="relative w-[280px]" {...float}>
      <motion.div
        className={`${glass} p-4`}
        initial={{ opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...spring, delay: 0.15 }}
      >
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-semibold text-white">Marketing budget</p>
          <p className="text-[12px] tabular-nums text-white/70">{used}%</p>
        </div>
        <p className="mt-0.5 text-[11px] text-white/60">Ksh 12,180 of Ksh 14,500 this month</p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500"
            initial={{ width: '0%' }}
            animate={{ width: '84%' }}
            transition={{ delay: 0.5, duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <motion.p
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-[11px] font-medium text-amber-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
        >
          Alert sent before you overspend
        </motion.p>
      </motion.div>
      <Chip delay={1.2} className="absolute -bottom-5 -left-3">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-emerald-950">
          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
        </span>
        Receipt approved by Aisha
      </Chip>
    </motion.div>
  );
}

export function GrowMoment() {
  const profit = useCountUp(1742300, 0.4, 1.8);
  // Rising line with a soft area fill underneath
  const line = 'M4 66 C 30 60, 44 64, 62 50 S 96 46, 112 34 S 150 30, 168 18 S 200 12, 236 6';
  return (
    <motion.div className="relative w-[280px]" {...float}>
      <motion.div
        className={`${glass} p-4`}
        initial={{ opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...spring, delay: 0.15 }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Net profit · October</p>
          <motion.span
            className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.6 }}
          >
            <TrendingUp className="h-3 w-3" aria-hidden />
            18.4%
          </motion.span>
        </div>
        <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-white">
          Ksh {profit.toLocaleString('en-KE')}
        </p>
        <svg viewBox="0 0 240 72" className="mt-2 h-[72px] w-full" aria-hidden>
          <defs>
            <linearGradient id="grow-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={`${line} L 236 72 L 4 72 Z`}
            fill="url(#grow-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          />
          <motion.path
            d={line}
            fill="none"
            stroke="#34d399"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.4, duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.circle
            cx="236"
            cy="6"
            r="5"
            fill="#34d399"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.5, 1] }}
            transition={{ delay: 1.9, duration: 0.45 }}
          />
        </svg>
      </motion.div>
    </motion.div>
  );
}

export function TrustMoment() {
  const items = [
    { icon: ShieldCheck, label: 'Encrypted & private' },
    { icon: RefreshCw, label: 'Live sync across devices' },
    { icon: Users, label: 'Roles for your whole team' },
    { icon: Fingerprint, label: 'Staff-only access' },
  ];
  return (
    <div className="flex w-[280px] flex-col gap-2.5">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          className={`${glass} flex items-center gap-3 px-3.5 py-3`}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...spring, delay: 0.25 + i * 0.12 }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
            <item.icon className="h-4 w-4 text-white" aria-hidden />
          </span>
          <span className="text-[13px] font-medium text-white">{item.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
