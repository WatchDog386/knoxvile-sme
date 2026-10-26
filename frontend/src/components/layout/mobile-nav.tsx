import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { BarChart3, PhoneCall, Plus, ShoppingCart, Users, Wallet, Wifi } from 'lucide-react';
import { useRole } from '@/hooks/use-role';
import type { ElementType } from 'react';

type Tab = { to: string; label: string; icon: ElementType };

const ADMIN_TABS: Tab[] = [
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/dashboard', label: 'Home', icon: Plus },
  { to: '/subscribers', label: 'Subscribers', icon: Wifi },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];
// Employees can't open Staff or Reports: they get Subscribers and Calls instead
const EMPLOYEE_TABS: Tab[] = [
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/subscribers', label: 'Subscribers', icon: Wifi },
  { to: '/dashboard', label: 'Home', icon: Plus },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/calls', label: 'Calls', icon: PhoneCall },
];
const HOME_INDEX = 2;

/*
 * Lime bar (the "Add staff" colour) with a smooth dip cut into its top edge under the active tab,
 * and a black bubble sitting in the dip holding that tab's icon (from the
 * reference design the user supplied). The bar itself never moves; only the
 * dip and bubble glide to the tab you tap.
 */
const BUBBLE_FILL = '#1C1F1B'; // black bubble for the active tab
const MUTED = 'rgba(28,31,27,0.72)'; // inactive icons and labels (charcoal) on the lime bar
const INK = '#1C1F1B'; // active label
const BAR_HEIGHT = 64;
const RADIUS = 24; // bar corner radius
const INSET = 10; // side padding inside the bar
const NOTCH_DEPTH = 38; // how far the dip cuts into the bar
const NOTCH_HALF = 42; // half the dip's width at the top edge
const BUBBLE = 46; // diameter of the raised active circle
const BUBBLE_GAP = 6; // space between the bubble and the floor of the dip

/**
 * Bar outline with a smooth dip in the top edge centred at `cx`, traced
 * clockwise. Near the ends the top corners tighten so the dip never folds back.
 */
function barPath(w: number, cx: number, depth: number): string {
  const h = BAR_HEIGHT;
  const r = RADIUS;
  const left = cx - NOTCH_HALF;
  const right = cx + NOTCH_HALF;
  const rl = Math.max(0, Math.min(r, left));
  const rr = Math.max(0, Math.min(r, w - right));
  const a = NOTCH_HALF * 0.55;
  const b = NOTCH_HALF * 0.62;
  return [
    `M ${rl} 0`,
    `H ${left}`,
    `C ${cx - a} 0 ${cx - b} ${depth} ${cx} ${depth}`,
    `C ${cx + b} ${depth} ${cx + a} 0 ${right} 0`,
    `H ${w - rr}`,
    `A ${rr} ${rr} 0 0 1 ${w} ${rr}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${rl}`,
    `A ${rl} ${rl} 0 0 1 ${rl} 0`,
    'Z',
  ].join(' ');
}

function activeIndex(tabs: Tab[], pathname: string): number {
  return tabs.findIndex((t) =>
    t.to === '/dashboard' ? pathname === t.to : pathname === t.to || pathname.startsWith(`${t.to}/`),
  );
}

/** Centre of tab `i` across the bar, inside the side padding. */
function tabCenter(i: number, width: number, count: number): number {
  const center = INSET + ((i + 0.5) * (width - INSET * 2)) / count;
  return Math.max(NOTCH_HALF, Math.min(width - NOTCH_HALF, center));
}

export function MobileNav() {
  const { pathname } = useLocation();
  const { isEmployee } = useRole();
  const tabs = isEmployee ? EMPLOYEE_TABS : ADMIN_TABS;
  // Pages that are not one of the tabs keep Home selected
  const found = activeIndex(tabs, pathname);
  const index = found >= 0 ? found : HOME_INDEX;
  const barRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  const widthMV = useMotionValue(0);
  const cx = useMotionValue(0);
  const path = useTransform([widthMV, cx], ([w, x]) =>
    (w as number) > 0 ? barPath(w as number, x as number, NOTCH_DEPTH) : '',
  );

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      widthMV.set(bar.offsetWidth);
      setWidth(bar.offsetWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [widthMV]);

  // Dip and bubble glide to the new tab; first placement (and resizes) snap into place
  const placed = useRef(false);
  const lastWidth = useRef(0);
  useLayoutEffect(() => {
    if (!width) return;
    const target = tabCenter(index, width, tabs.length);
    if (!placed.current || lastWidth.current !== width) {
      cx.set(target);
      placed.current = true;
      lastWidth.current = width;
      return;
    }
    const glide = animate(cx, target, { type: 'spring', stiffness: 380, damping: 34 });
    return () => glide.stop();
  }, [index, width, cx]);

  const active = tabs[index];
  const bubbleX = useTransform(cx, (x) => x - BUBBLE / 2);

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 z-30 px-4 lg:hidden"
      style={{ bottom: 'calc(1.25rem + var(--sab))' }}
      aria-label="Main"
    >
      <div
        ref={barRef}
        className="pointer-events-auto relative mx-auto max-w-md drop-shadow-[0_14px_22px_rgba(0,0,0,0.35)]"
        style={{ height: BAR_HEIGHT }}
      >
        {width > 0 && (
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${width} ${BAR_HEIGHT}`} aria-hidden>
            <defs>
              <linearGradient id="nav-bar-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#CDEE66" />
                <stop offset="100%" stopColor="#B9DD48" />
              </linearGradient>
            </defs>
            <motion.path d={path} fill="url(#nav-bar-fill)" />
          </svg>
        )}

        {/* Black bubble in the dip, holding the active tab's icon */}
        {width > 0 && (
          <motion.div
            className="absolute left-0 flex items-center justify-center rounded-full text-white shadow-[0_6px_14px_rgba(0,0,0,0.35)] [.dark_&]:ring-1 [.dark_&]:ring-white/20"
            style={{
              x: bubbleX,
              width: BUBBLE,
              height: BUBBLE,
              top: NOTCH_DEPTH - BUBBLE_GAP - BUBBLE,
              background: BUBBLE_FILL,
            }}
            aria-hidden
          >
            <active.icon className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </motion.div>
        )}

        {/* Tap targets: inactive tabs show icon and label; the active one its label under the bubble */}
        <div className="absolute inset-y-0 grid grid-cols-5" style={{ left: INSET, right: INSET }}>
          {tabs.map((tab, i) => {
            const isActive = i === index;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/dashboard'}
                aria-label={tab.label}
                className="relative flex flex-col items-center justify-center gap-1"
              >
                <span className="flex" style={{ color: MUTED, opacity: isActive ? 0 : 1 }}>
                  <tab.icon className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
                </span>
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: isActive ? INK : MUTED,
                    position: isActive ? 'absolute' : 'static',
                    bottom: isActive ? 8 : undefined,
                  }}
                >
                  {tab.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
