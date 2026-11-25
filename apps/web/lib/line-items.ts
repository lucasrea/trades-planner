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

export function describeToDraft(
  extraction: DescribeExtractionInput,
  options: { labourRate: number; statedPriceInTranscript?: boolean },
): DescribeDraftLine[] {
  return extraction.lines.map((line) => {
    const missingPrice = line.unit_price == null || line.unit_price === 0;
    const useDefault =
      line.kind === "labour" && missingPrice && !(options.statedPriceInTranscript && missingPrice);
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

export type ReceiptConfirmLine = {
  description: string;
  quantity: number;
  unitCost: number;
  printedLineTotal: number;
};

/** Confirm stays off while an edited cost disagrees with the printed line, or the lines miss the printed subtotal. */
export function receiptConfirmBlockers(input: { subtotal: number | null; lines: ReceiptConfirmLine[] }): string[] {
  const blockers: string[] = [];
  for (const line of input.lines) {
    const expected = roundMoney(line.quantity * line.unitCost);
    if (Math.abs(expected - roundMoney(line.printedLineTotal)) > 0.02) {
      blockers.push(`"${line.description}" does not match the printed line total.`);
    }
  }
  if (input.subtotal != null) {
    const sum = roundMoney(input.lines.reduce((acc, line) => acc + roundMoney(line.quantity * line.unitCost), 0));
    if (Math.abs(sum - roundMoney(input.subtotal)) > 0.02) {
      blockers.push("Line totals do not match the receipt subtotal.");
    }
  }
  return blockers;
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

const JOB_WORD_STOPWORDS = new Set(["the", "and", "for", "job", "work", "new"]);

/**
 * Find the one job a short note points at ("add this to the kitchen"). A job matches when at least
 * half of its meaningful title words appear in the note. Ties and no match return null, so the
 * contractor picks instead of us guessing.
 */
export function matchJobInText(text: string, jobs: { id: string; title: string }[]) {
  const words = new Set(normalizeName(text).split(" ").filter(Boolean));
  let best: { id: string; score: number } | null = null;
  let tied = false;
  for (const job of jobs) {
    const tokens = nameTokens(job.title).filter((token) => token.length >= 3 && !JOB_WORD_STOPWORDS.has(token));
    if (!tokens.length) continue;
    const score = tokens.filter((token) => words.has(token)).length / tokens.length;
    if (score < 0.5) continue;
    if (!best || score > best.score) {
      best = { id: job.id, score };
      tied = false;
    } else if (score === best.score) {
      tied = true;
    }
  }
  return best && !tied ? best.id : null;
}
