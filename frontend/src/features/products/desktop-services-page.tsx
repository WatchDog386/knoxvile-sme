import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { categoriesApi, servicesApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import {
  DataTable,
  DOT,
  StatusText,
  type Column,
} from '@/components/desktop/data-table';
import { ListToolbar, ToolbarButton, ToolbarSelect } from '@/components/desktop/list-toolbar';
import { TableEmpty } from '@/components/desktop/table-empty';
import { usePageCount } from '@/stores/page-meta';
import { csvDateStamp, downloadCsv } from '@/lib/csv';
import { formatKES } from '@/lib/utils';
import { ServiceForm } from './service-form';
import type { Service } from '@/api/types';

type StatusFilter = 'all' | 'active' | 'inactive';
type DurationFilter = 'all' | 'under30' | '30to90' | 'over90';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const DURATION_OPTIONS: Array<{ value: DurationFilter; label: string }> = [
  { value: 'all', label: 'All durations' },
  { value: 'under30', label: 'Under 30 min' },
  { value: '30to90', label: '30 - 90 min' },
  { value: 'over90', label: 'Over 90 min' },
];

const CSV_HEADERS = ['Service', 'Category', 'Price (KES)', 'Duration (min)', 'Status'];

function matchesDuration(service: Service, filter: DurationFilter): boolean {
  if (filter === 'all') return true;
  const minutes = service.duration_minutes;
  if (!minutes) return false;
  if (filter === 'under30') return minutes < 30;
  if (filter === '30to90') return minutes >= 30 && minutes <= 90;
  return minutes > 90;
}

/** Desktop-only services list (lg and up). Phones use the stacked mobile page. */
export function DesktopServicesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true);
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'SERVICE'],
    queryFn: () => categoriesApi.list('SERVICE'),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['services', { search: debouncedSearch }],
    queryFn: () => servicesApi.list({ search: debouncedSearch || undefined }),
  });

  const services = useMemo(() => data ?? [], [data]);

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    categoriesQuery.data?.forEach((category) => map.set(category.id, category.name));
    return map;
  }, [categoriesQuery.data]);

  const rows = useMemo(
    () =>
      services.filter(
        (service) =>
          (!categoryFilter || service.categoryId === categoryFilter) &&
          (statusFilter === 'all' ||
            (statusFilter === 'active' ? service.active : !service.active)) &&
          matchesDuration(service, durationFilter),
      ),
    [services, categoryFilter, statusFilter, durationFilter],
  );

  usePageCount(rows.length);

  const clearFilters = () => {
    setCategoryFilter('');
    setStatusFilter('all');
    setDurationFilter('all');
    setSearch('');
  };

  const hasQuery = Boolean(categoryFilter) || statusFilter !== 'all' || durationFilter !== 'all' || Boolean(search);
  const noServicesYet = services.length === 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => servicesApi.remove(id),
    onSuccess: async () => {
      setConfirmDelete(null);
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: ['services'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setDeleteError(apiErrorMessage(err)),
  });

  const columns: Column<Service>[] = [
    {
      key: 'name',
      header: 'Service',
      className: 'w-[34%]',
      cell: (service) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{service.name}</p>
          {service.description && (
            <p className="truncate text-[12px] text-foreground-5">{service.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      cell: (service) =>
        service.categoryId ? categoryNames.get(service.categoryId) ?? 'Uncategorised' : 'Uncategorised',
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      cell: (service) => <span className="tabular-nums">{formatKES(service.price)}</span>,
    },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      cell: (service) =>
        service.duration_minutes ? (
          <span className="tabular-nums">{service.duration_minutes} min</span>
        ) : (
          <span className="text-foreground-5">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (service) => (
        <StatusText tone={service.active ? 'green' : 'grey'}>{service.active ? 'Active' : 'Inactive'}</StatusText>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-20',
      cell: (service) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setEditService(service);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-4 transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label={`Edit ${service.name}`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setConfirmDelete(service);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-4 transition-colors hover:bg-surface-2 hover:text-red-600 [.dark_&]:hover:text-red-400"
            aria-label={`Delete ${service.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ),
    },
  ];

  const exportCsv = () => {
    downloadCsv(
      `services-${csvDateStamp()}`,
      CSV_HEADERS,
      rows.map((service) => [
        service.name,
        service.categoryId ? categoryNames.get(service.categoryId) ?? 'Uncategorised' : 'Uncategorised',
        service.price,
        service.duration_minutes ?? '',
        service.active ? 'Active' : 'Inactive',
      ]),
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-normal tracking-tight text-foreground">Services</h1>
          <p className="mt-1 text-[13.5px] text-foreground-3">
            What you offer, what it costs and whether it is still on the books.
          </p>
        </div>
        <ToolbarButton icon="add" onClick={() => setFormOpen(true)}>
          Add service
        </ToolbarButton>
      </div>

      {error && (
        <Alert variant="error" title="Could not load services" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}

      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search services"
        filters={
          <>
            <ToolbarSelect
              label="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: '', label: 'All categories' },
                ...(categoriesQuery.data ?? []).map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ]}
            />
            <ToolbarSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
            />
            <ToolbarSelect
              label="Duration"
              value={durationFilter}
              onChange={setDurationFilter}
              options={DURATION_OPTIONS}
            />
          </>
        }
        actions={
          <ToolbarButton
            icon="export"
            variant="outline"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            Export CSV
          </ToolbarButton>
        }
      />

      <DataTable<Service>
        columns={columns}
        rows={rows}
        rowKey={(service) => service.id}
        onRowClick={(service) => setEditService(service)}
        loading={isLoading}
        dot={(service) => (service.active ? DOT.green : DOT.grey)}
        empty={
          noServicesYet && !isLoading ? (
            <TableEmpty
              title="No services yet"
              description="Add the services you offer so you can sell them in seconds."
              actionLabel="Add a service"
              onAction={() => setFormOpen(true)}
            />
          ) : (
            <TableEmpty
              title="No services found"
              description={
                hasQuery
                  ? 'Try a different search term or clear the filters.'
                  : 'Add the services you offer so you can sell them in seconds.'
              }
              onClear={hasQuery ? clearFilters : undefined}
            />
          )
        }
      />

      {!isLoading && rows.length > 0 && (
        <p className="text-[12.5px] text-foreground-4">
          Showing {rows.length} of {services.length} service{services.length === 1 ? '' : 's'}
          {hasQuery ? ' (filtered)' : ''}
        </p>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add a service"
        description="A service is something you do for a customer, like a haircut."
      >
        <ServiceForm onClose={() => setFormOpen(false)} />
      </Dialog>

      <Dialog
        open={Boolean(editService)}
        onOpenChange={(open) => !open && setEditService(null)}
        title="Edit service"
      >
        {editService && (
          <ServiceForm
            onClose={() => setEditService(null)}
            defaultValues={{
              id: editService.id,
              name: editService.name,
              description: editService.description,
              price: editService.price,
              duration_minutes: editService.duration_minutes,
              categoryId: editService.categoryId,
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete service?"
        description={`"${confirmDelete?.name}" will be permanently removed. Services that have been sold cannot be deleted.`}
      >
        <div className="space-y-4">
          {deleteError && <Alert variant="error">{deleteError}</Alert>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              disabled={deleteMutation.isPending}
              className="h-9 rounded-md border border-edge bg-surface px-4 text-[13px] text-foreground-2 transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              disabled={deleteMutation.isPending}
              className="inline-flex h-9 items-center rounded-md bg-red-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete service
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}