export function newId() {
  return crypto.randomUUID();
}

/** Unguessable URL-safe token: 24 random bytes (192 bits), base64url, 32 chars. */
export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isTokenShape(value: string) {
  return /^[A-Za-z0-9_-]{32}$/.test(value);
}
