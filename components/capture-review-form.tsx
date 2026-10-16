"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { confirmCaptureAction, discardCaptureAction } from "@/lib/actions/captures";
import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import { LineEditor } from "@/components/line-editor";
import { describeToDraft, fuzzyMatchClient, fuzzyMatchJob, type DescribeDraftLine } from "@/lib/line-items";
import { cad, computeTotals, type DraftLine } from "@/lib/money";

type ClientOption = { id: string; name: string };
type JobOption = { id: string; title: string; clientId: string };

type CaptureLine = DescribeDraftLine & { id: string; jobId?: string };

function seedCaptureLines(
  initialLines: Array<DescribeDraftLine & { jobId?: string }> | undefined,
  extraction: DescribeExtraction | null,
  labourRate: number,
): CaptureLine[] {
  const base = initialLines?.length ? initialLines : extraction ? describeToDraft(extraction, { labourRate }) : [];
  return base.map((row) => ({ ...row, id: crypto.randomUUID() }));
}

function toDraftLine(line: CaptureLine): DraftLine {
  return {
    id: line.id,
    kind: line.kind,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice ?? 0,
    ...(line.unitCost != null ? { cost: line.unitCost } : {}),
  };
}

function lineNeedsAttention(line: CaptureLine, extraction: DescribeExtraction | null, index: number) {
  if (line.unitPrice == null || line.unitPrice < 0) return true;
  const ext = extraction?.lines[index];
  if (ext?.uncertain) return true;
  if (ext?.unit_price == null && line.kind !== "labour" && line.unitPrice === 0) return true;
  return false;
}

export function CaptureReviewForm({
  captureId,
  captureType,
  extraction,
  transcript,
  clients,
  jobs,
  labourRate,
  taxRate,
  taxLabel,
  defaultJobId,
  initialLines,
  warningMessages = [],
}: {
  captureId: string;
  captureType: string;
  extraction: DescribeExtraction | null;
  transcript: string | null;
  clients: ClientOption[];
  jobs: JobOption[];
  labourRate: number;
  taxRate: number;
  taxLabel: string;
  defaultJobId: string | null;
  initialLines?: Array<DescribeDraftLine & { jobId?: string }>;
  warningMessages?: string[];
}) {
  const isReceipt = captureType === "receipt";
  const initialCreateAs =
    extraction?.intent === "invoice" ? "invoice" : extraction?.intent === "log" ? "log" : "quote";
  const [createAs, setCreateAs] = useState<"quote" | "invoice" | "log">(isReceipt ? "log" : initialCreateAs);
  const [clientMode, setClientMode] = useState<"existing" | "new">(() => {
    const name = extraction?.client_name?.trim();
    if (!name) return "existing";
    return fuzzyMatchClient(name, clients) ? "existing" : "new";
  });
  const [clientId, setClientId] = useState(
    () => fuzzyMatchClient(extraction?.client_name?.trim() ?? "", clients)?.id ?? clients[0]?.id ?? "",
  );
  const [clientName, setClientName] = useState(extraction?.client_name?.trim() ?? "");
  const [jobMode, setJobMode] = useState<"existing" | "new">(() => {
    const title = extraction?.job_title?.trim();
    if (!title) return "existing";
    return fuzzyMatchJob(title, jobs) ? "existing" : "new";
  });
  const [jobId, setJobId] = useState(
    () => defaultJobId ?? fuzzyMatchJob(extraction?.job_title?.trim() ?? "", jobs)?.id ?? jobs[0]?.id ?? "",
  );
  const [jobTitle, setJobTitle] = useState(extraction?.job_title?.trim() ?? "");
  const [siteAddress, setSiteAddress] = useState(extraction?.site_address?.trim() ?? "");
  const [notes, setNotes] = useState(extraction?.scope_notes?.trim() ?? "");
  const [captureLines, setCaptureLines] = useState<CaptureLine[]>(() => seedCaptureLines(initialLines, extraction, labourRate));
  const [selectedReceiptLines, setSelectedReceiptLines] = useState<Set<string>>(() => new Set());
  const [bulkJobId, setBulkJobId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openJobs = useMemo(
    () => jobs.filter((job) => job.clientId === clientId || !clientId),
    [jobs, clientId],
  );

  const receiptLinesSorted = useMemo(() => {
    if (!isReceipt) return captureLines;
    return [...captureLines].sort((a, b) => Number(Boolean(a.jobId)) - Number(Boolean(b.jobId)));
  }, [captureLines, isReceipt]);

  const canConfirm = useMemo(() => {
    if (!captureLines.length) return false;
    if (
      captureLines.some(
        (line) =>
          line.unitPrice == null ||
          line.unitPrice < 0 ||
          !(line.quantity > 0) ||
          !line.description.trim(),
      )
    ) {
      return false;
    }
    if (isReceipt) return captureLines.every((line) => Boolean(line.jobId));
    if (clientMode === "existing" ? !clientId : !clientName.trim()) return false;
    if (jobMode === "existing" ? !jobId : !jobTitle.trim()) return false;
    if (jobMode === "existing" && jobId && !openJobs.some((job) => job.id === jobId)) return false;
    return true;
  }, [captureLines, isReceipt, clientMode, clientId, clientName, jobMode, jobId, jobTitle, openJobs]);

  const draftLines = useMemo(() => captureLines.map(toDraftLine), [captureLines]);
  const totals = useMemo(() => computeTotals(draftLines, taxRate), [draftLines, taxRate]);

  function updateCaptureLine(id: string, patch: Partial<CaptureLine>) {
    setCaptureLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function onDraftLinesChange(next: DraftLine[]) {
    setCaptureLines((prev) =>
      next.map((draft) => {
        const existing = prev.find((row) => row.id === draft.id);
        let unitPrice: number | null = draft.unitPrice;
        if (existing?.unitPrice == null && draft.unitPrice === 0) {
          unitPrice = null;
        } else if (existing?.unitPrice == null && draft.unitPrice > 0) {
          unitPrice = draft.unitPrice;
        }
        return {
          id: draft.id,
          kind: draft.kind,
          description: draft.description,
          quantity: draft.quantity,
          unit: draft.unit,
          unitPrice,
          unitCost: draft.cost ?? existing?.unitCost ?? null,
          defaultRate: existing?.defaultRate,
          jobId: existing?.jobId,
        };
      }),
    );
  }

  function toggleReceiptLine(id: string) {
    setSelectedReceiptLines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function assignBulkJob() {
    if (!bulkJobId) return;
    setCaptureLines((prev) =>
      prev.map((line) => (selectedReceiptLines.has(line.id) ? { ...line, jobId: bulkJobId } : line)),
    );
    setSelectedReceiptLines(new Set());
  }

  function addReceiptLine() {
    setCaptureLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: "material",
        description: "",
        quantity: 1,
        unit: "ea",
        unitPrice: null,
        unitCost: null,
        jobId: defaultJobId ?? undefined,
      },
    ]);
  }

  function removeReceiptLine(id: string) {
    setCaptureLines((prev) => prev.filter((line) => line.id !== id));
  }

  async function onConfirm() {
    setIsSubmitting(true);
    try {
      await confirmCaptureAction({
        captureId,
        createAs,
        notes,
        client: isReceipt
          ? undefined
          : clientMode === "existing"
            ? { id: clientId }
            : { name: clientName },
        job: isReceipt
          ? undefined
          : jobMode === "existing"
            ? { id: jobId }
            : { title: jobTitle, siteAddress },
        lines: captureLines.map((line) => ({
          kind: line.kind,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitCost: line.unitCost ?? null,
          unitPrice: line.unitPrice ?? 0,
          jobId: line.jobId,
        })),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onDiscard() {
    setIsSubmitting(true);
    try {
      await discardCaptureAction(captureId);
    } finally {
      setIsSubmitting(false);
    }
  }

  const allWarnings = [...warningMessages, ...(extraction?.warnings ?? [])];

  return (
    <div className="space-y-6">
      {transcript?.trim() ? (
        <div className="card p-6 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Input</p>
          <p className="mt-2 whitespace-pre-line">{transcript}</p>
        </div>
      ) : null}

      {allWarnings.length ? (
        <div className="card border-accent/30 bg-accent/5 p-4 text-sm" role="status">
          <p className="font-medium text-accent">Warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {allWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isReceipt ? (
        <div className="card space-y-4 p-6">
          <p className="text-sm font-semibold">Create as</p>
          <p className="text-xs text-muted">
            Suggested from your description — change if you meant a quote, invoice, or job log.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["quote", "invoice", "log"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={createAs === value ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                onClick={() => setCreateAs(value)}
              >
                {value === "log" ? "Add to job" : value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Client</p>
              <div className="mb-2 flex gap-2">
                <button type="button" className={clientMode === "existing" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"} onClick={() => setClientMode("existing")}>
                  Existing
                </button>
                <button type="button" className={clientMode === "new" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"} onClick={() => setClientMode("new")}>
                  New
                </button>
              </div>
              {clientMode === "existing" ? (
                <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Job</p>
              <div className="mb-2 flex gap-2">
                <button type="button" className={jobMode === "existing" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"} onClick={() => setJobMode("existing")}>
                  Existing
                </button>
                <button type="button" className={jobMode === "new" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"} onClick={() => setJobMode("new")}>
                  New
                </button>
              </div>
              {jobMode === "existing" ? (
                <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                  <option value="">Select job</option>
                  {openJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input className="input mb-2" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title" />
                  <input className="input" value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder="Site address" />
                </>
              )}
            </div>
          </div>
          {createAs !== "log" ? (
            <label className="block text-sm">
              <span className="text-muted">Notes on document</span>
              <textarea className="input mt-1 min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          ) : null}
        </div>
      ) : null}

      {!isReceipt ? (
        <div>
          <LineEditor
            lines={draftLines}
            onChange={onDraftLinesChange}
            taxRate={taxRate}
            taxLabel={taxLabel}
            labourRate={labourRate}
          />
          {createAs !== "log" ? (
            <p className="mt-3 text-sm text-muted">
              Preview total: {cad(totals.total)} ({taxLabel})
            </p>
          ) : null}
          <ul className="mt-2 space-y-1 text-sm text-accent">
            {captureLines.map((line, index) => {
              if (line.defaultRate) {
                return (
                  <li key={line.id}>
                    {line.description || `Line ${index + 1}`}: using your default labour rate ({cad(labourRate)}/hr)
                  </li>
                );
              }
              if (lineNeedsAttention(line, extraction, index)) {
                return (
                  <li key={line.id}>
                    {line.description || `Line ${index + 1}`}: add a price before confirming
                  </li>
                );
              }
              return null;
            })}
          </ul>
        </div>
      ) : (
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="text-muted">Assign to…</span>
              <select className="input mt-1" value={bulkJobId} onChange={(e) => setBulkJobId(e.target.value)}>
                <option value="">Pick job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!bulkJobId || selectedReceiptLines.size === 0} onClick={assignBulkJob}>
              Apply to selected
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addReceiptLine}>
              <Plus className="mr-1 inline h-4 w-4" aria-hidden />
              Add line
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-2 py-2" />
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2">Qty</th>
                  <th className="px-2 py-2">Price</th>
                  <th className="px-2 py-2">Job</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {receiptLinesSorted.map((line) => (
                  <tr
                    key={line.id}
                    className={`border-t border-line ${!line.jobId || line.unitPrice == null ? "bg-accent/5" : ""}`}
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${line.description || "line"}`}
                        checked={selectedReceiptLines.has(line.id)}
                        onChange={() => toggleReceiptLine(line.id)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className="input"
                        value={line.description}
                        onChange={(e) => updateCaptureLine(line.id, { description: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className="input w-20"
                        type="number"
                        min="0"
                        step="any"
                        value={line.quantity}
                        onChange={(e) => updateCaptureLine(line.id, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className="input w-24"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice ?? ""}
                        onChange={(e) =>
                          updateCaptureLine(line.id, {
                            unitPrice: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className="input"
                        value={line.jobId ?? ""}
                        onChange={(e) => updateCaptureLine(line.id, { jobId: e.target.value || undefined })}
                      >
                        <option value="">Assign job</option>
                        {jobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.title}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" className="btn btn-ghost btn-sm" aria-label="Remove line" onClick={() => removeReceiptLine(line.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={!canConfirm || isSubmitting} onClick={() => void onConfirm()}>
          {isSubmitting ? "Confirming…" : "Confirm"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={isSubmitting} onClick={() => void onDiscard()}>
          Discard
        </button>
        <Link href="/app/jobs" className="btn btn-ghost">
          Manual entry
        </Link>
      </div>
    </div>
  );
}
