"use client";

import type { ActionState } from "@/components/use-action-redirect";

export function ActionError({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return (
    <p className="text-sm text-danger" role="alert">
      {state.error}
    </p>
  );
}
