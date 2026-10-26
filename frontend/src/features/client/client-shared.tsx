import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, Loader2, Smartphone } from 'lucide-react';
import { clientApi, type ClientHome, type StkPush } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { formatDate, formatKES } from '@/lib/utils';

type Pkg = ClientHome['packages'][number];

export function PaymentRow({ payment }: { payment: ClientHome['payments'][number] }) {
  const [busy, setBusy] = useState<'invoice' | 'receipt' | null>(null);
  const paid = payment.status === 'PAID' || payment.status === 'PARTIAL';

  const get = async (kind: 'invoice' | 'receipt') => {
    setBusy(kind);
    try {
      await clientApi.document(payment.id, kind);
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden>
          <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" strokeLinejoin="round" />
          <path d="M9 7h6M9 11h6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold tabular-nums text-white">
          {formatKES(payment.total)}
        </span>
        <span className="block truncate text-[12px] text-white/70">
          {formatDate(payment.at)} · {payment.method === 'M-PESA' ? 'M-Pesa' : payment.method.toLowerCase()}
          {!paid ? ' · unpaid' : ''}
        </span>
      </span>
      <button
        type="button"
        onClick={() => get(paid ? 'receipt' : 'invoice')}
        disabled={busy !== null}
        className="flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[12px] font-semibold text-white active:scale-95 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {paid ? 'Receipt' : 'Invoice'}
      </button>
    </li>
  );
}

/** M-Pesa prompt to the client's phone; waits for the PIN, then the package renews. */
export function PaySheet({ pkg, defaultPhone, onDone }: { pkg: Pkg; defaultPhone: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(defaultPhone);
  const [push, setPush] = useState<(StkPush & { saleId?: string | null }) | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    setSending(true);
    try {
      setPush(await clientApi.pay({ productId: pkg.id, phone }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!push || push.state !== 'pending') return;
    const timer = window.setTimeout(async () => {
      try {
        const next = await clientApi.payStatus(push.checkoutRequestId);
        setPush(next);
        if (next.state === 'paid') await queryClient.invalidateQueries({ queryKey: ['client-me'] });
      } catch {
        setPush({ ...push });
      }
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [push, queryClient]);

  if (push?.state === 'paid') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-9 w-9" aria-hidden />
        </span>
        <p className="text-[18px] font-semibold text-foreground">Payment received</p>
        <p className="text-[13px] text-foreground-3">
          Your {pkg.name.replace(/\s*\d+\s*mbps\s*$/i, '')} package is renewed.
          {push.receipt ? ` M-Pesa ${push.receipt}.` : ''}
        </p>
        <button
          type="button"
          onClick={onDone}
          className="mt-2 h-12 w-full rounded-2xl bg-[#8BC53F] text-[15px] font-semibold text-white"
        >
          Done
        </button>
      </div>
    );
  }

  if (push?.state === 'pending') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#8BC53F]/25" aria-hidden />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#8BC53F] text-white">
            <Smartphone className="h-6 w-6" aria-hidden />
          </span>
        </span>
        <p className="text-[16px] font-semibold text-foreground">Check your phone</p>
        <p className="text-[13px] text-foreground-3">
          Enter your M-Pesa PIN to pay {formatKES(push.amount)}. This page updates on its own.
        </p>
        <button type="button" onClick={() => setPush(null)} className="text-[12px] font-semibold text-[#6DA81F]">
          Change number or send again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {push && <Alert variant="error" inline>{push.message}</Alert>}
      {error && <Alert variant="error" inline>{error}</Alert>}
      <div>
        <label htmlFor="client-pay-phone" className="mb-1 block text-[12px] font-medium text-foreground-3">
          Your M-Pesa number
        </label>
        <Input
          id="client-pay-phone"
          type="tel"
          inputMode="tel"
          placeholder="0712 345 678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={send}
        disabled={sending || !phone.trim()}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#8BC53F] text-[15px] font-semibold text-white disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
        Pay {formatKES(pkg.price)} with M-Pesa
      </button>
      <p className="text-center text-[11px] text-foreground-4">
        You'll get a prompt on your phone. Your WiFi renews as soon as you pay.
      </p>
    </div>
  );
}