# Decision Playground

Sandbox-UI zum Testen von System-One-Modellen: TypeSafe Jev (gehostet) und lokale Modelle über Ollama, nebeneinander. Clean, im Apple-Stil.

## Stack

- **Next.js 16** (App Router, TypeScript), **Node 24**, npm
- Tailwind CSS v4, shadcn/ui (base-ui), Motion
- React Hook Form + Zod, TanStack Query
- `@typesafe-ai/sdk` für beide Backends
- Persistenz nur im Browser (`localStorage`)
- Docker (`standalone`, `node:24-slim`), GitHub Actions → ghcr.io (amd64 + arm64)

## Architektur

```
UI ── POST /api/run ──▶ Route Handler (Guard) ──▶ TypeSafeClient
                                                   ├─ TypeSafe  https://api.typesafe.ai
                                                   └─ Ollama    OLLAMA_BASE_URL (/v1/systemone)
                         ◀── answers + metrics + usage + latency + raw request/response
```

- Ollama spricht nativ das Jev-Schema. Deshalb dient ein SDK-Client für beide Backends, nur die Konfiguration unterscheidet sich:
  - **TypeSafe:** `TYPESAFE_API_KEY`, Timeout 30 s.
  - **Ollama:** `baseURL`, Dummy-Key, `compression: false`, Timeout 120 s, `maxRetries: 0`.
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
- **Modelle:** TypeSafe `jev-latest`. Lokal `elephant-1:9b-q4-ctx8k` (Standard), `clef-flash`, `pplx-decider` 27B.

## Leitplanken

- **Fragen atomar stellen**, die Entscheidung trifft der Code. Also "Wird `dll` von einem Prozess geladen?" statt "Soll `dll` weg?".
- **Fakten berechnet der Code** und legt sie in den State, z. B. `days_since_last_patch`. Die Modelle kennen das heutige Datum nicht.
- **State kürzen** statt den Kontext zu vergrößern:
  - Presets enthalten nur die relevanten Felder.
  - `lib/limits.ts` schätzt die Tokens (Zeichen / 2,6) gegen das Modell-Limit. Lokal sind das 8k bzw. 16k Tokens, bei TypeSafe 64k.
- **Fehler bleiben Fehler**, z. B. Timeout oder Overflow-400. Sie werden nie als Antwort angezeigt.
- **Logs nur mit Metadaten**, ohne State-Inhalt. Next-Telemetrie aus.
- **TypeSafe nur mit synthetischen Daten** (US-Hosting). Die UI zeigt dort einen Hinweis.

## Schritte

1. Setup: Next.js, Tailwind, shadcn/ui, Zod-Schemas für Fragen und Antworten
2. `/api/run` + Client + Guard, zuerst gegen Ollama, dann TypeSafe; `lib/metrics.ts` mit Tests
3. UI: Eingabe, Ergebnis, Presets, Request-Inspektor
4. Vergleich, Reihenfolge mitteln, Historie mit JSON/CSV-Export
5. Docker, `/api/health`, CI nach GHCR, Compose mit `host.docker.internal`
6. Politur: Dark Mode, Animationen, Fehlerzustände, Mobile
7. Evaluation (separates Skript):
   - ca. 600 synthetische, gelabelte Items, Split 200/400
   - Brier, NLL, ECE, Risk-Coverage, Bootstrap-KI
   - lokal roh, mit Mitteln und mit Temperature Scaling, gegenüber Jev

## Offen

- Latenzen für die Arbeit in Ruhe messen: ein Modell geladen, State pro Lauf variieren (clef-flash cached identische Requests).
