// Liveness-Probe für Docker/Compose. Prüft nur, dass der Server antwortet, nicht die Backends.
export function GET() {
  return Response.json({ status: "ok" });
}
