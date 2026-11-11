import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeInvoiceTotals,
  toSmallestUnit,
  fromSmallestUnit,
  validateScheduleSumsToTotal,
} from "./money.ts";

test("computes subtotal, tax and total for a simple invoice", () => {
  const totals = computeInvoiceTotals([
    { quantity: 1, unitPrice: 50000, taxPercent: 18 },
  ]);
  assert.equal(totals.subtotal, 50000);
  assert.equal(totals.taxAmount, 9000);
  assert.equal(totals.total, 59000);
});

test("applies a discount after tax calculation", () => {
  const totals = computeInvoiceTotals(
    [{ quantity: 2, unitPrice: 10000, taxPercent: 18 }],
    2000,
  );
  // subtotal 20000, tax 3600, total = 20000 + 3600 - 2000 = 21600
  assert.equal(totals.subtotal, 20000);
  assert.equal(totals.taxAmount, 3600);
  assert.equal(totals.total, 21600);
});

test("converts rupees to paise and back without drift", () => {
  assert.equal(toSmallestUnit(1234.56), 123456);
  assert.equal(fromSmallestUnit(123456), 1234.56);
});

test("validates an instalment schedule that sums exactly to the total", () => {
  assert.equal(validateScheduleSumsToTotal([30000, 30000, 39000], 99000), true);
});

test("rejects an instalment schedule that does not sum to the total", () => {
  assert.equal(validateScheduleSumsToTotal([30000, 30000, 30000], 99000), false);
});
