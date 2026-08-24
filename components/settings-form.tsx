"use client";

import { useActionState } from "react";
import { Field } from "@/components/app-shell";
import { updateSettingsAction } from "@/lib/actions/auth";

export function SettingsForm({
  contractor,
}: {
  contractor: {
    businessName: string;
    businessAddress: string;
    phone: string;
    email: string;
    gstHstNumber: string;
    taxLabel: string;
    taxRate: number;
    labourRateHourly: number;
    defaultMarkupPct: number;
    etransferEmail: string;
    etransferNote: string;
    plan: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, null);
  return (
    <form action={formAction} className="card max-w-xl space-y-4 p-6">
      <p className="rounded-lg bg-paper px-3 py-2 text-sm text-muted">
        Plan: <span className="font-medium text-ink">{contractor.plan}</span> (local — Stripe portal comes later)
      </p>
      <Field label="Business name">
        <input className="input" name="businessName" required defaultValue={contractor.businessName} />
      </Field>
      <Field label="Business address">
        <textarea className="input min-h-20" name="businessAddress" defaultValue={contractor.businessAddress} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone">
          <input className="input" name="phone" defaultValue={contractor.phone} />
        </Field>
        <Field label="Email">
          <input className="input" name="email" type="email" defaultValue={contractor.email} />
        </Field>
      </div>
      <Field label="GST/HST number">
        <input className="input" name="gstHstNumber" defaultValue={contractor.gstHstNumber} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tax label">
          <input className="input" name="taxLabel" defaultValue={contractor.taxLabel} />
        </Field>
        <Field label="Tax rate (%)">
          <input className="input" name="taxPct" type="number" step="0.01" defaultValue={contractor.taxRate * 100} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Labour rate ($/hr)">
          <input className="input" name="labourRate" type="number" step="0.01" defaultValue={contractor.labourRateHourly} />
        </Field>
        <Field label="Material markup (%)">
          <input className="input" name="markupPct" type="number" step="0.01" defaultValue={contractor.defaultMarkupPct} />
        </Field>
      </div>
      <Field label="e-Transfer email">
        <input className="input" name="etransferEmail" type="email" defaultValue={contractor.etransferEmail} />
      </Field>
      <Field label="Payment note">
        <input className="input" name="etransferNote" defaultValue={contractor.etransferNote} />
      </Field>
      {state?.ok ? (
        <p className="rounded-lg bg-lime-50 px-3 py-2 text-sm text-ok">Settings saved.</p>
      ) : null}
      {state?.error ? <p className="text-sm text-accent">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
