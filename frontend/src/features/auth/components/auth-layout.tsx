import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import logo from '@/assets/knoxville-logo.png';

export function AuthLayout({
  title,
  desktopTitle,
  mobileTitle,
  subtitle,
  desktopSubtitle,
  hideLabelsOnMobile,
  hideFooterLinks,
  hideMobileFooter,
  forceMobileLayout,
  centerTitle,
  children,
}: {
  title?: string;
  /** Heading on the desktop card, if it should differ from the default. */
  desktopTitle?: string;
  /** Heading on phones, if it should differ from the default. */
  mobileTitle?: string;
  subtitle?: string;
  /** Subtitle on desktop, if it should differ from the default. */
  desktopSubtitle?: string;
  /** Phones show placeholder-only fields; labels stay for screen readers. */
  hideLabelsOnMobile?: boolean;
  hideFooterLinks?: boolean;
  /** Drop the small print under the form on phones. */
  hideMobileFooter?: boolean;
  /** Use the phone layout on desktop as well. */
  forceMobileLayout?: boolean;
  /** Centre the heading and subtitle in the phone layout. */
  centerTitle?: boolean;
  children: React.ReactNode;
}) {
  const isDesktop = useIsDesktop();
  if (isDesktop && !forceMobileLayout) {
    return (
      <DesktopAuthLayout title={desktopTitle ?? title} subtitle={desktopSubtitle ?? subtitle} hideFooterLinks={hideFooterLinks}>
        {children}
      </DesktopAuthLayout>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6 pb-10 pt-[max(9rem,var(--sat))]">
      <div className="mx-auto w-full max-w-sm">
        <Link to="/" className="flex justify-center" aria-label="Knoxville home">
          <img src={logo} alt="Knoxville Technologies logo" width={1200} height={488} className="w-36 object-contain" />
        </Link>

        {(title || mobileTitle || subtitle) && (
          <div className={cn('mt-14', centerTitle && 'text-center')}>
            {(mobileTitle ?? title) && (
              <h1 className="text-3xl font-normal tracking-tight text-slate-800">{mobileTitle ?? title}</h1>
            )}
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
        )}

        {/* Login uses dark fields; the other auth screens keep their muted fields. */}
        <div
          className={cn(
            forceMobileLayout
              ? 'login-dark-fields mt-6 [&_input]:!rounded-xl [&_input]:!border-2 [&_input]:!border-white/70 [&_input]:!bg-[#1E1E1E] [&_input]:!text-white [&_input]:!shadow-none [&_input]:placeholder:!text-white/60 [&_button:not([data-keep-color])]:!text-white/70'
              : 'mt-6 [&_input]:!rounded-lg [&_input]:!border-transparent [&_input]:!bg-slate-100 [&_input]:!text-slate-600 [&_input]:!shadow-none [&_input]:placeholder:text-slate-400',
            hideLabelsOnMobile && '[&_label]:sr-only',
          )}
        >
          {children}
        </div>

        {!hideFooterLinks && !hideMobileFooter && (
          <p className="mt-10 text-center text-xs text-slate-400">
            By continuing you agree to our Terms and Privacy Policy.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Desktop sign-in: the same white page and colour theme as the phone view,
 * centred in the viewport so it doesn't hug the top of a tall screen.
 */
function DesktopAuthLayout({
  title,
  subtitle,
  hideLabelsOnMobile,
  hideFooterLinks,
  children,
}: {
  title?: string;
  subtitle?: string;
  hideLabelsOnMobile?: boolean;
  hideFooterLinks?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-16">
      <div className="mx-auto w-full max-w-sm">
        <Link to="/" className="flex justify-center" aria-label="Knoxville home">
          <img src={logo} alt="Knoxville Technologies logo" width={1200} height={488} className="w-36 object-contain" />
        </Link>

        {title && <h1 className="mt-10 text-center text-3xl font-normal tracking-tight text-slate-800">{title}</h1>}
        {subtitle && <p className="mt-1 text-center text-sm text-slate-500">{subtitle}</p>}

        {/* Muted, borderless fields as in the mobile mock-ups */}
        <div
          className={cn(
            'mt-6 [&_input]:!rounded-lg [&_input]:!border-transparent [&_input]:!bg-slate-100 [&_input]:!text-slate-600 [&_input]:!shadow-none [&_input]:placeholder:text-slate-400',
            hideLabelsOnMobile && '[&_label]:sr-only',
          )}
        >
          {children}
        </div>

        {!hideFooterLinks && (
          <p className="mt-10 text-center text-xs text-slate-400">
            By continuing you agree to our Terms and Privacy Policy.
          </p>
        )}
      </div>
    </div>
  );
}

export function AuthFooterLink({
  text,
  linkText,
  to,
}: {
  text: string;
  linkText: string;
  to: string;
}) {
  return (
    <p className="mt-6 text-center text-sm text-foreground-3">
      {text}{' '}
      <Link
        to={to}
        className="font-medium text-brand-600 transition-colors hover:text-brand-700"
      >
        {linkText}
      </Link>
    </p>
  );
}
