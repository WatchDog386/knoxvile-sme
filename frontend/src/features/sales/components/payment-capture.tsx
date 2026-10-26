import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Camera, CheckCircle2, ClipboardPaste, Loader2, RotateCcw, Smartphone } from 'lucide-react';
import { paymentsApi, type StkPush } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatKES } from '@/lib/utils';
import { parseTransactionSms } from '@/lib/parse-transaction-sms';

export type PayMode = 'prompt' | 'camera' | 'paste' | 'cash';

/** A payment confirmed by M-Pesa (prompt) or read from the client's M-Pesa message. */
export interface CapturedPayment {
  source: 'prompt' | 'camera' | 'paste';
  amount: number;
  reference: string | null;
  name: string | null;
  phone: string | null;
  when: string | null;
}

/** One card in the "how are they paying?" grid. */
export interface CaptureMode {
  id: string;
  title: string;
  hint: string;
  icon: typeof Smartphone;
}

// Loaded only when the camera is used; never bundled
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js';

const MODES: CaptureMode[] = [
  { id: 'prompt', title: 'Prompt to pay', hint: 'M-Pesa on their phone', icon: Smartphone },
  { id: 'camera', title: 'Scan message', hint: 'Use the camera', icon: Camera },
  { id: 'paste', title: 'Paste message', hint: 'Copy the M-Pesa SMS', icon: ClipboardPaste },
  { id: 'cash', title: 'Cash or other', hint: 'Cash, bank, card, credit', icon: Banknote },
];

/**
 * The checkout's "How is the client paying?": send an M-Pesa prompt (STK
 * push) and wait for the PIN, read the M-Pesa message with the camera, or
 * paste it. Cash and other methods are handled by the page's own fields.
 *
 * Subscriber onboarding passes its own `modes` (it also offers "owes us" and
 * "already connected"), plus `renderExtra` and `children` for those choices.
 */
export function PaymentCapture<T extends string = PayMode>({
  mode,
  onModeChange,
  total,
  phone,
  onPhoneChange,
  reference,
  captured,
  onCaptured,
  modes,
  renderExtra,
  children,
}: {
  mode: T;
  onModeChange: (mode: T) => void;
  total: number;
  phone: string;
  onPhoneChange: (phone: string) => void;
  /** Shown on the client's M-Pesa prompt (e.g. the package name). */
  reference: string;
  captured: CapturedPayment | null;
  onCaptured: (payment: CapturedPayment | null) => void;
  /** Cards to offer; defaults to prompt / camera / paste / cash. */
  modes?: CaptureMode[];
  /** Panel shown for a mode of this page's own (e.g. "owes us"). */
  renderExtra?: (mode: string) => React.ReactNode;
  /** Extra fields under the chosen mode (e.g. cash amount and receipt). */
  children?: React.ReactNode;
}) {
  const status = useQuery({ queryKey: ['mpesa-status'], queryFn: paymentsApi.mpesaStatus, staleTime: 5 * 60_000 });
  const promptReady = status.data?.stkPush ?? true;
  const cards = modes ?? MODES;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="How is the client paying?">
        {cards.map(({ id, title, hint, icon: Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (mode !== id) onCaptured(null);
                onModeChange(id as T);
              }}
              className={cn(
                'relative flex flex-col items-start gap-2 rounded-2xl border-[1.5px] p-3 text-left transition-colors',
                active
                  ? 'border-brand-600 bg-brand-50 [.dark_&]:bg-brand-600/15'
                  : 'border-transparent bg-[#F2F2F4] [.dark_&]:bg-[#1E1E1E]',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full',
                  active ? 'bg-brand-600 text-white' : 'bg-white text-brand-600 [.dark_&]:bg-white/10',
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span>
                <span className="block text-[13px] font-semibold text-foreground">{title}</span>
                <span className="block text-[11px] text-foreground-4">
                  {id === 'prompt' && !promptReady ? 'Not set up yet' : hint}
                </span>
              </span>
              {active && <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-brand-600" aria-hidden />}
            </button>
          );
        })}
      </div>

      {captured ? (
        <PaidCard payment={captured} total={total} onRedo={() => onCaptured(null)} />
      ) : mode === 'prompt' ? (
        <PromptToPay total={total} phone={phone} onPhoneChange={onPhoneChange} reference={reference} onPaid={onCaptured} />
      ) : mode === 'camera' ? (
        <CameraReader onRead={(text) => onCaptured(fromMessage(text, 'camera'))} onFallback={() => onModeChange('paste' as T)} />
      ) : mode === 'paste' ? (
        <PasteReader onRead={(text) => onCaptured(fromMessage(text, 'paste'))} />
      ) : renderExtra ? (
        renderExtra(mode)
      ) : null}
      {children}
    </div>
  );
}

function fromMessage(text: string, source: 'camera' | 'paste'): CapturedPayment | null {
  const parsed = parseTransactionSms(text);
  if (!parsed.amount && !parsed.code) return null;
  return {
    source,
    amount: parsed.amount ?? 0,
    reference: parsed.code,
    name: parsed.name,
    phone: parsed.phone,
    when: parsed.datetime,
  };
}

/** Green receipt shown once the money is confirmed or read from the message. */
function PaidCard({ payment, total, onRedo }: { payment: CapturedPayment; total: number; onRedo: () => void }) {
  const short = payment.amount < total;
  const rows: Array<[string, string | null]> = [
    ['Reference', payment.reference],
    ['From', payment.name],
    ['Phone', payment.phone],
    ['When', payment.when],
  ];
  return (
    <div className={cn('overflow-hidden rounded-2xl', short ? 'bg-warning-soft' : 'bg-brand-50 [.dark_&]:bg-brand-600/15')}>
      <div className="flex items-center gap-3 p-4">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white', short ? 'bg-warning' : 'bg-brand-600')}>
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-foreground-3">
            {payment.source === 'prompt' ? 'Paid on M-Pesa' : 'Read from the M-Pesa message'}
          </p>
          <p className="text-[20px] font-semibold tabular-nums tracking-tight text-foreground">{formatKES(payment.amount)}</p>
        </div>
        <button
          type="button"
          onClick={onRedo}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-foreground-3 [.dark_&]:bg-white/10"
          aria-label="Capture again"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <dl className="space-y-1.5 px-4 pb-4">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 text-[12px]">
              <dt className="text-foreground-4">{k}</dt>
              <dd className="truncate font-medium tabular-nums text-foreground">{v}</dd>
            </div>
          ))}
        {short && (
          <p className="pt-1 text-[12px] font-medium text-warning">
            {formatKES(total - payment.amount)} short: the rest goes on the client's balance.
          </p>
        )}
      </dl>
    </div>
  );
}

/** Sends the STK push and waits for the client's PIN, checking every few seconds. */
export function PromptToPay({
  total,
  phone,
  onPhoneChange,
  reference,
  onPaid,
}: {
  total: number;
  phone: string;
  onPhoneChange: (phone: string) => void;
  reference: string;
  onPaid: (payment: CapturedPayment) => void;
}) {
  const [push, setPush] = useState<StkPush | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    setSending(true);
    try {
      setPush(await paymentsApi.stkPush({ phone, amount: total, reference, description: 'WiFi package' }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  // Poll while the client is on the PIN screen
  useEffect(() => {
    if (!push || push.state !== 'pending') return;
    const timer = window.setTimeout(async () => {
      try {
        const next = await paymentsApi.stkStatus(push.checkoutRequestId);
        setPush(next);
        if (next.state === 'paid') {
          onPaid({ source: 'prompt', amount: next.amount, reference: next.receipt, name: null, phone: next.phone, when: null });
        }
      } catch {
        setPush({ ...push });
      }
    }, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [push]);

  if (push?.state === 'pending') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#F2F2F4] px-4 py-6 text-center [.dark_&]:bg-[#1E1E1E]">
        <span className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/25" aria-hidden />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white">
            <Smartphone className="h-6 w-6" aria-hidden />
          </span>
        </span>
        <div>
          <p className="text-[15px] font-semibold text-foreground">Check the phone</p>
          <p className="mt-0.5 text-[12px] text-foreground-3">
            A prompt for {formatKES(push.amount)} was sent to {push.phone.replace(/^254/, '0')}. Waiting for the M-Pesa PIN…
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-foreground-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking every few seconds
        </p>
        <button type="button" onClick={() => setPush(null)} className="text-[12px] font-semibold text-brand-600">
          Change number or send again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]">
      {push && push.state !== 'paid' && (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger">{push.message}</p>
      )}
      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger">{error}</p>}
      <div>
        <label htmlFor="stk-phone" className="mb-1 block text-[12px] font-medium text-foreground-3">
          Client's M-Pesa number
        </label>
        <Input
          id="stk-phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="0712 345 678"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="bg-white [.dark_&]:bg-surface-3"
        />
      </div>
      <button
        type="button"
        onClick={send}
        disabled={sending || !phone.trim() || total <= 0}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[14px] font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Smartphone className="h-4 w-4" aria-hidden />}
        {push ? 'Send the prompt again' : `Send prompt · ${formatKES(total)}`}
      </button>
      <p className="text-center text-[11px] text-foreground-4">The client enters their M-Pesa PIN; the sale is marked paid on its own.</p>
    </div>
  );
}

/** Live camera: snap the M-Pesa message and read it on the phone. */
function CameraReader({ onRead, onFallback }: { onRead: (text: string) => void; onFallback: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setReady(true);
        }
      } catch {
        if (!cancelled) setError('The camera is not available here. Paste the message instead.');
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    setBusy(true);
    setError(null);
    try {
      const mod = (await import(/* @vite-ignore */ TESSERACT_URL)) as {
        recognize?: (img: string, lang: string) => Promise<{ data?: { text?: string } }>;
        default?: { recognize?: (img: string, lang: string) => Promise<{ data?: { text?: string } }> };
      };
      const recognize = mod.recognize ?? mod.default?.recognize;
      if (!recognize) throw new Error('OCR unavailable');
      const text = String((await recognize(canvas.toDataURL('image/png'), 'eng'))?.data?.text ?? '');
      if (!fromMessage(text, 'camera')) throw new Error('unreadable');
      onRead(text);
    } catch {
      setError('Could not read that clearly. Hold the phone steady and try again, or paste the message.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {/* Viewfinder corners */}
        <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/70 [mask:linear-gradient(#000_0_0)_top/100%_22%_no-repeat,linear-gradient(#000_0_0)_bottom/100%_22%_no-repeat]" aria-hidden />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-[13px] font-medium text-white">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> Reading the message…
          </div>
        )}
      </div>
      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger">{error}</p>}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={capture}
          disabled={!ready || busy}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          <Camera className="h-4 w-4" aria-hidden /> Capture message
        </button>
        <button
          type="button"
          onClick={onFallback}
          className="flex h-12 items-center justify-center rounded-2xl bg-[#F2F2F4] px-4 text-[13px] font-medium text-foreground [.dark_&]:bg-[#1E1E1E]"
        >
          Paste
        </button>
      </div>
    </div>
  );
}

/** Paste the M-Pesa SMS; the amount, code, name and time are read from it. */
function PasteReader({ onRead }: { onRead: (text: string) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const read = (value: string) => {
    if (!fromMessage(value, 'paste')) {
      setError('No amount or M-Pesa code found. Paste the whole message.');
      return;
    }
    setError(null);
    onRead(value);
  };

  const fromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setText(clip);
      read(clip);
    } catch {
      setError('Allow clipboard access, or long-press the box and paste.');
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]">
      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger">{error}</p>}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="e.g. QGH7XY8K2R Confirmed. Ksh1,999.00 received from GRACE ACHIENG 0712345678 on 12/10/26 at 9:30 AM…"
        className="bg-white text-[13px] [.dark_&]:bg-surface-3"
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={fromClipboard}
          className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-white text-[13px] font-medium text-foreground [.dark_&]:bg-surface-3"
        >
          <ClipboardPaste className="h-4 w-4" aria-hidden /> Paste
        </button>
        <button
          type="button"
          onClick={() => read(text)}
          disabled={!text.trim()}
          className="flex h-11 items-center justify-center rounded-2xl bg-brand-600 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          Read message
        </button>
      </div>
    </div>
  );
}
