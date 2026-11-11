// Money math kept in integer paise/cents internally wherever this module is
// used for comparisons, to avoid floating-point drift on financial totals.
// Decimal values coming from Prisma (Decimal.js) are passed in as strings.

export interface LineItemInput {
  quantity: number;
  unitPrice: number; // in rupees, as a plain number is fine at this boundary
  taxPercent?: number;
}

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeLineTotal(item: LineItemInput): number {
  return round2(item.quantity * item.unitPrice);
}

export function computeInvoiceTotals(
  items: LineItemInput[],
  discountAmount = 0,
): InvoiceTotals {
  const subtotal = round2(
    items.reduce((sum, item) => sum + computeLineTotal(item), 0),
  );
  const taxAmount = round2(
    items.reduce(
      (sum, item) =>
        sum + computeLineTotal(item) * ((item.taxPercent ?? 0) / 100),
      0,
    ),
  );
  const total = round2(subtotal + taxAmount - discountAmount);
  return { subtotal, taxAmount, discountAmount: round2(discountAmount), total };
}

/** Razorpay (and most gateways) expect amounts in the smallest currency unit. */
export function toSmallestUnit(rupees: number): number {
  return Math.round(rupees * 100);
}

export function fromSmallestUnit(paise: number): number {
  return round2(paise / 100);
}

export function sumSchedule(amounts: number[]): number {
  return round2(amounts.reduce((a, b) => a + b, 0));
}

/** Instalment schedules must add up exactly to the invoice total (no silent rounding gaps). */
export function validateScheduleSumsToTotal(
  amounts: number[],
  total: number,
  epsilon = 0.01,
): boolean {
  return Math.abs(sumSchedule(amounts) - total) <= epsilon;
}
