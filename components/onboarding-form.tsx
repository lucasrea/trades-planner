"use client";

import { useActionState, useRef, useState } from "react";
import { completeOnboardingAction } from "@/lib/actions/auth";
import { Field } from "@/components/app-shell";
import { useActionRedirect } from "@/components/use-action-redirect";

const steps = ["Business", "Tax", "Rates", "Getting paid"];

export function OnboardingForm({ email }: { email: string }) {
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(completeOnboardingAction, null);
  useActionRedirect(state);

  function goNext() {
    const data = formRef.current ? new FormData(formRef.current) : null;
    if (step === 0 && !String(data?.get("businessName") || "").trim()) {
      setLocalError("Business name is required.");
      return;
    }
    setLocalError("");
    setStep((s) => s + 1);
  }

  return (
    <form ref={formRef} action={formAction} className="card mx-auto w-full max-w-xl p-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Step {step + 1} of {steps.length}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{steps[step]}</h1>
      <p className="mt-1 text-sm text-muted">This shows up on quotes and invoices. You can change it later.</p>

      <div className="mt-6 flex gap-2">
        {steps.map((label, i) => (
          <div key={label} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
        ))}
      </div>

      <div className={step === 0 ? "mt-8 grid gap-4" : "hidden"}>
        <Field label="Business name">
          <input className="input" name="businessName" placeholder="Rea Plumbing" />
        </Field>
        <Field label="Business address">
          <textarea className="input min-h-20" name="businessAddress" placeholder="123 Main St, Hamilton ON" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input className="input" name="phone" placeholder="905-555-0199" />
          </Field>
          <Field label="Email on documents">
            <input className="input" name="email" type="email" defaultValue={email} />
          </Field>
        </div>
      </div>

      <div className={step === 1 ? "mt-8 grid gap-4" : "hidden"}>
        <Field label="GST/HST number (BN)">
          <input className="input" name="gstHstNumber" placeholder="123456789RT0001" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tax label">
            <input className="input" name="taxLabel" defaultValue="HST" />
          </Field>
          <Field label="Tax rate (%)">
            <input className="input" name="taxPct" type="number" step="0.01" defaultValue={13} />
          </Field>
        </div>
      </div>

      <div className={step === 2 ? "mt-8 grid gap-4" : "hidden"}>
        <Field label="Default labour rate ($ / hour)">
          <input className="input" name="labourRate" type="number" step="0.01" defaultValue={85} />
        </Field>
        <Field label="Default material markup (%)">
          <input className="input" name="markupPct" type="number" step="0.01" defaultValue={20} />
        </Field>
        <p className="text-sm text-muted">
          Markup is saved for later (price catalog / AI quotes). Line items you type today use the sell price you enter.
        </p>
      </div>

      <div className={step === 3 ? "mt-8 grid gap-4" : "hidden"}>
        <Field label="Interac e-Transfer email">
          <input className="input" name="etransferEmail" type="email" defaultValue={email} />
        </Field>
        <Field label="Payment note on invoices">
          <input className="input" name="etransferNote" placeholder="Please include the invoice number in the message." />
        </Field>
      </div>

      {localError || state?.error ? (
        <p className="mt-4 text-sm text-accent">{localError || state?.error}</p>
      ) : null}

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={step === 0}
          onClick={() => {
            setLocalError("");
            setStep((s) => s - 1);
          }}
        >
          Back
        </button>
        {step < steps.length - 1 ? (
          <button type="button" className="btn btn-navy" onClick={goNext}>
            Next
          </button>
        ) : (
          <button className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Go to dashboard"}
          </button>
        )}
      </div>
    </form>
  );
}
