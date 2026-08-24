const COOKIE = "tp_session";

function secret() {
  return process.env.SESSION_SECRET || "local-dev-only-not-secret";
}

export type SessionPayload = {
  userId: string;
  contractorId: string;
  exp: number;
};

function b64url(bytes: Uint8Array) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromB64url(s: string) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replaceAll("-", "+").replaceAll("_", "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(new Uint8Array(sig));
}

export async function encodeSession(payload: Omit<SessionPayload, "exp">) {
  const body: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  };
  const data = b64url(new TextEncoder().encode(JSON.stringify(body)));
  const sig = await hmac(data);
  return `${data}.${sig}`;
}

export async function decodeSession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = await hmac(data);
  if (expected.length !== sig.length) return null;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) ok |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (ok !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(data))) as SessionPayload;
    if (!payload.userId || !payload.contractorId || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: COOKIE,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  },
};
