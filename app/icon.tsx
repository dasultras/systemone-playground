import { iconResponse } from "@/components/s1-icon";

// Tab-Icon und Manifest-Icons, erreichbar unter /icon/<größe>.
const SIZES = [32, 192, 512];

export function generateImageMetadata() {
  return SIZES.map((s) => ({ id: String(s), size: { width: s, height: s }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  return iconResponse(Number(await id), "tile");
}
