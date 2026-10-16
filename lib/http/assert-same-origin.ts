export function assertSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "same-site") {
    throw new Response(JSON.stringify({ error: { code: "forbidden", message: "Cross-origin request blocked." } }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
}
