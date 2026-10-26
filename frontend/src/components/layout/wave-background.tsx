import { cn } from '@/lib/utils';

let uid = 0;

export function WaveBackground({
  className,
  start = '#2DA043',
  end = '#248537',
  start2 = '#34A94B',
  end2 = '#1D6A2C',
}: {
  className?: string;
  start?: string;
  end?: string;
  start2?: string;
  end2?: string;
}) {
  const id = `wave-${++uid}`;

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 opacity-15',
        className,
      )}
      aria-hidden
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 800"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`${id}-top`} x1="0%" y1="0%" x2="100%" y2="30%">
            <stop offset="0%" stopColor={start} />
            <stop offset="100%" stopColor={end} />
          </linearGradient>
          <linearGradient
            id={`${id}-bottom`}
            x1="0%"
            y1="70%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={start2} />
            <stop offset="100%" stopColor={end2} />
          </linearGradient>
        </defs>
        <path
          fill={`url(#${id}-top)`}
          d="M0,0 L1440,0 L1440,200 C1200,160 1000,120 800,180 C600,240 400,220 200,260 C0,280 0,240 0,200 Z"
        />
        <path
          fill={`url(#${id}-bottom)`}
          d="M1440,800 L0,800 L0,620 C200,660 400,680 600,640 C800,600 1000,580 1200,560 C1400,540 1440,560 1440,600 Z"
        />
      </svg>
    </div>
  );
}
