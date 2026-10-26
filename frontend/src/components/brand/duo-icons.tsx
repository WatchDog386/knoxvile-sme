import type { SVGProps } from 'react';

/**
 * Two-tone line icons in the Safaricom-app style: green outline (currentColor)
 * with a red detail. Drawn on a 24px grid, 2px rounded strokes.
 */
export const DUO_RED = '#E23B41';

type IconProps = SVGProps<SVGSVGElement>;

function Duo({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

/** Basket with a red handle (like "Lipa na M-PESA"). */
export function DuoSales(props: IconProps) {
  return (
    <Duo {...props}>
      <path d="M3 9.5h18l-1.7 8.8A2 2 0 0 1 17.3 20H6.7a2 2 0 0 1-2-1.7L3 9.5z" />
      <path d="M9 13.5v3M12 13.5v3M15 13.5v3" />
      <path d="M7.5 9.5V8a4.5 4.5 0 0 1 9 0v1.5" stroke={DUO_RED} />
    </Duo>
  );
}

/** Wallet with a red arrow going out (like "Withdraw Money"). */
export function DuoExpenses(props: IconProps) {
  return (
    <Duo {...props}>
      <path d="M13 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4h12A1.5 1.5 0 0 1 19 5.5V11" />
      <path d="M4 8h12" />
      <rect x="7" y="11" width="4" height="3" rx="0.8" />
      <path d="M18 13.5V21M15 18l3 3 3-3" stroke={DUO_RED} />
    </Duo>
  );
}

/** Two people, the second in red. */
export function DuoCustomers(props: IconProps) {
  return (
    <Duo {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6M21 20a6 6 0 0 0-3.6-5.5" stroke={DUO_RED} />
    </Duo>
  );
}

/** One person with a red plus, for the staff (team) tile. */
export function DuoStaff(props: IconProps) {
  return (
    <Duo {...props}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M18.5 13v6M15.5 16h6" stroke={DUO_RED} />
    </Duo>
  );
}

/** Box with a red ribbon tag (like "Tunukiwa Bundles"). */
export function DuoProducts(props: IconProps) {
  return (
    <Duo {...props}>
      <rect x="4" y="9.5" width="16" height="10.5" rx="1.5" />
      <rect x="3" y="6" width="18" height="3.5" rx="1" />
      <path d="M12 6c-1-2.8-4.6-2.8-4 0M12 6c1-2.8 4.6-2.8 4 0" />
      <path d="M10 12.5v4.5l2-1.4 2 1.4v-4.5" stroke={DUO_RED} />
    </Duo>
  );
}

/** Toolbox with a red latch. */
export function DuoServices(props: IconProps) {
  return (
    <Duo {...props}>
      <rect x="3" y="8" width="18" height="12" rx="1.5" />
      <path d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8" />
      <path d="M3 13h7M14 13h7" />
      <rect x="10" y="11.5" width="4" height="3.5" rx="0.8" stroke={DUO_RED} />
    </Duo>
  );
}

/** Frame with red bars. */
export function DuoReports(props: IconProps) {
  return (
    <Duo {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M8 16.5v-4M12 16.5v-9M16 16.5v-6" stroke={DUO_RED} />
    </Duo>
  );
}

/** House with red Wi-Fi inside (like "Home Internet"). */
export function DuoSubscribers(props: IconProps) {
  return (
    <Duo {...props}>
      <path d="M12 3 21 9.6 18.4 20H5.6L3 9.6z" />
      <path d="M8.6 13.2a4.8 4.8 0 0 1 6.8 0M10.4 15.3a2.3 2.3 0 0 1 3.2 0" stroke={DUO_RED} />
      <circle cx="12" cy="17.4" r="0.4" stroke={DUO_RED} fill={DUO_RED} />
    </Duo>
  );
}

/** Handset with a red corner mark (like "Airtime Top Up"). */
export function DuoCalls(props: IconProps) {
  return (
    <Duo {...props}>
      <path d="M21 16.4v2.7a1.8 1.8 0 0 1-2 1.8 17.8 17.8 0 0 1-7.8-2.8 17.5 17.5 0 0 1-5.4-5.4A17.8 17.8 0 0 1 3 4.9 1.8 1.8 0 0 1 4.8 3h2.7a1.8 1.8 0 0 1 1.8 1.5c.1.9.3 1.7.6 2.5a1.8 1.8 0 0 1-.4 1.9L8.3 10a14.4 14.4 0 0 0 5.4 5.4l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.8.3 1.6.5 2.5.6a1.8 1.8 0 0 1 1.5 1.8z" />
      <path d="M15.5 3H21v5.5" stroke={DUO_RED} />
    </Duo>
  );
}

/** Bell with a red clapper and alert dot (like the Safaricom header). */
export function DuoBell(props: IconProps) {
  return (
    <Duo {...props}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 21h4" stroke={DUO_RED} />
      <circle cx="18.5" cy="5" r="2" stroke={DUO_RED} fill={DUO_RED} />
    </Duo>
  );
}

/** Menu lines, the middle one red. */
export function DuoMenu(props: IconProps) {
  return (
    <Duo {...props}>
      <path d="M4 6h16M4 18h16" />
      <path d="M4 12h10" stroke={DUO_RED} />
    </Duo>
  );
}

/** Magnifier with a red handle (like the Safaricom search button). */
export function DuoSearch(props: IconProps) {
  return (
    <Duo {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" stroke={DUO_RED} />
    </Duo>
  );
}

/** QR scan: red corner brackets around green code squares (like Safaricom's "Scan to pay"). */
export function DuoScan({ mono, ...props }: IconProps & { mono?: boolean }) {
  return (
    <Duo {...props}>
      <path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8M16 3h3.5A1.5 1.5 0 0 1 21 4.5V8M21 16v3.5a1.5 1.5 0 0 1-1.5 1.5H16M8 21H4.5A1.5 1.5 0 0 1 3 19.5V16" stroke={mono ? 'currentColor' : DUO_RED} />
      <rect x="7" y="7" width="4" height="4" rx="0.8" />
      <rect x="13" y="7" width="4" height="4" rx="0.8" />
      <rect x="7" y="13" width="4" height="4" rx="0.8" />
      <path d="M13 13h1.5M17 13v1.5M13 17h4M15.5 15.5h0" />
    </Duo>
  );
}
