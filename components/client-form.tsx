"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field } from "@/components/app-shell";
import { useActionRedirect } from "@/components/use-action-redirect";
import { saveClientAction } from "@/lib/actions/data";

export function ClientForm({
  initial,
}: {
  initial?: { id: string; name: string; email: string; phone: string; billingAddress: string };
}) {
  const [state, formAction, pending] = useActionState(saveClientAction, null);
  useActionRedirect(state);
  const editing = Boolean(initial?.id);

  return (
    <form action={formAction} className="card max-w-xl space-y-4 p-6">
      {editing ? <input type="hidden" name="id" value={initial!.id} /> : null}
      <Field label="Name">
        <input className="input" name="name" required defaultValue={initial?.name} placeholder="Jane Smith" />
      </Field>
      <Field label="Email">
        <input className="input" name="email" type="email" defaultValue={initial?.email} placeholder="jane@example.com" />
      </Field>
      <Field label="Phone">
        <input className="input" name="phone" defaultValue={initial?.phone} placeholder="905-555-0199" />
      </Field>
      <Field label="Billing address">
        <textarea
          className="input min-h-20"
          name="billingAddress"
          defaultValue={initial?.billingAddress}
          placeholder="Street, city, postal code"
        />
      </Field>
      {state?.error ? <p className="text-sm text-accent">{state.error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Save client"}
        </button>
        <Link href="/app/clients" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
