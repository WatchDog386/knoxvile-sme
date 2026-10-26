import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Calculator,
  UsersRound,
  X,
  Check,
  Mail,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useActiveBusiness } from '@/stores/business';
import { businessesApi } from '@/api/endpoints';
import type { UserRole, BusinessMember } from '@/api/types';
import { api, apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { CHARCOAL, FiberHeroCard, LIME, ProfileHeader, RoundFilters, type RoundFilter } from '@/components/brand/fiber-card';
import { WhatsAppIcon } from '@/components/brand/whatsapp-icon';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { useRole } from '@/hooks/use-role';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { DesktopStaffPage } from './desktop-staff-page';

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
  /** Soft tile/pill colours. */
  tone: string;
  /** Solid avatar colour. */
  avatar: string;
  /** Segment colour in the team breakdown bar. */
  bar: string;
};

const ROLES: Record<UserRole, RoleInfo> = {
  OWNER: {
    label: 'Admin',
    plural: 'Admins',
    icon: Shield,
    description: 'Full access, including staff roles and business settings',
    tone: 'bg-violet-50 text-violet-700 [.dark_&]:bg-violet-500/15 [.dark_&]:text-violet-300',
    avatar: 'bg-violet-600',
    bar: 'bg-violet-500',
  },
  MANAGER: {
    label: 'Manager',
    plural: 'Managers',
    icon: Briefcase,
    description: 'Runs products, sales, expenses, customers and staff',
    tone: 'bg-emerald-50 text-emerald-700 [.dark_&]:bg-emerald-500/15 [.dark_&]:text-emerald-300',
    avatar: 'bg-emerald-600',
    bar: 'bg-emerald-500',
  },
  EMPLOYEE: {
    label: 'Employee',
    plural: 'Employees',
    icon: Users,
    description: 'Records sales and submits expenses',
    tone: 'bg-sky-50 text-sky-700 [.dark_&]:bg-sky-500/15 [.dark_&]:text-sky-300',
    avatar: 'bg-sky-600',
    bar: 'bg-sky-500',
  },
  // Client logins are not staff and never listed here
  CLIENT: {
    label: 'Client',
    plural: 'Clients',
    icon: Users,
    description: 'WiFi client with the client app',
    tone: 'bg-teal-50 text-teal-700 [.dark_&]:bg-teal-500/15 [.dark_&]:text-teal-300',
    avatar: 'bg-teal-600',
    bar: 'bg-teal-500',
  },
  ACCOUNTANT: {
    label: 'Accountant',
    plural: 'Accountants',
    icon: Calculator,
    description: 'Approves expenses and works with reports',
    tone: 'bg-amber-50 text-amber-700 [.dark_&]:bg-amber-500/15 [.dark_&]:text-amber-300',
    avatar: 'bg-amber-500',
    bar: 'bg-amber-400',
  },
};

const ROLE_ORDER: UserRole[] = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'EMPLOYEE'];
const ASSIGNABLE: UserRole[] = ['MANAGER', 'ACCOUNTANT', 'EMPLOYEE'];

const STATUS: Record<string, { label: string; dot: string }> = {
  ACTIVE: { label: 'Active', dot: 'bg-emerald-500' },
  PENDING: { label: 'Pending', dot: 'bg-amber-500' },
  INVITED: { label: 'Invited', dot: 'bg-sky-500' },
  INACTIVE: { label: 'Inactive', dot: 'bg-slate-400' },
};

const card =
  'rounded-3xl bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-14px_rgba(15,23,42,0.14)] [.dark_&]:border [.dark_&]:border-edge';

function initials(name: string): string {
  // Only words that start with a letter, so "Jane (Field Team)" gives "JF"
  return name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w.replace(/^[^\p{L}]+/u, '')))
    .map((w) => w.replace(/^[^\p{L}]+/u, '')[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function Avatar({ member, size = 44, ring = false }: { member: BusinessMember; size?: number; ring?: boolean }) {
  const status = STATUS[member.status] ?? STATUS.INACTIVE;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full font-semibold text-white',
          ROLES[member.role].avatar,
          ring && 'ring-2 ring-surface',
        )}
        style={{ fontSize: size * 0.36 }}
      >
        {initials(member.user.fullName)}
      </span>
      {!ring && (
        <span className={cn('absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-surface', status.dot)} aria-hidden />
      )}
    </span>
  );
}

function RolePill({ role }: { role: UserRole }) {
  const info = ROLES[role];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', info.tone)}>
      <info.icon className="h-3 w-3" aria-hidden />
      {info.label}
    </span>
  );
}

/** Team summary on the shared network-green card, with "Add staff" in its corner. */
function TeamHero({
  members,
  businessName,
  onAdd,
  canAdd,
}: {
  members: BusinessMember[];
  businessName: string;
  onAdd: () => void;
  canAdd: boolean;
}) {
  const active = members.filter((m) => m.status === 'ACTIVE').length;
  const secured = members.filter((m) => m.user.twoFactorEnabled).length;
  const admins = members.filter((m) => m.role === 'OWNER').length;
  return (
    <FiberHeroCard
      label="Team members"
      value={members.length}
      note={`${active} active · ${admins} admin${admins === 1 ? '' : 's'}`}
      maskedValue={members.length}
      footerLeft={businessName}
      footerRight={`2FA ${secured}/${members.length}`}
      icon={UsersRound}
      action={canAdd ? { label: 'Add staff', onClick: onAdd } : undefined}
    />
  );
}

const FILTER_STYLE: Record<UserRole | 'ALL', Pick<RoundFilter<string>, 'label' | 'icon' | 'iconClass' | 'hoverClass' | 'selectedClass'>> = {
  ALL: { label: 'Everyone', icon: Users, iconClass: 'text-brand-600', hoverClass: 'hover:bg-brand-50', selectedClass: 'bg-brand-50 border-brand-500' },
  OWNER: { label: 'Admins', icon: Shield, iconClass: 'text-violet-600', hoverClass: 'hover:bg-violet-50', selectedClass: 'bg-violet-50 border-violet-500' },
  MANAGER: { label: 'Managers', icon: Briefcase, iconClass: 'text-emerald-600', hoverClass: 'hover:bg-emerald-50', selectedClass: 'bg-emerald-50 border-emerald-500' },
  ACCOUNTANT: { label: 'Accounts', icon: Calculator, iconClass: 'text-amber-600', hoverClass: 'hover:bg-amber-50', selectedClass: 'bg-amber-50 border-amber-500' },
  EMPLOYEE: { label: 'Employees', icon: UsersRound, iconClass: 'text-sky-600', hoverClass: 'hover:bg-sky-50', selectedClass: 'bg-sky-50 border-sky-500' },
  // Client logins are not staff and never listed here
  CLIENT: { label: 'Clients', icon: Users, iconClass: 'text-teal-600', hoverClass: 'hover:bg-teal-50', selectedClass: 'bg-teal-50 border-teal-500' },
};

function RoleButtons({
  value,
  onChange,
  counts,
  total,
}: {
  value: UserRole | 'ALL';
  onChange: (v: UserRole | 'ALL') => void;
  counts: Partial<Record<UserRole, number>>;
  total: number;
}) {
  const ids: Array<UserRole | 'ALL'> = ['ALL', 'OWNER', 'MANAGER', 'ACCOUNTANT', 'EMPLOYEE'];
  return (
    <RoundFilters
      hideIcons
      value={value}
      onChange={onChange}
      items={ids.map((id) => ({ id, ...FILTER_STYLE[id], count: id === 'ALL' ? total : (counts[id] ?? 0) }))}
    />
  );
}

/** Avatar row for fast contact (Quick Send in the reference). */
function QuickContact({ members, onPick }: { members: BusinessMember[]; onPick: (id: string) => void }) {
  if (members.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Quick contact</h2>
        <span className="text-[12px] font-medium text-foreground-4">{members.length} people</span>
      </div>
      <div className="scrollbar-none -mx-1 flex gap-4 overflow-x-auto px-1">
        {members.map((m, i) => (
          <motion.button
            key={m.id}
            type="button"
            onClick={() => onPick(m.id)}
            className="flex w-14 shrink-0 flex-col items-center gap-1.5"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * i, type: 'spring', stiffness: 400, damping: 26 }}
            whileTap={{ scale: 0.9 }}
          >
            <Avatar member={m} size={48} />
            <span className="w-full truncate text-center text-[11px] font-medium text-foreground-2">{m.user.fullName.split(' ')[0]}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

/** Member list straight on the page, each person on a dull grey tile. */
function TeamList({
  members,
  currentUserId,
  onPick,
}: {
  members: BusinessMember[];
  currentUserId?: string;
  onPick: (id: string) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Team</h2>
        <span className="text-[12px] font-medium text-foreground-4">{members.length}</span>
      </div>
      <ul className="stagger-list space-y-2">
        {members.map((m) => {
          const status = STATUS[m.status] ?? STATUS.INACTIVE;
          const isSelf = m.user.id === currentUserId;
          return (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m.id)} className="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-3 text-left rounded-xl px-1 py-2.5 transition-[transform,background-color] active:scale-[0.99] active:bg-surface-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                  style={{ backgroundColor: CHARCOAL, color: LIME }}
                >
                  {initials(m.user.fullName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold text-foreground">{m.user.fullName}</span>
                    {isSelf && <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-foreground-3">You</span>}
                  </span>
                  <span className="block truncate text-[12px] text-foreground-4">
                    {ROLES[m.role].label} · {m.user.email}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-foreground-3">
                  <span className={cn('h-2 w-2 rounded-full', status.dot)} aria-hidden />
                  {status.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MemberDetail({
  member,
  isSelf,
  canEditRoles,
  onClose,
  onRoleChange,
  onRemove,
  onResetTwoFactor,
  changingRole,
}: {
  member: BusinessMember;
  isSelf: boolean;
  canEditRoles: boolean;
  onClose: () => void;
  onRoleChange: (role: UserRole) => void;
  onRemove: () => void;
  onResetTwoFactor: () => void;
  changingRole: boolean;
}) {
  const status = STATUS[member.status] ?? STATUS.INACTIVE;
  const editable = canEditRoles && !isSelf && member.role !== 'OWNER';
  const phoneDigits = member.user.phone?.replace(/[^\d]/g, '') ?? '';

  const actions = [
    { label: 'Call', icon: Phone, href: member.user.phone ? `tel:${member.user.phone}` : null },
    { label: 'Email', icon: Mail, href: `mailto:${member.user.email}` },
    { label: 'WhatsApp', icon: WhatsAppIcon, href: phoneDigits ? `https://wa.me/${phoneDigits}` : null },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center">
        <Avatar member={member} size={72} />
        <p className="mt-3 text-[18px] font-semibold tracking-tight text-foreground">{member.user.fullName}</p>
        <p className="text-[13px] text-foreground-4">{member.user.email}</p>
        <div className="mt-2 flex items-center gap-2">
          <RolePill role={member.role} />
          {isSelf && (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-foreground-3">You</span>
          )}
        </div>
      </div>

      {/* Quick contact */}
      <div className="grid grid-cols-3 gap-2">
        {actions.map((a) =>
          a.href ? (
            <a
              key={a.label}
              href={a.href}
              target={a.label === 'WhatsApp' ? '_blank' : undefined}
              rel="noreferrer"
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface py-3 text-[12px] font-medium text-foreground-2 active:scale-95"
            >
              <a.icon className="h-5 w-5 text-brand-600 [.dark_&]:text-brand-300" aria-hidden />
              {a.label}
            </a>
          ) : (
            <span
              key={a.label}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface py-3 text-[12px] font-medium text-foreground-5"
              aria-disabled
            >
              <a.icon className="h-5 w-5" aria-hidden />
              {a.label}
            </span>
          ),
        )}
      </div>

      {/* Details */}
      <div className="overflow-hidden rounded-2xl bg-surface">
        {[
          { label: 'Status', value: (
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', status.dot)} aria-hidden />
              {status.label}
            </span>
          ) },
          { label: 'Two-factor sign-in', value: member.user.twoFactorEnabled ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-600">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              On
            </span>
          ) : (
            <span className="text-amber-600">Set up at next sign-in</span>
          ) },
          { label: 'Phone', value: member.user.phone ?? '—' },
          { label: 'Member since', value: `${formatDate(member.createdAt)} · ${timeAgo(member.createdAt)}` },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-[13px] text-foreground-4">{row.label}</span>
            <span className="text-right text-[13px] font-medium text-foreground">{row.value}</span>
          </div>
        ))}
      </div>

      {editable && (
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-foreground-4">Role</p>
          <div className="space-y-2">
            {ASSIGNABLE.map((role) => {
              const info = ROLES[role];
              const selected = member.role === role;
              return (
                <button
                  key={role}
                  type="button"
                  disabled={selected || changingRole}
                  onClick={() => onRoleChange(role)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border bg-surface p-3 text-left transition-colors',
                    selected ? 'border-brand-600' : 'border-transparent active:bg-surface-2',
                  )}
                >
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', info.tone)}>
                    <info.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-foreground">{info.label}</span>
                    <span className="block text-[12px] text-foreground-4">{info.description}</span>
                  </span>
                  {selected && <Check className="h-5 w-5 text-brand-600" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {canEditRoles && !isSelf && member.user.twoFactorEnabled && (
        <Button variant="outline" className="w-full" onClick={onResetTwoFactor}>
          <ShieldCheck className="h-4 w-4" />
          Reset two-factor sign-in
        </Button>
      )}

      {/* Admins can remove anyone but themselves, other admins included */}
      {canEditRoles && !isSelf && (
        <Button variant="outline" className="w-full border-danger/30 text-danger hover:bg-danger-soft hover:text-danger" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
          Remove from team
        </Button>
      )}

      {isSelf && (
        <p className="text-center text-[12px] text-foreground-4">You can’t change your own role or remove yourself.</p>
      )}

      <Button variant="secondary" className="w-full" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

/** "Add staff" panel styled like the reference budget popup. */
function AddMemberForm({
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

  const clear = () => {
    setEmail('');
    setFullName('');
    setPhone('');
    setPassword('');
    setRole('EMPLOYEE');
    setLocalError(null);
  };

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
    <form onSubmit={submit} className="relative">
      {/* Lime "Close" pill in the corner, as in the reference */}
      <button
        type="button"
        onClick={onCancel}
        className="absolute -right-1 -top-1 flex h-9 items-center gap-1.5 rounded-full pl-1.5 pr-3.5 text-[12px] font-semibold"
        style={{ backgroundColor: LIME, color: CHARCOAL }}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ backgroundColor: CHARCOAL }}>
          <X className="h-3.5 w-3.5" aria-hidden />
        </span>
        Close
      </button>

      <div className="flex flex-col items-center pt-4 text-center">
        <motion.span
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: CHARCOAL, color: LIME }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          <UserPlus className="h-7 w-7" aria-hidden />
        </motion.span>
        <h2 className="mt-3 text-[20px] font-semibold tracking-tight text-foreground">Add team member</h2>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-4">New login for Knoxville</p>
      </div>

      <div className="mt-5 space-y-3">
        <Input aria-label="Full name" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isPending} className="h-12" />
        <Input aria-label="Email" type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} className="h-12" />
        <div className="grid grid-cols-2 gap-3">
          <Input aria-label="Phone" type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isPending} className="h-12" />
          <Input
            aria-label="Login password"
            type="text"
            autoComplete="new-password"
            placeholder="Password (8+)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            className="h-12"
          />
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-4">Role</p>
      <div className={cn('mt-2 grid gap-2', roles.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
        {roles.map((r) => {
          const info = ROLES[r];
          const selected = role === r;
          return (
            <motion.button
              key={r}
              type="button"
              whileTap={{ scale: 0.93 }}
              onClick={() => setRole(r)}
              aria-pressed={selected}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl border py-2.5 transition-colors',
                selected ? 'border-transparent' : 'border-edge bg-surface',
              )}
              style={selected ? { backgroundColor: LIME } : undefined}
            >
              <info.icon className={cn('h-4 w-4', selected ? 'text-[#1C1F1B]' : 'text-foreground-3')} aria-hidden />
              <span className={cn('text-[11px] font-semibold', selected ? 'text-[#1C1F1B]' : 'text-foreground-3')}>{info.label}</span>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[12px] text-foreground-4">{ROLES[role].description}</p>

      {(error || localError) && (
        <div className="mt-3">
            <Alert variant="error" inline>{error || localError}</Alert>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] leading-relaxed text-foreground-5">
        Share the email and password with them. They set up two-factor sign-in when they first log in. Leave name and
        password empty for someone who already has an Knoxville login.
      </p>

      {/* Clear / Add, like the reference's Clear / Set */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={isPending}
          className="h-12 rounded-full border border-edge bg-surface text-[14px] font-semibold text-foreground active:scale-[0.98]"
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex h-12 items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-white active:scale-[0.98] disabled:opacity-70"
          style={{ backgroundColor: CHARCOAL }}
        >
          {isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />}
          Add
        </button>
      </div>
    </form>
  );
}

/** Desktop gets its own table view; phones keep the card layout. Separate components so each keeps its own hooks. */
export function StaffPage() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopStaffPage /> : <StaffMobilePage />;
}

function StaffMobilePage() {
  const active = useActiveBusiness();
  if (!active) return <Navigate to="/dashboard" replace />;
  return <StaffScreen businessId={active.id} businessName={active.name} />;
}

function StaffScreen({ businessId, businessName }: { businessId: string; businessName: string }) {
  const user = useAuthStore((s) => s.user);
  const { role: myRole, canManage } = useRole();
  const canEditRoles = myRole === 'OWNER';
  const queryClient = useQueryClient();
  const queryKey = ['business', businessId, 'members'];

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const selected = members.find((m) => m.id === selectedId) ?? null;

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
      setSelectedId(null);
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
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
      (!term || m.user.fullName.toLowerCase().includes(term) || m.user.email.toLowerCase().includes(term)),
  );

  const openAdd = () => {
    setAddError(null);
    setAddOpen(true);
  };

  if (!canManage) {
    return (
      <div className="space-y-5 pb-8">
        <PageHeader title="Team" description={`People who work at ${businessName}`} />
        <section className={cn(card, 'flex flex-col items-center px-6 py-10 text-center')}>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Shield className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-foreground">Only admins and managers can see the team</p>
          <p className="mt-1 text-[13px] text-foreground-4">Ask your manager if you need someone added or their role changed.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <ProfileHeader roleLabel={myRole ? ROLES[myRole].label : 'Staff'} showBackButton />

      {error && <Alert variant="error" title="Could not load the team" inline>{apiErrorMessage(error)}</Alert>}
      {actionError && (
        <Alert variant="error" title="That change didn’t go through">
          {actionError}
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-[230px] w-full rounded-[1.75rem]" />
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
          <TeamHero members={members} businessName={businessName} onAdd={openAdd} canAdd={canManage} />
        </motion.div>
      )}

      <RoleButtons value={roleFilter} onChange={setRoleFilter} counts={counts} total={members.length} />

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-5" aria-hidden />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" className="h-12 pl-11" />
      </div>

      {!isLoading && !term && roleFilter === 'ALL' && <QuickContact members={members} onPick={setSelectedId} />}

      {isLoading ? (
        <div className="space-y-4 px-1 py-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <section className="flex flex-col items-center rounded-3xl px-6 py-10 text-center" style={{ backgroundColor: '#F3F8E6' }}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full text-[#C6EA5A]" style={{ backgroundColor: '#1C1F1B' }}>
            <Users className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-foreground">
            {members.length === 0 ? 'No team members yet' : 'No one matches that search'}
          </p>
          <p className="mt-1 text-[13px] text-foreground-4">
            {members.length === 0 ? 'Add your first staff member to give them access.' : 'Try another name or role.'}
          </p>
        </section>
      ) : (
        <TeamList members={visible} currentUserId={user?.id} onPick={setSelectedId} />
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <AddMemberForm
          onSubmit={(m) => addMutation.mutate(m)}
          onCancel={() => setAddOpen(false)}
          isPending={addMutation.isPending}
          error={addError}
          canAddAdmin={myRole === 'OWNER'}
        />
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        {selected && (
          <MemberDetail
            member={selected}
            isSelf={selected.user.id === user?.id}
            canEditRoles={canEditRoles}
            onClose={() => setSelectedId(null)}
            onRoleChange={(role) => {
              setActionError(null);
              roleMutation.mutate({ id: selected.id, role });
            }}
            onRemove={() => setConfirmRemove(selected)}
            onResetTwoFactor={() => setConfirmReset2fa(selected)}
            changingRole={roleMutation.isPending}
          />
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
