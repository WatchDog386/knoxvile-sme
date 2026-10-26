export interface ParsedTransaction {
  amount: number | null;
  code: string | null;
  name: string | null;
  phone: string | null;
  date: string | null;
  time: string | null;
  datetime: string | null;
}

const AMOUNT_RE = /(?:ksh|kes|shs?|tzs?|ugx)[\s.]*([0-9][0-9,]*(?:\.\d{1,2})?)/i;
const CODE_RE = /\b([A-Z][A-Z0-9]{8,11})\b/;
// The name stops before " on ", " for ", a phone number, or punctuation
const PAID_TO_RE = /paid\s+to\s+([A-Za-z][A-Za-z'. ]+?)(?=\s+on\s|\s+for\s|\s+\+?\d|[.,\n]|$)/i;
const FROM_RE = /(?:received|from)\s+([A-Z][A-Z'. ]+?)(?=\s+on\s|\s+\+?\d|[.,\n]|$)/;
const PHONE_RE = /(\+?2547\d{8}|\+?2541\d{8}|07\d{8}|01\d{8})/;
const DATE_RE = /on\s+(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i;
const TIME_RE = /at\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i;

function titleCaseName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Extracts amount / transaction code / counterparty name / phone from a
 * Kenyan mobile-money SMS (M-Pesa, Airtel Money, Mula) or generic
 * "paid X to Y" text.
 */
export function parseTransactionSms(text: string): ParsedTransaction {
  const result: ParsedTransaction = {
    amount: null,
    code: null,
    name: null,
    phone: null,
    date: null,
    time: null,
    datetime: null,
  };
  if (!text) return result;

  const amountMatch = text.match(AMOUNT_RE);
  if (amountMatch) {
    result.amount = Math.round(Number(amountMatch[1].replace(/,/g, '')));
  }

  // Codes appear before the word "Confirmed", e.g. "QGH7XY8K2R Confirmed."
  const confirmedIdx = text.toUpperCase().indexOf('CONFIRMED');
  const codeScope = confirmedIdx >= 0 ? text.slice(0, confirmedIdx + 10) : text;
  const codeMatch = codeScope.toUpperCase().match(CODE_RE);
  if (codeMatch) result.code = codeMatch[1];

  const paidTo = text.match(PAID_TO_RE);
  if (paidTo && paidTo[1]) {
    result.name = titleCaseName(paidTo[1]);
  } else {
    const from = text.match(FROM_RE);
    if (from && from[1]) {
      result.name = titleCaseName(from[1]);
    }
  }

  const phone = text.match(PHONE_RE);
  if (phone) result.phone = phone[1];

  const dateMatch = text.match(DATE_RE);
  if (dateMatch) result.date = dateMatch[1].trim();

  const timeMatch = text.match(TIME_RE);
  if (timeMatch) result.time = timeMatch[1].trim().toUpperCase();

  if (result.date || result.time) {
    result.datetime = [result.date, result.time].filter(Boolean).join(' at ');
  }

  return result;
}
