type Cell = string | number | null | undefined;

function escape(cell: Cell): string {
  const text = cell === null || cell === undefined ? '' : String(cell);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Builds a CSV file from the given rows and hands it to the browser to save. */
export function downloadCsv(filename: string, headers: string[], rows: Cell[][]): void {
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
  // BOM so Excel opens the file as UTF-8 (names with accents, "KES" etc.)
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Today's date as YYYY-MM-DD in Nairobi, for export file names. */
export function csvDateStamp(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
}
