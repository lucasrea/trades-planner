import { API_URL } from "./config";

export type PlanPreviewLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  note?: string | null;
};

export type PlanPreview = {
  title: string;
  jobTitle?: string | null;
  clientName?: string | null;
  siteAddress?: string | null;
  notes?: string | null;
  lines: PlanPreviewLine[];
  warnings?: string[];
  blockers?: string[];
  canConfirm: boolean;
};

export type TextCaptureResult = {
  captureId: string;
  status: "needs_review" | "failed";
  preview: PlanPreview | null;
  transcript?: string | null;
  reply?: string | null;
};

export type ConfirmResult =
  | { kind: "job"; jobId: string }
  | { kind: "document"; documentId: string }
  | { kind: "log"; jobIds: string[] }
  | { kind: "done"; message: string };

async function parseJson(res: Response) {
  const body = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(body.error?.message ?? "Request failed.");
  }
  return body;
}

export async function exchangeGoogleIdToken(idToken: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/mobile/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const body = (await parseJson(res)) as { token: string };
  return body.token;
}

export async function sendTextCapture(bearer: string, text: string): Promise<TextCaptureResult> {
  const res = await fetch(`${API_URL}/api/v1/captures/text`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ text }),
  });
  return (await parseJson(res)) as TextCaptureResult;
}

export async function confirmCapture(bearer: string, captureId: string): Promise<ConfirmResult> {
  const res = await fetch(`${API_URL}/api/v1/captures/${captureId}/confirm`, {
    method: "POST",
    headers: { authorization: `Bearer ${bearer}` },
  });
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
  }[];
  contractor: {
    taxRate: number;
    taxLabel: string;
    labourRateHourly: number;
    businessName: string;
  } | null;
};

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
};

async function bearerGet<T>(bearer: string, path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: { authorization: `Bearer ${bearer}` } });
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
