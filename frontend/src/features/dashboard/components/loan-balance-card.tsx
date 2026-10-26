import { useState } from 'react';
import { ArrowRight, EyeOff, Eye } from 'lucide-react';

/**
 * Loan balance strip under the hero cards, styled after the mobile banking reference:
 * a green panel with the masked balance on the left, a darker slanted panel on the right
 * with "Apply Loan" and a lime-ringed arrow. The dashboard API has no loan data yet, so
 * the balance shows a dash when revealed.
 */
export function LoanBalanceCard() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative h-12 overflow-hidden rounded-2xl bg-[linear-gradient(90deg,#1D6B46_0%,#135A3A_55%,#0B4A31_100%)] text-white">
      {/* Left content */}
      <div className="absolute inset-y-0 left-0 flex items-center gap-2.5 pl-5">
        <span className="whitespace-nowrap text-[14px] text-white">Loan Balance:</span>
        {revealed ? (
          <span className="text-[14px] font-medium tabular-nums">—</span>
        ) : (
          <span className="h-3.5 w-20 rounded-sm bg-white/20" aria-hidden />
        )}
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="ml-1 flex h-6 w-6 items-center justify-center text-white/85 transition-transform active:scale-90"
          aria-label={revealed ? 'Hide loan balance' : 'Show loan balance'}
        >
          {revealed ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {/* Darker slanted panel on the right */}
      <div
        className="absolute inset-y-0 right-0 flex w-[52%] items-center justify-between bg-[#063B26] pl-10 pr-2.5 shadow-[-10px_0_18px_-8px_rgba(0,0,0,0.55)]"
        style={{ clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0 100%)' }}
      >
        <span className="whitespace-nowrap text-[13.5px] font-medium">Apply Loan</span>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[2.5px] border-[#8BC53F] text-white transition-transform active:scale-90"
          aria-label="Apply for a loan"
        >
          <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
