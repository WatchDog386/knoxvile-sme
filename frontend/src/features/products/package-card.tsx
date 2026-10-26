import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trash2, Wifi } from 'lucide-react';
import type { Product } from '@/api/types';
import { DUO_RED, DuoSubscribers } from '@/components/brand/duo-icons';
import { cn } from '@/lib/utils';

/**
 * Each plan gets its own colour from the package palette, plus the
 * one-line pitch the website gives it. Unknown plans take a colour in turn.
 */
type PlanStyle = { from: string; to: string; pitch?: string; popular?: boolean };
const PLAN_STYLES: Record<string, PlanStyle> = {
  jumbo: { from: '#0288D1', to: '#29B6F6', pitch: 'Great for browsing' },
  buffalo: { from: '#8E24AA', to: '#AB47BC', pitch: 'Streaming and social media' },
  ndovu: { from: '#00897B', to: '#26A69A', pitch: 'Work from home and streaming' },
  gazzelle: { from: '#43A047', to: '#66BB6A', pitch: 'Multiple devices, low latency', popular: true },
  tiger: { from: '#FB8C00', to: '#FFA726', pitch: 'Heavy streaming, gaming ready' },
  chui: { from: '#E6007E', to: '#FF3399', pitch: 'High-speed everything, gaming and 4K' },
};
const FALLBACK = Object.values(PLAN_STYLES);

export function planStyle(name: string, index: number): PlanStyle {
  const key = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return PLAN_STYLES[key] ?? { ...FALLBACK[index % FALLBACK.length], pitch: undefined, popular: false };
}

/** Speed in the round icon, white on the plan colour, with red signal arcs like Safaricom's "4G". */
function SpeedBadge({ speed }: { speed: number }) {
  return (
    <span className="relative text-[12px] font-bold leading-none tracking-tight text-white">
      {speed}M
      <svg viewBox="0 0 12 10" className="absolute -right-2.5 -top-2 h-2.5 w-3" fill="none" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
        <path d="M2 5.5a5 5 0 0 1 8 0M4 7.6a2.4 2.4 0 0 1 4 0" stroke={DUO_RED} />
      </svg>
    </span>
  );
}

/**
 * A WiFi plan in the Safaricom "Home Internet" card style, coloured per plan:
 * dull tile like the product cards, gradient speed icon, the plan's pitch, an outlined "Sell"
 * button and a tinted Wi-Fi watermark. Tapping the card opens it for editing.
 */
export function PackageCard({
  product,
  index = 0,
  onEdit,
  onDelete,
  onAdd,
  inCart = 0,
  footer,
}: {
  product: Product;
  index?: number;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  /** Record sale: tapping the card or its button adds it to the cart. */
  onAdd?: (product: Product) => void;
  /** How many are already in the cart (Record sale). */
  inCart?: number;
  /** Replaces the bottom button (the cart shows a quantity stepper here). */
  footer?: React.ReactNode;
}) {
  const open = () => (onAdd ? onAdd(product) : onEdit?.(product));
  // The speed sits in the icon, so drop it from the end of the name
  const name = product.name.replace(/\s*\d+\s*mbps\s*$/i, '') || product.name;
  const style = planStyle(name, index);
  const speed = product.speed_mbps ? `${product.speed_mbps} Mbps unlimited` : 'Unlimited internet';
  const period = product.billing_days ? ` for ${product.billing_days} days` : '';
  const gradient = `linear-gradient(135deg, ${style.from}, ${style.to})`;
  // The description typed in the form wins; otherwise the website's pitch for the plan
  const pitch = product.description?.trim() || style.pitch;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative flex min-h-[188px] flex-col overflow-hidden rounded-2xl bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]',
        !product.active && 'opacity-60',
      )}
    >
      <Wifi className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 -rotate-12 opacity-[0.16]" style={{ color: style.from }} strokeWidth={1.5} aria-hidden />

      <button type="button" onClick={open} className="flex items-center gap-3 pr-5 text-left">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm" style={{ background: gradient }}>
          {product.speed_mbps ? (
            <SpeedBadge speed={product.speed_mbps} />
          ) : (
            <DuoSubscribers className="h-5 w-5 text-white" />
          )}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-[15px] font-medium leading-snug text-foreground">{name}</span>
          {style.popular && (
            <span className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: gradient }}>
              Most popular
            </span>
          )}
        </span>
      </button>

      {onDelete && !onAdd && (
        <button
          type="button"
          onClick={() => onDelete(product)}
          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-foreground-4 active:bg-surface-3"
          aria-label={`Delete ${product.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      <button type="button" onClick={open} className="mt-3 flex-1 text-left">
        <span className="line-clamp-3 text-[13px] leading-relaxed text-foreground-3">
          {pitch ? `${pitch.replace(/\.$/, '')}. ` : ''}
          {speed}
          {period}.{!product.active && ' Paused.'}
        </span>
      </button>

      {footer ? (
        <div className="relative mt-4">{footer}</div>
      ) : onAdd ? (
        <button
          type="button"
          onClick={() => onAdd(product)}
          className="relative mt-4 inline-flex h-10 items-center self-start rounded-xl border-[1.5px] px-3.5 text-[13px] font-medium tabular-nums transition-colors active:opacity-70"
          style={inCart ? { background: style.from, borderColor: style.from, color: '#FFFFFF' } : { borderColor: style.from, color: style.from }}
        >
          {inCart ? `In cart · ${inCart} · Add another` : `Add · KSh ${product.selling_price.toLocaleString('en-KE')}`}
        </button>
      ) : (
        <Link
          to={`/sales/new?product=${product.id}`}
          className="relative mt-4 inline-flex h-10 items-center self-start rounded-xl border-[1.5px] px-3.5 text-[13px] font-medium tabular-nums transition-opacity active:opacity-70"
          style={{ borderColor: style.from, color: style.from }}
        >
          Sell · KSh {product.selling_price.toLocaleString('en-KE')}
        </Link>
      )}
    </motion.div>
  );
}
