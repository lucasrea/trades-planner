"use client";

import { useCallback } from "react";
import { CaptureBar, type CaptureJobOption, type OpenPlan } from "@/components/capture-bar";
import { ReceiptUpload } from "@/components/receipt-upload";
import { PLAN_NEW } from "@/lib/plans";

export function PlanChatHost({
  open,
  jobs,
  planId,
  syncPlan,
}: {
  open: OpenPlan;
  jobs: CaptureJobOption[];
  /** Selected plan from the URL; null for a new thread. */
  planId: string | null;
  syncPlan: (savedPlanId: string | null | undefined) => Promise<void>;
}) {
  const onSyncPlan = useCallback(
    (savedPlanId: string | null | undefined) => syncPlan(savedPlanId),
    [syncPlan],
  );

  const dock = (
    <ReceiptUpload
      jobs={jobs}
      planId={open.id ?? planId ?? PLAN_NEW}
      initialJobId={open.jobId}
      compact
    />
  );

  return <CaptureBar jobs={jobs} fill plan={open} dock={dock} syncPlan={onSyncPlan} />;
}