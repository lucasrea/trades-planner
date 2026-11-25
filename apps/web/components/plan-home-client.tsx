"use client";

import { useCallback, useEffect, useState } from "react";
import { HomeLists } from "@/components/home-lists";
import { PlanChatHost } from "@/components/plan-chat-host";
import { PlanChatSkeleton } from "@/components/plan-chat-skeleton";
import { PlanSidebar } from "@/components/plan-list";
import type { CaptureJobOption, OpenPlan } from "@/components/capture-bar";
import { PLAN_NEW } from "@/lib/plans";
import type { PlanSummary } from "@/lib/services/plans";
import type { getHome } from "@/lib/queries";

type HomeData = Awaited<ReturnType<typeof getHome>>;

type ThreadPayload = {
  id: string;
  messages: OpenPlan["messages"];
  jobId: string | null;
};

const emptyOpen = (): OpenPlan => ({ id: null, messages: [], jobId: null });

function planIdFromLocation() {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("plan");
  return raw && raw.trim() ? raw.trim() : null;
}

function replacePlanInUrl(planId: string | null) {
  const path = planId ? `/app?plan=${encodeURIComponent(planId)}` : "/app";
  window.history.replaceState(window.history.state, "", path);
}

async function fetchPlanThread(planId: string): Promise<OpenPlan | null> {
  const response = await fetch(`/api/plans/${encodeURIComponent(planId)}/thread`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not load this conversation.");
  const data = (await response.json()) as ThreadPayload;
  return { id: data.id, messages: data.messages, jobId: data.jobId };
}

export function PlanHomeClient({
  plans,
  jobs,
  home,
  initialPlanId,
  initialOpen,
}: {
  plans: PlanSummary[];
  jobs: CaptureJobOption[];
  home: HomeData;
  initialPlanId: string | null;
  initialOpen: OpenPlan;
}) {
  const [planId, setPlanId] = useState(initialPlanId);
  const [open, setOpen] = useState(initialOpen);
  const [loading, setLoading] = useState(false);

  const selectPlan = useCallback(async (nextId: string | null) => {
    replacePlanInUrl(nextId);
    setPlanId(nextId);
    if (!nextId) {
      setOpen(emptyOpen());
      return;
    }
    setLoading(true);
    try {
      const loaded = await fetchPlanThread(nextId);
      setOpen(loaded ?? emptyOpen());
    } catch {
      setOpen(emptyOpen());
    } finally {
      setLoading(false);
    }
  }, []);

  const syncPlan = useCallback(
    async (savedPlanId: string | null | undefined) => {
      if (savedPlanId && savedPlanId !== planId) {
        await selectPlan(savedPlanId);
        return;
      }
      const id = savedPlanId ?? open.id ?? planId;
      if (id && id !== PLAN_NEW) {
        try {
          const loaded = await fetchPlanThread(id);
          if (loaded) setOpen(loaded);
        } catch {
          // Keep the current thread on screen if a light refresh fails.
        }
      }
    },
    [open.id, planId, selectPlan],
  );

  useEffect(() => {
    function onPopState() {
      const fromUrl = planIdFromLocation();
      if (fromUrl === planId) return;
      void selectPlan(fromUrl);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [planId, selectPlan]);

  return (
    <PlanSidebar plans={plans} currentId={planId} onSelectPlan={(id) => void selectPlan(id)}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="order-2 flex min-h-0 min-w-0 flex-1 flex-col lg:order-1">
          {loading ? (
            <PlanChatSkeleton fill />
          ) : (
            <PlanChatHost key={planId ?? "new"} open={open} jobs={jobs} planId={planId} syncPlan={syncPlan} />
          )}
        </div>
        <div className="order-1 shrink-0 lg:order-2">
          <HomeLists home={home} />
        </div>
      </div>
    </PlanSidebar>
  );
}