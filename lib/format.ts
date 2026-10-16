const BUSINESS_TIME_ZONE = "America/Toronto";

type DisplayDateOptions = {
  month?: "short" | "long";
};

function formatCalendarParts(year: number, month: number, day: number, options?: DisplayDateOptions) {
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    year: "numeric",
    month: options?.month ?? "short",
    day: "numeric",
  });
}

/** Calendar date in the business timezone (YYYY-MM-DD). */
export function calendarDateInTimeZone(timeZone = BUSINESS_TIME_ZONE, at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function formatDisplayDate(
  value: string | number | null | undefined,
  options?: DisplayDateOptions,
) {
  if (value == null || value === "") return "—";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return formatCalendarParts(year, month, day, options);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toLocaleDateString("en-CA", {
      timeZone: BUSINESS_TIME_ZONE,
      year: "numeric",
      month: options?.month ?? "short",
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
