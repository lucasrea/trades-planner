"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { confirmCaptureAction, discardCaptureAction } from "@/lib/actions/captures";
import { applyMarkup, cad, roundMoney } from "@/lib/money";

type ClientOption = { id: string; name: string };
type JobOption = { id: string; title: string };

export type ReceiptReviewLine = {
  description: string;
  quantity: number;
  /** Pre-tax price printed on the receipt, per unit. */
  cost: number;
  jobId: string | null;
};

type Line = {
  id: string;
  description: string;
  quantity: number;
  cost: number | null;
  price: number | null;
  /** "" = not chosen, an existing job id, or "new:<key>". */
  jobId: string;
};

type NewJob = {
  key: string;
  title: string;
  clientMode: "existing" | "new";
  clientId: string;
  clientName: string;
};

const NEW_PREFIX = "new:";

function lineIsComplete(line: Line) {
  return (
    Boolean(line.jobId) &&
    line.cost != null &&
    line.cost >= 0 &&
    line.price != null &&
    line.price >= 0 &&
    line.quantity > 0 &&
    Boolean(line.description.trim())
  );
}

export function ReceiptReviewForm({
  captureId,
  imageUrl,
  vendor,
  purchasedAt,
  note,
  warnings,
  lines: initialLines,
  jobs,
  clients,
  markupPct,
}: {
  captureId: string;
  imageUrl: string | null;
  vendor: string | null;
  purchasedAt: string | null;
  note: string | null;
  warnings: string[];
  lines: ReceiptReviewLine[];
  jobs: JobOption[];
  clients: ClientOption[];
  markupPct: number;
}) {
  const [lines, setLines] = useState<Line[]>(() =>
    initialLines.map((line) => ({
      id: crypto.randomUUID(),
      description: line.description,
      quantity: line.quantity,
      cost: line.cost,
      price: applyMarkup(line.cost, markupPct),
      jobId: line.jobId ?? "",
    })),
  );
  const [newJobs, setNewJobs] = useState<NewJob[]>([]);
  const [bulkJobId, setBulkJobId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usedKeys = new Set(lines.filter((l) => l.jobId.startsWith(NEW_PREFIX)).map((l) => l.jobId.slice(NEW_PREFIX.length)));
  const startedKeys = new Set(newJobs.map((job) => job.key));
  const canConfirm =
    lines.length > 0 &&
    lines.every((line) => lineIsComplete(line) && (!line.jobId.startsWith(NEW_PREFIX) || startedKeys.has(line.jobId.slice(NEW_PREFIX.length)))) &&
    newJobs
      .filter((job) => usedKeys.has(job.key))
      .every((job) => job.title.trim() && (job.clientMode === "existing" ? job.clientId : job.clientName.trim()));

  const sellTotal = roundMoney(lines.reduce((sum, line) => sum + roundMoney((line.quantity || 0) * (line.price ?? 0)), 0));

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function updateNewJob(key: string, patch: Partial<NewJob>) {
    setNewJobs((prev) => prev.map((job) => (job.key === key ? { ...job, ...patch } : job)));
  }

  function addNewJob() {
    const key = crypto.randomUUID().slice(0, 8);
    setNewJobs((prev) => [...prev, { key, title: "", clientMode: clients.length ? "existing" : "new", clientId: clients[0]?.id ?? "", clientName: "" }]);
    return key;
  }

  function removeNewJob(key: string) {
    setNewJobs((prev) => prev.filter((job) => job.key !== key));
    setLines((prev) => prev.map((line) => (line.jobId === `${NEW_PREFIX}${key}` ? { ...line, jobId: "" } : line)));
  }

  function assignAll(jobId: string) {
    setBulkJobId(jobId);
    if (jobId) setLines((prev) => prev.map((line) => ({ ...line, jobId })));
  }

  async function onConfirm() {
    setIsSubmitting(true);
    try {
      await confirmCaptureAction({
        captureId,
        createAs: "log",
        lines: lines.map((line) => ({
          kind: "material",
          description: line.description,
          quantity: line.quantity,
          unit: "ea",
          unitCost: line.cost,
          unitPrice: line.price ?? 0,
          jobId: line.jobId,
        })),
        newJobs: newJobs
          .filter((job) => usedKeys.has(job.key))
          .map((job) => ({
            key: job.key,
            title: job.title,
            client: job.clientMode === "existing" ? { id: job.clientId } : { name: job.clientName },
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

  return (
    <div className="space-y-6">
      <div className="card grid gap-4 p-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimizable
          <img src={imageUrl} alt="Receipt photo" className="max-h-72 w-full rounded-lg border border-line object-contain" />
        ) : (
          <p className="text-sm text-muted">The photo is not available to show.</p>
        )}
        <div className="grid content-start gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Vendor</p>
            <p className="mt-1">{vendor?.trim() || "Not printed"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Date</p>
            <p className="mt-1">{purchasedAt || "Not printed"}</p>
          </div>
          {note?.trim() ? (
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Your note</p>
              <p className="mt-1 whitespace-pre-line">{note}</p>
            </div>
          ) : null}
          <p className="text-xs text-muted sm:col-span-2">
            Sell price is cost plus your {markupPct}% material markup. Nothing is saved until you confirm, and no invoice is created.
          </p>
        </div>
      </div>

      {warnings.length ? (
        <div className="card border-accent/30 bg-accent/5 p-4 text-sm" role="status">
          <p className="font-medium text-accent">Check these</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="text-muted">Put every line on…</span>
            <select className="input mt-1" value={bulkJobId} onChange={(e) => assignAll(e.target.value)}>
              <option value="">Choose a job</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
              {newJobs.map((job, index) => (
                <option key={job.key} value={`${NEW_PREFIX}${job.key}`}>
                  New: {job.title.trim() || `job ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => addNewJob()}>
            <Plus className="mr-1 inline h-4 w-4" aria-hidden />
            Start a new job
          </button>
        </div>

        {newJobs.map((job, index) => (
          <div key={job.key} className="grid gap-2 rounded-lg border border-line p-3 text-sm sm:grid-cols-[1fr_1fr_auto]">
            <input
              className="input"
              aria-label={`New job ${index + 1} title`}
              placeholder="New job title"
              value={job.title}
              onChange={(e) => updateNewJob(job.key, { title: e.target.value })}
            />
            <div className="flex gap-2">
              {job.clientMode === "existing" && clients.length ? (
                <select
                  className="input"
                  aria-label={`New job ${index + 1} client`}
                  value={job.clientId}
                  onChange={(e) => updateNewJob(job.key, { clientId: e.target.value })}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  aria-label={`New job ${index + 1} client name`}
                  placeholder="New client name"
                  value={job.clientName}
                  onChange={(e) => updateNewJob(job.key, { clientName: e.target.value })}
                />
              )}
              {clients.length ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm whitespace-nowrap"
                  onClick={() => updateNewJob(job.key, { clientMode: job.clientMode === "existing" ? "new" : "existing" })}
                >
                  {job.clientMode === "existing" ? "New client" : "Existing client"}
                </button>
              ) : null}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove new job ${index + 1}`} onClick={() => removeNewJob(job.key)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">Cost</th>
                <th className="px-2 py-2">Sell price</th>
                <th className="px-2 py-2">Job</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className={`border-t border-line ${lineIsComplete(line) ? "" : "bg-accent/5"}`}>
                  <td className="px-2 py-2">
                    <input
                      className="input"
                      aria-label="Description"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, { description: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="input w-20"
                      aria-label="Quantity"
                      type="number"
                      min="0"
                      step="any"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="input w-24"
                      aria-label="Cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.cost ?? ""}
                      onChange={(e) => {
                        const cost = e.target.value === "" ? null : Number(e.target.value);
                        updateLine(line.id, { cost, price: cost == null ? null : applyMarkup(cost, markupPct) });
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="input w-24"
                      aria-label="Sell price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.price ?? ""}
                      onChange={(e) => updateLine(line.id, { price: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="input"
                      aria-label="Job"
                      value={line.jobId}
                      onChange={(e) => updateLine(line.id, { jobId: e.target.value })}
                    >
                      <option value="">Choose a job</option>
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title}
                        </option>
                      ))}
                      {newJobs.map((job, index) => (
                        <option key={job.key} value={`${NEW_PREFIX}${job.key}`}>
                          New: {job.title.trim() || `job ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label="Remove line"
                      onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr className="border-t border-line">
                  <td colSpan={6} className="px-2 py-6 text-center text-muted">
                    No lines left. Discard this receipt or go back.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">Sell total (before tax): {cad(sellTotal)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={!canConfirm || isSubmitting} onClick={() => void onConfirm()}>
          {isSubmitting ? "Confirming…" : "Confirm"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={isSubmitting} onClick={() => void onDiscard()}>
          Discard
        </button>
      </div>
    </div>
  );
}
