export const quoteStatuses = ["draft", "sent", "approved", "declined"] as const;
export const invoiceStatuses = ["draft", "sent", "paid", "overdue"] as const;
export const jobStatuses = ["quoted", "active", "completed", "archived"] as const;

export function isActiveJobStatus(status: string) {
  return status === "quoted" || status === "active";
}

type StatusTone = "good" | "wait" | "stop" | "draft";

function statusTone(status: string): StatusTone {
  switch (status) {
    case "approved":
    case "paid":
    case "active":
    case "done":
    case "completed":
      return "good";
    case "sent":
    case "quoted":
      return "wait";
    case "declined":
    case "overdue":
    case "archived":
      return "stop";
    default:
      return "draft";
  }
}

const chip: Record<StatusTone, string> = {
  good: "bg-[#86efac]/12 text-[#86efac] ring-1 ring-[#86efac]/30",
  wait: "bg-[#5167fc]/15 text-[#c5ceff] ring-1 ring-[#5167fc]/35",
  stop: "bg-[#fca5a5]/12 text-[#fca5a5] ring-1 ring-[#fca5a5]/30",
  draft: "bg-elevated text-muted ring-1 ring-line",
};

const dot: Record<StatusTone, string> = {
  good: "bg-[#86efac]",
  wait: "bg-[#5167fc]",
  stop: "bg-[#fca5a5]",
  draft: "bg-muted",
};

export function statusClass(status: string) {
  return chip[statusTone(status)];
}

export function statusDotClass(status: string) {
  return dot[statusTone(status)];
}

export function statusLabel(status: string) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : status;
}
