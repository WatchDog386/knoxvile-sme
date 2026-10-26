import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Landmark, PiggyBank, ShoppingCart, Wallet, Wifi, type LucideIcon } from 'lucide-react';
import type { DashboardData } from '@/api/types';
import { CARD_THEMES, FiberHeroCard, type CardTheme } from '@/components/brand/fiber-card';
import { cn } from '@/lib/utils';

// Space between slides
const SLIDE_GAP = 12;

type Slide = {
  key: string;
  label: string;
  amount: number;
  /** Shown instead of a Ksh amount (e.g. "7" with note "packages"). */
  headline?: string;
  note?: string;
  /** Last digits on the masked number line. */
  count: number;
  footerLeft: string;
  footerRight: string;
  icon: LucideIcon;
  theme: CardTheme;
  action: { label: string; to: string };
};

/**
 * Phone dashboard: swipeable cards in the Team page's card style, each with
 * its own colour and inside pattern for what it shows: sales (rising chart),
 * WiFi packages (signal waves), expenses (receipt), profit (coin stacks) and
 * the 30-day grand total (orbits).
 */
export function SummaryCards({ data }: { data: DashboardData }) {
  const { today } = data;
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => readStorage('biashara_hide_balance') === 'true');
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const pkg = data.packagesToday;

  const slides: Slide[] = [
    {
      key: 'sales',
      label: "Today's revenue",
      amount: today.cashReceived,
      count: today.paymentCount,
      footerLeft: `${today.paymentCount} payment${today.paymentCount === 1 ? '' : 's'} received today`,
      footerRight: `Week ${formatKsh(data.weekRevenue, true)}`,
      icon: ShoppingCart,
      theme: CARD_THEMES.sales,
      action: { label: 'Record sale', to: '/sales/new' },
    },
    {
      key: 'packages',
      label: 'WiFi packages sold today',
      amount: pkg?.revenue ?? 0,
      headline: String(pkg?.count ?? 0),
      note: `package${pkg?.count === 1 ? '' : 's'}`,
      count: pkg?.count ?? 0,
      footerLeft: `${pkg?.new ?? 0} new · ${pkg?.renewals ?? 0} renewals`,
      footerRight: formatKsh(pkg?.revenue ?? 0, true),
      icon: Wifi,
      theme: CARD_THEMES.packages,
      action: { label: 'Subscribers', to: '/subscribers' },
    },
    {
      key: 'expenses',
      label: "Today's expenses",
      amount: today.expenses,
      count: data.pendingApprovals,
      footerLeft: `${data.pendingApprovals} awaiting approval`,
      footerRight: `Sales ${formatKsh(today.sales, true)}`,
      icon: Wallet,
      theme: CARD_THEMES.expenses,
      action: { label: 'Add expense', to: '/expenses?new=1' },
    },
    {
      key: 'profit',
      label: "Today's net profit",
      amount: today.netProfit,
      count: today.salesCount,
      footerLeft: `Gross ${formatKsh(today.grossProfit, true)}`,
      footerRight: `Costs ${formatKsh(today.expenses, true)}`,
      icon: PiggyBank,
      theme: CARD_THEMES.profit,
      action: { label: 'Reports', to: '/reports' },
    },
    {
      key: 'total',
      label: 'Grand total · last 30 days',
      amount: data.monthRevenue,
      count: 30,
      footerLeft: `Week ${formatKsh(data.weekRevenue, true)}`,
      footerRight: `Owed ${formatKsh(data.outstandingDebts, true)}`,
      icon: Landmark,
      theme: CARD_THEMES.total,
      action: { label: 'Sales', to: '/sales' },
    },
  ];

  const toggleHide = () => {
    const next = !hidden;
    setHidden(next);
    writeStorage('biashara_hide_balance', String(next));
  };

  const onScroll = () => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return;
    const step = first.offsetWidth + SLIDE_GAP;
    setActive(Math.min(slides.length - 1, Math.round(track.scrollLeft / step)));
  };

  const goTo = (index: number) => {
    const card = trackRef.current?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  const masked = (node: React.ReactNode) => (
    <span className={cn('transition-all duration-200', hidden && 'select-none blur-sm')}>{node}</span>
  );

  return (
    <section aria-label="Today's summary" className="-mx-4">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4"
        style={{ gap: SLIDE_GAP }}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.key}
            className="w-[88%] shrink-0 snap-start"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}`}
          >
            <FiberHeroCard
              label={slide.label}
              value={
                <span className="flex items-center gap-2.5">
                  {masked(
                    slide.headline ?? (
                      <span className="relative top-1 text-[26px] font-normal text-black">
                        <span className="mr-1">KES</span>
                        {formatAmount(slide.amount, 2)}
                      </span>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={toggleHide}
                    className="relative top-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-80 transition-colors hover:bg-white/10"
                    aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
                  >
                    {hidden ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                  </button>
                </span>
              }
              note={slide.note}
              maskedValue={slide.count}
              footerLeft={slide.footerLeft}
              footerRight={masked(slide.footerRight)}
              icon={slide.icon}
              theme={slide.theme}
              action={{ label: slide.action.label, onClick: () => navigate(slide.action.to) }}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-center gap-1.5">
        {slides.map((slide, index) => (
          <button
            key={slide.key}
            type="button"
            aria-label={`Show card ${index + 1}`}
            aria-current={active === index}
            onClick={() => goTo(index)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              active === index ? 'w-6' : 'w-1.5 bg-foreground-5/40',
            )}
            style={active === index ? { backgroundColor: slide.theme.colors[1] } : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function formatAmount(amount: number, decimals = 0): string {
  const sign = amount < 0 ? '−' : '';
  const digits = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return `${sign}${Math.abs(amount).toLocaleString('en-KE', digits)}`;
}

function formatKsh(amount: number, short = false): string {
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  return `${sign}Ksh ${short ? formatShort(abs) : abs.toLocaleString('en-KE')}`;
}

/** Large amounts shortened (27.1K, 1.74M) so the card footer fits on phones. */
function formatShort(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString('en-KE', { maximumFractionDigits: 2 })}M`;
  }
  if (amount >= 10_000) {
    return `${(amount / 1_000).toLocaleString('en-KE', { maximumFractionDigits: 1 })}K`;
  }
  return amount.toLocaleString('en-KE');
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — preference just won't persist
  }
}
