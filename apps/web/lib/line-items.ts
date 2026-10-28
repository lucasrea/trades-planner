import { applyMarkup, lineTotal as moneyLineTotal, roundMoney } from "@/lib/money";

export type LineInput = {
  kind: "labour" | "material" | "other";
  description: string;
  quantity: number;
  unit: string;
  unitCost?: number | null;
  unitPrice: number | null;
};

export type LineRow = LineInput & { unitPrice: number; lineTotal: number };

export function validateLine(line: LineInput): string[] {
  const errors: string[] = [];
  if (!line.description.trim()) errors.push("Description is required.");
  if (!(line.quantity > 0)) errors.push("Quantity must be greater than zero.");
  if (line.unitPrice == null || line.unitPrice < 0) {
    errors.push("Unit price is required and cannot be negative.");
  }
  return errors;
}

export function validateLines(lines: LineInput[]): string[] {
  return lines.flatMap((line, index) =>
    validateLine(line).map((message) => `Line ${index + 1}: ${message}`),
  );
}

export function toLineRow(line: LineInput): LineRow {
  const unitPrice = line.unitPrice ?? 0;
  return {
    ...line,
    unitPrice,
    lineTotal: moneyLineTotal({
      id: "",
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice,
    }),
  };
}

export function sumLines(rows: Pick<LineRow, "lineTotal">[]): number {
  return roundMoney(rows.reduce((sum, row) => sum + row.lineTotal, 0));
}

export type DescribeExtractionInput = {
  lines: Array<{
    kind: "labour" | "material" | "other";
    description: string;
    quantity: number;
    unit: string;
    unit_price: number | null;
    uncertain?: boolean | null;
  }>;
};

export type DescribeDraftLine = LineInput & { defaultRate?: boolean };

export function describeToDraft(extraction: DescribeExtractionInput, options: { labourRate: number }): DescribeDraftLine[] {
  return extraction.lines.map((line) => {
    const useDefault = line.kind === "labour" && (line.unit_price == null || line.unit_price === 0);
    return {
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: useDefault ? options.labourRate : line.unit_price,
      defaultRate: useDefault,
    };
  });
}

export type ReceiptExtractionInput = {
  subtotal: number | null;
  lines: Array<{ description: string; quantity: number; unit_price: number; line_total: number }>;
};

export function receiptWarnings(extraction: ReceiptExtractionInput): string[] {
  const warnings: string[] = [];
  if (extraction.subtotal != null) {
    const sum = roundMoney(extraction.lines.reduce((acc, line) => acc + line.line_total, 0));
    if (Math.abs(sum - extraction.subtotal) > 0.02) {
      warnings.push("Line totals do not match the receipt subtotal.");
    }
  }
  for (const line of extraction.lines) {
    const expected = roundMoney(line.quantity * line.unit_price);
    if (Math.abs(expected - line.line_total) > 0.02) {
      warnings.push(`"${line.description}" line total may not match quantity × price.`);
      break;
    }
  }
  return warnings;
}

export function receiptToDraft(extraction: ReceiptExtractionInput, options: { markupPct: number }): LineInput[] {
  return extraction.lines.map((line) => ({
    kind: "material" as const,
    description: line.description,
    quantity: line.quantity,
    unit: "ea",
    unitCost: line.unit_price,
    unitPrice: applyMarkup(line.unit_price, options.markupPct),
  }));
}

const NAME_STOPWORDS = new Set(["mr", "mrs", "ms", "miss", "dr"]);

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(value: string) {
  return normalizeName(value)
    .split(" ")
    .filter((token) => token && !NAME_STOPWORDS.has(token));
}

function tokenOverlap(a: string, b: string) {
  const ta = nameTokens(a);
  const tb = new Set(nameTokens(b));
  if (!ta.length || !tb.size) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  const coverage = shared / ta.length;
  const density = shared / Math.max(ta.length, tb.size);
  return Math.max(coverage, density);
}

export function fuzzyMatchClient(name: string, clients: { id: string; name: string }[]) {
  let best: { id: string; score: number } | null = null;
  for (const client of clients) {
    const score = tokenOverlap(name, client.name);
    if (score >= 0.6 && (!best || score > best.score)) best = { id: client.id, score };
  }
  return best;
}

export function fuzzyMatchJob(title: string, jobs: { id: string; title: string }[]) {
  let best: { id: string; score: number } | null = null;
  for (const job of jobs) {
    const score = tokenOverlap(title, job.title);
    if (score >= 0.6 && (!best || score > best.score)) best = { id: job.id, score };
  }
  return best;
}
