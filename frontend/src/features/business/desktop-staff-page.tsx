import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Calculator,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useActiveBusiness } from '@/stores/business';
import { businessesApi } from '@/api/endpoints';
import type { BusinessMember, UserRole } from '@/api/types';
import { api, apiErrorMessage } from '@/api/client';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ListToolbar, ToolbarButton, ToolbarSelect } from '@/components/desktop/list-toolbar';
import { DataTable, DOT, StatusText, type Column } from '@/components/desktop/data-table';
import { TableEmpty } from '@/components/desktop/table-empty';
import { usePageCount } from '@/stores/page-meta';
import { csvDateStamp, downloadCsv } from '@/lib/csv';
import { cn, formatDate } from '@/lib/utils';
import { useRole } from '@/hooks/use-role';

interface NewMember {
  email: string;
  role: UserRole;
  fullName?: string;
  phone?: string;
  password?: string;
}

type RoleInfo = {
  label: string;
  plural: string;
  icon: LucideIcon;
  description: string;
  tone: string;
  avatar: string;
};

const ROLES: Record<UserRole, RoleInfo> = {
  OWNER: {
    label: 'Admin',
    plural: 'Admins',
    icon: UsersRound,
    description: 'Full access, including staff roles and business settings',
    tone: 'bg-violet-50 text-violet-700 [.dark_&]:bg-violet-500/15 [.dark_&]:text-violet-300',
    avatar: 'bg-violet-600',
  },
  MANAGER: {
    label: 'Manager',
    plural: 'Managers',
    icon: Briefcase,
    description: 'Runs products, sales, expenses, customers and staff',
    tone: 'bg-emerald-50 text-emerald-700 [.dark_&]:bg-emerald-500/15 [.dark_&]:text-emerald-300',
    avatar: 'bg-emerald-600',
  },
  EMPLOYEE: {
    label: 'Employee',
    plural: 'Employees',
    icon: Users,
    description: 'Records sales and submits expenses',
    tone: 'bg-sky-50 text-sky-700 [.dark_&]:bg-sky-500/15 [.dark_&]:text-sky-300',
    avatar: 'bg-sky-600',
  },
  // Client logins are not staff and never listed here
  CLIENT: {
    label: 'Client',
    plural: 'Clients',
    icon: Users,
    description: 'WiFi client with the client app',
    tone: 'bg-teal-50 text-teal-700 [.dark_&]:bg-teal-500/15 [.dark_&]:text-teal-300',
    avatar: 'bg-teal-600',
  },
  ACCOUNTANT: {
    label: 'Accountant',
    plural: 'Accountants',
    icon: Calculator,
    description: 'Approves expenses and works with reports',
    tone: 'bg-amber-50 text-amber-700 [.dark_&]:bg-amber-500/15 [.dark_&]:text-amber-300',
    avatar: 'bg-amber-500',
  },
};

const ROLE_ORDER: UserRole[] = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'EMPLOYEE'];
const FILTER_ROLES: Array<UserRole | 'ALL'> = ['ALL', 'OWNER', 'MANAGER', 'ACCOUNTANT', 'EMPLOYEE'];
const ASSIGNABLE: UserRole[] = ['MANAGER', 'ACCOUNTANT', 'EMPLOYEE'];

type StatusTone = 'green' | 'red' | 'amber' | 'grey' | 'blue';

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  ACTIVE: { label: 'Active', tone: 'green' },
  PENDING: { label: 'Pending', tone: 'amber' },
  INVITED: { label: 'Invited', tone: 'blue' },
  INACTIVE: { label: 'Inactive', tone: 'grey' },
};

function initials(name: string): string {
  // Only words that start with a letter, so "Korri (Platform Admin)" gives "KP"
  return name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w.replace(/^[^\p{L}]+/u, '')))
    .map((w) => w.replace(/^[^\p{L}]+/u, '')[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function statusOf(member: BusinessMember): { label: string; tone: StatusTone } {
  return STATUS[member.status] ?? STATUS.INACTIVE;
}

function RolePill({ role }: { role: UserRole }) {
  const info = ROLES[role];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium', info.tone)}>
      <info.icon className="h-3 w-3" aria-hidden />
      {info.label}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-4 transition-colors hover:bg-surface-3',
        danger && 'hover:bg-danger-soft hover:text-danger',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-foreground-3">{label}</span>
      {children}
    </label>
  );
}

/** Desktop-only staff list (lg and up). Phones use the stacked mobile page. */
export function DesktopStaffPage() {
  const active = useActiveBusiness();
  if (!active) return <Navigate to="/dashboard" replace />;
  return <DesktopStaffScreen businessId={active.id} businessName={active.name} />;
}

function DesktopStaffScreen({ businessId, businessName }: { businessId: string; businessName: string }) {
  const user = useAuthStore((s) => s.user);
  const { role: myRole, canManage } = useRole();
  const canEditRoles = myRole === 'OWNER';
  const queryClient = useQueryClient();
  const queryKey = ['business', businessId, 'members'];

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('EMPLOYEE');
  const [confirmRemove, setConfirmRemove] = useState<BusinessMember | null>(null);
  const [confirmReset2fa, setConfirmReset2fa] = useState<BusinessMember | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => businessesApi.members(),
    enabled: canManage,
  });

  const members = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) =>
          ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.user.fullName.localeCompare(b.user.fullName),
      ),
    [data],
  );

  usePageCount(members.length);

  const addMutation = useMutation({
    mutationFn: (member: NewMember) => businessesApi.addMember(member),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setAddOpen(false);
      setAddError(null);
    },
    onError: (err) => setAddError(apiErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api<{ success: boolean }>({ method: 'DELETE', url: `/businesses/current/members/${id}` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setConfirmRemove(null);
      setEditingId(null);
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const reset2faMutation = useMutation({
    mutationFn: (id: string) => businessesApi.resetMemberTwoFactor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setConfirmReset2fa(null);
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      api<{ success: boolean }>({ method: 'PATCH', url: `/businesses/current/members/${id}`, data: { role } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const counts = useMemo(() => {
    const c: Partial<Record<UserRole, number>> = {};
    for (const m of members) c[m.role] = (c[m.role] ?? 0) + 1;
    return c;
  }, [members]);

  const term = search.trim().toLowerCase();
  const visible = members.filter(
    (m) =>
      (roleFilter === 'ALL' || m.role === roleFilter) &&
      (!term ||
        m.user.fullName.toLowerCase().includes(term) ||
        m.user.email.toLowerCase().includes(term) ||
        (m.user.phone ?? '').toLowerCase().includes(term)),
  );

  const editing = members.find((m) => m.id === editingId) ?? null;

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('ALL');
  };

  const openAdd = () => {
    setAddError(null);
    setAddOpen(true);
  };

  const openEdit = (member: BusinessMember) => {
    setActionError(null);
    setEditRole(member.role);
    setEditingId(member.id);
  };

  const exportCsv = () => {
    downloadCsv(
      `team-${csvDateStamp()}`,
      ['Name', 'Email', 'Phone', 'Role', 'Status', 'Joined'],
      visible.map((m) => [
        m.user.fullName,
        m.user.email,
        m.user.phone ?? '',
        ROLES[m.role].label,
        statusOf(m).label,
        formatDate(m.createdAt),
      ]),
    );
  };

  const columns: Column<BusinessMember>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (m) => (
        <div className="flex items-center gap-2.5">
          <span
            className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white', ROLES[m.role].avatar)}
          >
            {initials(m.user.fullName)}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-foreground">{m.user.fullName}</span>
            {m.user.id === user?.id && (
              <span className="shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-foreground-3">You</span>
            )}
          </span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      cell: (m) => <span className="text-foreground-3">{m.user.email}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (m) => <span className={m.user.phone ? 'text-foreground-3' : 'text-foreground-5'}>{m.user.phone ?? '—'}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      cell: (m) => <RolePill role={m.role} />,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (m) => <StatusText tone={statusOf(m).tone}>{statusOf(m).label}</StatusText>,
    },
    {
      key: 'joined',
      header: 'Joined',
      cell: (m) => <span className="text-foreground-3">{formatDate(m.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-px',
      cell: (m) => {
        const isSelf = m.user.id === user?.id;
        const editable = canEditRoles && !isSelf && m.role !== 'OWNER';
        if (!canEditRoles) return <span className="text-[12.5px] text-foreground-5">—</span>;
        return (
          <div className="flex items-center justify-end gap-0.5">
            {editable && (
              <ActionButton icon={Pencil} label="Edit role" onClick={() => openEdit(m)} />
            )}
            {!isSelf && m.user.twoFactorEnabled && (
              <ActionButton icon={ShieldCheck} label="Reset two-factor sign-in" onClick={() => setConfirmReset2fa(m)} />
            )}
            {!isSelf && (
              <ActionButton icon={Trash2} label="Remove from team" danger onClick={() => setConfirmRemove(m)} />
            )}
          </div>
        );
      },
    },
  ];

  if (!canManage) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-[26px] font-normal tracking-tight text-foreground">Team</h1>
          <p className="mt-1 text-[13.5px] text-foreground-3">People who work at {businessName}</p>
        </div>
        <div className="flex flex-col items-center rounded-md border border-edge bg-surface px-6 py-14 text-center">
          <p className="text-[15px] font-medium text-foreground">Only admins and managers can see the team</p>
          <p className="mt-1 text-[13px] text-foreground-4">Ask your manager if you need someone added or their role changed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Heading + primary action */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-normal tracking-tight text-foreground">Team</h1>
          <p className="mt-1 text-[13.5px] text-foreground-3">
            People who work at {businessName} — {members.length} member{members.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-accent-strong"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Add staff member
        </button>
      </div>

      {error && (
        <Alert variant="error" title="Could not load the team" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}
      {actionError && (
        <Alert variant="error" title="That change didn’t go through">
          {actionError}
        </Alert>
      )}

      <ListToolbar
        filters={
          <ToolbarSelect
            label="Filter by role"
            value={roleFilter}
            onChange={setRoleFilter}
            options={FILTER_ROLES.map((r) => ({
              value: r,
              label:
                r === 'ALL'
                  ? `All roles (${members.length})`
                  : `${ROLES[r].plural} (${counts[r] ?? 0})`,
            }))}
          />
        }
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by name, email or phone"
        actions={
          <ToolbarButton icon="export" variant="outline" onClick={exportCsv} disabled={visible.length === 0}>
            Export CSV
          </ToolbarButton>
        }
      />

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(m) => m.id}
        dot={(m) => DOT[statusOf(m).tone]}
        loading={isLoading}
        total={visible.length}
        empty={
          <TableEmpty
            title={members.length === 0 ? 'No team members yet' : 'No one matches that search'}
            description={
              members.length === 0
                ? 'Add your first staff member to give them access.'
                : 'Try another name, phone number or role.'
            }
            actionLabel={members.length === 0 ? 'Add staff member' : undefined}
            onAction={members.length === 0 ? openAdd : undefined}
            onClear={members.length === 0 ? undefined : clearFilters}
          />
        }
      />

      {/* Add staff member */}
      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add team member">
        <AddStaffForm
          canAddAdmin={myRole === 'OWNER'}
          isPending={addMutation.isPending}
          error={addError}
          onCancel={() => setAddOpen(false)}
          onSubmit={(m) => addMutation.mutate(m)}
        />
      </Dialog>

      {/* Change role */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditingId(null)} title="Change role">
        {editing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-md border border-edge bg-surface-2 px-3 py-2.5">
              <span
                className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white', ROLES[editing.role].avatar)}
              >
                {initials(editing.user.fullName)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-foreground">{editing.user.fullName}</span>
                <span className="block truncate text-[12.5px] text-foreground-4">{editing.user.email}</span>
              </span>
            </div>
            <Field label="Role">
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                disabled={roleMutation.isPending}
                className="h-9 w-full cursor-pointer rounded-md border border-edge bg-surface px-2.5 text-[13.5px] text-foreground"
              >
                {ASSIGNABLE.map((role) => (
                  <option key={role} value={role}>
                    {ROLES[role].label}
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-[12.5px] text-foreground-4">{ROLES[editRole].description}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                disabled={roleMutation.isPending}
                className="h-9 rounded-md border border-edge bg-surface px-3.5 text-[13px] text-foreground-2 hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  roleMutation.mutate({ id: editing.id, role: editRole });
                }}
                disabled={roleMutation.isPending || editRole === editing.role}
                className="h-9 rounded-md bg-accent px-3.5 text-[13px] font-medium text-white hover:bg-accent-strong disabled:opacity-60"
              >
                {roleMutation.isPending ? 'Saving…' : 'Save role'}
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmReset2fa)}
        onOpenChange={(open) => !open && setConfirmReset2fa(null)}
        title="Reset two-factor sign-in?"
        description={
          confirmReset2fa
            ? `${confirmReset2fa.user.fullName} will set up their authenticator app again the next time they sign in. Use this if they lost their phone.`
            : undefined
        }
        confirmLabel="Reset"
        loading={reset2faMutation.isPending}
        onConfirm={() => {
          setActionError(null);
          if (confirmReset2fa) reset2faMutation.mutate(confirmReset2fa.id);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title="Remove from team?"
        description={
          confirmRemove
            ? `${confirmRemove.user.fullName} will lose access to ${businessName}. You can add them again later.`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => {
          setActionError(null);
          if (confirmRemove) removeMutation.mutate(confirmRemove.id);
        }}
      />
    </div>
  );
}

/** Compact desktop version of the mobile "Add team member" panel. */
function AddStaffForm({
  onSubmit,
  onCancel,
  isPending,
  error,
  canAddAdmin,
}: {
  onSubmit: (member: NewMember) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
  canAddAdmin: boolean;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('EMPLOYEE');
  const [localError, setLocalError] = useState<string | null>(null);
  const roles: UserRole[] = canAddAdmin ? ['OWNER', ...ASSIGNABLE] : ASSIGNABLE;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setLocalError('Enter their email address.');
      return;
    }
    if (password && password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    setLocalError(null);
    onSubmit({
      email: email.trim(),
      role,
      fullName: fullName.trim() || undefined,
      phone: phone.trim() || undefined,
      password: password || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name">
          <Input
            aria-label="Full name"
            placeholder="Optional"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isPending}
            className="h-9 rounded-md text-[13.5px]"
          />
        </Field>
        <Field label="Email address">
          <Input
            aria-label="Email"
            type="email"
            placeholder="name@business.co.ke"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            className="h-9 rounded-md text-[13.5px]"
          />
        </Field>
        <Field label="Phone">
          <Input
            aria-label="Phone"
            type="tel"
            placeholder="07…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isPending}
            className="h-9 rounded-md text-[13.5px]"
          />
        </Field>
        <Field label="Login password">
          <Input
            aria-label="Login password"
            type="text"
            autoComplete="new-password"
            placeholder="8+ characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            className="h-9 rounded-md text-[13.5px]"
          />
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-foreground-3">Role</p>
        <div className={cn('grid gap-2', roles.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
          {roles.map((r) => {
            const selected = role === r;
            const Icon = ROLES[r].icon;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={selected}
                onClick={() => setRole(r)}
                disabled={isPending}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-[12.5px] font-medium transition-colors',
                  selected
                    ? 'border-accent bg-accent-soft text-accent-text'
                    : 'border-edge bg-surface text-foreground-3 hover:bg-surface-2',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {ROLES[r].label}
              </button>
            );
          })}
        </div>
      </div>

          {(error || localError) && <Alert variant="error" inline>{error || localError}</Alert>}

      <p className="text-[12px] leading-relaxed text-foreground-5">
        Share the email and password with them. They set up two-factor sign-in when they first log in. Leave name and
        password empty for someone who already has a login.
      </p>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="h-9 rounded-md border border-edge bg-surface px-3.5 text-[13px] text-foreground-2 hover:bg-surface-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[13px] font-medium text-white hover:bg-accent-strong disabled:opacity-60"
        >
          <UserPlus className="h-3.5 w-3.5" aria-hidden />
          {isPending ? 'Adding…' : 'Add member'}
        </button>
      </div>
    </form>
  );
}
