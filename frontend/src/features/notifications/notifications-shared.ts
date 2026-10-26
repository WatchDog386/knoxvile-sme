import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlarmClock,
  Banknote,
  ClipboardCheck,
  FileBarChart2,
  PackageX,
  PhoneCall,
  PiggyBank,
  ShoppingCart,
  Wallet,
  WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { dashboardApi } from '@/api/endpoints';
import type { DashboardData } from '@/api/types';
import { useRole } from '@/hooks/use-role';
import { notifySuccess } from '@/components/ui/popup-host';
import { formatKES } from '@/lib/utils';

export type NotificationCategory = 'subscribers' | 'money' | 'expenses' | 'reports' | 'stock';

export interface NotificationItem {
  /**
   * Stable while the situation is the same; changes when it changes (e.g. the
   * number of expiring clients), so a new situation shows as unread again.
   */
  id: string;
  category: NotificationCategory;
  icon: LucideIcon;
  tone: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  text: string;
  time: string;
  link: string;
}

const TZ = 'Africa/Nairobi';
const isoDay = (offset = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(Date.now() + offset * 86_400_000),
  );

type Transaction = DashboardData['recentTransactions'][number];

const clock = new Intl.DateTimeFormat('en-KE', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

/** "Just now", "12 min ago", or the time today. */
function whenText(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  return isoDay() === new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso)) ? clock.format(new Date(iso)) : 'Yesterday';
}

/**
 * Payments received and unpaid sales recorded in the last day, newest first
 * (the server picks them by when they were recorded). A sale paid on the spot
 * shows once, as its payment.
 */
export function moneyEvents(data: DashboardData): Transaction[] {
  const recent = (data.recentMoney ?? []).filter((t) => t.type === 'PAYMENT' || t.type === 'SALE');
  const paidSales = new Set(recent.filter((t) => t.type === 'PAYMENT' && t.saleId).map((t) => t.saleId));
  return recent
    .filter((t) => t.type === 'PAYMENT' || !paidSales.has(t.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function moneyNotification(t: Transaction): NotificationItem {
  const payment = t.type === 'PAYMENT';
  const who = t.customerName ?? (payment ? 'a client' : 'walk-in');
  return {
    id: `tx-${t.type}-${t.id}`,
    category: 'money',
    icon: payment ? Banknote : ShoppingCart,
    tone: 'success',
    // Paid sales arrive as their payment; a SALE here is one still unpaid
    title: payment ? `Payment received: ${formatKES(t.amount)}` : `Sale recorded (unpaid): ${formatKES(t.amount)}`,
    text: [who, t.paymentMethod, payment ? null : t.description].filter(Boolean).join(' · '),
    time: whenText(t.createdAt),
    link: payment ? (t.saleId ? `/sales/${t.saleId}` : '/sales') : `/sales/${t.id}`,
  };
}

/** Notifications built from live dashboard data: only things that need attention. */
export function buildNotifications(data: DashboardData, options: { canApprove?: boolean } = {}): NotificationItem[] {
  const today = isoDay();
  const yesterday = isoDay(-1);
  const items: NotificationItem[] = [];
  const subs = data.subscribers;

  // Money in: every payment and sale from the last day, newest first
  items.push(...moneyEvents(data).map(moneyNotification));

  // Subscribers
  if (subs && subs.expired > 0) {
    items.push({
      id: `expired-${subs.expired}-${today}`,
      category: 'subscribers',
      icon: WifiOff,
      tone: 'danger',
      title: `${subs.expired} WiFi package${subs.expired === 1 ? ' has' : 's have'} expired`,
      text: 'These clients are disconnected until they renew. Call or message them.',
      time: 'Today',
      link: '/subscribers',
    });
  }
  if (subs && subs.expiringSoon > 0) {
    items.push({
      id: `expiring-${subs.expiringSoon}-${today}`,
      category: 'subscribers',
      icon: AlarmClock,
      tone: 'warning',
      title: `${subs.expiringSoon} subscription${subs.expiringSoon === 1 ? '' : 's'} due for renewal`,
      text: 'Message or call them before their connection lapses.',
      time: 'Today',
      link: '/subscribers',
    });
  }
  if ((data.callsDue ?? 0) > 0) {
    items.push({
      id: `calls-${data.callsDue}-${today}`,
      category: 'subscribers',
      icon: PhoneCall,
      tone: 'info',
      title: `${data.callsDue} client call${data.callsDue === 1 ? '' : 's'} due today`,
      text: 'Call-backs, renewals and balances to follow up.',
      time: 'Today',
      link: '/calls',
    });
  }

  // Money owed
  if (data.outstandingDebts > 0) {
    items.push({
      id: `owed-${data.outstandingDebts}`,
      category: 'money',
      icon: Wallet,
      tone: 'danger',
      title: 'Clients owe you money',
      text: `KSh ${data.outstandingDebts.toLocaleString('en-KE')} is unpaid across client balances.`,
      time: 'Now',
      link: '/customers',
    });
  }

  // Expenses
  if (options.canApprove && data.pendingApprovals > 0) {
    items.push({
      id: `approvals-${data.pendingApprovals}`,
      category: 'expenses',
      icon: ClipboardCheck,
      tone: 'warning',
      title: 'Expenses awaiting approval',
      text: `${data.pendingApprovals} staff expense${data.pendingApprovals === 1 ? ' needs' : 's need'} your review.`,
      time: 'Now',
      link: '/expenses?status=PENDING',
    });
  }
  for (const budget of data.budgetAlerts ?? []) {
    const over = budget.level === 'EXCEEDED';
    items.push({
      id: `budget-${budget.id}-${budget.level}`,
      category: 'expenses',
      icon: PiggyBank,
      tone: over ? 'danger' : 'warning',
      title: over ? `${budget.category_name} over budget` : `${budget.category_name} near budget`,
      text: `KSh ${budget.spent.toLocaleString('en-KE')} spent of KSh ${budget.limit.toLocaleString('en-KE')} this month (${budget.percent}%).`,
      time: 'This month',
      link: '/budgets',
    });
  }

  // Stock
  if (data.lowStock > 0) {
    items.push({
      id: `low-stock-${data.lowStock}`,
      category: 'stock',
      icon: PackageX,
      tone: 'warning',
      title: 'Low stock',
      text: `${data.lowStock} product${data.lowStock === 1 ? ' is' : 's are'} running low. Restock soon.`,
      time: 'Today',
      link: '/products',
    });
  }

  // Yesterday's daily report, every morning
  items.push({
    id: `report-${yesterday}`,
    category: 'reports',
    icon: FileBarChart2,
    tone: 'success',
    title: "Yesterday's report is ready",
    text: 'Revenue, money collected, expenses and profit for the full day.',
    time: 'Today',
    link: `/reports?date=${yesterday}`,
  });

  return items;
}

/* ---------------- Read state (kept on this device) ---------------- */

const STORE_KEY = 'knoxville_read_notifications';
const listeners = new Set<() => void>();
let cache: Set<string> | null = null;

function load(): Set<string> {
  if (cache) return cache;
  try {
    cache = new Set(JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as string[]);
  } catch {
    cache = new Set();
  }
  return cache;
}

function save(next: Set<string>) {
  // Keep the newest few hundred ids; old situations no longer appear anyway
  const list = [...next].slice(-300);
  cache = new Set(list);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: still works for this session
  }
  listeners.forEach((fn) => fn());
}

export function markNotificationsRead(ids: string[]) {
  const next = new Set(load());
  ids.forEach((id) => next.add(id));
  save(next);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORE_KEY) {
      cache = null;
      fn();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

/** The ids already read on this device; updates everywhere when one is read. */
export function useReadNotifications(): Set<string> {
  return useSyncExternalStore(subscribe, load, load);
}

/** Notifications plus how many are unread: used by the bell and the page. */
export function useNotifications() {
  const { canApprove, isClient } = useRole();
  // Checked every 15 s so new payments and sales show up without a refresh
  const query = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get, refetchInterval: isClient ? false : 15_000 });
  const read = useReadNotifications();
  const items = useMemo(
    () => (query.data ? buildNotifications(query.data, { canApprove }) : []),
    [query.data, canApprove],
  );
  const unread = items.filter((n) => !read.has(n.id)).length;
  return { ...query, items, read, unread };
}

/** A payment or sale to announce. */
export interface MoneyAlert {
  id: string;
  title: string;
  text: string;
  amount: number;
  link: string;
}

/*
 * The dashboard header's bell takes the alerts while it is on screen (it rings
 * and shows a bubble); anywhere else they are ordinary pop-ups.
 */
let bellListener: ((alert: MoneyAlert) => void) | null = null;

export function listenOnBell(fn: (alert: MoneyAlert) => void) {
  bellListener = fn;
  return () => {
    if (bellListener === fn) bellListener = null;
  };
}

/* Which payments and sales have already popped up on this device */
const POPPED_KEY = 'knoxville_popped_money';

function loadPopped(): Set<string> | null {
  try {
    const raw = localStorage.getItem(POPPED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function savePopped(ids: Set<string>) {
  try {
    localStorage.setItem(POPPED_KEY, JSON.stringify([...ids].slice(-300)));
  } catch {
    // Storage blocked: pop-ups still work while the app stays open
  }
}

/**
 * Pops up "Payment received" / "Sale recorded" on whatever page the admin is
 * on, once per payment or sale, including ones that came in while the app
 * was closed (anything from the last day not shown or read yet). The very
 * first time on a device only the last 10 minutes pop up, not a whole day.
 */
export function useMoneyPopups() {
  const { data, read } = useNotifications();
  const popped = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data) return;
    const events = moneyEvents(data);
    if (!popped.current) {
      popped.current = loadPopped();
      if (!popped.current) {
        const cutoff = Date.now() - 10 * 60_000;
        popped.current = new Set(events.filter((t) => new Date(t.createdAt).getTime() < cutoff).map((t) => `tx-${t.type}-${t.id}`));
      }
    }
    const fresh = events.filter((t) => !popped.current!.has(`tx-${t.type}-${t.id}`) && !read.has(`tx-${t.type}-${t.id}`));
    if (fresh.length === 0) return;
    // Oldest first, at most three; the rest are summed up in one more
    for (const t of fresh.slice(0, 3).reverse()) {
      const n = moneyNotification(t);
      const alert: MoneyAlert = { id: n.id, title: n.title.split(':')[0], text: n.text, amount: t.amount, link: n.link };
      if (bellListener) bellListener(alert);
      else notifySuccess(alert.title, `${formatKES(t.amount)} · ${n.text}`);
    }
    if (fresh.length > 3 && !bellListener) {
      notifySuccess(`${fresh.length - 3} more`, 'Open Notifications to see every payment and sale.');
    }
    fresh.forEach((t) => popped.current!.add(`tx-${t.type}-${t.id}`));
    savePopped(popped.current);
  }, [data, read]);
}

/** Mounted once in the app shell for admins. */
export function MoneyPopups() {
  useMoneyPopups();
  return null;
}
