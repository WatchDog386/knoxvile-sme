import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Scissors, Clock, ChevronRight, AlertTriangle, Trash2 } from 'lucide-react';
import { servicesApi } from '@/api/endpoints';
import { AppBar } from '@/components/layout/app-bar';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatKES } from '@/lib/utils';
import { ServiceForm } from './service-form';
import type { Service } from '@/api/types';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { DesktopServicesPage } from './desktop-services-page';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 ml-1 text-[14px] font-medium tracking-tight text-foreground">
      {children}
    </p>
  );
}

/** Phone card: round icon + name, description, outlined "Sell" button, faint watermark icon. */
function ServiceCard({
  service,
  onEdit,
  onDelete,
}: {
  service: Service;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-edge bg-surface p-4 [.dark_&]:border-transparent">
      <Scissors className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 -rotate-12 text-foreground opacity-[0.06]" strokeWidth={1.5} aria-hidden />
      <button type="button" onClick={() => onEdit(service)} className="flex flex-col items-start gap-3 text-left">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-3 text-rose-500">
          <Scissors className="h-5 w-5" aria-hidden />
        </span>
        <span className="line-clamp-2 text-[15px] font-medium leading-snug text-foreground">{service.name}</span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(service)}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-foreground-4 active:bg-surface-3"
        aria-label={`Delete ${service.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <p className="mt-1.5 line-clamp-3 flex-1 text-[13px] leading-relaxed text-foreground-3">
        {service.description || 'No description yet'}
        {service.duration_minutes ? ` · ${service.duration_minutes} min` : ''}
      </p>
      <Link
        to={`/sales/new?service=${service.id}`}
        className="relative mt-4 inline-flex h-10 items-center self-start rounded-xl border-[1.5px] border-brand-600 px-3.5 text-[13px] font-medium text-brand-600 transition-colors active:bg-brand-50 [.dark_&]:border-brand-400 [.dark_&]:text-brand-300 [.dark_&]:active:bg-brand-950"
      >
        Sell · {formatKES(service.price)}
      </Link>
    </div>
  );
}

function ServiceRow({
  service,
  onEdit,
  onDelete,
}: {
  service: Service;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
}) {
  return (
    <button
      onClick={() => onEdit(service)}
      className="relative flex w-full items-center gap-3 px-1 py-3 text-center transition-colors duration-150 hover:bg-surface-2 active:bg-surface-3 group max-lg:rounded-xl"
    >
      <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <Scissors className="h-4.5 w-4.5" aria-hidden />
      </span>

      <span className="min-w-0 flex-1 flex flex-col items-center">
        <span className="block truncate text-sm font-medium text-foreground leading-snug w-full text-center">
          {service.name}
        </span>
        <span className="block truncate text-xs leading-snug text-foreground-4 w-full text-center">
          {service.description ?? 'No description'}
        </span>
      </span>

      <div className="flex items-center gap-2 shrink-0">
        {service.duration_minutes && (
          <Badge variant="secondary" className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {service.duration_minutes} min
          </Badge>
        )}

        <div className="text-center hidden sm:block">
          <p className="text-sm font-semibold text-foreground">{formatKES(service.price)}</p>
          <p className="text-[11px] text-foreground-5">price</p>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(service); }}
          className="p-1.5 rounded-lg text-foreground-4 hover:bg-surface-3 hover:text-red-500 transition-colors"
          title="Delete service"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
        </button>

        <ChevronRight className="h-4 w-4 shrink-0 text-foreground-5 group-hover:text-foreground transition-colors max-lg:hidden" aria-hidden />
      </div>
    </button>
  );
}

/** Desktop gets its own table view; phones keep the card layout. Separate components so each keeps its own hooks. */
export function ServicesPage() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopServicesPage /> : <ServicesMobilePage />;
}

function ServicesMobilePage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true);
  }, [searchParams]);
  const [editService, setEditService] = useState<Service | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['services', { search: debouncedSearch }],
    queryFn: () => servicesApi.list({ search: debouncedSearch || undefined, active: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => servicesApi.remove(id),
    onSuccess: async () => {
      setConfirmDelete(null);
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (err) => setDeleteError(apiErrorMessage(err)),
  });

  const header = (
    <>
      <AppBar
        title="Services"
        onBack={() => window.history.back()}
        right={
          <div>
            <Button onClick={() => setFormOpen(true)} className="h-9 px-3 gap-1.5">
              <Plus className="h-4 w-4" />
              Add service
            </Button>
          </div>
        }
      />

      <div className="pb-3 lg:px-4">
        <div className="flex h-11 items-center gap-2.5 rounded-full border border-edge bg-field px-4 focus-within:border-edge-2">
          <Search className="h-4 w-4 shrink-0 text-foreground-4" aria-hidden />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              window.setTimeout(() => setDebouncedSearch(event.target.value), 300);
            }}
            placeholder="Search services..."
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:font-medium placeholder:text-foreground-4"
            autoComplete="off"
          />
        </div>
      </div>
    </>
  );

  const emptyState = (
    <EmptyState
      icon={Scissors}
      title={debouncedSearch ? 'No services found' : 'No services yet'}
      description={
        debouncedSearch
          ? 'Try a different search term.'
          : 'Add the services you offer so you can sell them in seconds.'
      }
      actionLabel={debouncedSearch ? undefined : 'Add a service'}
      onAction={() => setFormOpen(true)}
    />
  );

  const serviceList = data && data.length > 0 ? (
    <>
    <section className="lg:hidden">
      <SectionLabel>All Services</SectionLabel>
      <div className="stagger-list grid grid-cols-2 gap-3">
        {data.map((service) => (
          <ServiceCard key={service.id} service={service} onEdit={setEditService} onDelete={setConfirmDelete} />
        ))}
      </div>
    </section>
    <Card className="bg-surface mx-4 max-lg:hidden max-lg:mx-0 max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none">
      <SectionLabel>All Services</SectionLabel>
      <div className="stagger-list divide-y divide-edge/50 max-lg:divide-y-0 max-lg:space-y-2">
        {data.map((service) => (
          <ServiceRow
            key={service.id}
            service={service}
            onEdit={setEditService}
            onDelete={setConfirmDelete}
          />
        ))}
      </div>
    </Card>
    </>
  ) : null;

  return (
    <div className="space-y-5">
      {header}
      {error && <Alert variant="error" title="Could not load services" inline>{apiErrorMessage(error)}</Alert>}
      {isLoading && <PageLoader inline message="Loading" />}
      {data && data.length === 0 && emptyState}
      {serviceList}

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
            defaultValues={editService}
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
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() =>
                confirmDelete && deleteMutation.mutate(confirmDelete.id)
              }
            >
              Delete service
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}