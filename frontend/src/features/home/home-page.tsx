import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Monitor,
  PackageCheck,
  PiggyBank,
  Repeat,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { Brand } from '@/components/layout/brand';
import { useAuthStore } from '@/stores/auth';

const features = [
  {
    icon: PackageCheck,
    title: 'Sales & stock',
    text: 'Record sales in seconds, track stock across every product line and get low-stock warnings before you run out.',
  },
  {
    icon: ClipboardCheck,
    title: 'Expense approvals',
    text: 'Staff submit expenses with a receipt photo. Managers and accountants approve or reject with one click.',
  },
  {
    icon: PiggyBank,
    title: 'Budgets & alerts',
    text: 'Set a monthly limit per category and get warned at 80% — long before marketing or transport runs over.',
  },
  {
    icon: Repeat,
    title: 'Recurring bills',
    text: 'Rent, salaries and subscriptions are logged automatically on their day, every month.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Reports & exports',
    text: 'Profit & loss, daily summaries and expense reports — download them as Excel or PDF for the accountant.',
  },
  {
    icon: Users,
    title: 'Roles for the whole team',
    text: 'Admins, managers, accountants and sales staff each see exactly what their role needs.',
  },
];

const steps = [
  { title: 'Sign in', text: 'Use the account your Knoxville administrator created for you.' },
  { title: 'Record the day', text: 'Sales, expenses and stock movements as they happen — from a desk or your phone.' },
  { title: 'Know your numbers', text: 'Live profit, budgets and approvals on one dashboard.' },
];

/** Public landing page shown on desktop at "/". Phones skip it and go to login or the dashboard. */
export function HomePage() {
  const token = useAuthStore((s) => s.token);
  const primary = token
    ? { to: '/dashboard', label: 'Go to dashboard' }
    : { to: '/login', label: 'Sign in' };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-8">
          <Link to="/" aria-label="Knoxville home">
            <Brand compact size="md" />
          </Link>
          <nav className="flex items-center gap-8 text-sm font-medium text-slate-600" aria-label="Main">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900">How it works</a>
            <a href="#devices" className="hover:text-slate-900">Desktop &amp; mobile</a>
          </nav>
          <Link
            to={primary.to}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800"
          >
            {primary.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl grid-cols-[1.05fr_1fr] items-center gap-14 px-8 py-24">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Internal system · Knoxville Technologies Ltd
            </span>
            <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-tight text-white xl:text-6xl">
              Run Knoxville from
              <br />
              one place.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-white/85">
              Sales, stock, expenses and reports for the whole team — with approvals,
              budgets and recurring bills built in. On your desktop and on your phone.
            </p>
            <div className="flex items-center gap-4">
              <Link
                to={primary.to}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-brand-800 shadow-lg shadow-black/10 transition-transform hover:scale-[1.02]"
              >
                {primary.label}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href="#features"
                className="inline-flex h-12 items-center rounded-full border border-white/40 px-7 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                See what&apos;s inside
              </a>
            </div>
            <p className="text-xs text-white/60">
              No sign-up — accounts are created by your Knoxville administrator.
            </p>
          </div>

          <DashboardPreview />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Features</p>
            <h2 className="mt-2 text-4xl font-medium tracking-tight">
              Everything the business runs on, in one system.
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <f.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-medium">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-16 py-24">
        <div className="mx-auto max-w-7xl px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">How it works</p>
          <h2 className="mt-2 text-4xl font-medium tracking-tight">Three steps to a clear picture.</h2>
          <ol className="mt-12 grid grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <li key={step.title} className="relative rounded-3xl border border-slate-200 p-7">
                <span className="text-5xl font-medium text-brand-100">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-lg font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Devices */}
      <section id="devices" className="scroll-mt-16 bg-slate-900 py-24 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 items-center gap-16 px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-200">Desktop &amp; mobile</p>
            <h2 className="mt-2 text-4xl font-medium tracking-tight">At the desk or on the shop floor.</h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-white/70">
              The same account works everywhere. Use the full desktop dashboard in the office,
              and install the app on your phone to record sales and submit expenses on the go.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <DeviceCard
              icon={Monitor}
              title="Desktop"
              points={['Full dashboard & reports', 'Approve expenses', 'Excel & PDF exports']}
            />
            <DeviceCard
              icon={Smartphone}
              title="Phone"
              points={['Record sales fast', 'Snap receipts', 'Install as an app']}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-8 rounded-[2rem] bg-gradient-to-r from-brand-700 to-brand-600 px-12 py-12 text-white shadow-xl">
          <div>
            <h2 className="text-3xl font-medium tracking-tight">Ready to get to work?</h2>
            <p className="mt-2 text-white/80">Sign in with your Knoxville staff account.</p>
          </div>
          <Link
            to={primary.to}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-brand-800 transition-transform hover:scale-[1.02]"
          >
            {primary.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Knoxville Technologies Ltd. Authorised staff only.</p>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Secure &amp; private
          </span>
        </div>
      </footer>
    </div>
  );
}

function DeviceCard({
  icon: Icon,
  title,
  points,
}: {
  icon: typeof Monitor;
  title: string;
  points: string[];
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <Icon className="h-7 w-7 text-brand-200" aria-hidden />
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-white/75">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Illustrative product preview built from markup, so it stays crisp at any size. */
function DashboardPreview() {
  const bars = [42, 58, 35, 71, 64, 88, 52];
  return (
    <div className="relative" aria-hidden>
      <div className="rounded-3xl bg-white p-5 shadow-2xl shadow-black/30 ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-500">Good morning,</p>
            <p className="text-sm font-medium text-slate-900">Dashboard</p>
          </div>
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ['Sales today', 'Ksh 186,400', 'text-slate-900'],
            ['Net profit', 'Ksh 41,250', 'text-emerald-600'],
            ['Expenses', 'Ksh 2,200', 'text-rose-600'],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className={`mt-1 text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="text-[10px] text-slate-500">This week</p>
          <div className="mt-3 flex h-28 items-end gap-2">
            {bars.map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t-md ${i === 5 ? 'bg-brand-600' : 'bg-brand-200'}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="flex items-center gap-2 text-[11px] font-medium text-amber-800">
              <ClipboardCheck className="h-3.5 w-3.5" /> 3 expenses awaiting approval
            </span>
            <span className="text-[10px] font-semibold text-amber-700">Review</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
            <span className="flex items-center gap-2 text-[11px] font-medium text-rose-800">
              <PiggyBank className="h-3.5 w-3.5" /> Marketing at 112% of budget
            </span>
            <span className="text-[10px] font-semibold text-rose-700">View</span>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-6 -left-8 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl ring-1 ring-black/5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <BarChart3 className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] text-slate-500">Exported</p>
          <p className="text-xs font-semibold text-slate-900">profit-loss.xlsx</p>
        </div>
      </div>
    </div>
  );
}
