export type TransactionDateRange = 'all' | 'today' | '7d' | '30d' | 'month';

function dayKey(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone || 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
}

/** Today's date (YYYY-MM-DD) in the business's timezone, the latest day a record may have. */
export function businessToday(timezone?: string, now = new Date()): string {
  return dayKey(now, timezone || 'Africa/Nairobi');
}

function shiftDay(key: string, amount: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

/** Calendar date bounds for the business's local timezone; `to` is exclusive. */
export function transactionDateBounds(
  range: TransactionDateRange,
  timezone: string,
  now = new Date(),
): { from?: string; to?: string } {
  if (range === 'all') return {};
  const today = dayKey(now, timezone);
  const from = range === 'month'
    ? `${today.slice(0, 7)}-01`
    : shiftDay(today, range === 'today' ? 0 : range === '7d' ? -6 : -29);
  return { from, to: shiftDay(today, 1) };
}
