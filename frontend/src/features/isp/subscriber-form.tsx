import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { customersApi, productsApi, subscriptionsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { Customer, SubscriberInput } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PageLoader } from '@/components/ui/spinner';
import { formatKES } from '@/lib/utils';
import { useRole } from '@/hooks/use-role';
import { OnboardedAccess, type OnboardedSubscriber } from './onboarded-access-step';

/** A plain group heading inside the sheet; fields stack like the other forms. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-4">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-foreground-4">{hint}</p>}
    </div>
  );
}

/**
 * Add or edit a subscriber as an app user. Subscribers already exist in the
 * company's billing system and are already installed, so this only records
 * who they are: account number (FBI001 style), username, name, package,
 * contacts, location and SMS group. The package is recorded without a sale,
 * so no invoice or wallet is touched. Once
 * saved, the office hands them their own login with a temporary password.
 */
export function SubscriberForm({
  customerId,
  onDone,
  onCancel,
  onRemoved,
}: {
  /** Set to edit that subscriber; leave out to add a new one. */
  customerId?: string;
  onDone: () => void;
  onCancel: () => void;
  /** After an admin removes the subscriber; defaults to onDone. */
  onRemoved?: () => void;
}) {
  const id = customerId;
  const editing = Boolean(id);
  const queryClient = useQueryClient();
  const { role } = useRole();
  const canRemove = role === 'OWNER' || role === 'MANAGER';
  const [confirmRemove, setConfirmRemove] = useState(false);
  const removal = useMutation({
    mutationFn: () => customersApi.remove(id!),
    onSuccess: async () => {
      await Promise.all(
        ['subscriptions', 'subscribers', 'customers', 'customer-options', 'sales', 'dashboard'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      (onRemoved ?? onDone)();
    },
  });

  const optionsQuery = useQuery({ queryKey: ['customer-options'], queryFn: () => customersApi.options() });
  const customerQuery = useQuery({
    queryKey: ['customers', id],
    queryFn: () => customersApi.get(id!),
    enabled: editing,
  });
  const packageQuery = useQuery({
    queryKey: ['subscriptions', 'customer', id],
    queryFn: () => subscriptionsApi.forCustomer(id!),
    enabled: editing,
  });
  const productsQuery = useQuery({
    queryKey: ['products', { page: 1, limit: 100 }],
    queryFn: () => productsApi.list({ page: 1, limit: 100 }),
  });
  const packages = useMemo(
    () =>
      (productsQuery.data?.items ?? [])
        .filter((p) => p.billing_days && p.active)
        .sort((a, b) => a.selling_price - b.selling_price),
    [productsQuery.data],
  );
  const options = optionsQuery.data;

  const [accountNumber, setAccountNumber] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [smsGroup, setSmsGroup] = useState('');
  const [packageId, setPackageId] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState<OnboardedSubscriber | null>(null);
  const filled = useRef(false);

  // New subscriber: suggest the next FBI account number (username follows it)
  useEffect(() => {
    if (!editing && options && !accountNumber) {
      setAccountNumber(options.nextAccountNumber);
      if (!usernameTouched) setUsername(options.nextAccountNumber);
    }
  }, [editing, options, accountNumber, usernameTouched]);

  // Editing: fill the form once from the saved record
  useEffect(() => {
    const c: Customer | undefined = customerQuery.data;
    if (!c || filled.current) return;
    filled.current = true;
    setAccountNumber(c.account_number ?? '');
    setUsername(c.username ?? '');
    setUsernameTouched(true);
    setName(c.name);
    setPhone(c.phone ?? '');
    setExtraPhones(c.extra_phones ?? []);
    setEmail(c.email ?? '');
    setLocation(c.location ?? '');
    setAddress(c.address ?? '');
    setSmsGroup(c.sms_group ?? '');
  }, [customerQuery.data]);

  // Editing: show the package they are on now
  const currentPackageId = packageQuery.data?.productId ?? '';
  useEffect(() => {
    if (currentPackageId) setPackageId(currentPackageId);
  }, [currentPackageId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!accountNumber.trim()) throw new Error('Enter the account number, e.g. FBI001.');
      if (!name.trim()) throw new Error('Enter the full name.');
      if (!packageId) throw new Error('Choose the package the subscriber is on.');

      // Only these fields are sent, so editing never clears anything else on file
      const data: SubscriberInput & { name: string } = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        accountNumber: accountNumber.trim().toUpperCase(),
        username: username.trim(),
        extraPhones: extraPhones.map((p) => p.trim()).filter(Boolean),
        location: location.trim(),
        smsGroup: smsGroup.trim(),
      };

      if (editing) {
        await customersApi.update(id!, data);
        if (packageId !== currentPackageId) await subscriptionsApi.setPackage(id!, packageId);
        return null;
      }

      const customer = await customersApi.create(data);
      // Recorded as their current package; no sale or invoice is raised
      const plan = await subscriptionsApi.setPackage(customer.id, packageId);
      return {
        customerId: customer.id,
        name: customer.name,
        username: customer.username ?? '',
        accountNumber: customer.account_number ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        packageName: plan.packageName,
        invoice: null,
      } satisfies OnboardedSubscriber;
    },
    onSuccess: async (created) => {
      await Promise.all(
        ['subscriptions', 'subscribers', 'customers', 'customer-options', 'dashboard'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      // A new subscriber is not finished until they have their own login
      if (created) setOnboarded(created);
      else onDone();
    },
    onError: (err) => {
      setError(err instanceof Error && !('response' in err) ? err.message : apiErrorMessage(err));
    },
  });

  if (editing && customerQuery.isLoading) return <PageLoader inline message="Loading" />;

  // Saved: the only thing left is handing them their own login
  if (onboarded) return <OnboardedAccess subscriber={onboarded} onDone={onDone} />;

  return (
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        noValidate
      >
        {error && <Alert variant="error" inline>{error}</Alert>}
        <Section title="Subscriber">
          <Field label="Account number" htmlFor="sf-account" hint="As in the billing system, e.g. FBI001.">
            <Input
              id="sf-account"
              autoComplete="off"
              autoCapitalize="characters"
              className="uppercase"
              placeholder="FBI001"
              value={accountNumber}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setAccountNumber(value);
                if (!usernameTouched) setUsername(value);
              }}
            />
          </Field>
          <Field label="Username" htmlFor="sf-username" hint="The subscriber signs in to the app with this. Follows the account number unless you change it.">
            <Input
              id="sf-username"
              autoComplete="off"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameTouched(true);
              }}
            />
          </Field>

          <Field label="Full name" htmlFor="sf-name">
            <Input id="sf-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field
            label="Package"
            htmlFor="sf-package"
            hint={packages.length || productsQuery.isLoading ? undefined : 'No packages yet. Add one under Products with billing days.'}
          >
            <Select id="sf-package" placeholder="Choose a package" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatKES(p.selling_price)} / {p.billing_days} days
                </option>
              ))}
            </Select>
          </Field>
        </Section>

        <Section title="Contacts">
          <Field label="Phone number" htmlFor="sf-phone">
            <Input id="sf-phone" type="tel" inputMode="tel" placeholder="0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>

          <div>
            <Label>Additional numbers</Label>
            <div className="space-y-2">
              {extraPhones.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="tel"
                    inputMode="tel"
                    aria-label={`Additional number ${i + 1}`}
                    placeholder="0722000000"
                    value={p}
                    onChange={(e) => setExtraPhones((list) => list.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                  <button
                    type="button"
                    aria-label="Remove number"
                    onClick={() => setExtraPhones((list) => list.filter((_, j) => j !== i))}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-foreground-3 active:scale-90"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
              {extraPhones.length < 5 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setExtraPhones((list) => [...list, ''])}>
                  <Plus className="h-4 w-4" aria-hidden /> Add number
                </Button>
              )}
            </div>
          </div>

          <Field label="Email address" htmlFor="sf-email">
            <Input id="sf-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </Section>

        <Section title="Location">
          <Field label="Location" htmlFor="sf-location" hint="Pick a known estate or type a new one.">
            <Input
              id="sf-location"
              list="sf-locations"
              autoComplete="off"
              placeholder="e.g. Imara Daima"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <datalist id="sf-locations">
              {options?.locations.map((l) => <option key={l} value={l} />)}
            </datalist>
          </Field>
          <Field label="House / building" htmlFor="sf-address">
            <Input id="sf-address" autoComplete="off" placeholder="e.g. Block C, House 12" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>

          <Field label="SMS group" htmlFor="sf-group">
            <Input
              id="sf-group"
              list="sf-groups"
              autoComplete="off"
              placeholder="None"
              value={smsGroup}
              onChange={(e) => setSmsGroup(e.target.value)}
            />
            <datalist id="sf-groups">
              {options?.smsGroups.map((g) => <option key={g} value={g} />)}
            </datalist>
          </Field>
        </Section>

        {/* Admins can remove the subscriber: a second tap confirms */}
        {editing && canRemove && confirmRemove && (
          <Alert variant="error" inline>
            Remove {name || 'this subscriber'}? Their app login is deleted. Past records stay.
            {removal.error && <span className="mt-1 block font-semibold">{apiErrorMessage(removal.error)}</span>}
          </Alert>
        )}
        <div className="flex justify-end gap-3 pt-1">
          {editing && canRemove && (
            <Button
              type="button"
              variant="outline"
              className="mr-auto text-danger"
              loading={removal.isPending}
              onClick={() => (confirmRemove ? removal.mutate() : setConfirmRemove(true))}
            >
              {confirmRemove ? 'Yes, remove' : 'Remove'}
            </Button>
          )}
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {editing ? 'Save changes' : 'Add subscriber'}
          </Button>
        </div>
      </form>
  );
}
