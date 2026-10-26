import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Plus, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

/*
 * Shared "network" look for list pages (Team, Customers): a fibre-optic green
 * hero card with an action tab cut into its corner, a profile header, and
 * tall round filter buttons. Based on the Paytin reference.
 */

export const LIME = '#C6EA5A';
export const CHARCOAL = '#1C1F1B';

const HERO_RADIUS = 26;
const NOTCH_R = 16;
const NOTCH_GAP = 8;

/** Card outline with a real cut-out in the top-right corner (where the action sits). */
function heroPath(w: number, h: number, nw: number, nh: number): string {
  const R = HERO_RADIUS;
  const r = NOTCH_R;
  if (nw <= 0) {
    return `M ${R} 0 H ${w - R} A ${R} ${R} 0 0 1 ${w} ${R} V ${h - R} A ${R} ${R} 0 0 1 ${w - R} ${h} H ${R} A ${R} ${R} 0 0 1 0 ${h - R} V ${R} A ${R} ${R} 0 0 1 ${R} 0 Z`;
  }
  return [
    `M ${R} 0`,
    `H ${w - nw - r}`,
    `A ${r} ${r} 0 0 1 ${w - nw} ${r}`,
    `V ${nh - r}`,
    `A ${r} ${r} 0 0 0 ${w - nw + r} ${nh}`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${nh + r}`,
    `V ${h - R}`,
    `A ${R} ${R} 0 0 1 ${w - R} ${h}`,
    `H ${R}`,
    `A ${R} ${R} 0 0 1 0 ${h - R}`,
    `V ${R}`,
    `A ${R} ${R} 0 0 1 ${R} 0`,
    'Z',
  ].join(' ');
}

function fiberTip(w: number, h: number, i: number) {
  return { x: w * (0.58 + i * 0.075), y: h * (0.18 + i * 0.1) };
}

/** Curved fibre-optic strands fanning from the bottom-left corner towards the right. */
function fiberStrands(w: number, h: number): string[] {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const tip = fiberTip(w, h, i);
    return `M ${-10 + i * 6} ${h + 10} C ${w * 0.25 + i * 8} ${h * 0.95 - i * 6}, ${w * 0.45} ${tip.y + 40 - i * 4}, ${tip.x} ${tip.y}`;
  });
}

/** What the card's inside shows: its colours and the pattern drawn behind the text. */
export type CardPattern = 'fiber' | 'chart' | 'signal' | 'receipt' | 'coins' | 'orbit' | 'guilloche' | 'ribbon';
export interface CardTheme {
  /** Three gradient stops, dark to light. */
  colors: [string, string, string];
  /** Glow colour of the pattern. */
  glow: string;
  /** Icon and action pill. */
  accent: string;
  pattern: CardPattern;
  /** Premium cards: chip metal (gold or platinum). */
  chip?: 'gold' | 'silver';
  /** Text colour; light cards (like the lime one) use dark ink. Default white. */
  ink?: string;
  /** Contactless mark, engraving accent and corner icon. Default: accent. */
  detail?: string;
  /** Text on the action pill. Default charcoal. */
  pillInk?: string;
}

export const CARD_THEMES = {
  // Default (clients, staff): the same teal loop card as today's sales
  network: { colors: ['#3A8F91', '#469D9F', '#56ACAD'], glow: '#1F5F61', accent: '#FFFFFF', pattern: 'ribbon', chip: 'silver', detail: '#FFFFFF', pillInk: '#2F7F81' },
  // Teal "Infinite" card: soft teal with large rounded ribbon loops, silver chip
  sales: { colors: ['#3A8F91', '#469D9F', '#56ACAD'], glow: '#1F5F61', accent: '#FFFFFF', pattern: 'ribbon', chip: 'silver', detail: '#FFFFFF', pillInk: '#2F7F81' },
  // Black card: charcoal with lighter rounded loops, silver chip
  packages: { colors: ['#1F1F21', '#29292C', '#333337'], glow: '#8A8A90', accent: '#FFFFFF', pattern: 'ribbon', chip: 'silver', detail: '#FFFFFF', pillInk: '#1F1F21' },
  // Garnet: wine red with darker loops
  expenses: { colors: ['#7A1828', '#8A2032', '#9B2B3D'], glow: '#3A0712', accent: '#FFFFFF', pattern: 'ribbon', chip: 'silver', detail: '#FFFFFF', pillInk: '#7A1828' },
  // Black & gold: bronze-black with gold loops and chip
  profit: { colors: ['#262016', '#30291C', '#3B3223'], glow: '#B89650', accent: '#E9C46A', pattern: 'ribbon', detail: '#E9C46A' },
  // Amethyst: violet with darker loops
  total: { colors: ['#4C2C8E', '#5934A0', '#6840B1'], glow: '#22104F', accent: '#FFFFFF', pattern: 'ribbon', chip: 'silver', detail: '#FFFFFF', pillInk: '#4C2C8E' },
} satisfies Record<string, CardTheme>;

/** Pattern layer, clipped to the card. Each one hints at what the card measures. */
export function CardPatternLayer({
  theme,
  w,
  h,
  uid,
  showChip = true,
}: {
  theme: CardTheme;
  w: number;
  h: number;
  uid: string;
  /** Draw the EMV chip and contactless mark (ribbon pattern only). */
  showChip?: boolean;
}) {
  const glow = theme.glow;
  const blur = `url(#${uid}-glow)`;
  switch (theme.pattern) {
    case 'ribbon':
    case 'guilloche': {
      // Bank-note style engraving: two families of fine interlaced waves,
      // a soft diagonal sheen, a gold EMV chip and the contactless mark
      const waves = (count: number, baseY: number, amp: number, freq: number, phaseStep: number) =>
        Array.from({ length: count }, (_, k) => {
          const pts: string[] = [];
          for (let x = -10; x <= w + 10; x += 6) {
            const y = baseY + Math.sin(x * freq + k * phaseStep) * amp + Math.sin(x * freq * 0.37 + k) * amp * 0.35;
            pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
          }
          return `M ${pts.join(' L ')}`;
        });
      const chipX = w * 0.6;
      const chipY = h * 0.36;
      const cw = 42;
      const ch = 32;
      return (
        <>
          <defs>
            <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="48%" stopColor="#fff" stopOpacity="0.10" />
              <stop offset="52%" stopColor="#fff" stopOpacity="0.16" />
              <stop offset="58%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
              {theme.chip === 'silver' ? (
                <>
                  <stop offset="0%" stopColor="#F4F6F9" />
                  <stop offset="45%" stopColor="#BFC6D1" />
                  <stop offset="100%" stopColor="#8A93A1" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#F7E3A1" />
                  <stop offset="45%" stopColor="#D9AE4E" />
                  <stop offset="100%" stopColor="#A87A22" />
                </>
              )}
            </linearGradient>
          </defs>
          {theme.pattern === 'ribbon' ? (
            <>
              {/* Big rounded loops on the right, a shade darker than the card */}
              <path
                d={`M ${w * 1.1} ${h * 0.06} H ${w * 0.8} A ${h * 0.2} ${h * 0.2} 0 0 0 ${w * 0.8} ${h * 0.46} H ${w * 0.86} A ${h * 0.2} ${h * 0.2} 0 0 1 ${w * 0.86} ${h * 0.86} H ${w * 0.62}`}
                fill="none"
                stroke={glow}
                strokeOpacity={0.22}
                strokeWidth={h * 0.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx={w * 0.93} cy={h * 1.02} r={h * 0.34} fill={glow} fillOpacity={0.16} />
              <circle cx={w * 0.72} cy={h * -0.12} r={h * 0.24} fill={glow} fillOpacity={0.1} />
            </>
          ) : (
            <>
          {waves(16, h * 0.62, h * 0.11, 0.022, 0.32).map((d, i) => (
            <path key={`a${i}`} d={d} fill="none" stroke={glow} strokeOpacity={0.07 + (i % 4) * 0.012} strokeWidth={0.7} />
          ))}
          {waves(12, h * 0.3, h * 0.08, 0.031, 0.45).map((d, i) => (
            <path key={`b${i}`} d={d} fill="none" stroke={theme.detail ?? theme.accent} strokeOpacity={0.05 + (i % 3) * 0.01} strokeWidth={0.6} />
          ))}
            </>
          )}
          <rect x={0} y={0} width={w} height={h} fill={`url(#${uid}-sheen)`} opacity={theme.pattern === 'ribbon' ? 0.5 : 1} />
          {showChip && (
            <>
          {/* EMV chip */}
          <rect x={chipX} y={chipY} width={cw} height={ch} rx={6} fill={`url(#${uid}-gold)`} />
          <g stroke={theme.chip === 'silver' ? '#5B6370' : '#7A5716'} strokeOpacity={0.55} strokeWidth={1} fill="none">
            <path d={`M ${chipX} ${chipY + ch / 3} H ${chipX + cw * 0.36} M ${chipX} ${chipY + (2 * ch) / 3} H ${chipX + cw * 0.36}`} />
            <path d={`M ${chipX + cw} ${chipY + ch / 3} H ${chipX + cw * 0.64} M ${chipX + cw} ${chipY + (2 * ch) / 3} H ${chipX + cw * 0.64}`} />
            <rect x={chipX + cw * 0.36} y={chipY + ch * 0.22} width={cw * 0.28} height={ch * 0.56} rx={3} />
          </g>
          {/* Contactless mark */}
          <g fill="none" stroke={theme.detail ?? theme.accent} strokeOpacity={0.85} strokeWidth={2} strokeLinecap="round">
            {[0, 1, 2, 3].map((i) => (
              <path key={i} d={`M ${chipX + cw + 16 + i * 6} ${chipY + 6 - i * 2} q ${5 + i * 1.5} ${ch / 2 - 6 + i * 2} 0 ${ch - 12 + i * 4}`} />
            ))}
          </g>
            </>
          )}
        </>
      );
    }
    case 'chart': {
      // Rising bars with a trend line: sales going up
      const bars = [0.32, 0.45, 0.38, 0.58, 0.52, 0.72, 0.86];
      const bw = w * 0.055;
      const x0 = w * 0.5;
      const step = w * 0.066;
      const pts = bars.map((b, i) => ({ x: x0 + i * step + bw / 2, y: h - b * h * 0.75 }));
      const line = `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
      return (
        <>
          {bars.map((b, i) => (
            <rect key={i} x={x0 + i * step} y={h - b * h * 0.75} width={bw} height={b * h} rx={bw / 2} fill={glow} fillOpacity={0.08 + i * 0.02} />
          ))}
          <path d={line} fill="none" stroke={glow} strokeOpacity={0.55} strokeWidth={1.6} />
          <path d={line} fill="none" stroke={glow} strokeOpacity={0.3} strokeWidth={5} filter={blur} />
          {pts.map((p, i) => {
            const last = i === pts.length - 1;
            return <circle key={`p${i}`} cx={p.x} cy={p.y} r={last ? 3.5 : 2} fill="#fff" fillOpacity={last ? 1 : 0.6} filter={last ? blur : undefined} />;
          })}
        </>
      );
    }
    case 'signal': {
      // WiFi arcs radiating from the corner
      const cx = w * 0.98;
      const cy = h * 0.02;
      return (
        <>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <circle key={i} cx={cx} cy={cy} r={i * h * 0.17} fill="none" stroke={glow} strokeOpacity={0.22 - i * 0.025} strokeWidth={i % 2 ? 1.4 : 6} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={`d${i}`} cx={w * (0.08 + ((i * 37) % 90) / 100)} cy={h * (0.15 + ((i * 53) % 80) / 100)} r={1.2} fill={glow} fillOpacity={0.35} />
          ))}
        </>
      );
    }
    case 'receipt': {
      // Torn receipt edges, receipt lines and a falling line: money going out (static)
      const teeth = (y: number, flip: number) => {
        const n = 16;
        const tw = w / n;
        let d = `M 0 ${y}`;
        for (let i = 0; i < n; i++) d += ` l ${tw / 2} ${8 * flip} l ${tw / 2} ${-8 * flip}`;
        return d;
      };
      const drop = `M ${w * 0.4} ${h * 0.3} C ${w * 0.55} ${h * 0.32}, ${w * 0.6} ${h * 0.55}, ${w * 0.72} ${h * 0.6} S ${w * 0.9} ${h * 0.82}, ${w * 1.02} ${h * 0.86}`;
      return (
        <>
          <path d={teeth(h * 0.12, 1)} fill="none" stroke={glow} strokeOpacity={0.18} strokeWidth={1.5} />
          <path d={teeth(h * 0.9, -1)} fill="none" stroke={glow} strokeOpacity={0.12} strokeWidth={1.5} />
          {[0.36, 0.46, 0.56, 0.66].map((y, i) => (
            <line key={i} x1={w * 0.52} x2={w * (0.86 - i * 0.04)} y1={h * y} y2={h * y} stroke={glow} strokeOpacity={0.1} strokeWidth={6} strokeLinecap="round" />
          ))}
          <path d={drop} fill="none" stroke={glow} strokeOpacity={0.5} strokeWidth={1.6} strokeDasharray="4 5" />
          <path d={drop} fill="none" stroke={glow} strokeOpacity={0.25} strokeWidth={5} filter={blur} />
        </>
      );
    }
    case 'coins': {
      // Stacks of coins growing left to right: profit building up
      const stacks = [3, 5, 7, 9];
      const r = w * 0.055;
      return (
        <>
          {stacks.map((n, s) =>
            Array.from({ length: n }, (_, k) => (
              <ellipse
                key={`${s}-${k}`}
                cx={w * (0.58 + s * 0.1)}
                cy={h * 0.95 - k * (r * 0.42)}
                rx={r}
                ry={r * 0.36}
                fill={glow}
                fillOpacity={0.06 + k * 0.012}
                stroke={glow}
                strokeOpacity={0.28}
                strokeWidth={1}
              />
            )),
          )}
          {stacks.map((n, s) => (
            <circle key={`c${s}`} cx={w * (0.58 + s * 0.1)} cy={h * 0.95 - n * r * 0.42 - 8} r={r * 0.28} fill={glow} fillOpacity={0.55} filter={blur} />
          ))}
          <circle cx={w * 0.9} cy={h * 0.12} r={h * 0.32} fill="none" stroke={glow} strokeOpacity={0.12} strokeWidth={14} />
        </>
      );
    }
    case 'orbit': {
      // Dotted grid with orbit rings: everything added up
      const cx = w * 0.82;
      const cy = h * 0.42;
      return (
        <>
          {Array.from({ length: 7 }, (_, row) =>
            Array.from({ length: 12 }, (_, col) => (
              <circle key={`${row}-${col}`} cx={w * (0.08 + col * 0.08)} cy={h * (0.1 + row * 0.13)} r={1} fill={glow} fillOpacity={0.18} />
            )),
          )}
          {[0.28, 0.42, 0.56].map((k, i) => (
            <ellipse
              key={i}
              cx={cx}
              cy={cy}
              rx={h * k * 1.5}
              ry={h * k * 0.55}
              fill="none"
              stroke={glow}
              strokeOpacity={0.3 - i * 0.07}
              strokeWidth={1.3}
              transform={`rotate(-18 ${cx} ${cy})`}
            />
          ))}
          <circle cx={cx} cy={cy} r={h * 0.14} fill={glow} fillOpacity={0.12} stroke={glow} strokeOpacity={0.4} />
          {[0, 1].map((i) => (
            <circle key={`o${i}`} cx={cx + h * (0.42 + i * 0.14) * 0.9} cy={cy - i * 6} r={3} fill="#fff" filter={blur} />
          ))}
        </>
      );
    }
    default:
      return (
        <>
          {fiberStrands(w, h).map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke={`url(#${uid}-fiber)`} strokeWidth={1.4} />
              <path d={d} fill="none" stroke={glow} strokeOpacity={0.25} strokeWidth={4} filter={blur} />
            </g>
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const tip = fiberTip(w, h, i);
            return <circle key={`t${i}`} cx={tip.x} cy={tip.y} r={2.4} fill="#E8FFD0" filter={blur} />;
          })}
        </>
      );
  }
}

/** Branded card (network green by default) with a themed pattern and an optional action in its cut-out corner. */
export function FiberHeroCard({
  label,
  value,
  note,
  maskedValue,
  footerLeft,
  footerRight,
  icon: Icon,
  action,
  theme = CARD_THEMES.network,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  note?: React.ReactNode;
  /** Last digits of the masked number line. */
  maskedValue: number;
  footerLeft: React.ReactNode;
  footerRight?: React.ReactNode;
  icon: LucideIcon;
  action?: { label: string; onClick: () => void };
  theme?: CardTheme;
}) {
  const uid = useId().replace(/:/g, '');
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, bw: 0, bh: 0 });

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const measure = () =>
      setSize({
        w: card.offsetWidth,
        h: card.offsetHeight,
        bw: buttonRef.current?.offsetWidth ?? 0,
        bh: buttonRef.current?.offsetHeight ?? 0,
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    if (buttonRef.current) observer.observe(buttonRef.current);
    return () => observer.disconnect();
  }, [action]);

  const nw = action && size.bw ? size.bw + NOTCH_GAP : 0;
  const nh = action && size.bh ? size.bh + NOTCH_GAP : 0;
  const path = size.w ? heroPath(size.w, size.h, nw, nh) : '';

  return (
    <div ref={cardRef} className="relative min-h-[200px]" style={{ color: theme.ink ?? '#FFFFFF' }}>
      {size.w > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden>
          <defs>
            {/* Deep network green */}
            <linearGradient id={`${uid}-green`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={theme.colors[0]} />
              <stop offset="55%" stopColor={theme.colors[1]} />
              <stop offset="100%" stopColor={theme.colors[2]} />
            </linearGradient>
            {/* Fibre strand: dark at the root, glowing at the tip */}
            <linearGradient id={`${uid}-fiber`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#7CF29A" stopOpacity="0" />
              <stop offset="70%" stopColor="#7CF29A" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#D9FFB0" stopOpacity="0.9" />
            </linearGradient>
            <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
            <clipPath id={`${uid}-clip`}>
              <path d={path} />
            </clipPath>
          </defs>
          <path d={path} fill={`url(#${uid}-green)`} />
          <g clipPath={`url(#${uid}-clip)`}>
            <CardPatternLayer theme={theme} w={size.w} h={size.h} uid={uid} />
          </g>
        </svg>
      )}

      <div className="relative flex min-h-[200px] flex-col justify-between p-5 pr-20">
        <div>
          <div className="text-[12px] opacity-60">{label}</div>
          <p className="mt-0.5 text-[32px] font-semibold leading-none tracking-tight tabular-nums">
            {value}
            {note && <span className="ml-2 text-[14px] font-medium opacity-60">{note}</span>}
          </p>
        </div>
        <p className="mt-6 text-[13px] tracking-[0.3em] opacity-50">
          ••••&nbsp;&nbsp;••••&nbsp;&nbsp;{String(maskedValue).padStart(4, '0')}
        </p>
        <div className="mt-3 flex items-end justify-between gap-3 text-[12px]">
          <span className="truncate font-medium">{footerLeft}</span>
          {footerRight && <span className="shrink-0 opacity-60">{footerRight}</span>}
        </div>
      </div>

      <Icon
        className="absolute bottom-5 right-5 h-9 w-9 drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
        style={{ color: theme.detail ?? theme.accent }}
        strokeWidth={1.8}
        aria-hidden
      />

      {action && (
        <motion.button
          ref={buttonRef}
          type="button"
          onClick={action.onClick}
          whileTap={{ scale: 0.95 }}
          className="absolute right-0 top-0 flex h-9 items-center gap-1.5 rounded-full pl-1.5 pr-3.5 text-[12px] font-semibold"
          style={{ backgroundColor: theme.accent, color: theme.pillInk ?? CHARCOAL }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.pillInk ?? CHARCOAL, color: theme.pillInk ? theme.accent : '#FFFFFF' }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </span>
          {action.label}
        </motion.button>
      )}
    </div>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+/u, ''))
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Signed-in person at the top of the page ("Welcome back"), with notifications. */
export function ProfileHeader({
  roleLabel,
  showBackButton,
}: { roleLabel?: string; showBackButton?: boolean }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const name = user?.fullName ?? 'You';

  const leftContent = showBackButton
    ? (
      <button
        type="button"
        onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/dashboard')}
        className="flex min-w-0 items-center gap-3 text-left"
        aria-label="Go back"
      >
        <span className="text-[15px] font-semibold text-foreground">Back</span>
      </button>
    ) : (
      <button type="button" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/profile')} className="flex min-w-0 items-center gap-3 text-left">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-semibold shadow-md ring-2 ring-white"
          style={{ backgroundColor: CHARCOAL, color: LIME }}
        >
          {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : initialsOf(name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] text-foreground-4">
            {name}
            {roleLabel ? ` · ${roleLabel}` : ''}
          </span>
          <span className="block text-[18px] font-semibold tracking-tight text-foreground">Welcome back 👋</span>
        </span>
      </button>
    );

  return (
    <header className="page-head flex items-center justify-between gap-3">
      {leftContent}
      <button
        type="button"
        onClick={() => navigate('/notifications')}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-edge bg-surface text-foreground-2 active:scale-90"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" aria-hidden />
      </button>
    </header>
  );
}

export interface RoundFilter<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
  count?: number;
  /** Icon colour, plus hover and selected tints for the container. */
  iconClass: string;
  hoverClass: string;
  selectedClass: string;
}

/** Tall round filter buttons: coloured icons, white until hovered or picked. */
export function RoundFilters<T extends string>({
  items,
  value,
  onChange,
  hideIcons = false,
}: {
  items: RoundFilter<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Show just the label (and count), no icon. */
  hideIcons?: boolean;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((b) => {
        const selected = value === b.id;
        return (
          <motion.button
            key={b.id}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => onChange(b.id)}
            aria-pressed={selected}
            className={cn(
              'relative flex flex-col items-center gap-1.5 rounded-full border py-3 transition-colors',
              selected
                ? cn(b.selectedClass, '[.dark_&]:bg-white/10')
                : cn('border-edge bg-surface', b.hoverClass, '[.dark_&]:hover:bg-white/5'),
            )}
          >
            {!hideIcons && <b.icon className={cn('h-5 w-5', b.iconClass)} strokeWidth={2.2} aria-hidden />}
            <span className={cn(hideIcons ? 'text-[12px]' : 'text-[10px]', 'font-semibold', selected ? 'text-foreground' : 'text-foreground-3')}>{b.label}</span>
            {!!b.count && (
              <span
                className="absolute -right-0.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: CHARCOAL }}
              >
                {b.count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
