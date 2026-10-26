import logo from '@/assets/knoxville-logo.png';
import { COMPANY } from '@/lib/company';
import { cn } from '@/lib/utils';

/** Knoxville pay-with-M-Pesa banner: paybill (from VITE_MPESA_PAYBILL), account and support line. */
export function AdvertBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 overflow-hidden rounded-2xl bg-[#0F2341] p-4 text-white shadow-sm',
        className,
      )}
    >
      <div className="shrink-0 rounded-xl bg-white p-2">
        <img src={logo} alt="Knoxville Technologies" width={1200} height={488} className="w-24 object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Pay with M-Pesa</p>
        {COMPANY.paybill ? (
          <p className="mt-0.5 text-[20px] font-bold tracking-wider">
            Paybill <span className="text-[#E0292E]">{COMPANY.paybill}</span>
          </p>
        ) : (
          <p className="mt-0.5 text-[16px] font-semibold">Home of fibre internet</p>
        )}
        <p className="text-[12px] text-white/80">Account number: your Knoxville account number</p>
        <p className="mt-1 truncate text-[11px] text-white/65">
          Support {COMPANY.supportPhoneDisplay} · {COMPANY.websiteLabel}
        </p>
      </div>
    </div>
  );
}
