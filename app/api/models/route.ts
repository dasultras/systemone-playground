import { listModels, ollamaLoaded } from "@/lib/registry";

// `req.url` lesen hält die Route request-time (Cache Components); `?refresh` umgeht den 30-s-Cache.
// Was geladen ist, ändert sich mit jedem Lauf und kommt deshalb immer frisch dazu.
export async function GET(req: Request) {
  const [list, loaded] = await Promise.all([
    listModels(new URL(req.url).searchParams.has("refresh")),
    ollamaLoaded().catch(() => []),
  ]);
  return Response.json({ ...list, loaded });
}
