import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { PageLoader } from '@/components/ui/spinner';
import { Alert } from '@/components/ui/alert';
import { apiErrorMessage } from '@/api/client';
import { cn } from '@/lib/utils';
import { AppBar, Chips } from '@/components/layout/app-bar';
import {
  markNotificationsRead,
  useNotifications,
  type NotificationCategory,
  type NotificationItem,
} from './notifications-shared';

type Tab = 'all' | NotificationCategory;

const TAB_LABEL: Record<Tab, string> = {
  all: 'All',
  subscribers: 'Subscribers',
  money: 'Money',
  expenses: 'Expenses',
  reports: 'Reports',
  stock: 'Stock',
};

// Coloured round icon tile per tone
const TONE: Record<NotificationItem['tone'], string> = {
  warning: 'bg-amber-50 text-amber-600 [.dark_&]:bg-amber-500/10 [.dark_&]:text-amber-300',
  danger: 'bg-red-50 text-red-600 [.dark_&]:bg-red-500/10 [.dark_&]:text-red-300',
  info: 'bg-sky-50 text-sky-600 [.dark_&]:bg-sky-500/10 [.dark_&]:text-sky-300',
  success: 'bg-emerald-50 text-emerald-600 [.dark_&]:bg-emerald-500/10 [.dark_&]:text-emerald-300',
};

/**
 * Notifications: what needs attention now. Opening one marks it read, and
 * "Mark all as read" clears them; read state is kept on this device, so the
 * bell's badge only counts what hasn't been seen.
 */
export function NotificationsPage() {
  const navigate = useNavigate();
  const { items, read, unread, isLoading, error, data } = useNotifications();
  const [tab, setTab] = useState<Tab>('all');

  if (isLoading) return <PageLoader inline message="Loading" />;
  if (error || !data) {
    return (
      <Alert variant="error" title="Could not load notifications" inline>
        {apiErrorMessage(error)}
      </Alert>
    );
  }

  // Tabs: All, then only the topics that have something
  const present = (Object.keys(TAB_LABEL) as Tab[]).filter((t) => t === 'all' || items.some((n) => n.category === t));
  const unreadIn = (t: Tab) => items.filter((n) => (t === 'all' || n.category === t) && !read.has(n.id)).length;
  const visible = items.filter((n) => tab === 'all' || n.category === tab);
  const fresh = visible.filter((n) => !read.has(n.id));
  const earlier = visible.filter((n) => read.has(n.id));

  const open = (item: NotificationItem) => {
    markNotificationsRead([item.id]);
    navigate(item.link);
  };

  return (
    <div className="space-y-5 pb-10">
      <AppBar
        title="Notifications"
        onBack={() => navigate('/dashboard')}
        right={
          <button
            type="button"
            onClick={() => markNotificationsRead(items.map((n) => n.id))}
            disabled={unread === 0}
            className="flex h-9 items-center gap-1.5 rounded-full bg-surface-3 px-3.5 text-[12px] font-semibold text-foreground transition-opacity active:scale-95 disabled:opacity-40"
          >
            <CheckCheck className="h-4 w-4" aria-hidden />
            Mark all read
          </button>
        }
      />

      <Chips
        items={present.map((t) => {
          const n = unreadIn(t);
          return { id: t, label: n ? `${TAB_LABEL[t]} · ${n}` : TAB_LABEL[t] };
        })}
        value={present.includes(tab) ? tab : 'all'}
        onChange={setTab}
      />

      {visible.length === 0 ? (
        <Empty />
      ) : (
        <>
          {fresh.length > 0 ? (
            <Section title="New" count={fresh.length}>
              {fresh.map((item) => (
                <Row key={item.id} item={item} unread onOpen={open} />
              ))}
            </Section>
          ) : (
            <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700 [.dark_&]:bg-emerald-500/10 [.dark_&]:text-emerald-300">
              <CheckCheck className="h-4 w-4" aria-hidden /> You're all caught up
            </p>
          )}
          {earlier.length > 0 && (
            <Section title="Earlier" count={earlier.length}>
              {earlier.map((item) => (
                <Row key={item.id} item={item} onOpen={open} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        <span className="text-[12px] font-medium text-foreground-4">{count}</span>
      </div>
      <ul className="space-y-1">{children}</ul>
    </section>
  );
}

function Row({ item, unread = false, onOpen }: { item: NotificationItem; unread?: boolean; onOpen: (item: NotificationItem) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors active:scale-[0.99]',
          unread ? 'bg-[#F2F2F4] [.dark_&]:bg-[#1E1E1E]' : 'opacity-70 active:bg-surface-3',
        )}
      >
        <span className={cn('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full', TONE[item.tone])}>
          <item.icon className="h-5 w-5" aria-hidden />
          {unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[#E23B41] ring-2 ring-white [.dark_&]:ring-[#1E1E1E]" aria-label="Unread" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className={cn('min-w-0 text-[14px] leading-snug', unread ? 'font-semibold text-foreground' : 'font-medium text-foreground-2')}>
              {item.title}
            </span>
            <span className="shrink-0 pt-0.5 text-[11px] text-foreground-4">{item.time}</span>
          </span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-foreground-3 line-clamp-2">{item.text}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-foreground-5" aria-hidden />
      </button>
    </li>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-3">
        <Bell className="h-10 w-10 text-foreground-4" strokeWidth={1.5} aria-hidden />
      </span>
      <h2 className="mt-6 text-[16px] font-medium text-foreground">Nothing here</h2>
      <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-foreground-3">There's nothing that needs your attention.</p>
    </div>
  );
}
