"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelPlanProposalAction, confirmPlanProposalAction, updateProposalLinesAction } from "@/lib/actions/captures";
import type { PlanPreview, PlanPreviewLine } from "@/lib/plan-proposal";

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

  function saveLines(next: PlanPreviewLine[]) {
    setLines(next);
    setSaving(true);
    startTransition(async () => {
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
      if (result && "error" in result) setError(result.error ?? "Couldn't save that edit.");
      else router.refresh();
      } finally {
        setSaving(false);
      }
    });
  }

  function confirm() {
    setError(null);
    setWorking("confirm");
    startTransition(async () => {
      const result = await confirmPlanProposalAction(captureId);
      if ("error" in result) setError(result.error);
    });
  }

  function cancel() {
    setError(null);
    setWorking("cancel");
    startTransition(async () => {
      const result = await cancelPlanProposalAction(captureId);
      if ("error" in result) setError(result.error);
      else onCancelled();
    });
  }

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
    <div className="card mb-3 max-w-[40rem] space-y-3 p-4 text-sm" aria-label="Proposal">
      <p className="font-medium">{preview.title}</p>

      {details.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {details.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted">{row.label}</dt>
              <dd className="whitespace-pre-line">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {lines.length > 0 ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {lines.map((line, index) => (
            <li key={index} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_5rem_4rem_6rem]">
              <input
                className="input"
                aria-label="Description"
                value={line.description}
                onChange={(event) => setLines((rows) => rows.map((row, i) => (i === index ? { ...row, description: event.target.value } : row)))}
                onBlur={() => saveLines(lines)}
              />
              <input
                className="input"
                aria-label="Quantity"
                type="number"
                min="0"
                step="any"
                value={line.quantity}
                onChange={(event) =>
                  setLines((rows) => rows.map((row, i) => (i === index ? { ...row, quantity: Number(event.target.value) } : row)))
                }
                onBlur={() => saveLines(lines)}
              />
              <input
                className="input"
                aria-label="Unit"
                value={line.unit}
                onChange={(event) => setLines((rows) => rows.map((row, i) => (i === index ? { ...row, unit: event.target.value } : row)))}
                onBlur={() => saveLines(lines)}
              />
              <input
                className="input"
                aria-label="Price"
                type="number"
                min="0"
                step="0.01"
                value={line.unitPrice ?? ""}
                onChange={(event) =>
                  setLines((rows) =>
                    rows.map((row, i) =>
                      i === index ? { ...row, unitPrice: event.target.value === "" ? null : Number(event.target.value) } : row,
                    ),
                  )
                }
                onBlur={() => saveLines(lines)}
              />
              {line.note ? <p className="text-xs text-accent sm:col-span-4">{line.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {preview.warnings.length > 0 || preview.blockers.length > 0 ? (
        <ul className="space-y-1 text-accent" role="status">
          {[...preview.blockers, ...preview.warnings].map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="text-accent" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending || saving || !preview.canConfirm} onClick={confirm}>
          {pending && working === "confirm" ? "Confirming…" : "Confirm"}
        </button>
        <Link href={reviewUrl} className="btn btn-ghost btn-sm" aria-disabled={pending}>
          Change
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending || saving} onClick={cancel}>
          {pending && working === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
