import { iconResponse } from "@/components/s1-icon";

// Maskable-Icons nur fürs Manifest, deshalb kein icon.tsx (das würde sie als Tab-Icon verlinken).
const SIZES = new Set(["192", "512"]);

export async function GET(_req: Request, ctx: RouteContext<"/maskable-icon/[size]">) {
  const { size } = await ctx.params;
  return SIZES.has(size) ? iconResponse(Number(size), "full") : new Response(null, { status: 404 });
}
