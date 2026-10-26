import { Link } from 'react-router-dom';
import { Link2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  blue: { card: 'bg-[#0D6EFD]', footer: 'bg-[#0B5ED7] hover:bg-[#0A58CA]', text: 'text-white', icon: 'text-[#073B8C]' },
  green: { card: 'bg-[#198754]', footer: 'bg-[#146C43] hover:bg-[#115C39]', text: 'text-white', icon: 'text-[#0A3D25]' },
  yellow: { card: 'bg-[#FFC107]', footer: 'bg-[#E0A800] hover:bg-[#CC9A06]', text: 'text-[#212529]', icon: 'text-[#9C7400]' },
  red: { card: 'bg-[#DC3545]', footer: 'bg-[#B02A37] hover:bg-[#9A2530]', text: 'text-white', icon: 'text-[#7A1C26]' },
} as const;

export type KpiTone = keyof typeof TONES;

/**
 * Solid-colour stat card (Command Center style): big value, bold label, an
 * optional note, a large faint icon on the right and a "More info" footer.
 */
export function KpiCard({
  tone,
  icon: Icon,
  value,
  label,
  note,
  to,
}: {
  tone: KpiTone;
  icon: LucideIcon;
  value: string;
  label: string;
  note?: string;
  to: string;
}) {
  const t = TONES[tone];
  return (
    <div className={cn('overflow-hidden rounded-md shadow-sm', t.card, t.text)}>
      <div className="relative min-h-[5.5rem] px-3.5 pb-3 pt-3">
        <p className="truncate pr-14 text-[22px] font-bold leading-tight tabular-nums tracking-tight">{value}</p>
        <p className="mt-1.5 truncate pr-14 text-[13px] font-semibold">{label}</p>
        {note && <p className="mt-0.5 truncate pr-14 text-[11.5px] opacity-80">{note}</p>}
        <Icon className={cn('absolute right-3 top-3 h-12 w-12 opacity-40', t.icon)} strokeWidth={1.5} aria-hidden />
      </div>
      <Link
        to={to}
        className={cn('flex items-center justify-center gap-1.5 py-1.5 text-[12.5px] font-medium transition-colors', t.footer)}
      >
        More info
        <Link2 className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
