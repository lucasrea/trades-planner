export const quoteStatuses = ["draft", "sent", "approved", "declined"] as const;
export const invoiceStatuses = ["draft", "sent", "paid", "overdue"] as const;
export const jobStatuses = ["quoted", "active", "completed", "archived"] as const;

export function statusClass(status: string) {
  switch (status) {
    case "approved":
    case "paid":
    case "active":
    case "completed":
      return "bg-lime-100 text-ok";
    case "sent":
    case "quoted":
      return "bg-sky-100 text-navy";
    case "declined":
    case "overdue":
    case "archived":
      return "bg-orange-100 text-accent";
    default:
      return "bg-stone-100 text-muted";
  }
}

export function statusLabel(status: string) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : status;
}
