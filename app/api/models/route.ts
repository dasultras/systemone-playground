import { listModels } from "@/lib/registry";

// `req.url` lesen hält die Route request-time (Cache Components); `?refresh` umgeht den 30-s-Cache.
export async function GET(req: Request) {
  return Response.json(await listModels(new URL(req.url).searchParams.has("refresh")));
}
