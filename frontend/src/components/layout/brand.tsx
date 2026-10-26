import { cn } from '@/lib/utils';
import logo from '@/assets/knoxville-logo.png';
import logoLight from '@/assets/knoxville-logo-light.png';

/** Image width and the wordmark's font sizes for each size. */
const sizes = {
  sm: { img: 'w-24', name: 'text-[13px]', sub: 'text-[10px]' },
  md: { img: 'w-28', name: 'text-sm', sub: 'text-[10px]' },
  lg: { img: 'w-40', name: 'text-base', sub: 'text-[11px]' },
  xl: { img: 'w-56', name: 'text-xl', sub: 'text-[13px]' },
} as const;

export function Brand({
  className,
  compact = false,
  onDark = false,
  size = 'md',
}: {
  className?: string;
  compact?: boolean;
  onDark?: boolean;
  size?: keyof typeof sizes;
}) {
  // The logo is ~2.5:1 (on a white card when onDark), so it is sized by width
  // with height derived from the intrinsic aspect ratio (never a fixed square).
  const scale = sizes[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img
        src={onDark ? logoLight : logo}
        alt="Knoxville Technologies logo"
        width={1200}
        height={onDark ? 576 : 488}
        className={cn('shrink-0 object-contain', scale.img)}
      />
      {!compact && (
        <div className="leading-tight">
          <p
            className={cn(
              'font-display font-medium tracking-tight',
              scale.name,
              onDark ? 'text-white' : 'text-foreground',
            )}
          >
            Knoxville
          </p>
          <p
            className={cn(
              'font-medium',
              scale.sub,
              onDark ? 'text-white/70' : 'text-foreground-5',
            )}
          >
            Technologies Ltd
          </p>
        </div>
      )}
    </div>
  );
}