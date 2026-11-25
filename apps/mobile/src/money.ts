export function formatCad(amount: number) {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return `$${rounded.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}