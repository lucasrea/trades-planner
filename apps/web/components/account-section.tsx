"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/app-shell";
import { deleteAccountAction, type DeleteAccountState } from "@/lib/actions/account";

export function AccountSection({ businessName }: { businessName: string }) {
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(deleteAccountAction, null);
  const [typed, setTyped] = useState("");

  return (
    <section className="card space-y-6 p-6">
      <div>
        <h2 className="text-base font-semibold text-ink">Your data</h2>
        <p className="mt-1 text-sm text-muted">
          One JSON file with your business, clients, jobs, documents, lines, and captures. No audio or photos.
        </p>
        <a href="/api/account/export" download className="btn btn-ghost mt-3 inline-flex">
          Download my data
        </a>
      </div>

      <form action={formAction} className="space-y-3 border-t border-line pt-6">
        <div>
          <h2 className="text-base font-semibold text-ink">Delete account</h2>
          <p className="mt-1 text-sm text-muted">
            This removes all your data and receipt photos for good. Type your business name
            {businessName ? <> (<span className="font-medium text-ink">{businessName}</span>)</> : null} to confirm.
          </p>
        </div>
        <Field label="Business name">
          <input
            className="input"
            name="confirmBusinessName"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </Field>
        {state?.error ? (
          <p className="text-sm text-accent" role="alert">
            {state.error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-ghost" disabled={pending || !typed.trim()}>
          {pending ? "Deleting…" : "Delete my account"}
        </button>
      </form>
    </section>
  );
}
