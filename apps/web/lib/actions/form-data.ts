import { z } from "zod";
import type { DraftLine, LineKind } from "@/lib/money";

const lineKinds = ["material", "labour", "other"] as const satisfies readonly LineKind[];

const draftLineSchema = z.object({
  id: z.string().optional().default(""),
  kind: z.enum(lineKinds).catch("material"),
  description: z.coerce.string().transform((value) => value.trim()),
  quantity: z.coerce.number().finite().catch(0),
  unit: z.coerce.string().transform((value) => value.trim() || "ea"),
  unitPrice: z.coerce.number().finite().catch(0),
});

export function formText(formData: FormData, name: string, fallback = "") {
  return String(formData.get(name) ?? fallback).trim();
}

export function formOptionalText(formData: FormData, name: string) {
  return formText(formData, name) || null;
}

export function formNumber(formData: FormData, name: string, fallback: number) {
  const raw = formText(formData, name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function formEnum<const T extends readonly [string, ...string[]]>(
  formData: FormData,
  name: string,
  values: T,
  fallback: T[number],
) {
  const value = formText(formData, name);
  return values.includes(value) ? (value as T[number]) : fallback;
}

export function parseDraftLines(raw: FormDataEntryValue | null): DraftLine[] {
  if (raw == null || String(raw).trim() === "") return [];
  try {
    const parsed = z.array(draftLineSchema).safeParse(JSON.parse(String(raw)));
    if (!parsed.success) return [];
    return parsed.data.filter((line) => line.description);
  } catch {
    return [];
  }
}

export function requireDraftLines(raw: FormDataEntryValue | null): DraftLine[] | { error: string } {
  if (raw == null || String(raw).trim() === "") {
    return { error: "Line items did not save. Refresh the page and try again." };
  }
  try {
    const parsed = z.array(draftLineSchema).safeParse(JSON.parse(String(raw)));
    if (!parsed.success) {
      return { error: "Line items are invalid. Refresh the page and try again." };
    }
    const lines = parsed.data.filter((line) => line.description);
    if (lines.length === 0) {
      return { error: "Add at least one line item with a description." };
    }
    return lines;
  } catch {
    return { error: "Line items are invalid. Refresh the page and try again." };
  }
}
