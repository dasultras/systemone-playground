import { connection } from "next/server";
import { Suspense } from "react";
import { Playground } from "@/components/playground";
import { loadPresets } from "@/lib/presets";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <WithPresets />
    </Suspense>
  );
}

/** Liest die Vorlagen pro Request, nicht beim Build; so greift eine eingehängte Datei im Container. */
async function WithPresets() {
  await connection();
  return <Playground presets={await loadPresets()} />;
}
