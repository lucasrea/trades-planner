import { fuzzyMatchJob, matchJobInText } from "@/lib/line-items";
import { computeTotals, type DraftLine } from "@/lib/money";

type JobRef = { id: string; title: string };

/**
 * The job a lookup is about. A name from the model wins over the job that happens to be open,
 * including a partial title such as "kitchen" for "Kitchen reno".
 */
export function pickLookupJob(
  jobs: JobRef[],
  named: string | null | undefined,
  selectedJobId: string | null,
  transcript: string,
): string | null {
  const wanted = named?.trim();
  if (wanted) {
    return fuzzyMatchJob(wanted, jobs)?.id ?? matchJobInText(wanted, jobs);
  }
  return selectedJobId ?? matchJobInText(transcript, jobs);
}

type StoredLine = {
  id: string;
  kind: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
};

/** Unbilled rows for a lookup. Hours with no stored price use the contractor's labour rate. */
export function unbilledSummary(rows: StoredLine[], labourRate: number) {
  const drafts: DraftLine[] = rows.map((row) => ({
    id: row.id,
    kind: row.kind === "labour" || row.kind === "other" ? row.kind : "material",
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.kind === "labour" && !(row.unitPrice && row.unitPrice > 0) ? labourRate : (row.unitPrice ?? 0),
  }));
  return {
    total: computeTotals(drafts, 0).subtotal,
    lines: drafts.map((line) => ({
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
    })),
  };
}
