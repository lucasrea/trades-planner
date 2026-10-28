"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { deleteLineItemAction, saveLineItemAction } from "@/lib/actions/line-items";
import { applyMarkup, cad, computeTotals, type DraftLine, type LineKind, lineTotal } from "@/lib/money";

function emptyLine(kind: LineKind, unitPrice = 0, cost?: number): DraftLine {
  return {
    id: crypto.randomUUID(),
    kind,
    description: "",
    quantity: 1,
    unit: kind === "labour" ? "hr" : "ea",
    unitPrice,
    ...(cost !== undefined ? { cost } : {}),
  };
}

export function createDefaultLines(labourRate: number, applyMaterialMarkup = false): DraftLine[] {
  return [emptyLine("material", 0, applyMaterialMarkup ? 0 : undefined), emptyLine("labour", labourRate)];
}

const kindLabel: Record<LineKind, string> = {
  material: "Material",
  labour: "Labour",
  other: "Other",
};

function EditableLineRow({
  line,
  index,
  jobId,
  documentId,
  existing,
  labourRate,
  onRemoveDraft,
}: {
  line: DraftLine;
  index: number;
  jobId: string;
  documentId?: string;
  existing: boolean;
  labourRate: number;
  onRemoveDraft?: () => void;
}) {
  const formId = `line-form-${line.id}`;
  const router = useRouter();
  const [state, action, pending] = useActionState(saveLineItemAction, null);
  const [kind, setKind] = useState<LineKind>(line.kind);
  const [description, setDescription] = useState(line.description);
  const [quantity, setQuantity] = useState(line.quantity);
  const [unit, setUnit] = useState(line.unit);
  const [unitPrice, setUnitPrice] = useState(line.unitPrice);
  const handledSave = useRef(false);

  useEffect(() => {
    if (!state?.ok || handledSave.current) return;
    handledSave.current = true;
    onRemoveDraft?.();
    router.refresh();
  }, [state, router, onRemoveDraft]);

  const preview = lineTotal({ id: line.id, kind, description, quantity, unit, unitPrice });

  return (
    <>
      <tr className="border-t border-line bg-card/50">
        <td className="px-2 py-2">
          <select
            className="input"
            form={formId}
            name="kind"
            aria-label={`Line ${index + 1} type`}
            value={kind}
            onChange={(event) => {
              const next = event.target.value as LineKind;
              setKind(next);
              if (next === "labour") {
                setUnit("hr");
                if (!unitPrice) setUnitPrice(labourRate);
              } else if (unit === "hr") {
                setUnit("ea");
              }
            }}
          >
            <option value="material">Material</option>
            <option value="labour">Labour</option>
            <option value="other">Other</option>
          </select>
        </td>
        <td className="px-2 py-2">
          <input
            className="input"
            form={formId}
            name="description"
            aria-label={`Line ${index + 1} description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={kind === "labour" ? "Install valve, rough-in" : "1/2 in PEX pipe"}
          />
        </td>
        <td className="w-24 px-2 py-2">
          <input
            className="input"
            form={formId}
            name="quantity"
            aria-label={`Line ${index + 1} quantity`}
            type="number"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
        </td>
        <td className="w-20 px-2 py-2">
          <input
            className="input"
            form={formId}
            name="unit"
            aria-label={`Line ${index + 1} unit`}
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          />
        </td>
        <td className="w-28 px-2 py-2">
          <input
            className="input"
            form={formId}
            name="unitPrice"
            aria-label={`Line ${index + 1} unit price`}
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(event) => setUnitPrice(Number(event.target.value))}
          />
        </td>
        <td className="whitespace-nowrap px-3 py-2 font-medium">{cad(preview)}</td>
        <td className="sticky right-0 bg-card px-2 py-2 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-1">
            <form id={formId} action={action}>
              {existing ? <input type="hidden" name="id" value={line.id} /> : null}
              <input type="hidden" name="jobId" value={jobId} />
              {documentId ? <input type="hidden" name="documentId" value={documentId} /> : null}
            </form>
            <button form={formId} className="btn btn-ghost btn-sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            {existing ? (
              <form action={deleteLineItemAction}>
                <input type="hidden" name="id" value={line.id} />
                <input type="hidden" name="jobId" value={jobId} />
                {documentId ? <input type="hidden" name="documentId" value={documentId} /> : null}
                <button className="rounded-lg p-2 text-muted hover:bg-paper hover:text-accent" aria-label={`Remove line ${index + 1}`}>
                  <Trash2 size={16} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="rounded-lg p-2 text-muted hover:bg-paper hover:text-accent"
                onClick={onRemoveDraft}
                aria-label={`Remove line ${index + 1}`}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {state?.error ? (
            <p className="mt-1 text-xs text-accent" role="alert">
              {state.error}
            </p>
          ) : null}
        </td>
      </tr>
    </>
  );
}

function LockedLineRow({ line }: { line: DraftLine }) {
  return (
    <tr className="border-t border-line text-muted">
      <td className="px-3 py-2">{kindLabel[line.kind]}</td>
      <td className="px-3 py-2">{line.description || "—"}</td>
      <td className="px-3 py-2 tabular-nums">{line.quantity}</td>
      <td className="px-3 py-2">{line.unit}</td>
      <td className="px-3 py-2 tabular-nums">{cad(line.unitPrice)}</td>
      <td className="px-3 py-2 font-medium tabular-nums">{cad(lineTotal(line))}</td>
      <td className="sticky right-0 bg-card px-3 py-2 text-xs shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.35)]">Billed</td>
    </tr>
  );
}

function PersistLineEditor({
  lines,
  taxRate,
  taxLabel,
  labourRate,
  jobId,
  documentId,
  lockedIds = [],
}: {
  lines: DraftLine[];
  taxRate: number;
  taxLabel: string;
  labourRate: number;
  jobId: string;
  documentId?: string;
  lockedIds?: string[];
}) {
  const [drafts, setDrafts] = useState<DraftLine[]>([]);
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);
  const billableLines = useMemo(
    () => (documentId ? lines : lines.filter((line) => !locked.has(line.id))),
    [documentId, lines, locked],
  );
  const totals = useMemo(() => computeTotals(billableLines, taxRate), [billableLines, taxRate]);
  const showTax = taxRate > 0;
  const subtotalLabel = documentId ? "Subtotal" : "Unbilled subtotal";

  return (
    <div className="min-w-0 space-y-3">
      <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-paper text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Unit</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="sticky right-0 bg-paper px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) =>
              locked.has(line.id) ? (
                <LockedLineRow key={line.id} line={line} />
              ) : (
                <EditableLineRow
                  key={`${line.id}:${line.kind}:${line.description}:${line.quantity}:${line.unit}:${line.unitPrice}`}
                  line={line}
                  index={index}
                  jobId={jobId}
                  documentId={documentId}
                  existing
                  labourRate={labourRate}
                />
              ),
            )}
            {drafts.map((line, index) => (
              <EditableLineRow
                key={line.id}
                line={line}
                index={lines.length + index}
                jobId={jobId}
                documentId={documentId}
                existing={false}
                labourRate={labourRate}
                onRemoveDraft={() => setDrafts((rows) => rows.filter((row) => row.id !== line.id))}
              />
            ))}
          </tbody>
        </table>
      </div>
      {lines.length === 0 && drafts.length === 0 ? (
        <p className="text-sm text-muted">No line items yet. Add material or labour.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDrafts((rows) => [...rows, emptyLine("material")])}>
          <Plus size={16} /> Material
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setDrafts((rows) => [...rows, emptyLine("labour", labourRate)])}
        >
          <Plus size={16} /> Labour
        </button>
      </div>
      <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
        {documentId ? (
          <>
            <div className="flex justify-between">
              <dt>{subtotalLabel}</dt>
              <dd>{cad(totals.subtotal)}</dd>
            </div>
            {showTax ? (
              <div className="flex justify-between text-muted">
                <dt>
                  {taxLabel} ({Math.round(taxRate * 1000) / 10}%)
                </dt>
                <dd>{cad(totals.tax)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{cad(totals.total)}</dd>
            </div>
          </>
        ) : (
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt>Unbilled</dt>
            <dd>{cad(totals.subtotal)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function LineEditor({
  lines,
  onChange,
  taxRate,
  taxLabel,
  labourRate,
  markupPct = 0,
  persist,
}: {
  lines: DraftLine[];
  onChange?: (lines: DraftLine[]) => void;
  taxRate: number;
  taxLabel: string;
  labourRate: number;
  markupPct?: number;
  persist?: {
    jobId: string;
    documentId?: string;
    lockedIds?: string[];
  };
}) {
  if (persist) {
    return (
      <PersistLineEditor
        lines={lines}
        taxRate={taxRate}
        taxLabel={taxLabel}
        labourRate={labourRate}
        jobId={persist.jobId}
        documentId={persist.documentId}
        lockedIds={persist.lockedIds}
      />
    );
  }
  if (!onChange) return null;
  return (
    <ControlledLineEditor
      lines={lines}
      onChange={onChange}
      taxRate={taxRate}
      taxLabel={taxLabel}
      labourRate={labourRate}
      markupPct={markupPct}
    />
  );
}

function ControlledLineEditor({
  lines,
  onChange,
  taxRate,
  taxLabel,
  labourRate,
  markupPct = 0,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  taxRate: number;
  taxLabel: string;
  labourRate: number;
  markupPct?: number;
}) {
  const totals = useMemo(() => computeTotals(lines, taxRate), [lines, taxRate]);
  const useMarkup = markupPct > 0;

  function update(id: string, patch: Partial<DraftLine>) {
    onChange(lines.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function usesCost(line: DraftLine) {
    return useMarkup && line.kind === "material" && line.cost !== undefined;
  }

  return (
    <div className="space-y-3">
      {useMarkup ? (
        <p className="text-sm text-muted">
          Material cost is marked up {markupPct}% from Settings. The client price is what they pay.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-paper text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Unit</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id} className="border-t border-line bg-card/50">
                <td className="px-2 py-2">
                  <select
                    className="input"
                    aria-label={`Line ${index + 1} type`}
                    value={line.kind}
                    onChange={(e) => {
                      const kind = e.target.value as LineKind;
                      if (kind === "material" && useMarkup) {
                        const cost = Number(line.unitPrice) || 0;
                        update(line.id, {
                          kind,
                          unit: line.unit === "hr" ? "ea" : line.unit,
                          cost,
                          unitPrice: applyMarkup(cost, markupPct),
                        });
                        return;
                      }
                      const next: Partial<DraftLine> = {
                        kind,
                        unit: kind === "labour" ? "hr" : line.unit === "hr" ? "ea" : line.unit,
                        unitPrice: kind === "labour" && !line.unitPrice ? labourRate : line.unitPrice,
                      };
                      if (line.cost !== undefined) next.cost = undefined;
                      update(line.id, next);
                    }}
                  >
                    <option value="material">Material</option>
                    <option value="labour">Labour</option>
                    <option value="other">Other</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    className="input"
                    aria-label={`Line ${index + 1} description`}
                    value={line.description}
                    onChange={(e) => update(line.id, { description: e.target.value })}
                    placeholder={line.kind === "labour" ? "Install valve, rough-in" : "1/2 in PEX pipe"}
                  />
                </td>
                <td className="w-24 px-2 py-2">
                  <input
                    className="input"
                    aria-label={`Line ${index + 1} quantity`}
                    type="number"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => update(line.id, { quantity: Number(e.target.value) })}
                  />
                </td>
                <td className="w-20 px-2 py-2">
                  <input
                    className="input"
                    aria-label={`Line ${index + 1} unit`}
                    value={line.unit}
                    onChange={(e) => update(line.id, { unit: e.target.value })}
                  />
                </td>
                <td className="w-28 px-2 py-2">
                  {usesCost(line) ? (
                    <div>
                      <input
                        className="input"
                        aria-label={`Line ${index + 1} cost`}
                        type="number"
                        step="0.01"
                        value={line.cost}
                        onChange={(e) => {
                          const cost = Number(e.target.value);
                          update(line.id, { cost, unitPrice: applyMarkup(cost, markupPct) });
                        }}
                      />
                      <p className="mt-1 text-[11px] leading-tight text-muted">
                        +{markupPct}% → {cad(line.unitPrice)}
                      </p>
                    </div>
                  ) : (
                    <input
                      className="input"
                      aria-label={`Line ${index + 1} unit price`}
                      type="number"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => update(line.id, { unitPrice: Number(e.target.value) })}
                    />
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">{cad(lineTotal(line))}</td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-muted hover:bg-paper hover:text-accent"
                    onClick={() => onChange(lines.filter((row) => row.id !== line.id))}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lines.length === 0 ? <p className="text-sm text-muted">No line items yet. Add material or labour.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onChange([...lines, emptyLine("material", 0, useMarkup ? 0 : undefined)])}
        >
          <Plus size={16} /> Material
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onChange([...lines, emptyLine("labour", labourRate)])}
        >
          <Plus size={16} /> Labour
        </button>
      </div>
      <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between text-muted">
          <dt>Materials</dt>
          <dd>{cad(totals.materials)}</dd>
        </div>
        <div className="flex justify-between text-muted">
          <dt>Labour</dt>
          <dd>{cad(totals.labour)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{cad(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between text-muted">
          <dt>
            {taxLabel} ({Math.round(taxRate * 1000) / 10}%)
          </dt>
          <dd>{cad(totals.tax)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd>{cad(totals.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
