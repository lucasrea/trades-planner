"use client";

import Link from "next/link";
import type { ActionState } from "@/components/use-action-redirect";

export function ActionError({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return (
    <p className="text-sm text-accent" role="alert">
      {state.error}
      {state.upgradeHref ? (
        <>
          {" "}
          <Link href={state.upgradeHref} className="font-medium underline hover:text-ink">
            See plans
          </Link>
        </>
      ) : null}
    </p>
  );
}
