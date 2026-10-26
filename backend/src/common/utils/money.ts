/** Amounts are stored as integer whole shillings (KES has no minor units). */

export const toCents = (value: number): number => Math.round(value);

export const roundKES = (value: number): number => Math.round(value);

export const formatMoney = (amount: number, currency = 'KES'): string =>
  `${currency} ${amount.toLocaleString('en-KE')}`;

export const sum = (values: number[]): number =>
  values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);