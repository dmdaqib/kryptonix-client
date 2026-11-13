// Small formatting helpers shared across screens — keeps currency/number
// display consistent (Indian comma grouping, no decimals for whole-rupee
// amounts) instead of every screen rolling its own.

export function formatCurrency(amount: number | string, currency = "INR") {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
