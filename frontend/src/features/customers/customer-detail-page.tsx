import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Pencil,
  Plus,
  ShoppingCart,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { customersApi, salesApi } from '@/api/endpoints';
import { AppBar } from '@/components/layout/app-bar';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge, statusVariant, statusLabel } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/spinner';
import { Dialog } from '@/components/ui/dialog';
import { formatKES, formatDate, formatDateTime } from '@/lib/utils';
import { invoiceNo } from '@/features/isp/document-actions';
import { useState } from 'react';
import { SubscriberForm } from '@/features/isp/subscriber-form';
import { ClientAppAccess } from './client-app-access';
import { UnpaidInvoices } from './unpaid-invoices';
import { ContactButtons, LogCallSheet, SendSmsSheet } from '@/features/isp/contact';
import { CallHistory, SubscriptionCard } from '@/features/isp/subscription';

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);

  const customerQuery = useQuery({
    queryKey: ['customers', id],
    queryFn: () => customersApi.get(id),
  });

  const salesQuery = useQuery({
    queryKey: ['customer-sales', id],
    queryFn: () => salesApi.list({ customerId: id, limit: 20 }),
  });

  if (customerQuery.isLoading) return <PageLoader inline message="Loading" />;

  if (customerQuery.error || !customerQuery.data) {
    return (
      <Alert variant="error" title="Subscriber not found" inline>
        {apiErrorMessage(customerQuery.error)}
      </Alert>
    );
  }

  const customer = customerQuery.data;

  return (
    <div className="space-y-4 pb-10">
      <AppBar title="Subscriber" onBack={() => navigate(-1)} />

      {/* Customer header — flat, polished */}
      <div className="space-y-4">
        <div className="flex items-center gap-4 px-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-lg font-medium text-accent">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">{customer.name}</h2>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground-5">
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </span>
              )}
              {customer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {customer.email}
                </span>
              )}
              {customer.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {customer.address}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 px-1">
          <Stat label="Total spent" value={formatKES(customer.total_spent)} />
          <Stat label="Owes you" value={formatKES(customer.outstanding_balance)} tone={customer.outstanding_balance > 0 ? 'danger' : 'default'} />
          <Stat label="Visits" value={String(customer.visit_count)} />
          <Stat label="Last visit" value={customer.last_visit_at ? formatDate(customer.last_visit_at) : '—'} />
        </div>
      </div>

      {/* Unpaid invoices, each with a prompt to pay */}
      <UnpaidInvoices customer={customer} />

      {/* Actions in the Sales page's outline pill style */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => navigate(`/sales/new?customer=${customer.id}`)}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full border-2 border-edge-2 text-[15px] font-semibold text-brand-600 transition-colors active:scale-[0.98] active:border-brand-600 [.dark_&]:text-brand-400"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Record sale
        </button>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full border-2 border-edge-2 text-[15px] font-semibold text-brand-600 transition-colors active:scale-[0.98] active:border-brand-600 [.dark_&]:text-brand-400"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </button>
      </div>

      {/* WiFi package + quick contact */}
      <SubscriptionCard customerId={customer.id} name={customer.name} />
      <div className="flex items-center justify-between gap-3 px-1 py-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">Contact {customer.name.split(' ')[0]}</p>
          <p className="truncate text-[12px] text-foreground-4">{customer.phone ?? 'No phone number saved'}</p>
        </div>
        <ContactButtons
          phone={customer.phone}
          message={`Hello ${customer.name}, this is Knoxville.`}
          onMessage={() => setSmsOpen(true)}
          onLog={() => setLogOpen(true)}
        />
      </div>

      {/* The client's own app login (admins only) */}
      <ClientAppAccess customerId={customer.id} name={customer.name} email={customer.email} username={customer.username} />

      {/* Purchase history — flat, professional */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[13px] font-medium tracking-tight text-foreground">Purchase history</h2>
          <Link to={`/sales?customer=${customer.id}`} className="text-xs font-medium text-accent hover:text-accent-strong">
            View all
          </Link>
        </div>
        {salesQuery.isLoading && <PageLoader inline message="Loading" />}
        {salesQuery.data && salesQuery.data.items.length === 0 && (
          <div className="px-1 py-8 text-center">
            <ShoppingCart className="mx-auto h-8 w-8 text-foreground-5" aria-hidden />
            <p className="mt-2 text-sm font-medium text-foreground">No purchases yet</p>
            <p className="mt-1 text-xs text-foreground-4">This subscriber hasn't bought anything yet.</p>
            <Button size="sm" className="mt-4 rounded-full bg-accent text-white" onClick={() => navigate(`/sales/new?customer=${customer.id}`)}>
              Record a sale
            </Button>
          </div>
        )}
        {salesQuery.data && salesQuery.data.items.length > 0 && (
          <ul className="divide-y divide-edge max-lg:divide-y-0">
            {salesQuery.data.items.map((sale) => (
              <li key={sale.id}>
                <Link to={`/sales/${sale.id}`} className="flex items-center justify-between gap-3 px-1 py-3 hover:bg-surface-2 transition-colors">
                  <div>
                    <p className="text-sm font-medium tabular-nums text-foreground">{sale.number ? invoiceNo(sale.number) : `#${sale.id.slice(0, 8).toUpperCase()}`}</p>
                    <p className="text-xs text-foreground-5">
                      {formatDateTime(sale.created_at)} · {sale.payment_method}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums text-foreground">{formatKES(sale.total)}</span>
                    <Badge variant={statusVariant(sale.payment_status)}>{statusLabel(sale.payment_status)}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Calls with this client */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[13px] font-medium tracking-tight text-foreground">Calls</h2>
          <button type="button" onClick={() => setLogOpen(true)} className="text-xs font-medium text-accent">
            Log a call
          </button>
        </div>
        <CallHistory customerId={customer.id} />
      </section>
      <LogCallSheet open={logOpen} onOpenChange={setLogOpen} customerId={customer.id} customerName={customer.name} />
      <SendSmsSheet
        open={smsOpen}
        onOpenChange={setSmsOpen}
        customerId={customer.id}
        customerName={customer.name}
        phone={customer.phone}
        defaultMessage={`Hello ${customer.name}, this is Knoxville. Your monthly subscription is due for renewal. Pay via M-Pesa to stay connected. Thank you.`}
      />

      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit subscriber"
        description="Update this subscriber's details."
      >
        {editOpen && (
          <SubscriberForm
            customerId={customer.id}
            onDone={() => setEditOpen(false)}
            onCancel={() => setEditOpen(false)}
            onRemoved={() => navigate('/subscribers', { replace: true })}
          />
        )}
      </Dialog>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'danger';
}) {
  return (
      <div className="rounded-xl bg-surface-2 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-5">
        {label}
      </p>
      <p
        className={
          'mt-0.5 text-sm font-medium ' +
          (tone === 'danger' ? 'text-danger' : 'text-foreground')
        }
      >
        {value}
      </p>
    </div>
  );
}
