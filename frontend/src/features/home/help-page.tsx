import { useNavigate, Link } from 'react-router-dom';
import { HomePhoto } from '@/components/brand/home-photo';
import { ArrowUpRight, KeyRound, PhoneCall, ShieldCheck } from 'lucide-react';
import { AppBar } from '@/components/layout/app-bar';
import { WhatsAppIcon } from '@/components/brand/whatsapp-icon';
import { usePhotoStatusBar } from '@/hooks/use-photo-status-bar';

const SUPPORT_PHONE = '+254726818938';
const SUPPORT_DIGITS = SUPPORT_PHONE.replace(/\D/g, '');
const SUPPORT_MESSAGE = encodeURIComponent('Hi Knoxville, I need help with my account.');

/** Public support page opened from the signed-out mobile home screen. */
export function HelpPage() {
  const navigate = useNavigate();
  usePhotoStatusBar();

  return (
    <div className="dark fixed inset-0 isolate overflow-y-auto bg-[#121212] text-white">
      <HomePhoto className="fixed inset-0 z-0 h-full w-full object-cover" />
      <div
        aria-hidden
        className="fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/45 to-black/75"
      />

      <main className="relative z-10 mx-auto min-h-full w-full max-w-xl px-5 pb-[max(1.5rem,var(--sab))]">
        <AppBar
          title="Help & support"
          onBack={() => navigate('/')}
          className="!bg-black/20 !backdrop-blur-sm"
          titleClassName="!text-white"
          backClassName="!text-white"
        />

        <div className="pb-8 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A9E06D]">Knoxville support</p>
          <h2 className="mt-2 text-[25px] font-semibold leading-tight tracking-tight">How can we help?</h2>
          <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/75">
            Contact our team about signing in, your account, WiFi packages, sales or payments.
          </p>

          <section className="mt-5 rounded-2xl border border-white/10 bg-[#1E1E1E] p-4 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)]">
            <h3 className="text-[15px] font-semibold">Contact the support team</h3>
            <p className="mt-1 text-[12px] text-white/65">Choose a channel and we’ll help you from there.</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="flex min-h-[104px] flex-col items-start justify-between rounded-xl border border-white/10 bg-[#303538] p-3 transition-colors active:bg-[#3B4245]"
              >
                <PhoneCall className="h-5 w-5 text-[#60B8E8]" aria-hidden />
                <span>
                  <span className="block text-[13px] font-semibold">Call support</span>
                  <span className="mt-0.5 block text-[11px] text-white/65">{SUPPORT_PHONE}</span>
                </span>
              </a>
              <a
                href={`https://wa.me/${SUPPORT_DIGITS}?text=${SUPPORT_MESSAGE}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[104px] flex-col items-start justify-between rounded-xl border border-[#25D366]/45 bg-[#075E45] p-3 transition-colors active:bg-[#064B38]"
              >
                <WhatsAppIcon className="h-5 w-5 text-[#25D366]" aria-hidden />
                <span>
                  <span className="block text-[13px] font-semibold">WhatsApp</span>
                  <span className="mt-0.5 block text-[11px] text-white/65">Message our team</span>
                </span>
              </a>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-white/10 bg-[#1E1E1E] p-4 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)]">
            <h3 className="text-[15px] font-semibold">Common questions</h3>

            <div className="mt-3 divide-y divide-white/10">
              <div className="flex items-start gap-3 py-3 first:pt-0">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#F4B942]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">Forgot your password?</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-white/65">Request a password reset using the email on your account.</p>
                  <Link to="/forgot-password" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#A9E06D]">
                    Reset password <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-3 py-3 last:pb-0">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#60B8E8]" aria-hidden />
                <div>
                  <p className="text-[13px] font-medium">Need access to your business?</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-white/65">Ask your business administrator to create or activate your account.</p>
                </div>
              </div>
            </div>
          </section>

          <Link
            to="/login"
            className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#3A8F91] text-[14px] font-semibold text-white transition-colors active:bg-[#2F7F81]"
          >
            Go to login
          </Link>
        </div>
      </main>
    </div>
  );
}
