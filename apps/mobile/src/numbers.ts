/** A typed amount. Empty is null; anything that isn't a number is NaN. Accepts "1,200.50" and "12,5". */
export function parseAmount(text: string): number | null {
  const trimmed = text.replace(/[\s$]/g, "");
  if (!trimmed) return null;
  const plain = /^\d+,\d{1,2}$/.test(trimmed) ? trimmed.replace(",", ".") : trimmed.replace(/,/g, "");
  return /^(\d+\.?\d*|\.\d+)$/.test(plain) ? Number(plain) : Number.NaN;
}
