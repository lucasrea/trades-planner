"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/app-shell";
import { updateSettingsAction } from "@/lib/actions/auth";

type ContractorSettings = {
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

type SectionId = "business" | "tax" | "rates" | "payment";

function displayValue(value: string) {
  return value.trim() || "—";
}

function SettingsSection({
  title,
  description,
  section,
  editingSection,
  onEdit,
  onCancel,
  children,
  view,
}: {
  title: string;
  description?: string;
  section: SectionId;
  editingSection: SectionId | null;
  onEdit: (section: SectionId) => void;
  onCancel: () => void;
  children: React.ReactNode;
  view: React.ReactNode;
}) {
  const editing = editingSection === section;

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {!editing ? (
          <button type="button" className="btn btn-ghost shrink-0" onClick={() => onEdit(section)}>
            Edit
          </button>
        ) : (
          <button type="button" className="btn btn-ghost shrink-0" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      <div className="mt-4">{editing ? children : view}</div>
    </section>
  );
}

function SettingsFields({
  section,
  contractor,
  onSaved,
}: {
  section: SectionId;
  contractor: ContractorSettings;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, null);
  const router = useRouter();

  useEffect(() => {
    if (!state?.ok) return;
    onSaved();
    router.refresh();
  }, [state, onSaved, router]);

  return (
    <form action={formAction} className="space-y-4">
      {section === "business" ? (
        <>
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
          <input type="hidden" name="gstHstNumber" value={contractor.gstHstNumber} />
          <input type="hidden" name="taxLabel" value={contractor.taxLabel} />
          <input type="hidden" name="taxPct" value={contractor.taxRate * 100} />
          <input type="hidden" name="labourRate" value={contractor.labourRateHourly} />
          <input type="hidden" name="markupPct" value={contractor.defaultMarkupPct} />
          <input type="hidden" name="etransferEmail" value={contractor.etransferEmail} />
          <input type="hidden" name="etransferNote" value={contractor.etransferNote} />
        </>
      ) : null}

      {section === "tax" ? (
        <>
          <Field label="GST/HST number">
            <input className="input" name="gstHstNumber" defaultValue={contractor.gstHstNumber} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tax label">
              <input className="input" name="taxLabel" defaultValue={contractor.taxLabel} />
            </Field>
            <Field label="Tax rate (%)">
              <input
                className="input"
                name="taxPct"
                type="number"
                step="0.01"
                defaultValue={contractor.taxRate * 100}
              />
            </Field>
          </div>
          <input type="hidden" name="businessName" value={contractor.businessName} />
          <input type="hidden" name="businessAddress" value={contractor.businessAddress} />
          <input type="hidden" name="phone" value={contractor.phone} />
          <input type="hidden" name="email" value={contractor.email} />
          <input type="hidden" name="labourRate" value={contractor.labourRateHourly} />
          <input type="hidden" name="markupPct" value={contractor.defaultMarkupPct} />
          <input type="hidden" name="etransferEmail" value={contractor.etransferEmail} />
          <input type="hidden" name="etransferNote" value={contractor.etransferNote} />
        </>
      ) : null}

      {section === "rates" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Labour rate ($/hr)">
              <input
                className="input"
                name="labourRate"
                type="number"
                step="0.01"
                defaultValue={contractor.labourRateHourly}
              />
            </Field>
            <Field label="Material markup (%)">
              <input
                className="input"
                name="markupPct"
                type="number"
                step="0.01"
                defaultValue={contractor.defaultMarkupPct}
              />
            </Field>
          </div>
          <input type="hidden" name="businessName" value={contractor.businessName} />
          <input type="hidden" name="businessAddress" value={contractor.businessAddress} />
          <input type="hidden" name="phone" value={contractor.phone} />
          <input type="hidden" name="email" value={contractor.email} />
          <input type="hidden" name="gstHstNumber" value={contractor.gstHstNumber} />
          <input type="hidden" name="taxLabel" value={contractor.taxLabel} />
          <input type="hidden" name="taxPct" value={contractor.taxRate * 100} />
          <input type="hidden" name="etransferEmail" value={contractor.etransferEmail} />
          <input type="hidden" name="etransferNote" value={contractor.etransferNote} />
        </>
      ) : null}

      {section === "payment" ? (
        <>
          <Field label="e-Transfer email">
            <input className="input" name="etransferEmail" type="email" defaultValue={contractor.etransferEmail} />
          </Field>
          <Field label="Payment note">
            <input className="input" name="etransferNote" defaultValue={contractor.etransferNote} />
          </Field>
          <input type="hidden" name="businessName" value={contractor.businessName} />
          <input type="hidden" name="businessAddress" value={contractor.businessAddress} />
          <input type="hidden" name="phone" value={contractor.phone} />
          <input type="hidden" name="email" value={contractor.email} />
          <input type="hidden" name="gstHstNumber" value={contractor.gstHstNumber} />
          <input type="hidden" name="taxLabel" value={contractor.taxLabel} />
          <input type="hidden" name="taxPct" value={contractor.taxRate * 100} />
          <input type="hidden" name="labourRate" value={contractor.labourRateHourly} />
          <input type="hidden" name="markupPct" value={contractor.defaultMarkupPct} />
        </>
      ) : null}

      {state?.error ? (
        <p className="text-sm text-accent" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export function SettingsForm({ contractor }: { contractor: ContractorSettings }) {
  const [editingSection, setEditingSection] = useState<SectionId | null>(null);
  const [savedSection, setSavedSection] = useState<SectionId | null>(null);

  function closeEditor() {
    setEditingSection(null);
  }

  function handleSaved(section: SectionId) {
    setSavedSection(section);
    setEditingSection(null);
  }

  function startEdit(section: SectionId) {
    setSavedSection(null);
    setEditingSection(section);
  }

  return (
    <div className="max-w-xl space-y-4">
      <SettingsSection
        title="Business"
        description="Shown on quotes and invoices."
        section="business"
        editingSection={editingSection}
        onEdit={startEdit}
        onCancel={closeEditor}
        view={
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted">Business name</dt>
              <dd className="mt-1 font-medium text-ink">{displayValue(contractor.businessName)}</dd>
            </div>
            <div>
              <dt className="text-muted">Address</dt>
              <dd className="mt-1 text-ink">{displayValue(contractor.businessAddress)}</dd>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-muted">Phone</dt>
                <dd className="mt-1 text-ink">{displayValue(contractor.phone)}</dd>
              </div>
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="mt-1 text-ink">{displayValue(contractor.email)}</dd>
              </div>
            </div>
          </dl>
        }
      >
        {editingSection === "business" ? (
          <SettingsFields
            section="business"
            contractor={contractor}
            onSaved={() => handleSaved("business")}
          />
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Tax"
        description="GST/HST details for PDFs."
        section="tax"
        editingSection={editingSection}
        onEdit={startEdit}
        onCancel={closeEditor}
        view={
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-muted">GST/HST number</dt>
              <dd className="mt-1 text-ink">{displayValue(contractor.gstHstNumber)}</dd>
            </div>
            <div>
              <dt className="text-muted">Tax label</dt>
              <dd className="mt-1 text-ink">{displayValue(contractor.taxLabel)}</dd>
            </div>
            <div>
              <dt className="text-muted">Tax rate</dt>
              <dd className="mt-1 text-ink">{(contractor.taxRate * 100).toFixed(2)}%</dd>
            </div>
          </dl>
        }
      >
        {editingSection === "tax" ? (
          <SettingsFields section="tax" contractor={contractor} onSaved={() => handleSaved("tax")} />
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Rates"
        description="Defaults for new quotes."
        section="rates"
        editingSection={editingSection}
        onEdit={startEdit}
        onCancel={closeEditor}
        view={
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Labour rate</dt>
              <dd className="mt-1 text-ink">${contractor.labourRateHourly.toFixed(2)}/hr</dd>
            </div>
            <div>
              <dt className="text-muted">Material markup</dt>
              <dd className="mt-1 text-ink">{contractor.defaultMarkupPct.toFixed(2)}%</dd>
            </div>
          </dl>
        }
      >
        {editingSection === "rates" ? (
          <SettingsFields section="rates" contractor={contractor} onSaved={() => handleSaved("rates")} />
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Getting paid"
        description="Printed on invoices."
        section="payment"
        editingSection={editingSection}
        onEdit={startEdit}
        onCancel={closeEditor}
        view={
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted">e-Transfer email</dt>
              <dd className="mt-1 text-ink">{displayValue(contractor.etransferEmail)}</dd>
            </div>
            <div>
              <dt className="text-muted">Payment note</dt>
              <dd className="mt-1 text-ink">{displayValue(contractor.etransferNote)}</dd>
            </div>
          </dl>
        }
      >
        {editingSection === "payment" ? (
          <SettingsFields
            section="payment"
            contractor={contractor}
            onSaved={() => handleSaved("payment")}
          />
        ) : null}
      </SettingsSection>

      {savedSection && !editingSection ? (
        <p className="text-sm text-ok">Settings saved.</p>
      ) : null}
    </div>
  );
}
