import { applyMarkup, lineTotal, roundMoney, type DraftLine, type LineKind } from "@/lib/money";

export const jobCostKinds = ["material", "expense", "labour"] as const;
export type JobCostKind = (typeof jobCostKinds)[number];

export type JobCostInput = {
  kind: JobCostKind;
  description: string;
  quantity: number;
  unit: string;
  cost: number;
  unitPrice: number;
};

export function jobCostToInvoiceKind(kind: JobCostKind): LineKind {
  return kind === "expense" ? "other" : kind;
}

export function defaultSellPrice(
  kind: JobCostKind,
  cost: number,
  {
    markupPct,
    labourRate,
    applyMarkup: shouldMarkup,
  }: { markupPct: number; labourRate: number; applyMarkup: boolean },
) {
  if (kind === "labour") return roundMoney(Number(cost) > 0 ? cost : labourRate);
  if (shouldMarkup) return applyMarkup(cost, markupPct);
  return roundMoney(Number(cost) || 0);
}

export function jobCostToDraftLine(cost: JobCostInput & { id?: string }): DraftLine {
  return {
    id: cost.id || "",
    kind: jobCostToInvoiceKind(cost.kind),
    description: cost.description.trim(),
    quantity: Number(cost.quantity) || 0,
    unit: cost.unit.trim() || "ea",
    unitPrice: roundMoney(Number(cost.unitPrice) || 0),
  };
}

export function jobCostLineTotal(cost: Pick<JobCostInput, "quantity" | "unitPrice">) {
  return lineTotal({
    id: "",
    kind: "material",
    description: "",
    quantity: cost.quantity,
    unit: "ea",
    unitPrice: cost.unitPrice,
  });
}
