import { Link } from 'react-router-dom';
import mainLogo from '@/assets/knoxville-logo-main.png';
import { HomePhoto } from '@/components/brand/home-photo';
import { useId } from 'react';
import { ArrowRight, Headset, MessageCircle, Smartphone, Wifi } from 'lucide-react';
import { CARD_THEMES, CardPatternLayer } from '@/components/brand/fiber-card';
import { usePhotoStatusBar } from '@/hooks/use-photo-status-bar';

const SUPPORT_PHONE = '0741 874 200';

/** What Knoxville offers; the same page greets admins, staff and subscribers. */
const cards = [
  { icon: Smartphone, title: 'My account', text: 'See your package, pay and renew from your phone.' },
  { icon: Headset, title: 'Support', text: 'Our team is ready to help, any time.' },
];

/**
 * Mobile landing page for signed-out users, shown after logging out.
 * Only rendered on phone-width screens; desktop keeps going straight to sign-in.
 *
 * Layout: the photo fills the top edge to edge (under the status bar) with the
 * logo on it. Below it sits a solid white sheet, like the loading screen,
 * about Knoxville Technologies itself: the same app serves admins, staff and
 * subscribers, so nothing here is about running a business.
 */
export function MobileHomePage() {
  const uid = useId().replace(/:/g, '');

  usePhotoStatusBar();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white">
      {/* Photo covers the top, from under the status bar down behind the sheet */}
      <HomePhoto featured className="absolute inset-0 h-full w-full object-cover" />

      <div className="relative flex min-h-[170px] w-full flex-1 items-center justify-center pb-10 pt-[var(--sat)]">
        <img src={mainLogo} alt="Knoxville Technologies" width={900} height={366} className="w-60 max-w-[75%] drop-shadow-[0_2px_10px_rgba(255,255,255,0.35)]" />
      </div>

      {/* Solid white sheet, as on the loading screen */}
      <main className="relative flex max-h-[calc(100%-170px)] shrink-0 flex-col rounded-t-3xl bg-white px-5 pb-[max(1rem,var(--sab))] pt-3 text-slate-900 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
        <div className="mx-auto h-1 w-12 shrink-0 rounded-full bg-slate-300" aria-hidden />

        {/* Middle content scrolls only on very short screens; Login stays pinned below */}
        <div className="-mx-5 min-h-0 flex-1 overflow-y-auto px-5">
          <h1 className="mt-4 text-center text-[22px] font-semibold tracking-tight text-slate-900">Welcome to Knoxville</h1>

          {/* Green hero card: who Knoxville is */}
          <div className="relative mt-4 flex h-32 flex-col justify-center overflow-hidden rounded-3xl px-5 text-white">
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 144" preserveAspectRatio="xMidYMid slice" aria-hidden>
              <defs>
                <linearGradient id={`${uid}-green`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={CARD_THEMES.sales.colors[0]} />
                  <stop offset="55%" stopColor={CARD_THEMES.sales.colors[1]} />
                  <stop offset="100%" stopColor={CARD_THEMES.sales.colors[2]} />
                </linearGradient>
              </defs>
              <rect width="400" height="144" fill={`url(#${uid}-green)`} />
              <CardPatternLayer theme={CARD_THEMES.sales} w={400} h={144} uid={uid} showChip={false} />
            </svg>
            <h2 className="relative text-lg font-semibold">Stay connected</h2>
            <p className="relative mt-1 max-w-[68%] text-sm leading-snug text-white/90">
              Fast, reliable internet for your home and business.
            </p>
            <Wifi className="absolute right-5 top-1/2 h-20 w-20 -translate-y-1/2 text-white/90 drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]" aria-hidden />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {cards.map((card) => (
              <div key={card.title} className="relative flex min-h-[148px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">{card.title}</h2>
                <p className="mt-1 max-w-[80%] text-xs leading-snug text-slate-500">{card.text}</p>
                <span
                  aria-hidden
                  className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_4px_10px_rgba(63,126,8,0.35)]"
                  style={{ background: 'radial-gradient(circle at 32% 26%, #A9E06D 0%, #63AD18 45%, #3F7E08 100%)' }}
                >
                  <card.icon className="h-6 w-6" />
                </span>
              </div>
            ))}
          </div>

          <Link
            to="/help"
            aria-label="Open help and support"
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-transform active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Need help?</p>
              <p className="text-xs text-slate-500">Call or WhatsApp {SUPPORT_PHONE}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
          </Link>
        </div>

        {/* Login button, always in full view at the bottom of the sheet */}
        <div className="shrink-0 pt-4">
          <Link
            to="/login"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#3A8F91] text-[20px] font-medium text-white shadow-none transition-colors hover:bg-[#2F7F81] active:bg-[#2F7F81]"
          >
            Login
          </Link>
        </div>
      </main>
    </div>
  );
}
