# System One Playground

Sandbox-UI zum Testen von System-One-Modellen: TypeSafe Jev (gehostet) und lokale Modelle über Ollama oder vLLM,
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

## Vorlagen

Vorlagen liegen als JSON-Datei vor, ein Zod-Schema in [`lib/presets.ts`](lib/presets.ts) prüft sie beim Laden. Der
Server liest die Datei aus `PRESETS_FILE` (Standard [`config/presets.default.json`](config/presets.default.json) mit
einer einzigen Vorlage). Ist sie fehlerhaft oder fehlt sie, gilt der Standard. Ab zwei Vorlagen zeigt die Eingabe das
Menü „Vorlage laden“. [`examples/presets.example.json`](examples/presets.example.json) zeigt alle Fragetypen und ein
Bündel mit Regel, z. B. mit `PRESETS_FILE=examples/presets.example.json` in `.env`. Im Container hängt `compose.yml`
die Datei per Volume ein (dort auskommentiert).

## Evaluation

`npm run eval -- --limit 2` ist ein Smoke-Lauf, `npm run eval` der volle Lauf (600 synthetische Items, lokal roh und
gemittelt) gegen den laufenden Server (`--base-url`, Standard `:3100`). Antworten liegen je Frage-Hash in
`eval/out/raw/` (Resume; geänderte Fragen werden neu geholt), Bericht in `eval/out/report.md`. Modelle über `--models`
mit Präfix (Standard `ollama:elephant-1:9b-q4-ctx8k`), `typesafe:`-Modelle nur mit `EVAL_ALLOW_TYPESAFE=1`, die
Daten sind synthetisch.

## Kompatible Backends

Kompatibel mit jedem Server, der das System-One-Schema (`/v1/systemone`) spricht, angebunden über die Base-URL. Ollama
ist standardmäßig aktiv (`localhost:11434`, leeres `OLLAMA_BASE_URL` schaltet es ab), vLLM und TypeSafe nur mit gesetzter
Env (`VLLM_BASE_URL`, `TYPESAFE_API_KEY`). `GET /api/models`
listet die Modelle mit Präfix (`ollama:`, `vllm:`, `typesafe:`), 30 s gecacht, Ollama nur mit Capability `decision`.
`DEFAULT_MODEL` wählt das Startmodell vor.

- **TypeSafe** (`api.typesafe.ai`), gehostet
- **[Ollama](https://docs.ollama.com/api/systemone)** (`localhost:11434`), lokal
- **[vLLM](https://docs.vllm.ai/en/latest/models/structured_decisions_models/#example)** (`localhost:8000`): Start mit
  `--logprobs-mode raw_logprobs`, max. 64 Fragen pro Request, unbekannte Felder geben 400.

Bekannte System-One-Modelle stehen in [`config/models.json`](config/models.json) (Pull-Referenz, Label, Größe). Was davon
in Ollama fehlt, zeigt die Modellwahl unter „Bekannt, nicht installiert“. Mit `ALLOW_PULL=1` lädt ein Button das Modell
über `POST /api/models/pull` (Fortschritt als NDJSON), sonst steht dort der Befehl `ollama pull <name>` zum Kopieren.
Pullen belegt Plattenplatz auf dem Host.

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
