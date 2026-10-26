import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Phone,
  Receipt,
  RefreshCw,
  Search,
  UserCog,
} from 'lucide-react';
import {
  DuoCalls,
  DuoCustomers,
  DuoProducts,
  DuoReports,
  DuoSales,
} from '@/components/brand/duo-icons';
import { QuickActions, type QuickAction } from '@/features/dashboard/components/quick-actions';
import { PaymentRow } from './client-shared';
import { ClientBackdrop } from './client-backdrop';
import { clientApi, type ClientHome } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { WorkspaceLoader } from '@/components/ui/workspace-loader';
import { WhatsAppIcon } from '@/components/brand/whatsapp-icon';
import { useAuthStore } from '@/stores/auth';
import { AdvertBanner } from '@/components/brand/advert-banner';
import { cn, formatKES } from '@/lib/utils';

type Pkg = ClientHome['packages'][number];

/** Dark green of the package card. */
const CARD_FROM = '#12463A';
const CARD_MID = '#0D5B3F';
const CARD_TO = '#072A21';

const STATUS = {
  ACTIVE: { label: 'Connected', cls: 'bg-emerald-400/20 text-emerald-200', bar: '#8BC53F' },
  EXPIRING: { label: 'Expiring soon', cls: 'bg-amber-400/20 text-amber-200', bar: '#F08C21' },
  EXPIRED: { label: 'Expired', cls: 'bg-red-400/20 text-red-200', bar: '#E23B41' },
} as const;

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  );
}

/** Teal ringed avatar: the saved photo when there is one, initials otherwise. */
function ProfileAvatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#3A8F91] to-[#2F7F81] text-[14px] font-semibold text-white ring-2 ring-white">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );
}

/** Translucent panel sitting over the photo, so the photo reads through it. */
function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        'rounded-lg border border-white/15 bg-black/55 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md',
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Outlined pill button used on the dark panels. */
function PillButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-white/70 text-[13px] font-semibold text-white transition-transform active:scale-[0.97]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Client dashboard: a WiFi client's own app, laid out like the reference banking
 * home screen — a photo behind the page, a bare top bar with the greeting, a green
 * package card, a balance strip, quick actions and a floating bottom bar.
 * They never see anything of the business beyond this.
 */
export function ClientDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['client-me'], queryFn: clientApi.me });
  const topRef = useRef<HTMLDivElement>(null);
  const paymentsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add('page-white', 'dash-glow-body');
    return () => document.body.classList.remove('page-white', 'dash-glow-body');
  }, []);

  if (isLoading) return <WorkspaceLoader />;
  if (error || !data) {
    return (
      <div className="space-y-4 pt-10">
        <Alert variant="error" title="Could not load your account" inline>
          {apiErrorMessage(error)}
        </Alert>
        <button type="button" onClick={logout} className="mx-auto block text-[13px] font-semibold text-foreground-3">
          Sign out
        </button>
      </div>
    );
  }

  const sub = data.subscription;
  const current = data.packages.find((p) => p.id === sub?.productId) ?? null;
  const status = sub ? STATUS[sub.status] : null;
  const firstName = (data.customer.name || user?.fullName || '').split(' ')[0];
  const period = current?.billingDays ?? 30;
  const phoneDigits = (data.business.phone ?? '').replace(/\D/g, '').replace(/^0/, '254');

  const jump = (ref: React.RefObject<HTMLElement | null>) =>
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /** Sends the client to the amount step of the M-Pesa flow. */
  const pay = (pkg: Pkg | null) =>
    navigate(pkg ? `/my-amount?pkg=${pkg.id}` : '/my-amount');

  /** Quick actions reuse the admin dashboard's own grid, so the tiles always match. */
  const quickActions: QuickAction[] = [
    { to: 'pay', label: 'Pay with M-Pesa', icon: DuoSales },
    { to: 'packages', label: 'Packages', icon: DuoProducts },
    { to: 'receipts', label: 'Receipts', icon: DuoReports },
    { to: 'call', label: 'Call us', icon: DuoCalls },
    { to: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon },
    { to: 'details', label: 'My account', icon: DuoCustomers },
  ].filter((a) => a.to !== 'call' || Boolean(data.business.phone)) as QuickAction[];

  const onQuickAction = (to: string) => {
    if (to === 'pay') return pay(current);
    if (to === 'packages') return navigate('/my-packages');
    if (to === 'receipts') return navigate('/my-notifications');
    if (to === 'call' || to === 'whatsapp') return navigate('/my-contact');
    if (to === 'details') return navigate('/my-account');
  };

  return (
    <div className="relative isolate -mx-4 -mt-2 min-h-[100dvh] pb-8">
      {/* Photo behind the whole page, dark enough for white text to read; it stays put on scroll */}
      <ClientBackdrop />

      <div ref={topRef} />

      {/* Top bar: avatar, centred greeting, then notifications and the account button.
          Translucent so the photo reads through it. */}
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-4 bg-black/45 px-5 pb-3 pt-[max(0.75rem,var(--sat))] backdrop-blur-md">
        <ProfileAvatar name={data.customer.name} src={user?.avatarUrl} />
        <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-semibold text-white">
          Hello {firstName} 👋
        </h1>
        <button
          type="button"
          onClick={() => navigate('/my-notifications')}
          className="relative shrink-0 text-white transition-transform active:scale-90"
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6" strokeWidth={1.9} aria-hidden />
          {data.payments.length > 0 && (
            <span
              aria-hidden
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#8BC53F] px-1 text-[9px] font-bold text-white"
            >
              {data.payments.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('/my-account')}
          className="shrink-0 text-white transition-transform active:scale-90"
          aria-label="My account"
        >
          <UserCog className="h-6 w-6" strokeWidth={1.9} aria-hidden />
        </button>
      </header>

      <div className="px-5 pt-3">
        {/* Search takes you to the packages page with the term */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/my-packages?q=${encodeURIComponent(query.trim())}`);
          }}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search packages…"
              className="w-full rounded-full border border-white/15 bg-black/40 py-3 pl-11 pr-4 text-sm font-medium text-white outline-none placeholder:font-medium placeholder:text-white/60"
              autoComplete="off"
              aria-label="Search packages"
            />
          </div>
        </form>

        {/* Hero: a single card for the subscribed package, in the reference's card style */}
{current ? (
          <article
            className="relative mt-4 overflow-hidden rounded-lg border border-white/15 p-5 text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,0.85)]"
            style={{ background: `linear-gradient(135deg, ${CARD_FROM} 0%, ${CARD_MID} 55%, ${CARD_TO} 100%)` }}
          >
            {/* Faint decorative arcs on the right, like the reference card */}
            <svg
              className="pointer-events-none absolute -right-10 top-0 h-full w-1/2 opacity-25"
              viewBox="0 0 200 200"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden
            >
              <g fill="none" stroke="white" strokeWidth="0.7">
                {[26, 44, 62, 80, 98].map((r) => (
                  <circle key={r} cx="200" cy="70" r={r} />
                ))}
              </g>
            </svg>

            <div className="relative">
              <p className="text-[13px] text-white/80">My WiFi package</p>
              <p className="mt-1 text-[13px] font-semibold uppercase tracking-wide text-white/90">
                {data.customer.name}
              </p>

              <p className="mt-3 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[22px] font-semibold leading-tight">
                  {current.name.replace(/\s*\d+\s*mbps\s*$/i, '')}
                </span>
                <span className="shrink-0 text-[15px] font-medium text-white/85">
                  {current.speedMbps ? `${current.speedMbps} Mbps` : 'Unlimited'}
                </span>
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <PillButton onClick={() => jump(paymentsRef)}>
                  <Receipt className="h-4 w-4" aria-hidden />
                  Statement
                </PillButton>
                <PillButton onClick={() => pay(current)}>
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  {sub?.status === 'EXPIRED' ? 'Renew' : 'Deposit'}
                </PillButton>
              </div>

              <p className="mt-3 text-[12px] text-white/70">
                {Math.max(0, sub?.daysLeft ?? 0)} days left · {formatKES(current.price)}
                {status && (
                  <span className={cn('ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold', status.cls)}>
                    {status.label}
                  </span>
                )}
              </p>
            </div>
          </article>
        ) : (
          <Panel className="mt-4 p-5">
            <p className="text-[18px] font-semibold text-white">No WiFi package yet</p>
            <p className="mt-1 text-[13px] text-white/75">Open the Packages page below to choose one and pay with M-Pesa.</p>
          </Panel>
        )}

        {/* Days-left bar, in the reference's loan balance style: light left half,
            chamfered dark right half with the action and its ring */}
        {sub && (
          <div className="relative mt-4 flex items-stretch overflow-hidden rounded-xl border border-white/15 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.85)]">
            <div
              className="flex min-w-0 flex-1 items-center px-4 py-4 text-white"
              style={{ background: `linear-gradient(120deg, ${CARD_FROM} 0%, ${CARD_MID} 100%)` }}
            >
              <p className="min-w-0 truncate text-[15px] font-medium text-white/90">
                Days left:{' '}
                <span className="font-semibold text-white">
                  {Math.max(0, sub.daysLeft)} of {period}
                </span>
              </p>
            </div>

            {/* The dark half laps over the light one on a diagonal, as in the reference */}
            <button
              type="button"
              onClick={() => current && pay(current)}
              className="relative flex shrink-0 items-center gap-2.5 py-4 pl-7 pr-3 text-white"
              style={{
                background: `linear-gradient(120deg, ${CARD_MID} 0%, ${CARD_TO} 100%)`,
                clipPath: 'polygon(1.5rem 0, 100% 0, 100% 100%, 0 100%)',
              }}
            >
              <span className="whitespace-nowrap text-[14px] font-medium">
                {sub.status === 'EXPIRED' ? 'Renew now' : 'Pay now'}
              </span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#8BC53F] bg-black/25">
                <ArrowRight className="h-4 w-4 text-white" strokeWidth={2.4} aria-hidden />
              </span>
            </button>
          </div>
        )}

        {/* Quick actions: the admin dashboard's own grid, on the dark panel */}
        <Panel className="mt-4 rounded-2xl p-4">
          <QuickActions
            items={quickActions}
            viewAll
            onSelect={onQuickAction}
            onManage={() => navigate('/my-packages')}
            titleClassName="!text-white"
            labelClassName="!text-white"
          />
        </Panel>

        {/* Paybill advert: how to pay and who to call */}
        <AdvertBanner className="mt-4" />

        {/* My payments, straight on the photo with no card around it */}
        <div ref={paymentsRef} className="mt-5">
          <div className="mb-1 flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-white">My payments</h2>
            <span className="text-[12px] text-white/70">{data.payments.length}</span>
          </div>
          {data.payments.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-white/70">No payments yet.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {data.payments.map((p) => (
                <PaymentRow key={p.id} payment={p} />
              ))}
            </ul>
          )}
        </div>


        {/* Need help */}
        {data.business.phone && (
          <div className="pt-5">
            <Panel className="p-4">
              <p className="text-[15px] font-semibold text-white">Need help with your WiFi?</p>
              <p className="mt-0.5 text-[12px] text-white/75">
                Our support team at {data.business.name} is here for you.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <PillButton
                  className="border-[#0288D1] bg-[#0288D1]"
                  onClick={() => window.location.assign(`tel:${data.business.phone}`)}
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  Call us
                </PillButton>
                <PillButton
                  className="border-[#25D366] bg-[#25D366]"
                  onClick={() => window.open(`https://wa.me/${phoneDigits}`, '_blank')}
                >
                  <WhatsAppIcon className="h-4 w-4" aria-hidden />
                  WhatsApp
                </PillButton>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}