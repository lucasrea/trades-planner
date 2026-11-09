"use client";

import { useActionState } from "react";
import { sendDocumentEmailAction } from "@/lib/actions/document-email";
import { FormSubmitButton } from "@/components/form-submit";

export function EmailClientButton({ documentId }: { documentId: string }) {
  const [state, action] = useActionState(sendDocumentEmailAction, null);

  return (
    <form action={action} className="contents">
    <input type="hidden" name="documentId" value={documentId} />
    <FormSubmitButton label="Email client" pendingLabel="Sending…" className="btn btn-ghost" />
    {state && "ok" in state && state.ok ? (
      <span className="self-center text-sm text-muted" role="status">
        {state.message}
      </span>
    ) : null}
    {state && "error" in state ? (
      <span className="self-center text-sm text-accent" role="alert">
        {state.error}
      </span>
    ) : null}
    </form>
  );
}
