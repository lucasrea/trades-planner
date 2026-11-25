import { fuzzyMatchJob, matchJobInText } from "@/lib/line-items";
import { cad, computeTotals, roundMoney, type DraftLine } from "@/lib/money";

type JobRef = { id: string; title: string };

const ALL_JOBS_PHRASE = /\b(all(?:\s+my|\s+the)?\s+jobs|every\s+job|everything|anything|across\s+all|in\s+total|overall)\b/i;

export function asksForAllJobs(text: string | null | undefined) {
  return ALL_JOBS_PHRASE.test(text ?? "");
}

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
    if (asksForAllJobs(wanted) || /^all$/i.test(wanted)) return null;
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

export function formatJobUnbilled(jobTitle: string, summary: ReturnType<typeof unbilledSummary>): string {
  if (summary.lines.length === 0) {
    return `${jobTitle}\nNo unbilled work.`;
  }
  const items = summary.lines.map((line) => {
    const lineTotal = roundMoney(line.quantity * line.unitPrice);
    return `• ${line.description} (${line.quantity} ${line.unit}) — ${cad(lineTotal)}`;
  });
  return `${jobTitle} — ${cad(summary.total)} unbilled\n${items.join("\n")}`;
}

export function formatAllJobsUnbilled(
  entries: { jobTitle: string; clientName?: string | null; lineCount: number; total: number }[],
): string {
  const active = entries.filter((entry) => entry.lineCount > 0);
  if (active.length === 0) {
    return "You don't have any unbilled work right now.";
  }
  const grandTotal = roundMoney(active.reduce((sum, entry) => sum + entry.total, 0));
  const lines = active.map((entry) => {
    const label = entry.clientName ? `${entry.jobTitle} (${entry.clientName})` : entry.jobTitle;
    const count = `${entry.lineCount} ${entry.lineCount === 1 ? "item" : "items"}`;
    return `• ${label}: ${cad(entry.total)} (${count})`;
  });
  return `Unbilled work — ${cad(grandTotal)} total\n${lines.join("\n")}`;
}
