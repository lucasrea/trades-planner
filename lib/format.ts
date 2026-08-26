export function formatDisplayDate(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return "—";
}

export function previewText(value: string | null | undefined, max = 120) {
  const text = value?.trim();
  if (!text) return "—";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}
