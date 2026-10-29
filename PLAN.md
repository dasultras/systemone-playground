# System One Playground

Sandbox-UI zum Testen von System-One-Modellen: TypeSafe Jev (gehostet) und lokale Modelle über Ollama oder vLLM, nebeneinander. Clean, im Apple-Stil.

## Stack

- **Next.js 16** (App Router, TypeScript), **Node 24**, npm
- Tailwind CSS v4, shadcn/ui (base-ui), Motion
- React Hook Form + Zod, TanStack Query
- `@typesafe-ai/sdk` für alle Backends
- Persistenz nur im Browser (`localStorage`)
- OxLint + Prettier (Tailwind-Plugin), `npm run check` / `npm run fix`
- Docker (`standalone`, `node:24-slim`), GitHub Actions → ghcr.io (amd64 + arm64)

## Architektur

```
UI ── GET /api/models ──▶ Registry (30-s-Cache) ──▶ Ollama /api/tags + /api/show, vLLM /v1/models, TypeSafe statisch
   ── POST /api/run ──▶ Route Handler (Guard) ──▶ TypeSafeClient
                                                   ├─ TypeSafe  https://api.typesafe.ai
                                                   ├─ Ollama    OLLAMA_BASE_URL (/v1/systemone)
                                                   └─ vLLM      VLLM_BASE_URL (/v1/systemone)
                         ◀── answers + metrics + usage + latency + raw request/response
```

- Ollama und vLLM sprechen nativ das Jev-Schema. Deshalb dient ein SDK-Client für alle Backends, nur die Konfiguration unterscheidet sich:
  - **TypeSafe:** `TYPESAFE_API_KEY`, Timeout 30 s.
  - **Ollama, vLLM:** `baseURL`, Dummy-Key, `compression: false`, Timeout 120 s, `maxRetries: 0`.
- **Modelle frei wählbar:** IDs tragen das Backend als Präfix, z. B. `ollama:elephant-1:9b-q4-ctx8k`, `vllm:<name>`, `typesafe:jev-latest`.
  - `GET /api/models` listet je aktivem Backend (Ollama standardmäßig, leeres `OLLAMA_BASE_URL` schaltet es ab; vLLM/TypeSafe nur mit Env): Ollama nur mit Capability `decision` (Limit aus `num_ctx`, sonst `*.context_length`), vLLM mit `max_model_len`, TypeSafe statisch und nur mit Key (kein API-Aufruf).
  - Nicht erreichbare Backends stehen in `errors`, die Route scheitert nie. Cache 30 s, `?refresh` lädt neu.
  - Bekannte Modelle aus `config/models.json`, die Ollama nicht hat (Name oder `parent_model`), stehen in `known` („Bekannt, nicht installiert“).
  - `POST /api/models/pull` leitet an Ollama `/api/pull` weiter und streamt den Fortschritt; nur mit `ALLOW_PULL=1`, sonst 403 und der Befehl `ollama pull` zum Kopieren.
  - `/api/run` prüft die ID gegen diese Liste. Standard: `DEFAULT_MODEL`, sonst das erste Ollama-Modell.
  - Verlaufseinträge mit entfernten Modellen laden weiter; alte IDs ohne Präfix gelten als Ollama (`jev-latest` als TypeSafe).
- Den Key liest nur Server-Code (`server-only`), er bekommt nie das Präfix `NEXT_PUBLIC_`.
- Der Guard enthält ein Rate-Limit, ein Tagesbudget für TypeSafe, das Größenlimit und `AbortSignal`-Timeouts.

## Fragen & Anzeige

| Typ                    | Antwort                               | Anzeige                                               |
| ---------------------- | ------------------------------------- | ----------------------------------------------------- |
| Choice (≤ 10 Optionen) | Verteilung über Optionen              | Balken mit Linie bei 1/K, `confidence`, Margin, Ampel |
| Noul                   | P(wahr)                               | Band 0,3–0,7 = "unklar"                               |
| Score (2–10 Level)     | Verteilung über Level, Erwartungswert | volle Verteilung, Modus, Hinweis bei zwei Gipfeln     |

- **Kennzahlen** berechnet `lib/metrics.ts` selbst, einheitlich für alle Modelle:
  - `confidence = (p_max − 1/K) / (1 − 1/K)` (TypeSafe-Definition).
  - Margin = p1 − p2.
  - Ampel grün bei `confidence ≥ 0,6` und Margin ≥ 0,3, rot bei `< 0,25` oder Margin < 0,1, sonst gelb.
- **Detailansicht:** normierte Entropie, Tokens, Latenz, Modell-ID, Raw-Payload.
- **Reihenfolge mitteln** (optional): 2–4 zyklische Verschiebungen der Optionen im selben Request, gegen Positions-Bias.
- **Vergleich:** Derselbe Request mit demselben Fragenbündel geht an mehrere Modelle.
- **Modellfarben** folgen deterministisch aus der ID (sechs Tokens `--model-1` bis `--model-6`).

## Leitplanken

- **Fragen atomar stellen**, die Entscheidung trifft der Code. Also "Erwähnt die Nachricht eine Rückerstattung?" statt "Soll das Ticket an die Abrechnung?".
- **Fakten berechnet der Code** und legt sie in den State, z. B. `days_since_order`. Die Modelle kennen das heutige Datum nicht.
- **State kürzen** statt den Kontext zu vergrößern:
  - Vorlagen enthalten nur die relevanten Felder.
  - `lib/limits.ts` schätzt die Tokens (Zeichen / 2,6) gegen das Kontextlimit aus `/api/models`, bei TypeSafe 64k.
- **Fehler bleiben Fehler**, z. B. Timeout oder Overflow-400. Sie werden nie als Antwort angezeigt.
- **Logs nur mit Metadaten**, ohne State-Inhalt. Next-Telemetrie aus.
- **TypeSafe nur mit synthetischen Daten** (US-Hosting). Die UI zeigt dort einen Hinweis.

## Stand

Schritte 1–7 umgesetzt:

- UI mit editierbarem Titel, Vergleich mehrerer Modelle, Reihenfolge mitteln, Request-Inspektor.
- Vorlagen als JSON-Datei (`PRESETS_FILE`, Standard `config/presets.default.json`), geprüft per Zod-Schema; Menü „Vorlage laden“ erst ab zwei Vorlagen.
- Historie in `localStorage` (höchstens 50 Läufe), Export als JSON/CSV.
- Fehlerzustände je Modell mit Wiederholen, Dark Mode (System/Hell/Dunkel), Mobile, dezente Animationen.
- Modellwahl dynamisch über `/api/models` (Ollama, vLLM, TypeSafe), bekannte Modelle aus `config/models.json` mit Pull
  aus der UI (`ALLOW_PULL=1`), Startmodell per `DEFAULT_MODEL`.
- `/api/models`, `/api/models/pull`, `/api/run`, `/api/health`, Docker, CI nach GHCR.
- Unit-Tests (`npm test`) für Kennzahlen, Vorlagen, Historie, Modell-IDs und Pull-Stream.
- Evaluation (`npm run eval`, `eval/`, Kennzahlen in `lib/calibration.ts`):
  - 600 synthetische, gelabelte Items (120 States × 5 Fragen, leicht/schwer), Split 200/400 nach States.
  - Brier, NLL, ECE, Risk-Coverage/AURC, Cluster-Bootstrap-KI, Temperature Scaling auf dem Kalibrierungs-Split.
  - Ergebnisse unter `eval/out/` (nicht im Repo), Cache pro Frage, Läufe setzen fort.
  - `typesafe:`-Modelle nur mit `EVAL_ALLOW_TYPESAFE=1`.

## Offen

- Eval-Items sind zu leicht: elephant liegt auf dem Test-Split bei 98,5 % Accuracy, AURC ≈ 0,001. Schwere Varianten verraten die Antwort über eindeutige Hinweise im State. Sie müssen härter werden, danach ist ein neuer Lauf nötig.
- Eval-Läufe: elephant gemittelt ×3 ist erst zu 50 von 120 States fertig. clef-flash steht noch aus, der Vergleich mit Jev ebenfalls (nur mit Freigabe).
- Latenzen für die Arbeit in Ruhe messen: ein Modell geladen, State pro Lauf variieren (clef-flash cached identische Requests).
