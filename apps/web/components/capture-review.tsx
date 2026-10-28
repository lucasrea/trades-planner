import Link from "next/link";
import { PageHeader, TableCard } from "@/components/app-shell";
import {
  parseDescribeExtraction,
  parseReceiptExtraction,
  type DescribeExtraction,
  type ReceiptExtraction,
} from "@/lib/ai/extraction-types";
import { cad } from "@/lib/money";

export type CaptureReviewData = {
  id: string;
  type: string;
  status: string;
  jobId: string | null;
  transcript: string | null;
  imagePath: string | null;
  extraction: unknown;
  error: string | null;
};

function intentLabel(intent: DescribeExtraction["intent"]) {
  if (intent === "quote") return "Quote";
  if (intent === "invoice") return "Invoice";
  if (intent === "log") return "Add to job";
  return "Unclear";
}

function DescribeBody({ extraction, transcript }: { extraction: DescribeExtraction; transcript: string | null }) {
  return (
    <>
      <div className="card space-y-3 p-6 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Input</p>
        <p className="whitespace-pre-line">{transcript?.trim() || "—"}</p>
      </div>
      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Suggested intent</p>
          <p className="mt-1 font-medium">{intentLabel(extraction.intent)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Client</p>
          <p className="mt-1">{extraction.client_name?.trim() || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Job</p>
          <p className="mt-1">{extraction.job_title?.trim() || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Site</p>
          <p className="mt-1 whitespace-pre-line">{extraction.site_address?.trim() || "—"}</p>
        </div>
        {extraction.scope_notes?.trim() ? (
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Scope</p>
            <p className="mt-1 whitespace-pre-line">{extraction.scope_notes}</p>
          </div>
        ) : null}
      </div>
      <LineTable
        lines={extraction.lines.map((line) => ({
          kind: line.kind,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          price: line.unit_price,
          note: line.uncertain ? "Uncertain" : line.unit_price == null ? "No price" : undefined,
        }))}
      />
      <Warnings warnings={extraction.warnings} />
    </>
  );
}

function ReceiptBody({ extraction }: { extraction: ReceiptExtraction }) {
  return (
    <>
      <div className="card p-6 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Receipt image</p>
        <p className="mt-2 text-muted">{extraction.vendor ? `${extraction.vendor} receipt` : "Photo placeholder"} (review only)</p>
      </div>
      <div className="card grid gap-4 p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Vendor</p>
          <p className="mt-1">{extraction.vendor?.trim() || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Date</p>
          <p className="mt-1">{extraction.purchased_at || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total</p>
          <p className="mt-1 tabular-nums">{extraction.total != null ? cad(extraction.total) : "—"}</p>
        </div>
      </div>
      <LineTable
        lines={extraction.lines.map((line) => ({
          kind: "material",
          description: line.description,
          quantity: line.quantity,
          unit: "ea",
          price: line.unit_price,
          note: line.jobId ? undefined : "Assign job (coming soon)",
        }))}
      />
      <Warnings warnings={extraction.warnings} />
    </>
  );
}

function LineTable({
  lines,
}: {
  lines: { kind: string; description: string; quantity: number; unit: string; price: number | null; note?: string }[];
}) {
  return (
    <TableCard>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-paper text-left text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Description</th>
            <th className="px-4 py-3 font-medium">Qty</th>
            <th className="px-4 py-3 font-medium">Unit</th>
            <th className="px-4 py-3 text-right font-medium">Unit price</th>
            <th className="px-4 py-3 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr className="border-t border-line">
              <td colSpan={6} className="px-4 py-8 text-center text-muted">
                No lines extracted.
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr key={index} className="border-t border-line">
                <td className="px-4 py-3 capitalize">{line.kind}</td>
                <td className="px-4 py-3">{line.description}</td>
                <td className="px-4 py-3 tabular-nums">{line.quantity}</td>
                <td className="px-4 py-3">{line.unit}</td>
                <td className="px-4 py-3 text-right tabular-nums">{line.price != null ? cad(line.price) : "—"}</td>
                <td className="px-4 py-3 text-muted">{line.note ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableCard>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div className="card border-accent/30 p-6">
      <h2 className="text-sm font-semibold">Warnings</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}

export function CaptureReview({ capture, manualHref }: { capture: CaptureReviewData; manualHref: string }) {
  const title = capture.type === "receipt" ? "Receipt capture" : "Describe capture";
  const failed = capture.status === "failed";

  if (failed) {
    return (
      <div>
        <PageHeader title={title} subtitle="Review" back={{ href: "/app", label: "Home" }} />
        <div className="card space-y-4 p-6">
          <p className="text-sm">Couldn&apos;t read that — add the lines manually.</p>
          {capture.error ? <p className="text-sm text-muted">{capture.error}</p> : null}
          {capture.transcript?.trim() ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">What we saved</p>
              <p className="mt-1 whitespace-pre-line text-sm">{capture.transcript}</p>
            </div>
          ) : null}
          <Link href={manualHref} className="btn btn-primary">
            Add lines manually
          </Link>
        </div>
      </div>
    );
  }

  const describe = capture.type !== "receipt" ? parseDescribeExtraction(capture.extraction) : null;
  const receipt = capture.type === "receipt" ? parseReceiptExtraction(capture.extraction) : null;

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={`Status: ${capture.status}`} back={{ href: "/app", label: "Home" }} />
      {describe ? <DescribeBody extraction={describe} transcript={capture.transcript} /> : null}
      {receipt ? <ReceiptBody extraction={receipt} /> : null}
      {!describe && !receipt ? (
        <div className="card p-6 text-sm text-muted">No structured extraction to show yet.</div>
      ) : null}
      <p className="text-sm text-muted">Confirm and edit controls arrive in a later task. This screen is read-only.</p>
    </div>
  );
}
