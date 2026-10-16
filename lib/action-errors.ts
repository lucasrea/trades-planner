import { ConflictError, NotFoundError, ValidationError } from "@/lib/services/context";

export const ACTION_ERROR_MESSAGES = {
  "not-found": "That item was not found or you don't have access.",
  locked: "This document is locked and can't be changed.",
  "not-draft": "Only draft invoices can be edited this way.",
  "invalid-status": "That status change isn't allowed.",
  "invalid-quote": "That document isn't a quote.",
  "quote-not-approved": "Approve the quote before creating an invoice.",
  "nothing-to-bill": "Add unbilled tracked lines before creating an invoice from them.",
  "billed-line": "Billed tracked lines can't be changed.",
  "missing-document": "Missing document.",
  invalid: "Something wasn't valid. Check the form and try again.",
  conflict: "That action couldn't be completed.",
} as const;

export type ActionErrorCode = keyof typeof ACTION_ERROR_MESSAGES;

const SERVICE_MESSAGE_TO_CODE: Record<string, ActionErrorCode> = {
  "Contractor not found.": "not-found",
  "Job not found.": "not-found",
  "Document not found.": "not-found",
  "Line not found.": "not-found",
  "Client not found.": "not-found",
  "Document is locked.": "locked",
  "Invoice is not an editable draft.": "not-draft",
  "Invalid status transition.": "invalid-status",
  "Document is not a quote.": "invalid-quote",
  "Quote must be approved.": "quote-not-approved",
  "No unbilled tracked lines on this job.": "nothing-to-bill",
  "Billed tracked line cannot be edited.": "billed-line",
  "Billed tracked line cannot be deleted.": "billed-line",
  "Line job does not match document job.": "invalid",
  "Line job does not match.": "invalid",
};

export function actionErrorCode(raw: string | undefined): ActionErrorCode | null {
  if (!raw || raw.length > 48 || !/^[a-z0-9-]+$/.test(raw)) return null;
  if (raw in ACTION_ERROR_MESSAGES) return raw as ActionErrorCode;
  return null;
}

export function actionErrorNotice(raw: string | undefined): string | null {
  const code = actionErrorCode(raw);
  return code ? ACTION_ERROR_MESSAGES[code] : null;
}

export function codeFromServiceError(error: NotFoundError | ValidationError | ConflictError): ActionErrorCode {
  if (error instanceof NotFoundError) {
    return SERVICE_MESSAGE_TO_CODE[error.message] ?? "not-found";
  }
  if (error instanceof ConflictError) {
    return SERVICE_MESSAGE_TO_CODE[error.message] ?? "conflict";
  }
  return SERVICE_MESSAGE_TO_CODE[error.message] ?? "invalid";
}
