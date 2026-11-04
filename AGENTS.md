<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commands

- `npm run dev` starts the dev server on :3000.
- `npm run check` checks types (tsc), lint (OxLint) and format (Prettier); `npm run fix` fixes lint/format.
- `docker compose up` starts the published image from ghcr.io (`compose.yml`).
- `docker compose -f compose.yml -f compose.dev.yml up --build` builds the image locally (`compose.dev.yml` only adds `build`).
- In both cases Ollama runs natively on the host; the container reaches it via `host.docker.internal:11434`.
- Images are pushed to ghcr.io only on tags `v*.*.*` or manual dispatch.
