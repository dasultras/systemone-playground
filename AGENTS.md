<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Befehle

- `npm run dev` startet den Dev-Server auf :3000.
- `npm run check` prüft Typen (tsc), Lint (OxLint) und Format (Prettier); `npm run fix` behebt Lint/Format.
- `docker compose up` startet das veröffentlichte Image von ghcr.io (`compose.yml`).
- `docker compose -f compose.yml -f compose.dev.yml up --build` baut das Image lokal (`compose.dev.yml` ergänzt nur `build`).
- Ollama läuft in beiden Fällen nativ auf dem Host, der Container erreicht es über `host.docker.internal:11434`.
- Images gehen nur bei Tags `v*.*.*` oder manuellem Dispatch nach ghcr.io.
