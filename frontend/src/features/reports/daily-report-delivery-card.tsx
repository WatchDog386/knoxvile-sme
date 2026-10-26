import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, Mail, RefreshCw } from 'lucide-react';
import { reportsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRole } from '@/hooks/use-role';
import { useActiveBusiness } from '@/stores/business';

/** Recipient and delivery health for the automatic previous-day report email. */
export function DailyReportDeliveryCard() {
  const queryClient = useQueryClient();
  const { canManage } = useRole();
  const business = useActiveBusiness();
  const queryKey = ['reports', 'daily-delivery', business?.id];
  const settings = useQuery({ queryKey, queryFn: reportsApi.deliverySettings, enabled: Boolean(business?.id) });
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!settings.data) return;
    setEmail(settings.data.email);
    setEnabled(settings.data.enabled);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => reportsApi.updateDeliverySettings({ email: email.trim() || null, enabled }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKey, updated);
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  return (
    <section className="rounded-[24px] border border-edge bg-surface p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Mail className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-foreground">Automatic daily report</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground-4">
            The previous day’s sales, collections, expenses and profit arrive as a PDF and Excel workbook at 6:00 AM ({settings.data?.timezone ?? 'business local time'}).
          </p>
        </div>
      </div>

      {settings.error && (
        <div className="mt-4"><Alert variant="error" inline>{apiErrorMessage(settings.error)}</Alert></div>
      )}
      {save.error && (
        <div className="mt-4"><Alert variant="error" inline>{apiErrorMessage(save.error)}</Alert></div>
      )}
      {settings.data && !settings.data.emailConfigured && (
        <div className="mt-4"><Alert variant="info" inline>The recipient is saved, but automatic email is waiting for SMTP settings on the API server.</Alert></div>
      )}

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label htmlFor="daily-report-email" className="block text-[12px] font-medium text-foreground-3">
          Send reports to
        </label>
        <Input
          id="daily-report-email"
          type="email"
          required={enabled}
          autoComplete="email"
          value={email}
          disabled={!canManage || settings.isLoading}
          onChange={(event) => { save.reset(); setEmail(event.target.value); }}
          placeholder="owner@business.co.ke"
          className="h-11 rounded-xl bg-field"
        />
        {settings.data?.usingOwnerEmail && (
          <p className="-mt-2 text-[11px] text-foreground-5">Using the business owner’s account email. Enter another address to change it.</p>
        )}

        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3 py-3">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!canManage || settings.isLoading}
            onChange={(event) => { save.reset(); setEnabled(event.target.checked); }}
            className="h-4 w-4 accent-accent"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-foreground">Email every day</span>
            <span className="block text-[11px] text-foreground-4">You can pause delivery at any time.</span>
          </span>
          <Clock3 className="h-4 w-4 shrink-0 text-foreground-5" aria-hidden />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="text-[11px] text-foreground-4" aria-live="polite">
            {save.isSuccess ? (
              <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="h-3.5 w-3.5" aria-hidden />Delivery settings saved</span>
            ) : settings.data?.lastDelivery?.status === 'SENT' ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Last sent for {settings.data.lastDelivery.date}
              </span>
            ) : settings.data?.lastDelivery?.status === 'FAILED' ? (
              <span className="text-red-600">Last attempt for {settings.data.lastDelivery.date} failed; the system will retry.</span>
            ) : settings.data?.lastDelivery?.status === 'SENDING' ? (
              <span>Report email is being prepared.</span>
            ) : (
              <span>No report has been emailed yet.</span>
            )}
          </div>
          {canManage && (
            <Button type="submit" size="sm" disabled={settings.isLoading || save.isPending}>
              {save.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              {save.isPending ? 'Saving…' : 'Save delivery'}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
