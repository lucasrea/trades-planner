"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { CaptureBar, type CaptureJobOption, type OpenPlan } from "@/components/capture-bar";
import { ReceiptUpload } from "@/components/receipt-upload";
import { PLAN_NEW } from "@/lib/plans";

type ThreadPayload = {
  id: string;
  messages: OpenPlan["messages"];
  jobId: string | null;
};

export function PlanChatHost({
  initial,
  jobs,
  planId,
}: {
  initial: OpenPlan;
  jobs: CaptureJobOption[];
  /** Selected plan from the URL; null for a new thread. */
  planId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initial);
  const [, startTransition] = useTransition();

  const syncPlan = useCallback(
    async (savedPlanId: string | null | undefined) => {
      if (savedPlanId && savedPlanId !== planId) {
        startTransition(() => {
          router.replace(`/app?plan=${encodeURIComponent(savedPlanId)}`, { scroll: false });
        });
        return;
      }
      const id = savedPlanId ?? open.id ?? planId;
      if (id && id !== PLAN_NEW) {
        const response = await fetch(`/api/plans/${encodeURIComponent(id)}/thread`);
        if (response.ok) {
          const data = (await response.json()) as ThreadPayload;
          setOpen({ id: data.id, messages: data.messages, jobId: data.jobId });
          return;
        }
      }
      startTransition(() => router.refresh());
    },
    [open.id, planId, router],
  );

  const dock = (
    <ReceiptUpload
      jobs={jobs}
      planId={open.id ?? planId ?? PLAN_NEW}
      initialJobId={open.jobId}
      compact
    />
  );

  return <CaptureBar jobs={jobs} fill plan={open} dock={dock} syncPlan={syncPlan} />;
}