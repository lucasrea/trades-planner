export const quoteStatuses = ["draft", "sent", "approved", "declined"] as const;
export const invoiceStatuses = ["draft", "sent", "paid", "overdue"] as const;
export const jobStatuses = ["quoted", "active", "completed", "archived"] as const;

export function isActiveJobStatus(status: string) {
  return status === "quoted" || status === "active";
}

export function statusClass(status: string) {
  switch (status) {
    case "approved":
    case "paid":
    case "active":
    case "done":
    case "completed":
      return "bg-lime-950/60 text-lime-400 ring-1 ring-lime-900/50";
    case "sent":
    case "quoted":
      return "bg-sky-950/60 text-sky-400 ring-1 ring-sky-900/50";
    case "declined":
    case "overdue":
    case "archived":
      return "bg-orange-950/60 text-orange-400 ring-1 ring-orange-900/50";
    default:
      return "bg-elevated text-muted ring-1 ring-line";
  }
}

export function statusLabel(status: string) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : status;
}
