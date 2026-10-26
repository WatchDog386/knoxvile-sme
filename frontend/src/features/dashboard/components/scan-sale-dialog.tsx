import * as React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  CheckCircle2,
  ClipboardType,
  Loader2,
  ScanLine,
  X,
} from 'lucide-react';
import { customersApi, salesApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import {
  parseTransactionSms,
  type ParsedTransaction,
} from '@/lib/parse-transaction-sms';
import { cn, uuid } from '@/lib/utils';
import { SpeedWheel } from '@/components/ui/workspace-loader';

type Step = 'capture' | 'paste' | 'review' | 'saving' | 'done';

const METHODS = ['M-PESA', 'CASH', 'BANK', 'CARD'];

// Loaded lazily at capture time; never bundled
const TESSERACT_URL =
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js';

export function ScanSaleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const [step, setStep] = React.useState<Step>('capture');
  const [ocrBusy, setOcrBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rawText, setRawText] = React.useState('');
  const [parsed, setParsed] = React.useState<ParsedTransaction | null>(null);
  const [amount, setAmount] = React.useState('');
  const [customerName, setCustomerName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [method, setMethod] = React.useState('M-PESA');

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const close = () => {
    onOpenChange(false);
  };

  // Reset each time the dialog opens
  React.useEffect(() => {
    if (open) {
      setStep('capture');
      setOcrBusy(false);
      setError(null);
      setRawText('');
      setParsed(null);
      setAmount('');
      setCustomerName('');
      setPhone('');
      setMethod('M-PESA');
    }
  }, [open]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // Camera lifecycle — only live while the capture step is showing
  React.useEffect(() => {
    if (!open || step !== 'capture') {
      stopStream();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        if (!cancelled) {
          setError('Camera not available — paste the SMS text instead.');
          setStep('paste');
        }
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, step]);

  const applyParsed = (text: string) => {
    const result = parseTransactionSms(text);
    setParsed(result);
    setAmount(result.amount ? String(result.amount) : '');
    setCustomerName(result.name ?? '');
    setPhone(result.phone ?? '');
  };

  const captureAndRead = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');

    setOcrBusy(true);
    setError(null);
    try {
      const mod = (await import(
        /* @vite-ignore */ TESSERACT_URL
      )) as any;
      const recognize = mod.recognize ?? mod.default?.recognize;
      if (!recognize) throw new Error('OCR unavailable');
      const result = await recognize(dataUrl, 'eng');
      const text = String(result?.data?.text ?? '');
      if (!text.trim().match(/\d{2,}/)) throw new Error('No readable digits');
      applyParsed(text);
      setStep('review');
    } catch {
      setError('Could not read that image clearly — paste the SMS text instead.');
      setStep('paste');
    } finally {
      setOcrBusy(false);
    }
  };

  const parsePasted = () => {
    if (!rawText.trim()) {
      setError('Paste the full SMS message first.');
      return;
    }
    applyParsed(rawText);
    setError(null);
    setStep('review');
  };

  const save = async () => {
    const totalNum = Math.round(Number(amount.replace(/,/g, '')));
    if (!totalNum || totalNum <= 0) {
      setError('Enter the amount that was paid.');
      return;
    }
    setError(null);
    setStep('saving');

    try {
      let customerId: string | undefined;
      const name = customerName.trim();
      if (name) {
        const digits = phone.replace(/\D/g, '').slice(-9);
        const list = await customersApi.list({ limit: 50, search: name });
        const exact = list.items.find(
          (c) =>
            (digits && (c.phone ?? '').replace(/\D/g, '').endsWith(digits)) ||
            c.name.toLowerCase() === name.toLowerCase(),
        );
        const fuzzy =
          exact ??
          list.items.find((c) => {
            const cn = c.name.toLowerCase();
            const sn = name.toLowerCase();
            return cn.includes(sn) || sn.includes(cn);
          });
        customerId = exact?.id ?? fuzzy?.id;
        if (!customerId) {
          const created = await customersApi.create({
            name,
            phone: phone.trim() || undefined,
          });
          customerId = created.id;
        }
      }

      await salesApi.create({
        items: [],
        total: totalNum,
        customerId,
        paymentMethod: method,
        amountPaid: method === 'CREDIT' ? 0 : totalNum,
        reference: parsed?.code ?? undefined,
        notes: parsed?.code
          ? `Recorded from transaction SMS ${parsed.code}`
          : 'Recorded from transaction SMS',
        idempotencyKey: uuid(),
      });

      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setStep('done');
    } catch (err) {
      setError(apiErrorMessage(err));
      setStep('review');
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink-950/70" onClick={close} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scan to record sale"
        className="relative z-10 mx-auto flex h-full w-full max-w-lg flex-col bg-surface-2 sm:my-16 sm:h-auto sm:max-h-[85vh] sm:rounded-3xl sm:border sm:border-edge sm:shadow-lg"
      >
        {/* Title bar */}
        <div className="relative flex h-14 shrink-0 items-center px-2">
          <button
            onClick={() => (step === 'review' ? setStep('capture') : close())}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-surface text-foreground transition-colors hover:bg-surface-2"
            aria-label={step === 'review' ? 'Back to scanner' : 'Close'}
          >
            {step === 'review' ? (
              <span className="rotate-180 text-lg leading-none">›</span>
            ) : (
              <X className="h-5 w-5" />
            )}
          </button>
          <h2 className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-base font-medium tracking-tight text-foreground">
            <ScanLine className="h-4 w-4 text-brand-600" />
            Scan to record sale
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {error && (
            <p className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          )}

          {/* ---------- CAPTURE ---------- */}
          {step === 'capture' && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-3xl bg-black" style={{ aspectRatio: '3 / 4' }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="h-full w-full object-cover"
                />

                {/* Corner frame guides */}
                <div className="pointer-events-none absolute inset-8">
                  <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-3 border-t-3 border-white/90" />
                  <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-3 border-t-3 border-white/90" />
                  <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-3 border-l-3 border-white/90" />
                  <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-3 border-r-3 border-white/90" />
                </div>

                {ocrBusy && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
                    <SpeedWheel />
                    <p className="text-sm font-medium">Reading the message…</p>
                  </div>
                )}
              </div>

              <p className="text-center text-xs leading-relaxed text-foreground-3 px-2">
                Point the camera at the M-Pesa / Airtel Money confirmation SMS and hold still.
              </p>

              <button
                onClick={captureAndRead}
                disabled={ocrBusy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-700 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800 active:scale-[0.99] disabled:opacity-60"
              >
                <Camera className="h-5 w-5" />
                Capture & extract
              </button>

              <button
                onClick={() => setStep('paste')}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-medium text-brand-600 hover:bg-accent-soft"
              >
                <ClipboardType className="h-4 w-4" />
                Or paste the SMS text instead
              </button>
            </div>
          )}

          {/* ---------- PASTE ---------- */}
          {step === 'paste' && (
            <div className="space-y-4">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={6}
                placeholder={`Example:\nQGH7XY8K2R Confirmed.Ksh1,500.00 paid to MARY WANJIKU on 23/8/26 at 2:30 PM.New M-PESA balance is Ksh24,300.00`}
                className="w-full resize-none rounded-2xl border border-edge bg-field p-4 text-sm text-foreground outline-none placeholder:text-foreground-5 focus:border-edge-2 focus:ring-0"
              />
              <button
                onClick={parsePasted}
                className="h-12 w-full rounded-full bg-brand-700 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800 active:scale-[0.99]"
              >
                Extract details
              </button>
              <button
                onClick={() => setStep('capture')}
                className="h-9 w-full text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Use the camera instead
              </button>
            </div>
          )}

          {/* ---------- REVIEW ---------- */}
          {(step === 'review' || step === 'saving') && (
            <div className="space-y-4">
              {parsed?.code && (
                <div className="flex items-center justify-between rounded-xl bg-accent-soft px-4 py-2.5">
                  <span className="text-xs text-foreground-3">Transaction code</span>
                  <span className="text-sm font-medium tabular-nums text-brand-700">
                    {parsed.code}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="px-1 text-xs font-medium uppercase tracking-wider text-foreground-4">
                  Amount received (KSh)
                </label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="1500"
                  className="h-14 w-full rounded-2xl border border-edge bg-field text-center text-xl font-medium tabular-nums text-foreground outline-none focus:border-edge-2 focus:ring-0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="px-1 text-xs font-medium uppercase tracking-wider text-foreground-4">
                    Customer name
                  </label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Optional"
                    className="h-12 w-full rounded-full border border-edge bg-field px-4 text-sm text-foreground outline-none placeholder:text-foreground-5 focus:border-edge-2 focus:ring-0"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="px-1 text-xs font-medium uppercase tracking-wider text-foreground-4">
                    Phone
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="07XX XXX XXX"
                    className="h-12 w-full rounded-full border border-edge bg-field px-4 text-sm tabular-nums text-foreground outline-none placeholder:text-foreground-5 focus:border-edge-2 focus:ring-0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="px-1 text-xs font-medium uppercase tracking-wider text-foreground-4">
                  Payment method
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={cn(
                        'h-9 rounded-full border text-xs font-medium transition-all active:scale-[0.97]',
                        method === m
                          ? 'border-brand-700 bg-brand-700 text-white'
                          : 'border-edge bg-surface text-foreground-2 hover:bg-surface-2',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={save}
                disabled={step === 'saving'}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-700 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800 active:scale-[0.99] disabled:opacity-70"
              >
                {step === 'saving' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Recording sale…
                  </>
                ) : (
                  'Record sale'
                )}
              </button>
            </div>
          )}

          {/* ---------- DONE ---------- */}
          {step === 'done' && (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="h-16 w-16 text-success" strokeWidth={1.5} />
              <h3 className="mt-4 text-lg font-medium text-foreground">Sale recorded</h3>
              <p className="mt-1 text-sm text-foreground-3">
                KSh {Number(amount).toLocaleString('en-KE')}
                {customerName ? ` · ${customerName}` : ''}
              </p>
              <div className="mt-6 grid w-full grid-cols-2 gap-3">
                <button
                  onClick={close}
                  className="h-11 rounded-full border border-edge bg-surface text-sm font-medium text-foreground hover:bg-surface-2"
                >
                  Done
                </button>
                <button
                  onClick={() => navigate('/sales')}
                  className="h-11 rounded-full bg-brand-700 text-sm font-medium text-white hover:bg-brand-800"
                >
                  View sales
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
