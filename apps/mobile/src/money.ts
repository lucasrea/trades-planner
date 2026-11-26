/** Markup comes from the web's money module, so a receipt prices the same on both. */
export { applyMarkup } from "../../web/lib/money";

export function formatCad(amount: number) {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return `$${rounded.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}