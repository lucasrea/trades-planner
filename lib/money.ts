export function cad(amount: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export type LineKind = "material" | "labour" | "other";

export type DraftLine = {
  id: string;
  kind: LineKind;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** UI-only cost before markup. Not persisted. */
  cost?: number;
};

export type Totals = {
  materials: number;
  labour: number;
  other: number;
  subtotal: number;
  tax: number;
  total: number;
};

export function lineTotal(line: DraftLine) {
  return roundMoney((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
}

export function computeTotals(lines: DraftLine[], taxRate: number): Totals {
  const materials = roundMoney(
    lines.filter((l) => l.kind === "material").reduce((s, l) => s + lineTotal(l), 0),
  );
  const labour = roundMoney(
    lines.filter((l) => l.kind === "labour").reduce((s, l) => s + lineTotal(l), 0),
  );
  const other = roundMoney(
    lines.filter((l) => l.kind === "other").reduce((s, l) => s + lineTotal(l), 0),
  );
  const subtotal = roundMoney(materials + labour + other);
  const tax = roundMoney(subtotal * (taxRate || 0));
  return { materials, labour, other, subtotal, tax, total: roundMoney(subtotal + tax) };
}

/** Quote/invoice columns stored on the document row. */
export function documentTotals(lines: DraftLine[], taxRate: number) {
  const { subtotal, tax, total } = computeTotals(lines, taxRate);
  return { subtotal, tax, total };
}

export function applyMarkup(cost: number, markupPct: number) {
  return roundMoney((Number(cost) || 0) * (1 + (Number(markupPct) || 0) / 100));
}

export function padNumber(n: number, prefix: string) {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

/** Percent implied by stored document tax. Null when subtotal cannot support it. */
export function storedTaxPercent(subtotal: number, tax: number): number | null {
  if (!(subtotal > 0) || !Number.isFinite(tax)) return null;
  return Math.round((tax / subtotal) * 1000) / 10;
}

