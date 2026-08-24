"use client";

import { useActionState } from "react";
import { Field } from "@/components/app-shell";
import { saveClientAction } from "@/lib/actions/data";

export function ClientForm({
  initial,
}: {
  initial?: { id: string; name: string; email: string; phone: string; billingAddress: string };
}) {
  const [state, formAction, pending] = useActionState(saveClientAction, null);
  return (
    <form action={formAction} className="card max-w-xl space-y-4 p-6">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Field label="Name">
        <input className="input" name="name" required defaultValue={initial?.name} />
      </Field>
      <Field label="Email">
        <input className="input" name="email" type="email" defaultValue={initial?.email} />
      </Field>
      <Field label="Phone">
        <input className="input" name="phone" defaultValue={initial?.phone} />
      </Field>
      <Field label="Billing address">
        <textarea className="input min-h-20" name="billingAddress" defaultValue={initial?.billingAddress} />
      </Field>
      {state?.error ? <p className="text-sm text-accent">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save client"}
      </button>
    </form>
  );
}
