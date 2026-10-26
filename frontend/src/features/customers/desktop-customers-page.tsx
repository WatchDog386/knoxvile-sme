import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customersApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { Customer } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { DataTable, DOT, StatusText, type Column } from '@/components/desktop/data-table';
import { ListToolbar, ToolbarButton, ToolbarSelect } from '@/components/desktop/list-toolbar';
import { TableEmpty } from '@/components/desktop/table-empty';
import { csvDateStamp, downloadCsv } from '@/lib/csv';
import { formatDate, formatKES } from '@/lib/utils';
import { usePageCount } from '@/stores/page-meta';
import { CustomerForm } from './customer-form';

/** Rows per page; matches the mobile list so both views page the same way. */
const PAGE_SIZE = 20;

type Filter = 'all' | 'debtors' | 'creditors' | 'loyal';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Everyone' },
  { value: 'debtors', label: 'Debtors' },
  { value: 'creditors', label: 'Creditors' },
  { value: 'loyal', label: 'Loyal' },
];

function balanceTone(balance: number): 'red' | 'green' | 'grey' {
  if (balance > 0) return 'red';
  if (balance < 0) return 'green';
  return 'grey';
}

/** Desktop-only customers list (lg and up). Phones use the stacked mobile page. */
export function DesktopCustomersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true);
  }, [searchParams]);

  // Debounce typing, then return to the first page of results.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', { page, search: debouncedSearch }],
    queryFn: () => customersApi.list({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined }),
  });

  usePageCount(data?.total);

  const items = data?.items ?? [];
  const counts = useMemo(
    () => ({
      all: items.length,
      debtors: items.filter((c) => c.outstanding_balance > 0).length,
      creditors: items.filter((c) => c.outstanding_balance < 0).length,
      loyal: items.filter((c) => c.visit_count > 5).length,
    }),
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((c) => {
        if (filter === 'debtors') return c.outstanding_balance > 0;
        if (filter === 'creditors') return c.outstanding_balance < 0;
        if (filter === 'loyal') return c.visit_count > 5;
        return true;
      }),
    [items, filter],
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const isFiltered = Boolean(debouncedSearch) || filter !== 'all';
  const hasNoCustomers = !isLoading && !data?.total && !isFiltered;

  const addedOn = (c: Customer) => formatDate(c.created_at);

  const columns: Column<Customer>[] = [
    {
      key: 'email',
      header: 'Customer Email',
      cell: (c) => <span className="text-foreground-2">{c.email ?? c.username ?? '—'}</span>,
      className: 'w-[30%]',
    },
    {
      key: 'name',
      header: 'Full Name',
      cell: (c) => <span className="text-foreground">{c.name}</span>,
      className: 'w-[24%]',
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (c) => <span className="tabular-nums">{c.phone ?? '—'}</span>,
    },
    {
      key: 'balance',
      header: 'Balance',
      cell: (c) =>
        c.outstanding_balance === 0 ? (
          <StatusText tone="grey">Settled</StatusText>
        ) : (
          <StatusText tone={balanceTone(c.outstanding_balance)}>
            {c.outstanding_balance > 0
              ? `Owes ${formatKES(c.outstanding_balance)}`
              : `Credit ${formatKES(Math.abs(c.outstanding_balance))}`}
          </StatusText>
        ),
    },
    {
      key: 'added',
      header: 'Added On',
      cell: (c) => <span className="text-foreground-3">{addedOn(c)}</span>,
    },
  ];

  function exportCsv() {
    downloadCsv(
      `customers-${csvDateStamp()}`,
      ['Customer Email', 'Full Name', 'Phone', 'Account', 'Visits', 'Total spent', 'Balance', 'Added On'],
      filteredItems.map((c) => [
        c.email ?? '',
        c.name,
        c.phone ?? '',
        c.account_number ?? '',
        c.visit_count,
        c.total_spent,
        c.outstanding_balance,
        addedOn(c),
      ]),
    );
  }

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setFilter('all');
    setPage(1);
  }

  return (
    <div className="pb-6">
      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by email or name"
        actions={
          <>
            <ToolbarSelect
              label="Show"
              value={filter}
              onChange={(value) => {
                setFilter(value);
                setPage(1);
              }}
              options={FILTERS.map((f) => ({ value: f.value, label: `${f.label} (${counts[f.value]})` }))}
            />
            <ToolbarButton icon="add" onClick={() => setFormOpen(true)}>
              Add Customer
            </ToolbarButton>
            <ToolbarButton onClick={exportCsv} disabled={filteredItems.length === 0}>
              Export CSV
            </ToolbarButton>
          </>
        }
      />

      {error && (
        <Alert variant="error" title="Could not load customers" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}

      <DataTable<Customer>
        columns={columns}
        rows={filteredItems}
        rowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/customers/${c.id}`)}
        loading={isLoading}
        dot={(c) => (c.outstanding_balance > 0 ? DOT.red : c.outstanding_balance < 0 ? DOT.green : DOT.grey)}
        page={page}
        totalPages={totalPages}
        total={data?.total ?? 0}
        onPage={setPage}
        empty={
          hasNoCustomers ? (
            <TableEmpty
              title="No customers found"
              description="Customers appear here after their first payment, or when you add one."
              actionLabel="Add Customer"
              onAction={() => setFormOpen(true)}
            />
          ) : (
            <TableEmpty
              title="No clients found"
              description="Try a different search term or clear the filter to see everyone."
              onClear={clearFilters}
            />
          )
        }
      />

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add client"
        description="New WiFi customer"
      >
        <CustomerForm onClose={() => setFormOpen(false)} />
      </Dialog>
    </div>
  );
}