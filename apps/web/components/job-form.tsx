"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionError } from "@/components/action-error";
import { Field } from "@/components/app-shell";
import { saveJobAction, setJobStatusAction } from "@/lib/actions/jobs";

const jobStatusOptions = ["quoted", "active", "done"] as const;

export function JobForm({
  clients,
  initial,
}: {
  clients: { id: string; name: string }[];
  initial?: { clientId?: string };
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveJobAction, null);
  const hasClients = clients.length > 0;
  const [mode, setMode] = useState<"existing" | "new">(hasClients ? "existing" : "new");
  const saved = Boolean(state && "ok" in state && state.ok && "jobId" in state && state.jobId);

  useEffect(() => {
    if (state && "jobId" in state && state.ok && state.jobId) {
      router.push(`/app/jobs/${state.jobId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="card max-w-2xl space-y-5 p-6">
      <Field label="Title">
        <input className="input" name="title" required placeholder="Kitchen rough-in" />
      </Field>
      <div className="space-y-3">
        <div className="inline-flex rounded-lg border border-line bg-paper p-1" role="group" aria-label="Client type">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "existing" ? "bg-elevated text-ink" : "text-muted hover:text-ink"
            } disabled:opacity-40`}
            disabled={!hasClients}
            onClick={() => setMode("existing")}
          >
            Existing client
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "new" ? "bg-elevated text-ink" : "text-muted hover:text-ink"
            }`}
            onClick={() => setMode("new")}
          >
            New client
          </button>
        </div>
        {mode === "existing" ? (
          <Field label="Client">
            <select className="input" name="clientId" required defaultValue={initial?.clientId || ""}>
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="space-y-4 rounded-xl border border-line bg-navy-2/50 p-4">
            <Field label="Client name">
              <input className="input" name="clientName" required placeholder="Patel" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input className="input" type="email" name="clientEmail" placeholder="patel@example.com" />
              </Field>
              <Field label="Phone">
                <input className="input" name="clientPhone" placeholder="555-0100" />
              </Field>
            </div>
            <Field label="Billing address">
              <textarea className="input min-h-20" name="clientBillingAddress" placeholder="Where invoices are sent" />
            </Field>
          </div>
        )}
      </div>
      <Field label="Job site address">
        <textarea className="input min-h-20" name="siteAddress" placeholder="Where the work happens" />
      </Field>
      <Field label="Notes">
        <textarea className="input min-h-20" name="notes" />
      </Field>
      <ActionError state={state && "error" in state ? state : null} />
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <button className="btn btn-primary" disabled={pending || saved}>
          {pending ? "Saving…" : saved ? "Saved" : "Save job"}
        </button>
        <Link href="/app/jobs" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function JobEditForm({
  job,
  clients,
}: {
  job: { id: string; title: string; clientId: string; siteAddress: string; notes: string };
  clients: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(saveJobAction, null);
  const [dirty, setDirty] = useState(false);
  const saved = Boolean(state && "ok" in state && state.ok) && !dirty;

  return (
    <form
      action={(formData) => {
        setDirty(false);
        return formAction(formData);
      }}
      onChange={() => setDirty(true)}
      className="card space-y-4 p-6"
    >
      <input type="hidden" name="id" value={job.id} />
      <div>
        <h2 className="text-base font-semibold">Job details</h2>
        <p className="mt-0.5 text-sm text-muted">Title, client, site address, and notes.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <input className="input" name="title" required defaultValue={job.title} />
        </Field>
        <Field label="Client">
          <select className="input" name="clientId" required defaultValue={job.clientId}>
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Job site address">
        <textarea className="input min-h-20" name="siteAddress" defaultValue={job.siteAddress} placeholder="Where the work happens" />
      </Field>
      <Field label="Notes">
        <textarea className="input min-h-20" name="notes" defaultValue={job.notes} />
      </Field>
      <ActionError state={state && "error" in state ? state : null} />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save job"}
        </button>
        {saved ? <p className="text-sm text-ok" role="status">Saved.</p> : null}
      </div>
    </form>
  );
}

export function JobStatusForm({ jobId, status }: { jobId: string; status: string }) {
  const [state, action, pending] = useActionState(setJobStatusAction, null);
  const known = (jobStatusOptions as readonly string[]).includes(status);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <Field label="Status">
        <select className="input" name="status" defaultValue={known ? status : "quoted"}>
          {jobStatusOptions.map((value) => (
            <option key={value} value={value}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </option>
          ))}
        </select>
      </Field>
      {known ? null : (
        <p className="text-sm text-muted">This job is marked {status}. Choose quoted, active, or done.</p>
      )}
      <ActionError state={state} />
      <button className="btn btn-navy btn-sm w-full" disabled={pending}>
        {pending ? "Saving…" : "Update status"}
      </button>
    </form>
  );
}
