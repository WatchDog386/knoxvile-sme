import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { paymentsApi, salesApi, smsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { Customer, Sale } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { WhatsAppIcon } from '@/components/brand/whatsapp-icon';
import { notifySuccess } from '@/components/ui/popup-host';
import { cn, formatDate, formatKES } from '@/lib/utils';
import { COMPANY } from '@/lib/company';
import { invoiceNo } from '@/features/isp/document-actions';
import { PromptToPay, type CapturedPayment } from '@/features/sales/components/payment-capture';

const PAYBILL = COMPANY.paybill;
const SUPPORT = COMPANY.supportPhoneDisplay;

/** What is still owed on an invoice. */
function dueOf(sale: Sale): number {
  return Math.max(0, sale.total - (sale.amount_paid ?? 0) - (sale.advance_credit ?? 0));
}

const label = (sale: Sale) => (sale.number ? invoiceNo(sale.number) : `#${sale.id.slice(0, 8).toUpperCase()}`);

/**
 * The subscriber's unpaid and part-paid invoices, each with "Prompt": an
 * M-Pesa PIN prompt on their phone (when the M-Pesa keys are set up) or a
 * payment reminder by SMS or WhatsApp with the paybill and their account.
 */
export function UnpaidInvoices({ customer }: { customer: Customer }) {
  const invoicesQuery = useQuery({
    queryKey: ['customer-sales', customer.id, 'unpaid'],
    queryFn: () => salesApi.list({ customerId: customer.id, limit: 100 }),
  });
  const unpaid = useMemo(
    () =>
      (invoicesQuery.data?.items ?? [])
        .filter((s) => (s.payment_status === 'UNPAID' || s.payment_status === 'PARTIAL') && s.sale_type !== 'ADVANCE')
        .filter((s) => dueOf(s) > 0)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [invoicesQuery.data],
  );
  // The invoices being prompted for: one, or all of them
  const [target, setTarget] = useState<Sale[] | null>(null);

  if (!unpaid.length) return null;
  const totalDue = unpaid.reduce((sum, s) => sum + dueOf(s), 0);

  return (
    <section className="space-y-2 rounded-2xl border border-danger/30 bg-danger-soft/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground">Unpaid invoices</h2>
          <p className="text-[12px] text-foreground-3">
            {unpaid.length} invoice{unpaid.length === 1 ? '' : 's'} · <span className="font-semibold text-danger">{formatKES(totalDue)} due</span>
          </p>
        </div>
        <Button type="button" size="sm" className="shrink-0 rounded-full bg-brand-600 text-white" onClick={() => setTarget(unpaid)}>
          <BellRing className="h-4 w-4" aria-hidden /> Prompt{unpaid.length > 1 ? ' for all' : ''}
        </Button>
      </div>
      <ul className="divide-y divide-edge">
        {unpaid.map((sale) => (
          <li key={sale.id} className="flex items-center gap-3 py-2.5">
            <Link to={`/sales/${sale.id}`} className="min-w-0 flex-1">
              <p className="text-[13px] font-medium tabular-nums text-foreground">{label(sale)}</p>
              <p className="text-[11px] text-foreground-4">
                {formatDate(sale.created_at)} · {formatKES(sale.total)}
                {sale.payment_status === 'PARTIAL' ? ` · ${formatKES(sale.amount_paid ?? 0)} paid` : ''}
              </p>
            </Link>
            <span className="text-[13px] font-semibold tabular-nums text-danger">{formatKES(dueOf(sale))}</span>
            <button
              type="button"
              onClick={() => setTarget([sale])}
              className="flex h-8 items-center gap-1 rounded-full border border-edge-2 px-3 text-[12px] font-semibold text-brand-600 active:scale-95 [.dark_&]:text-brand-400"
            >
              Prompt
            </button>
          </li>
        ))}
      </ul>

      <PromptSheet customer={customer} invoices={target} onClose={() => setTarget(null)} />
    </section>
  );
}

function PromptSheet({ customer, invoices, onClose }: { customer: Customer; invoices: Sale[] | null; onClose: () => void }) {
  const open = Boolean(invoices?.length);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Prompt ${customer.name.split(' ')[0]} to pay`}
      description={invoices ? `${invoices.length === 1 ? label(invoices[0]) : `${invoices.length} invoices`} · ${formatKES(invoices.reduce((s, i) => s + dueOf(i), 0))} due` : undefined}
    >
      {open && invoices && <PromptBody customer={customer} invoices={invoices} onClose={onClose} />}
    </Dialog>
  );
}

function PromptBody({ customer, invoices, onClose }: { customer: Customer; invoices: Sale[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const due = invoices.reduce((s, i) => s + dueOf(i), 0);
  const mpesa = useQuery({ queryKey: ['mpesa-status'], queryFn: paymentsApi.mpesaStatus, staleTime: 5 * 60_000 });
  const stkReady = mpesa.data?.stkPush ?? false;
  const [mode, setMode] = useState<'prompt' | 'reminder'>('reminder');
  // Opens on the PIN prompt when M-Pesa is set up, unless they already picked
  const picked = useRef(false);
  useEffect(() => {
    if (stkReady && !picked.current) setMode('prompt');
  }, [stkReady]);
  const [phone, setPhone] = useState(customer.phone ?? '');
  const account = customer.account_number || customer.username || '';
  const [message, setMessage] = useState(
    `Hello ${customer.name.split(' ')[0]}, your Knoxville ${invoices.length === 1 ? `invoice ${label(invoices[0])}` : 'invoices'} of ${formatKES(due)} ${invoices.length === 1 ? 'is' : 'are'} unpaid. ` +
      `Pay via M-Pesa${PAYBILL ? ` Paybill ${PAYBILL}` : ''}${account ? `, Account ${account}` : ''}. Thank you. Help: ${SUPPORT}`,
  );

  const refresh = () =>
    Promise.all(
      ['customer-sales', 'customers', 'sales', 'dashboard', 'subscriptions'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    );

  // Paid on the PIN prompt: put the money on the invoices, oldest first
  const applyPayment = useMutation({
    mutationFn: async (payment: CapturedPayment) => {
      let left = payment.amount;
      for (const sale of invoices) {
        if (left <= 0) break;
        const pay = Math.min(dueOf(sale), left);
        if (pay <= 0) continue;
        await salesApi.recordPayment(sale.id, { amount: pay, method: 'M-PESA', reference: payment.reference ?? undefined });
        left -= pay;
      }
    },
    onSuccess: async () => {
      await refresh();
      notifySuccess('Payment received', 'The invoice is updated.');
      onClose();
    },
  });

  const sms = useMutation({
    mutationFn: () => smsApi.send(customer.id, message.trim()),
    onSuccess: (res) => {
      if (res.sent) {
        notifySuccess('Reminder sent', `SMS sent to ${res.to ?? customer.phone}.`);
        onClose();
      }
    },
  });
  const smsFailed = sms.data && !sms.data.sent ? `The SMS was not delivered: ${sms.data.statusDesc}` : null;
  const waNumber = (customer.phone ?? '').replace(/\D/g, '').replace(/^0/, '254');

  // Which channels the server can send on by itself
  const channels = useQuery({ queryKey: ['notify-status'], queryFn: smsApi.status, staleTime: 5 * 60_000 });
  const waApi = channels.data?.whatsapp ?? false;
  const emailReady = channels.data?.email ?? false;

  // WhatsApp from the server (approved template: name, amount due, account)
  const whatsapp = useMutation({
    mutationFn: () => smsApi.whatsapp(customer.id, message.trim(), [customer.name.split(' ')[0], formatKES(due), account || '-']),
    onSuccess: () => {
      notifySuccess('Reminder sent', `WhatsApp sent to ${customer.phone}.`);
      onClose();
    },
  });

  const email = useMutation({
    mutationFn: () =>
      smsApi.emailReminder(customer.id, {
        saleIds: invoices.map((i) => i.id),
        message: message.trim(),
        subject: `Payment reminder: ${formatKES(due)} due`,
      }),
    onSuccess: (res) => {
      notifySuccess('Reminder sent', `Email sent to ${res.to}.`);
      onClose();
    },
  });
  const sendError = sms.error ?? whatsapp.error ?? email.error;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How to prompt">
        {([
          { id: 'prompt', title: 'M-Pesa prompt', hint: stkReady ? 'PIN pop-up on their phone' : 'Not set up yet', icon: Smartphone },
          { id: 'reminder', title: 'Send reminder', hint: 'SMS, WhatsApp or email', icon: MessageSquare },
        ] as const).map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={mode === o.id}
            onClick={() => {
              picked.current = true;
              setMode(o.id);
            }}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors',
              mode === o.id ? 'border-brand-600 bg-brand-50 [.dark_&]:bg-brand-600/15' : 'border-edge bg-surface-2',
            )}
          >
            <o.icon className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
            <span>
              <span className="block text-[13px] font-semibold text-foreground">{o.title}</span>
              <span className="block text-[11px] text-foreground-4">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {mode === 'prompt' ? (
        stkReady ? (
          <>
            <PromptToPay
              total={due}
              phone={phone}
              onPhoneChange={setPhone}
              reference={account || 'Knoxville'}
              onPaid={(payment) => applyPayment.mutate(payment)}
            />
            {applyPayment.error && <Alert variant="error" inline>{apiErrorMessage(applyPayment.error)}</Alert>}
          </>
        ) : (
          <Alert variant="warning" inline>
            The M-Pesa PIN prompt needs the M-Pesa (Daraja) keys on the server. Until then, send a reminder: paybill payments
            to account {account || 'their account number'} are matched to this subscriber automatically.
          </Alert>
        )
      ) : (
        <div className="space-y-3">
          <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Reminder message" />
          {(sendError || smsFailed) && <Alert variant="error" inline>{sendError ? apiErrorMessage(sendError) : smsFailed}</Alert>}
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              className="h-11 rounded-full bg-brand-600 px-2 text-white"
              loading={sms.isPending}
              disabled={!customer.phone || !message.trim()}
              onClick={() => sms.mutate()}
            >
              <MessageSquare className="h-4 w-4" aria-hidden /> SMS
            </Button>
            {waApi ? (
              <Button
                type="button"
                className="h-11 rounded-full bg-[#25D366] px-2 text-white hover:bg-[#1ebe5b]"
                loading={whatsapp.isPending}
                disabled={!customer.phone || !message.trim()}
                onClick={() => whatsapp.mutate()}
              >
                <WhatsAppIcon className="h-4 w-4" /> WhatsApp
              </Button>
            ) : (
              <a
                href={waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message.trim())}` : undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!waNumber}
                className={cn(
                  'flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#25D366] text-[14px] font-semibold text-white',
                  !waNumber && 'pointer-events-none opacity-50',
                )}
              >
                <WhatsAppIcon className="h-4 w-4" /> WhatsApp
              </a>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full px-2"
              loading={email.isPending}
              disabled={!customer.email || !emailReady || !message.trim()}
              onClick={() => email.mutate()}
            >
              <Mail className="h-4 w-4" aria-hidden /> Email
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-foreground-4">
            {waApi ? 'WhatsApp is sent from the business number.' : 'WhatsApp opens on this device with the message ready.'}{' '}
            {!customer.email
              ? 'Add an email address to this subscriber to send by email.'
              : emailReady
                ? `Email goes to ${customer.email} with the invoice${invoices.length === 1 ? '' : 's'} attached.`
                : 'Email is not set up on the server yet.'}
          </p>
          {!customer.phone && <p className="text-[12px] text-foreground-4">Add a phone number to this subscriber to send reminders.</p>}
        </div>
      )}
    </div>
  );
}
