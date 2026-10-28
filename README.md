# System One Playground

Sandbox-UI zum Testen von System-One-Modellen: TypeSafe Jev (gehostet) und lokale Modelle über Ollama,
nebeneinander. [MIT](LICENSE).

> **TypeSafe nur mit synthetischen Daten** (US-Hosting). Lokale Modelle laufen über Ollama auf dem eigenen Rechner.

Plan, Architektur und Leitplanken: [PLAN.md](PLAN.md).

## Schnellstart für Dev

```bash
# Voraussetzungen: Node 24, Ollama (nativ), optional Docker
cp .env.example .env
npm ci

# → http://localhost:3000
npm run dev
```

`npm run check` prüft Typen, Lint (OxLint) und Format (Prettier), `npm run fix` behebt Lint und Format.

### Dev Container

Es gibt einen [Dev Container](.devcontainer/devcontainer.json) (Node 24, docker-in-docker, gh), in VS Code
„Reopen in Container".

## Docker

```bash
# Veröffentlichtes Image von ghcr.io
docker compose up

# Lokal gebautes Image
docker compose -f compose.yml -f compose.dev.yml up --build
```

Ollama läuft nativ auf dem Host (GPU/Metal), der Container erreicht es über `host.docker.internal:11434`.
`TYPESAFE_API_KEY` kommt aus `.env`. Health-Check: `GET /api/health`.

Images baut die [CI](.github/workflows/ci.yml) für amd64 und arm64, nur bei Tags `v*.*.*` oder manuellem Dispatch.

KI-Agenten: siehe [AGENTS.md](AGENTS.md).
