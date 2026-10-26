import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Hash } from 'lucide-react';
import { businessesApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRole } from '@/hooks/use-role';
import { useActiveBusiness, useBusinessStore } from '@/stores/business';

const PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

/** Settings card: the letters every new subscriber account number starts with (KNX → KNX001). */
export function AccountPrefixCard() {
  const { canManage } = useRole();
  const business = useActiveBusiness();
  const queryClient = useQueryClient();
  const saved = business?.account_prefix || 'FBI';
  const [prefix, setPrefix] = useState(saved);

  useEffect(() => setPrefix(saved), [saved]);

  const save = useMutation({
    mutationFn: () => businessesApi.update({ accountPrefix: prefix }),
    onSuccess: async (updated) => {
      const { businesses, setBusinesses } = useBusinessStore.getState();
      setBusinesses(businesses.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
      await queryClient.invalidateQueries({ queryKey: ['customer-options'] });
    },
  });

  if (!canManage) return null;
  const valid = PATTERN.test(prefix);
  const dirty = prefix !== saved;

  return (
    <section className="mt-6">
      <p className="mb-1.5 ml-1 text-[15px] font-medium tracking-tight text-foreground">Subscribers</p>
      <form
        className="rounded-[24px] border border-edge bg-surface p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && dirty) save.mutate();
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Hash className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-foreground">Account number prefix</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-foreground-4">
              New subscribers get account numbers that start with this, e.g. <b>{valid ? prefix : saved}001</b>. Existing accounts keep theirs, and M-Pesa payments to either still match.
            </p>
          </div>
        </div>

        {save.error && (
          <div className="mt-3"><Alert variant="error" inline>{apiErrorMessage(save.error)}</Alert></div>
        )}

        <label htmlFor="account-prefix" className="mt-4 block text-[12px] font-medium text-foreground-3">Prefix</label>
        <Input
          id="account-prefix"
          value={prefix}
          maxLength={10}
          autoComplete="off"
          autoCapitalize="characters"
          aria-invalid={!valid}
          className="mt-1.5 h-11 rounded-xl bg-field uppercase"
          placeholder="KNX"
          onChange={(event) => {
            save.reset();
            setPrefix(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
          }}
        />
        {!valid && <p className="mt-1.5 text-[11px] text-danger">Use 2 to 10 letters or digits, starting with a letter.</p>}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-emerald-600" aria-live="polite">
            {save.isSuccess && <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" aria-hidden />Saved</span>}
          </span>
          <Button type="submit" size="sm" disabled={!valid || !dirty || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save prefix'}
          </Button>
        </div>
      </form>
    </section>
  );
}
