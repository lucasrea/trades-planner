export function jsonError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}
