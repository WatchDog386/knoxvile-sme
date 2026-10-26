import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, KeyRound, RefreshCw } from 'lucide-react';
import { clientAccessApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatKES } from '@/lib/utils';
import { whatsappUrl } from './contact';

/** What the office needs to know once a new subscriber is saved. */
export interface OnboardedSubscriber {
  customerId: string;
  name: string;
  username: string;
  accountNumber: string;
  phone: string;
  email: string;
  /** Null when they were added without a package. */
  packageName: string | null;
  /** The first invoice: how much was due and how much landed today. */
  invoice: { total: number; paid: number } | null;
}

/**
 * The last step of onboarding. The subscriber is saved; now they need their own
 * app login, so a temporary password is generated here and handed to them. The
 * office never types a password: they generate, send, and can regenerate if the
 * message never arrived.
 */
export function OnboardedAccess({ subscriber, onDone }: { subscriber: OnboardedSubscriber; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [sent, setSent] = useState<{ login: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const email = subscriber.email.trim();

  const grant = useMutation({
    mutationFn: () => clientAccessApi.grant(subscriber.customerId, email ? { email } : {}),
    onSuccess: (access) => {
      setSent({ login: access.username ?? access.accountNumber ?? email, password: access.password ?? '' });
      setCopied(false);
      queryClient.invalidateQueries({ queryKey: ['client-access', subscriber.customerId] });
    },
  });

  const first = subscriber.name.split(' ')[0];
  const message = sent
    ? [
        `Hello ${first}, you can now use the Knoxville app to see your WiFi package and pay with M-Pesa.`,
        `Sign in at ${window.location.origin}/login`,
        `Username: ${sent.login}`,
        `Password: ${sent.password}`,
        'Please keep it private. The app will ask you to set your own password when you first sign in.',
      ].join('\n')
    : '';

  return (
    <div className="space-y-4">
      <Alert variant="success" title={`${subscriber.name} is now a subscriber`} inline>
        {[
          subscriber.accountNumber && `Account ${subscriber.accountNumber}`,
          subscriber.username && `username ${subscriber.username}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Alert>

      {/* Added without a sale: just the package they are on */}
      {!subscriber.invoice && subscriber.packageName && (
        <div className="rounded-2xl bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-4">Package</p>
          <p className="mt-1 text-[14px] font-semibold text-foreground">{subscriber.packageName}</p>
        </div>
      )}

      {/* How the first package settled, when it was sold */}
      {subscriber.invoice && (
        <div className="rounded-2xl bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-4">First package</p>
          <div className="mt-1 space-y-1">
            <p className="text-[14px] font-semibold text-foreground">{subscriber.packageName}</p>
            {subscriber.invoice.paid >= subscriber.invoice.total ? (
              <p className="text-[13px] text-success">Paid in full · {formatKES(subscriber.invoice.total)} received today.</p>
            ) : subscriber.invoice.paid > 0 ? (
              <p className="text-[13px] font-medium text-warning">
                {formatKES(subscriber.invoice.paid)} received · {formatKES(subscriber.invoice.total - subscriber.invoice.paid)} left on their account.
              </p>
            ) : (
              <p className="text-[13px] font-medium text-warning">
                Nothing paid yet · {formatKES(subscriber.invoice.total)} is on their account.
              </p>
            )}
          </div>
        </div>
      )}

      {grant.error && <Alert variant="error">{apiErrorMessage(grant.error)}</Alert>}

      {sent ? (
        <div className="space-y-3">
          <p className="text-[13px] font-semibold text-foreground">Send this to {first}</p>
          <pre className="whitespace-pre-wrap rounded-2xl bg-[#F2F2F4] p-4 text-[13px] leading-relaxed text-foreground [.dark_&]:bg-[#1E1E1E]">
            {message}
          </pre>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={async () => {
                await navigator.clipboard.writeText(message).catch(() => undefined);
                setCopied(true);
              }}
            >
              <Copy className="h-4 w-4" aria-hidden /> {copied ? 'Copied' : 'Copy'}
            </Button>
            <a
              href={whatsappUrl(subscriber.phone, message) ?? `https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[14px] font-semibold text-white"
            >
              WhatsApp
            </a>
          </div>
          <Button
            variant="outline"
            className="w-full rounded-2xl"
            loading={grant.isPending}
            onClick={() => grant.mutate()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Generate a new password
          </Button>
          <p className="text-[11px] text-foreground-4">
            Generating again replaces the old password immediately. Use it if the message never reached them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Button
            className="w-full rounded-2xl"
            size="lg"
            loading={grant.isPending}
            onClick={() => grant.mutate()}
          >
            <KeyRound className="h-4 w-4" aria-hidden /> Generate their login and send it
          </Button>
          <p className="text-[12px] leading-relaxed text-foreground-3">
            Creates their app login with a temporary password you send over WhatsApp, SMS or in person. They
            set their own password the first time they sign in.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-edge pt-3">
        <p className="flex items-center gap-1.5 text-[11px] text-foreground-4">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          They can also be given access later from their account page.
        </p>
        <Button className="shrink-0 rounded-full" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
