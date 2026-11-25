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

/** Plan works in the contractor's local day. One time zone until there is a setting for it. */
export const PLAN_TIME_ZONE = "America/Toronto";

/** YYYY-MM-DD in the contractor's time zone. */
export function localDate(nowMs: number, timeZone = PLAN_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(nowMs);
}

function zoneOffsetMinutes(atMs: number, timeZone: string) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(atMs)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name ?? "");
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

/** Epoch ms of local midnight at the start of a YYYY-MM-DD day. Null for anything else. */
export function localMidnightMs(date: string, timeZone = PLAN_TIME_ZONE): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const utc = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(utc)) return null;
  return utc - zoneOffsetMinutes(utc, timeZone) * 60_000;
}

/** A date range from the model's YYYY-MM-DD strings. `until` includes that whole day. */
export function dateRangeMs(since?: string | null, until?: string | null, timeZone = PLAN_TIME_ZONE) {
  const from = since ? localMidnightMs(since, timeZone) : null;
  const to = until ? localMidnightMs(until, timeZone) : null;
  return { from, to: to == null ? null : to + 24 * 60 * 60 * 1000 };
}

/** The first day of "today", "this week" (Monday) or "this month", as YYYY-MM-DD. */
export function periodStart(period: "today" | "week" | "month", today: string) {
  if (period === "today") return today;
  if (period === "month") return `${today.slice(0, 8)}01`;
  const date = new Date(`${today}T12:00:00Z`);
  const back = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}

export const DOCUMENT_STATUS_WORDS = ["open", "waiting", "draft", "sent", "approved", "declined", "unpaid", "overdue", "paid", "all"] as const;
export type DocumentStatusWord = (typeof DOCUMENT_STATUS_WORDS)[number];

/**
 * The app's meaning of the words a contractor uses. "open" is not yet answered or paid (draft or sent);
 * "waiting" is sent and not answered; "unpaid" and "overdue" are invoices only.
 */
export function documentStatusFilter(
  type: "quote" | "invoice" | null | undefined,
  word: DocumentStatusWord | null | undefined,
): { type: "quote" | "invoice" | null; statuses: string[] | null; overdueOnly: boolean } {
  const scoped = type ?? null;
  switch (word ?? "all") {
    case "open":
      return { type: scoped, statuses: ["draft", "sent"], overdueOnly: false };
    case "waiting":
    case "sent":
      return { type: scoped, statuses: ["sent"], overdueOnly: false };
    case "draft":
      return { type: scoped, statuses: ["draft"], overdueOnly: false };
    case "approved":
    case "declined":
      return { type: "quote", statuses: [word!], overdueOnly: false };
    case "unpaid":
      return { type: "invoice", statuses: ["sent"], overdueOnly: false };
    case "overdue":
      return { type: "invoice", statuses: ["sent"], overdueOnly: true };
    case "paid":
      return { type: "invoice", statuses: ["paid"], overdueOnly: false };
    default:
      return { type: scoped, statuses: null, overdueOnly: false };
  }
}

/** Fields in a read tool's result that hold dollars. */
const MONEY_FIELDS = new Set([
  "total",
  "unbilled_total",
  "unit_price",
  "unit_cost",
  "line_total",
  "subtotal",
  "tax",
  "lowest_price",
  "highest_price",
  "total_cost",
  "total_sell",
  "recorded_cost",
  "invoiced_before_tax",
  "paid",
]);

/**
 * A read result as the model should see it: every dollar amount already written the way the contractor
 * reads it ($1,265.60), so the model repeats it instead of printing 1265.6.
 */
export function moneyForModel(value: unknown, format: (amount: number) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => moneyForModel(item, format));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [
      key,
      MONEY_FIELDS.has(key) && typeof field === "number" ? format(field) : moneyForModel(field, format),
    ]),
  );
}
