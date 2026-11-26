import { ZodError } from "zod";
import { ACTION_ERROR_MESSAGES, codeFromServiceError } from "@/lib/action-errors";
import { jsonError } from "@/lib/http/json-error";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/services/context";

/** The web's error wording for a typed service error. Anything else is rethrown. */
export function serviceErrorResponse(error: unknown): Response {
  if (error instanceof NotFoundError) {
    return jsonError("not_found", ACTION_ERROR_MESSAGES[codeFromServiceError(error)], 404);
  }
  if (error instanceof ValidationError || error instanceof ConflictError) {
    const code = codeFromServiceError(error);
    return jsonError(code, ACTION_ERROR_MESSAGES[code], error instanceof ConflictError ? 409 : 400);
  }
  throw error;
}

/** For Plan cards, whose service messages are written for the contractor and shown as they are on the web. */
export function planErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) return jsonError("invalid", "Check the details and try again.", 400);
  if (error instanceof ValidationError || error instanceof ConflictError) {
    return jsonError(codeFromServiceError(error), error.message, error instanceof ConflictError ? 409 : 400);
  }
  return serviceErrorResponse(error);
}
