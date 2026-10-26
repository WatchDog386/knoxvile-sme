import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileText, Mail, Printer, Receipt } from 'lucide-react';
import { WhatsAppIcon } from '@/components/brand/whatsapp-icon';
import { documentsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { DocKind, SaleDetail } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import { notifySuccess } from '@/components/ui/popup-host';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { whatsappUrl } from './contact';
import { PdfPreview } from './pdf-preview';

export const invoiceNo = (n?: number | null) => `INV-${String(n ?? 0).padStart(6, '0')}`;
export const receiptNo = (n?: number | null) => `RCT-${String(n ?? 0).padStart(6, '0')}`;

/** Invoice & receipt: download A4 / 80mm PDFs, send by WhatsApp or email. */
export function DocumentActions({ sale }: { sale: SaleDetail }) {
  const hasPayment = sale.payments.some((p) => p.status === 'SUCCESS');
  const [kind, setKind] = useState<DocKind>(hasPayment ? 'receipt' : 'invoice');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState(sale.customer?.email ?? '');
  // Generated documents open in a preview first; saving is a separate tap
  const [preview, setPreview] = useState<{ blob: Blob; filename: string; title: string } | null>(null);

  const openPreview = (format: 'a4' | 'thermal') =>
    run(format === 'a4' ? 'pdf' : 'thermal', async () => {
      const file = await documentsApi.fetchPdf(sale.id, kind, format);
      const label = kind === 'invoice' ? invoiceNo(sale.number) : 'Receipt';
      setPreview({ ...file, title: `${label}${format === 'thermal' ? ' · 80mm' : ''}` });
    });

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const shareWhatsApp = () =>
    run('whatsapp', async () => {
      const share = await documentsApi.share(sale.id, kind);
      const link = documentsApi.publicUrl(share.token, kind);
      const text = `${share.text}\n\nView or download: ${link}`;
      const url = whatsappUrl(share.customer?.phone, text) ?? `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener');
    });

  const email = useMutation({
    mutationFn: () => documentsApi.email(sale.id, kind, emailTo.trim()),
    onSuccess: (res) => {
      setEmailOpen(false);
      notifySuccess('Document sent', `Sent to ${res.to}`);
    },
  });

  const tiles = [
    { key: 'pdf', label: 'View PDF', icon: FileText, tone: 'bg-brand-600 text-white', onClick: () => openPreview('a4') },
    { key: 'thermal', label: '80mm receipt', icon: Printer, tone: 'bg-slate-800 text-white', onClick: () => openPreview('thermal') },
    { key: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon, tone: 'bg-[#25D366] text-white', onClick: shareWhatsApp },
    { key: 'email', label: 'Email', icon: Mail, tone: 'bg-sky-600 text-white', onClick: () => { setError(null); email.reset(); setEmailOpen(true); } },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Invoice & receipt</h2>
        <span className="text-[12px] font-medium text-foreground-4">{invoiceNo(sale.number)}</span>
      </div>

      {/* Which document */}
      <div className="grid grid-cols-2 rounded-full bg-surface-3 p-1">
        {(['invoice', 'receipt'] as const).map((k) => (
          <button
            key={k}
            type="button"
            disabled={k === 'receipt' && !hasPayment}
            onClick={() => setKind(k)}
            className={cn(
              'flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors disabled:opacity-40',
              kind === k ? 'bg-surface text-foreground shadow-sm' : 'text-foreground-4',
            )}
          >
            {k === 'invoice' ? <FileText className="h-4 w-4" aria-hidden /> : <Receipt className="h-4 w-4" aria-hidden />}
            {k === 'invoice' ? 'Invoice' : 'Receipt'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={t.onClick}
            disabled={busy !== null}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface-3 py-3 active:scale-95 disabled:opacity-60"
          >
            <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', t.tone)}>
              {busy === t.key ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
              ) : (
                <t.icon className="h-[18px] w-[18px]" aria-hidden />
              )}
            </span>
            <span className="text-[11px] font-medium text-foreground-2">{t.label}</span>
          </button>
        ))}
      </div>

      {!hasPayment && <p className="px-1 text-[12px] text-foreground-4">A receipt is available once a payment is recorded.</p>}
      {error && <Alert variant="error">{error}</Alert>}

      <PdfPreview
        file={preview}
        title={preview?.title ?? ''}
        onClose={() => setPreview(null)}
        onDownload={() => preview && documentsApi.save(preview.blob, preview.filename)}
        onWhatsApp={() => {
          setPreview(null);
          void shareWhatsApp();
        }}
      />

      <Dialog open={emailOpen} onOpenChange={setEmailOpen} title={`Email ${kind}`} description="The PDF is attached to the email.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            email.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email-to">Send to</Label>
            <Input id="email-to" type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="client@example.com" required />
          </div>
              {email.error && <Alert variant="error" inline>{apiErrorMessage(email.error)}</Alert>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={email.isPending}>
              <Mail className="h-4 w-4" />
              Send
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
