# System One Playground

Sandbox UI for testing System One models: TypeSafe Jev (hosted) and local models via Ollama or vLLM, side by side.
[MIT](LICENSE).

> **Use TypeSafe with synthetic data only** (hosted in the US). Local models run via Ollama on your own machine.

## Dev quick start

```bash
# Requirements: Node 24, Ollama (native), optionally Docker
cp .env.example .env
npm ci

# → http://localhost:3000
npm run dev
```

`npm run check` checks types, lint (OxLint) and format (Prettier), `npm run fix` fixes lint and format, `npm test` runs
the unit tests.

### Configuration

All variables are documented in [`.env.example`](.env.example); the server reads them at startup.

| Variable                  | Effect                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `OLLAMA_BASE_URL`         | Ollama instance (default `http://localhost:11434`), empty disables Ollama           |
| `VLLM_BASE_URL`           | vLLM instance, no vLLM models without it                                            |
| `TYPESAFE_API_KEY`        | TypeSafe Jev (hosted), not listed without a key                                     |
| `TYPESAFE_DAILY_REQUESTS` | Daily budget for TypeSafe runs (default 200)                                        |
| `DEFAULT_MODEL`           | Preselected model with prefix, e.g. `ollama:elephant-1:9b-q4-ctx8k`                 |
| `PRESETS_FILE`            | Presets file (default `config/presets.default.json`)                                |
| `ALLOW_PULL`              | `1` allows pulling known models from the UI (uses disk space on the host)           |

### Dev Container

There is a [Dev Container](.devcontainer/devcontainer.json) (Node 24, docker-in-docker, gh); in VS Code use "Reopen in
Container".

## Presets

Presets live in a JSON file, validated on load by a Zod schema in [`lib/presets.ts`](lib/presets.ts). The server reads
the file from `PRESETS_FILE` (default [`config/presets.default.json`](config/presets.default.json) with a single
preset). If the file is invalid or missing, the default applies. With two or more presets, the input shows a "Vorlage
laden" (load preset) menu. [`examples/presets.example.json`](examples/presets.example.json) shows all question types and
a bundle with a rule, e.g. with `PRESETS_FILE=examples/presets.example.json` in `.env`. In the container, `compose.yml`
mounts your own file to `/app/config/presets.json` via a volume and points `PRESETS_FILE` at it (both commented out
there).

## Evaluation

`npm run eval -- --limit 2` is a smoke run, `npm run eval` the full run (600 synthetic items, local raw and averaged)
against the running server (`--base-url`, default `:3100`). Answers are stored per question hash in `eval/out/raw/`
(resume; changed questions are fetched again), the report in `eval/out/report.md`. Select models with `--models` using
the prefix (default `ollama:elephant-1:9b-q4-ctx8k`); `typesafe:` models only with `EVAL_ALLOW_TYPESAFE=1`, the data is
synthetic.

## Compatible backends

Compatible with any server that speaks the System One schema (`/v1/systemone`), connected via its base URL. Ollama is
enabled by default (`localhost:11434`, an empty `OLLAMA_BASE_URL` disables it), vLLM and TypeSafe only when their env is
set (`VLLM_BASE_URL`, `TYPESAFE_API_KEY`). `GET /api/models` lists the models with prefix (`ollama:`, `vllm:`,
`typesafe:`), cached for 30 s, Ollama only with the `decision` capability. `DEFAULT_MODEL` preselects the start model.

- **TypeSafe** (`api.typesafe.ai`), hosted
- **[Ollama](https://docs.ollama.com/api/systemone)** (`localhost:11434`), local
- **[vLLM](https://docs.vllm.ai/en/latest/models/structured_decisions_models/#example)** (`localhost:8000`): start with
  `--logprobs-mode raw_logprobs`, max. 64 questions per request, unknown fields return 400.

Known System One models are listed in [`config/models.json`](config/models.json) (pull reference, label, size). Those
missing in Ollama appear in the model picker under "Bekannt, nicht installiert" (known, not installed). With
`ALLOW_PULL=1`, a button pulls the model via `POST /api/models/pull` (progress as NDJSON); only models from
`config/models.json` and same-origin requests are accepted. Otherwise the picker shows the command `ollama pull <name>`
to copy. Pulling uses disk space on the host.

## Docker

```bash
# Published image from ghcr.io
docker compose up

# Locally built image
docker compose -f compose.yml -f compose.dev.yml up --build
```

Ollama runs natively on the host (GPU/Metal); the container reaches it via `host.docker.internal:11434`.
`TYPESAFE_API_KEY` comes from `.env`; further variables (`VLLM_BASE_URL`, `DEFAULT_MODEL`, `PRESETS_FILE`,
`ALLOW_PULL`) are commented out in `compose.yml`. Health check: `GET /api/health`.

The [CI](.github/workflows/ci.yml) builds images for amd64 and arm64, only on tags `v*.*.*` or manual dispatch.

AI agents: see [AGENTS.md](AGENTS.md).
