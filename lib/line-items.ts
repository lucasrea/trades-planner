import { lineTotal as moneyLineTotal, roundMoney } from "@/lib/money";

export type LineInput = {
  kind: "labour" | "material" | "other";
  description: string;
  quantity: number;
  unit: string;
  unitCost?: number | null;
  unitPrice: number | null;
};

export type LineRow = LineInput & { unitPrice: number; lineTotal: number };

export function validateLine(line: LineInput): string[] {
  const errors: string[] = [];
  if (!line.description.trim()) errors.push("Description is required.");
  if (!(line.quantity > 0)) errors.push("Quantity must be greater than zero.");
  if (line.unitPrice == null || line.unitPrice < 0) {
    errors.push("Unit price is required and cannot be negative.");
  }
  return errors;
}

export function validateLines(lines: LineInput[]): string[] {
  return lines.flatMap((line, index) =>
    validateLine(line).map((message) => `Line ${index + 1}: ${message}`),
  );
}

export function toLineRow(line: LineInput): LineRow {
  const unitPrice = line.unitPrice ?? 0;
  return {
    ...line,
    unitPrice,
    lineTotal: moneyLineTotal({
      id: "",
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice,
    }),
  };
}

export function sumLines(rows: Pick<LineRow, "lineTotal">[]): number {
  return roundMoney(rows.reduce((sum, row) => sum + row.lineTotal, 0));
}
