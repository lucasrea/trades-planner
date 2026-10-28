"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export type ActionState = {
  error?: string;
  redirectTo?: string;
  ok?: boolean;
} | null;

export function useActionRedirect(state: ActionState) {
  const router = useRouter();
  useEffect(() => {
    if (!state?.redirectTo) return;
    router.replace(state.redirectTo);
    router.refresh();
  }, [state, router]);
}
