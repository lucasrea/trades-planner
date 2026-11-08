"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cancelPlanProposalAction, confirmPlanProposalAction } from "@/lib/actions/captures";
import { cad } from "@/lib/money";
import type { PlanPreview } from "@/lib/plan-proposal";

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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<"confirm" | "cancel" | null>(null);

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

      {preview.lines.length > 0 ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {preview.lines.map((line, index) => (
            <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2">
              <span>{line.description}</span>
              <span className="tabular-nums text-muted">
                {line.quantity} {line.unit} ×{" "}
                {line.unitPrice == null ? <span className="text-accent">no price</span> : cad(line.unitPrice)}
                {line.note && line.note !== "No price" ? <span className="ml-2 text-accent">{line.note}</span> : null}
              </span>
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
        <button type="button" className="btn btn-primary btn-sm" disabled={pending || !preview.canConfirm} onClick={confirm}>
          {pending && working === "confirm" ? "Confirming…" : "Confirm"}
        </button>
        <Link href={reviewUrl} className="btn btn-ghost btn-sm" aria-disabled={pending}>
          Change
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={cancel}>
          {pending && working === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
