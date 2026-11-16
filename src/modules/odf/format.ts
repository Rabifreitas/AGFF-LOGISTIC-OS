export function formatMoney(value: number | string | { toString(): string }, currency = "AOA", locale = "pt-PT") {
  const n = typeof value === "number" ? value : Number(value.toString());
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function formatKm(value: number | string | { toString(): string }, locale = "pt-PT") {
  const n = typeof value === "number" ? value : Number(value.toString());
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n)} km`;
}
