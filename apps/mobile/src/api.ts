import { File, UploadType } from "expo-file-system";
import { API_URL } from "./config";
import { expireSession } from "./session";

export type PlanPreviewLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  note?: string | null;
};

export type PlanPreview = {
  action: string;
  title: string;
  jobId?: string | null;
  jobTitle?: string | null;
  jobIsNew?: boolean;
  clientName?: string | null;
  clientIsNew?: boolean;
  siteAddress?: string | null;
  notes?: string | null;
  lines: PlanPreviewLine[];
  warnings?: string[];
  blockers?: string[];
  canConfirm: boolean;
  /** Change cards only: one row per thing that changes. */
  changes?: { label: string; value: string }[];
};

export type PlanLineEdit = Pick<PlanPreviewLine, "description" | "quantity" | "unit" | "unitPrice">;

export type TextCaptureResult = {
  captureId: string;
  status: "needs_review" | "failed";
  preview: PlanPreview | null;
  transcript?: string | null;
  reply?: string | null;
  planId?: string | null;
  cards?: { captureId: string; title: string; preview: PlanPreview }[];
};

export type ConfirmResult =
  | { kind: "job"; jobId: string }
  | { kind: "document"; documentId: string }
  | { kind: "log"; jobIds: string[] }
  | { kind: "done"; message: string; href: string };

async function parseJson(res: Response) {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok || !body) {
    throw new Error(body?.error?.message ?? "Request failed.");
  }
  return body;
}

/** Every signed-in request goes through here, so that any 401 ends the session. */
async function bearerFetch(
  bearer: string,
  path: string,
  init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> } = {},
) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${bearer}` },
  });
  if (res.status === 401) {
    await expireSession(bearer);
    throw new Error("Your session ended. Log in again.");
  }
  return res;
}

export type SignInProvider = "google" | "apple";

export async function exchangeIdToken(provider: SignInProvider, idToken: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/mobile/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider, idToken }),
  });
  const body = (await parseJson(res)) as { token: string };
  return body.token;
}

/** Log out on the server. Not through bearerFetch: a session that is already gone is fine here. */
export async function revokeSession(bearer: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`${API_URL}/api/mobile/session`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${bearer}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendTextCapture(
  bearer: string,
  text: string,
  options?: { planId?: string; jobId?: string },
): Promise<TextCaptureResult> {
  const res = await bearerFetch(bearer, "/api/v1/captures/text", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, planId: options?.planId, jobId: options?.jobId }),
  });
  return (await parseJson(res)) as TextCaptureResult;
}

export async function listPlans(bearer: string) {
  const body = await bearerGet<{ plans: import("./plans").PlanSummary[] }>(bearer, "/api/v1/plans");
  return body.plans;
}

export type PlanThreadPayload = {
  id: string;
  title: string;
  jobTitle: string | null;
  jobId: string | null;
  messages: import("./plans").PlanThreadMessage[];
};

export async function fetchPlanThread(bearer: string, planId: string) {
  return bearerGet<PlanThreadPayload>(bearer, `/api/v1/plans/${encodeURIComponent(planId)}/thread`);
}

export async function confirmCapture(bearer: string, captureId: string): Promise<ConfirmResult> {
  const res = await bearerFetch(bearer, `/api/v1/captures/${captureId}/confirm`, { method: "POST" });
  return (await parseJson(res)) as ConfirmResult;
}

export type JobListItem = {
  id: string;
  title: string;
  status: string;
  siteAddress: string | null;
  updatedAt: number;
  client: { name: string } | null;
  unbilledTotal: number;
};

export type JobSummary = {
  id: string;
  title: string;
  status: string;
  siteAddress: string | null;
  notes: string | null;
  client: { id: string; name: string } | null;
};

export type JobWorkspace = {
  tracked: {
    id: string;
    kind: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
    billedDocumentId: string | null;
  }[];
  documents: {
    id: string;
    type: string;
    status: string;
    number: string;
    total: number;
    dueDate: string | null;
    canInvoice: boolean;
  }[];
  contractor: {
    taxRate: number;
    taxLabel: string;
    labourRateHourly: number;
    businessName: string;
  } | null;
};

export type DocumentStatusChange = "sent" | "approved" | "declined" | "paid";

export type DocumentListItem = {
  id: string;
  type: string;
  status: string;
  number: string;
  total: number;
  dueDate: string | null;
  validUntil: string | null;
  updatedAt: number;
  client: { name: string } | null;
  job: { id: string; title: string } | null;
};

export type DocumentDetail = {
  id: string;
  jobId: string;
  type: string;
  status: string;
  number: string;
  notes: string;
  validUntil: string | null;
  dueDate: string | null;
  subtotal: number;
  tax: number;
  total: number;
  client: { name: string; email: string } | null;
  job: { id: string; title: string } | null;
  lines: {
    id: string;
    kind: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }[];
  /** What the web offers for this type and status (`lib/documents.ts`). */
  actions: string[];
  canShare: boolean;
  /** The invoice already made from an approved quote. */
  invoiceId: string | null;
};

async function bearerGet<T>(bearer: string, path: string): Promise<T> {
  const res = await bearerFetch(bearer, path);
  return (await parseJson(res)) as T;
}

export async function listJobs(bearer: string) {
  const body = await bearerGet<{ jobs: JobListItem[] }>(bearer, "/api/v1/jobs");
  return body.jobs;
}

export async function fetchJobSummary(bearer: string, jobId: string) {
  const body = await bearerGet<{ job: JobSummary }>(bearer, `/api/v1/jobs/${jobId}`);
  return body.job;
}

export async function fetchJobWorkspace(bearer: string, jobId: string) {
  return bearerGet<JobWorkspace>(bearer, `/api/v1/jobs/${jobId}/workspace`);
}

export async function listDocuments(bearer: string, filter?: { type?: "quote" | "invoice" }) {
  const params = new URLSearchParams();
  if (filter?.type) params.set("type", filter.type);
  const query = params.toString();
  const body = await bearerGet<{ documents: DocumentListItem[] }>(
    bearer,
    `/api/v1/documents${query ? `?${query}` : ""}`,
  );
  return body.documents;
}

export async function fetchDocument(bearer: string, documentId: string) {
  const body = await bearerGet<{ document: DocumentDetail }>(bearer, `/api/v1/documents/${documentId}`);
  return body.document;
}

async function bearerSend<T>(bearer: string, method: "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const res = await bearerFetch(bearer, path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await parseJson(res)) as T;
}

export async function setDocumentStatus(bearer: string, documentId: string, status: DocumentStatusChange) {
  await bearerSend(bearer, "POST", `/api/v1/documents/${encodeURIComponent(documentId)}/status`, { status });
}

export async function createShareLink(bearer: string, documentId: string) {
  const body = await bearerSend<{ url: string }>(bearer, "POST", `/api/v1/documents/${encodeURIComponent(documentId)}/share`);
  return body.url;
}

export async function invoiceQuote(bearer: string, quoteId: string) {
  const body = await bearerSend<{ documentId: string }>(bearer, "POST", `/api/v1/documents/${encodeURIComponent(quoteId)}/invoice`);
  return body.documentId;
}

export async function invoiceTrackedLines(bearer: string, jobId: string) {
  const body = await bearerSend<{ documentId: string }>(bearer, "POST", `/api/v1/jobs/${encodeURIComponent(jobId)}/invoice`);
  return body.documentId;
}

export async function cancelCapture(bearer: string, captureId: string) {
  await bearerSend(bearer, "POST", `/api/v1/captures/${encodeURIComponent(captureId)}/cancel`);
}

export async function updateCaptureLines(bearer: string, captureId: string, lines: PlanLineEdit[]) {
  const body = await bearerSend<{ preview: PlanPreview | null }>(
    bearer,
    "PATCH",
    `/api/v1/captures/${encodeURIComponent(captureId)}/lines`,
    { lines },
  );
  return body.preview;
}

/** Multipart upload of a local file. The native uploader lets us name the MIME type the server checks. */
async function bearerUpload<T>(
  bearer: string,
  path: string,
  file: { uri: string; fieldName: string; mimeType: string },
  fields: Record<string, string | null | undefined>,
): Promise<T> {
  const parameters: Record<string, string> = {};
  for (const [name, value] of Object.entries(fields)) if (value) parameters[name] = value;
  let result: { status: number; body: string };
  try {
    result = await new File(file.uri).upload(`${API_URL}${path}`, {
      uploadType: UploadType.MULTIPART,
      fieldName: file.fieldName,
      mimeType: file.mimeType,
      parameters,
      headers: { authorization: `Bearer ${bearer}` },
      // A background session may resend on its own, which would read the same message twice.
      sessionType: "foreground",
    });
  } catch {
    throw new Error("Couldn't upload. Check your connection and try again.");
  }
  // The native uploader can't go through bearerFetch, so it ends the session on a 401 the same way.
  if (result.status === 401) {
    await expireSession(bearer);
    throw new Error("Your session ended. Log in again.");
  }
  return (await parseJson(new Response(result.body, { status: result.status }))) as T;
}

export async function sendVoiceCapture(bearer: string, uri: string, options: { planId?: string; jobId?: string }) {
  return bearerUpload<TextCaptureResult>(
    bearer,
    "/api/v1/captures/voice",
    { uri, fieldName: "audio", mimeType: "audio/m4a" },
    options,
  );
}

export type ReceiptSent = { captureId: string; status: "needs_review" | "failed"; planId: string | null };

export async function sendReceiptCapture(
  bearer: string,
  uri: string,
  options: { planId?: string; jobId?: string; note?: string },
) {
  return bearerUpload<ReceiptSent>(
    bearer,
    "/api/v1/captures/receipt",
    { uri, fieldName: "image", mimeType: "image/jpeg" },
    options,
  );
}

export type ReceiptReview = {
  status: string;
  error: string | null;
  imageUrl: string | null;
  vendor: string | null;
  purchasedAt: string | null;
  note: string | null;
  markupPct: number;
  lines: { description: string; quantity: number; cost: number; price: number; jobId: string | null }[];
  jobs: { id: string; title: string }[];
  clients: { id: string; name: string }[];
};

export async function fetchReceiptReview(bearer: string, captureId: string) {
  const body = await bearerGet<{ receipt: ReceiptReview }>(bearer, `/api/v1/captures/${encodeURIComponent(captureId)}/receipt`);
  return body.receipt;
}

export type ReceiptConfirmInput = {
  lines: {
    kind: "material";
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    unitPrice: number;
    jobId: string;
  }[];
  newJobs: { key: string; title: string; client: { id: string } | { name: string } }[];
};

export async function confirmReceipt(bearer: string, captureId: string, input: ReceiptConfirmInput) {
  return bearerSend<{ jobIds: string[] }>(
    bearer,
    "POST",
    `/api/v1/captures/${encodeURIComponent(captureId)}/receipt-confirm`,
    input,
  );
}

export async function listOpenJobs(bearer: string) {
  const body = await bearerGet<{ jobs: JobListItem[] }>(bearer, "/api/v1/jobs?open=1");
  return body.jobs;
}

