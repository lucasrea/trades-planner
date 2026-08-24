"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field } from "@/components/app-shell";
import { useActionRedirect } from "@/components/use-action-redirect";
import { saveJobAction } from "@/lib/actions/data";

export function JobForm({
  clients,
  initial,
}: {
  clients: { id: string; name: string }[];
  initial?: {
    id?: string;
    title?: string;
    clientId?: string;
    status?: string;
    siteAddress?: string;
    notes?: string;
    targetDate?: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(saveJobAction, null);
  useActionRedirect(state);
  const editing = Boolean(initial?.id);

  return (
    <form action={formAction} className="card max-w-xl space-y-4 p-6">
      {editing ? <input type="hidden" name="id" value={initial!.id} /> : null}
      <Field label="Title">
        <input className="input" name="title" required defaultValue={initial?.title} placeholder="Kitchen rough-in" />
      </Field>
      <Field label="Client">
        <select className="input" name="clientId" required defaultValue={initial?.clientId || ""}>
          <option value="">Select client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select className="input" name="status" defaultValue={initial?.status || "quoted"}>
          <option value="quoted">Quoted</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </Field>
      <Field label="Job site address">
        <textarea
          className="input min-h-20"
          name="siteAddress"
          defaultValue={initial?.siteAddress}
          placeholder="Where the work happens — can differ from billing"
        />
      </Field>
      <Field label="Target date">
        <input className="input" type="date" name="targetDate" defaultValue={initial?.targetDate || ""} />
      </Field>
      <Field label="Notes">
        <textarea className="input min-h-20" name="notes" defaultValue={initial?.notes} />
      </Field>
      {state?.error ? <p className="text-sm text-accent">{state.error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Save job"}
        </button>
        <Link href={editing && initial?.id ? `/app/jobs/${initial.id}` : "/app/jobs"} className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
