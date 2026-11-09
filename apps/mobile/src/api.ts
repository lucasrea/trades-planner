import { API_URL } from "./config";

export type PlanPreviewLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
};

export type PlanPreview = {
  title: string;
  lines: PlanPreviewLine[];
  canConfirm: boolean;
};

export type TextCaptureResult = {
  captureId: string;
  status: "needs_review" | "failed";
  preview: PlanPreview | null;
};

export type ConfirmResult =
  | { kind: "job"; jobId: string }
  | { kind: "document"; documentId: string }
  | { kind: "log"; jobIds: string[] };

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
