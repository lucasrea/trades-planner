"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { confirmCaptureAction, discardCaptureAction } from "@/lib/actions/captures";
import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import { describeToDraft, fuzzyMatchClient, fuzzyMatchJob, type DescribeDraftLine } from "@/lib/line-items";
import { cad, computeTotals, type LineKind } from "@/lib/money";

type ClientOption = { id: string; name: string };
type JobOption = { id: string; title: string; clientId: string };

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
    if (!title) return defaultJobId ? "existing" : "existing";
    return fuzzyMatchJob(title, jobs) ? "existing" : "new";
  });
  const [jobId, setJobId] = useState(
    () => defaultJobId ?? fuzzyMatchJob(extraction?.job_title?.trim() ?? "", jobs)?.id ?? jobs[0]?.id ?? "",
  );
  const [jobTitle, setJobTitle] = useState(extraction?.job_title?.trim() ?? "");
  const [siteAddress, setSiteAddress] = useState(extraction?.site_address?.trim() ?? "");
  const [notes, setNotes] = useState(extraction?.scope_notes?.trim() ?? "");
  const [lines, setLines] = useState<Array<DescribeDraftLine & { jobId?: string }>>(() =>
    initialLines?.length ? initialLines : extraction ? describeToDraft(extraction, { labourRate }) : [],
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const openJobs = useMemo(
    () => jobs.filter((job) => job.clientId === clientId || !clientId),
    [jobs, clientId],
  );

  const canConfirm = useMemo(() => {
    if (!lines.length) return false;
    if (lines.some((line) => line.unitPrice == null || line.unitPrice < 0 || !(line.quantity > 0) || !line.description.trim())) {
      return false;
    }
    if (isReceipt) return lines.every((line) => Boolean((line as DescribeDraftLine & { jobId?: string }).jobId));
    if (clientMode === "existing" ? !clientId : !clientName.trim()) return false;
    if (jobMode === "existing" ? !jobId : !jobTitle.trim()) return false;
    return true;
  }, [lines, isReceipt, clientMode, clientId, clientName, jobMode, jobId, jobTitle]);

  const totals = useMemo(() => computeTotals(lines.map((l) => ({ ...l, id: "x", unitPrice: l.unitPrice ?? 0 })), taxRate), [lines, taxRate]);

  function updateLine(index: number, patch: Partial<DescribeDraftLine & { jobId?: string }>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function onConfirm() {
    setError(null);
    startTransition(() => {
      void confirmCaptureAction({
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
        lines: lines.map((line) => ({
          kind: line.kind,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitCost: line.unitCost ?? null,
          unitPrice: line.unitPrice ?? 0,
          jobId: line.jobId,
        })),
      });
    });
  }

  return (
    <div className="space-y-6">
      {transcript?.trim() ? (
        <div className="card p-6 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Input</p>
          <p className="mt-2 whitespace-pre-line">{transcript}</p>
        </div>
      ) : null}

      {!isReceipt ? (
        <div className="card space-y-4 p-6">
          <p className="text-sm font-semibold">Create as</p>
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

      <div className="card overflow-x-auto p-4">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Description</th>
              <th className="px-2 py-2">Qty</th>
              <th className="px-2 py-2">Unit</th>
              <th className="px-2 py-2">Price</th>
              {isReceipt ? <th className="px-2 py-2">Job</th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-t border-line">
                <td className="px-2 py-2">
                  <select
                    className="input"
                    value={line.kind}
                    onChange={(e) => updateLine(index, { kind: e.target.value as LineKind })}
                  >
                    <option value="material">Material</option>
                    <option value="labour">Labour</option>
                    <option value="other">Other</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input className="input" value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <input
                    className="input w-20"
                    type="number"
                    min="0"
                    step="any"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input className="input w-20" value={line.unit} onChange={(e) => updateLine(index, { unit: e.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <input
                    className="input w-24"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice ?? ""}
                    onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
                  />
                  {line.defaultRate ? <span className="ml-1 text-xs text-muted">default rate</span> : null}
                </td>
                {isReceipt ? (
                  <td className="px-2 py-2">
                    <select
                      className="input"
                      value={(line as DescribeDraftLine & { jobId?: string }).jobId ?? ""}
                      onChange={(e) => updateLine(index, { jobId: e.target.value })}
                    >
                      <option value="">Assign job</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}
                        </option>
                      ))}
                    </select>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {createAs !== "log" && !isReceipt ? (
          <p className="mt-3 text-sm text-muted">
            Preview total: {cad(totals.total)} ({taxLabel})
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={!canConfirm || pending} onClick={onConfirm}>
          {pending ? "Confirming…" : "Confirm"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={() => startTransition(() => discardCaptureAction(captureId))}
        >
          Discard
        </button>
        <Link href="/app/jobs" className="btn btn-ghost">
          Manual entry
        </Link>
      </div>
    </div>
  );
}
