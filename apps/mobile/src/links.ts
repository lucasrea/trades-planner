import type { ConfirmResult } from "./api";

/** Where to go after a card is confirmed: the job or document it wrote. Null stays in Plan. */
export function confirmedScreen(result: ConfirmResult): string | null {
  if (result.kind === "document") return `/documents/${result.documentId}`;
  if (result.kind === "job") return `/jobs/${result.jobId}`;
  if (result.kind === "log") return result.jobIds.length === 1 ? `/jobs/${result.jobIds[0]}` : "/jobs";
  // A change card answers with a web path.
  const change = /^\/app\/(documents|jobs)\/([^/?#]+)$/.exec(result.href);
  return change ? `/${change[1]}/${change[2]}` : null;
}
