function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DEFAULT_FROM = toISO(new Date(Date.now() - 29 * 86400000));
export const DEFAULT_TO = toISO(new Date());
