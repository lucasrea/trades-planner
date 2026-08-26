"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
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

export function LineEditor({
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
