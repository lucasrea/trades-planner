"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelPlanProposalAction, confirmPlanProposalAction, updateProposalLinesAction } from "@/lib/actions/captures";
import { cad, roundMoney } from "@/lib/money";
import type { PlanPreview, PlanPreviewLine } from "@/lib/plan-proposal";

function serializeLines(lines: PlanPreviewLine[]) {
  return JSON.stringify(
    lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
    })),
  );
}

export function PlanProposalCard({
  captureId,
  reviewUrl,
  preview,
  onCancelled,
}: {
  captureId: string;
  reviewUrl: string;
  preview: PlanPreview;
  onCancelled: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<"confirm" | "cancel" | null>(null);
  const [lines, setLines] = useState<PlanPreviewLine[]>(preview.lines);
  const [saving, setSaving] = useState(false);

  const linesRef = useRef<PlanPreviewLine[]>(preview.lines);
  const lastSavedRef = useRef<string>(serializeLines(preview.lines));
  const saveFailedRef = useRef(false);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  function updateLines(updater: (rows: PlanPreviewLine[]) => PlanPreviewLine[]) {
    setError(null);
    setLines((rows) => {
      const next = updater(rows);
      linesRef.current = next;
      return next;
    });
  }

  function saveLines(next: PlanPreviewLine[]): Promise<boolean> {
    const serialized = serializeLines(next);
    if (serialized === lastSavedRef.current && !saveFailedRef.current) {
      return Promise.resolve(true);
    }
    setSaving(true);
    setError(null);
    const task = (async () => {
      try {
        const result = await updateProposalLinesAction(
          captureId,
          next.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
          })),
        );
        if (result && "error" in result) {
          saveFailedRef.current = true;
          setError(result.error ?? "Couldn't save that edit.");
          return false;
        }
        lastSavedRef.current = serialized;
        saveFailedRef.current = false;
        router.refresh();
        return true;
      } catch {
        saveFailedRef.current = true;
        setError("Couldn't save that edit.");
        return false;
      } finally {
        setSaving(false);
        savePromiseRef.current = null;
      }
    })();
    savePromiseRef.current = task;
    return task;
  }

  function confirm() {
    setError(null);
    setWorking("confirm");
    startTransition(async () => {
      if (savePromiseRef.current) {
        const ok = await savePromiseRef.current;
        if (!ok) {
          setWorking(null);
          return;
        }
      }
      const current = linesRef.current;
      if (serializeLines(current) !== lastSavedRef.current || saveFailedRef.current) {
        const ok = await saveLines(current);
        if (!ok) {
          setWorking(null);
          return;
        }
      }
      const result = await confirmPlanProposalAction(captureId);
      if ("error" in result) {
        setError(result.error);
        setWorking(null);
      }
    });
  }

  function cancel() {
    setError(null);
    setWorking("cancel");
    startTransition(async () => {
      const result = await cancelPlanProposalAction(captureId);
      if ("error" in result) {
        setError(result.error);
        setWorking(null);
      } else {
        onCancelled();
      }
    });
  }

  const linesSubtotal = useMemo(() => {
    if (lines.length === 0) return null;
    if (lines.some((line) => line.unitPrice == null || !Number.isFinite(line.quantity))) return null;
    return roundMoney(lines.reduce((sum, line) => sum + roundMoney(line.quantity * (line.unitPrice ?? 0)), 0));
  }, [lines]);

  // Invoicing tracked lines bills the job's own rows. They are edited on the job, not on this card.
  const readOnly = preview.action === "invoice_tracked";
  const changeHref = readOnly && preview.jobId ? `/app/jobs/${preview.jobId}` : reviewUrl;

  const details: { label: string; value: string }[] = [];
  if (preview.jobTitle) {
    details.push({
      label: preview.action === "create_job" ? "Title" : "Job",
      value: `${preview.jobTitle}${preview.jobIsNew ? " (new job)" : ""}`,
    });
  }
  if (preview.clientName) {
    details.push({ label: "Client", value: `${preview.clientName}${preview.clientIsNew ? " (new client)" : ""}` });
  }
  if (preview.siteAddress) details.push({ label: "Site", value: preview.siteAddress });
  if (preview.notes) details.push({ label: "Notes", value: preview.notes });

  return (
    <div className="card mb-3 max-w-[40rem] space-y-3.5 p-4 text-sm" aria-label="Proposal">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Review before saving</p>
          <p className="mt-0.5 font-semibold text-ink">{preview.title}</p>
        </div>
        {linesSubtotal != null ? (
          <span className="rounded-lg border border-line bg-navy-2 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink">
            {cad(linesSubtotal)}
          </span>
        ) : null}
      </div>

      {details.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-line bg-navy-2/70 px-3 py-2.5">
          {details.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-xs font-medium text-muted">{row.label}</dt>
              <dd className="whitespace-pre-line text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {lines.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[1fr_5rem_4rem_6rem] gap-2 border-b border-line bg-navy-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted sm:grid">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Price</span>
          </div>
          <ul className="divide-y divide-line">
            {lines.map((line, index) =>
              readOnly ? (
                <li key={index} className="grid gap-2 px-3 py-2.5 text-ink sm:grid-cols-[1fr_5rem_4rem_6rem]">
                  <span>{line.description}</span>
                  <span className="tabular-nums">{line.quantity}</span>
                  <span>{line.unit}</span>
                  <span className="tabular-nums">{line.unitPrice == null ? "—" : cad(line.unitPrice)}</span>
                </li>
              ) : (
                <li key={index} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_5rem_4rem_6rem]">
                  <input
                    className="input"
                    aria-label="Description"
                    value={line.description}
                    onChange={(event) =>
                      updateLines((rows) => rows.map((row, i) => (i === index ? { ...row, description: event.target.value } : row)))
                    }
                    onBlur={() => void saveLines(linesRef.current)}
                  />
                  <input
                    className="input"
                    aria-label="Quantity"
                    type="number"
                    min="0"
                    step="any"
                    value={line.quantity}
                    onChange={(event) =>
                      updateLines((rows) =>
                        rows.map((row, i) => (i === index ? { ...row, quantity: Number(event.target.value) } : row)),
                      )
                    }
                    onBlur={() => void saveLines(linesRef.current)}
                  />
                  <input
                    className="input"
                    aria-label="Unit"
                    value={line.unit}
                    onChange={(event) =>
                      updateLines((rows) => rows.map((row, i) => (i === index ? { ...row, unit: event.target.value } : row)))
                    }
                    onBlur={() => void saveLines(linesRef.current)}
                  />
                  <input
                    className="input"
                    aria-label="Price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice ?? ""}
                    onChange={(event) =>
                      updateLines((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, unitPrice: event.target.value === "" ? null : Number(event.target.value) } : row,
                        ),
                      )
                    }
                    onBlur={() => void saveLines(linesRef.current)}
                  />
                  {line.note ? <p className="text-xs text-danger sm:col-span-4">{line.note}</p> : null}
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}

      {preview.warnings.length > 0 || preview.blockers.length > 0 ? (
        <ul className="space-y-1 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="status">
          {[...preview.blockers, ...preview.warnings].map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending || !preview.canConfirm} onClick={confirm}>
          {pending && working === "confirm" ? "Confirming…" : "Confirm"}
        </button>
        <Link
          href={changeHref}
          className={`btn btn-ghost btn-sm ${pending ? "pointer-events-none opacity-45" : ""}`}
          aria-disabled={pending}
          tabIndex={pending ? -1 : undefined}
        >
          {readOnly ? "Open job" : "Change"}
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={cancel}>
          {pending && working === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
        {saving ? <span className="ml-auto text-xs text-muted">Saving edit…</span> : null}
      </div>
    </div>
  );
}
