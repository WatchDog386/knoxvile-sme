import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Phone, PhoneCall } from 'lucide-react';
import { WhatsAppIcon } from '@/components/brand/whatsapp-icon';
import { callsApi, smsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { CallOutcome } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** Kenyan numbers to international digits for WhatsApp: 0712… / +254 712… → 254712… */
export function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) digits = `254${digits}`;
  return digits.length >= 10 ? digits : null;
}

export function whatsappUrl(phone: string | null | undefined, text?: string): string | null {
  const n = waNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export const OUTCOMES: Array<{ value: CallOutcome; label: string; tone: string }> = [
  { value: 'REACHED', label: 'Reached', tone: 'bg-emerald-100 text-emerald-700' },
  { value: 'PROMISED_TO_PAY', label: 'Promised to pay', tone: 'bg-sky-100 text-sky-700' },
  { value: 'CALL_BACK', label: 'Call back', tone: 'bg-violet-100 text-violet-700' },
  { value: 'NO_ANSWER', label: 'No answer', tone: 'bg-amber-100 text-amber-700' },
  { value: 'BUSY', label: 'Busy', tone: 'bg-orange-100 text-orange-700' },
  { value: 'WRONG_NUMBER', label: 'Wrong number', tone: 'bg-red-100 text-red-700' },
];
export const outcomeInfo = (o: CallOutcome) => OUTCOMES.find((x) => x.value === o) ?? OUTCOMES[0];

/** Round Call / WhatsApp / Message / Log buttons for a client. */
export function ContactButtons({
  phone,
  onLog,
  onMessage,
  message,
  size = 'md',
}: {
  phone: string | null | undefined;
  onLog?: () => void;
  /** Opens the SMS sheet. Omit to hide the button. */
  onMessage?: () => void;
  message?: string;
  size?: 'sm' | 'md';
}) {
  const wa = whatsappUrl(phone, message);
  const box = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <div className="flex items-center gap-2">
      {phone ? (
        <a href={`tel:${phone}`} className={cn(box, 'flex items-center justify-center rounded-full bg-emerald-500 text-white active:scale-90')} aria-label="Call">
          <Phone className={icon} aria-hidden />
        </a>
      ) : null}
      {wa ? (
        <a href={wa} target="_blank" rel="noreferrer" className={cn(box, 'flex items-center justify-center rounded-full bg-[#25D366] text-white active:scale-90')} aria-label="WhatsApp">
          <WhatsAppIcon className={icon} />
        </a>
      ) : null}
      {onMessage ? (
        <button type="button" onClick={onMessage} className={cn(box, 'flex items-center justify-center rounded-full bg-brand-600 text-white active:scale-90')} aria-label="Send SMS">
          <MessageSquare className={icon} aria-hidden />
        </button>
      ) : null}
      {onLog && (
        <button type="button" onClick={onLog} className={cn(box, 'flex items-center justify-center rounded-full bg-surface-3 text-foreground-2 active:scale-90')} aria-label="Log a call">
          <PhoneCall className={icon} aria-hidden />
        </button>
      )}
    </div>
  );
}

const quickTimes: Array<{ label: string; at: () => Date }> = [
  { label: 'Later today', at: () => setTime(new Date(), 16) },
  { label: 'Tomorrow', at: () => setTime(addDays(new Date(), 1), 10) },
  { label: 'In 3 days', at: () => setTime(addDays(new Date(), 3), 10) },
  { label: 'Next week', at: () => setTime(addDays(new Date(), 7), 10) },
];
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function setTime(d: Date, h: number) {
  const x = new Date(d);
  x.setHours(Math.max(h, x.getHours() + (h === 16 ? 1 : 0)), 0, 0, 0);
  return x;
}

/** Bottom sheet to log how a call went and optionally set a call-back. */
export function LogCallSheet({
  open,
  onOpenChange,
  customerId,
  customerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}) {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<CallOutcome>('REACHED');
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      callsApi.log(customerId, {
        outcome,
        notes: notes.trim() || undefined,
        followUpAt: followUp !== null ? quickTimes[followUp].at().toISOString() : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['calls'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setNotes('');
      setFollowUp(null);
      setOutcome('REACHED');
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Log a call" description={customerName}>
      <div className="space-y-5">
        <div>
          <Label>How did it go?</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setOutcome(o.value);
                  if (o.value === 'CALL_BACK' && followUp === null) setFollowUp(1);
                }}
                className={cn(
                  'h-9 rounded-full px-4 text-[13px] font-semibold transition-colors',
                  outcome === o.value ? 'bg-brand-600 text-white' : 'bg-surface text-foreground-3',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="call-notes">Notes</Label>
          <Textarea id="call-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Will pay the renewal on Friday via M-Pesa" />
        </div>

        <div>
          <Label>Call back</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {quickTimes.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setFollowUp(followUp === i ? null : i)}
                className={cn(
                  'h-10 rounded-xl text-[13px] font-semibold transition-colors',
                  followUp === i ? 'bg-violet-600 text-white' : 'bg-surface text-foreground-3',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-foreground-4">
            {followUp === null ? 'No call-back scheduled.' : `They'll appear in Calls due ${quickTimes[followUp].label.toLowerCase()}.`}
          </p>
        </div>

        {mutation.error && <Alert variant="error">{apiErrorMessage(mutation.error)}</Alert>}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save call
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Compose and send an SMS. A delivered message is written to the client's call
 * history by the backend, so staff can see what has already been prompted.
 */
export function SendSmsSheet({
  open,
  onOpenChange,
  customerId,
  customerName,
  phone,
  defaultMessage = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  phone: string | null | undefined;
  defaultMessage?: string;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(defaultMessage);

  // Re-seed the draft each time the sheet opens, so the suggested renewal
  // prompt is fresh but anything typed is not lost to a re-render.
  useEffect(() => {
    if (open) setText(defaultMessage);
  }, [open, defaultMessage]);

  const status = useQuery({ queryKey: ['sms', 'status'], queryFn: smsApi.status });
  const configured = status.data?.configured ?? false;

  const mutation = useMutation({
    mutationFn: () => smsApi.send(customerId, text),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['calls'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['customers', customerId] });
      if (result.sent) onOpenChange(false);
    },
  });

  const noPhone = !phone;
  const notConfigured = !status.isLoading && !configured;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Send SMS" description={`${customerName} · ${phone ?? 'no number on file'}`}>
      <div className="space-y-4">
        {!status.isLoading && notConfigured && (
          <Alert variant="error">
            SMS is not set up on the server yet. Add{' '}
            <span className="font-medium">{status.data?.missing.join(', ')}</span> to the backend .env.
          </Alert>
        )}
        {noPhone && <Alert variant="error">This client has no mobile number saved.</Alert>}
        {mutation.error && <Alert variant="error">{apiErrorMessage(mutation.error)}</Alert>}
        {mutation.data && !mutation.data.sent && (
          <Alert variant="error">
            The provider did not send it ({mutation.data.statusCode} · {mutation.data.statusDesc}).
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="sms-body">Message</Label>
          <Textarea
            id="sms-body"
            rows={5}
            value={text}
            maxLength={900}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Hello John, your 10 Mbps package expires in 3 days. Renew via M-Pesa to stay connected."
            autoFocus
          />
          <p className="text-[12px] text-foreground-4">{text.length}/900 characters</p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={noPhone || notConfigured || !text.trim()}
            onClick={() => mutation.mutate()}
          >
            <MessageSquare className="h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
