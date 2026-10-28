import type { ModelId, ModelInfo, Preset, Question, QuestionType } from "./types";

export const MODELS: ModelInfo[] = [
  {
    id: "elephant-1:9b-q4-ctx8k",
    label: "elephant-1",
    backend: "ollama",
    hosted: false,
    contextTokens: 8_000,
    size: "9B · q4 · 8k",
    color: "#e8710a",
    sharpness: 2.8,
    noise: 0.55,
    baseLatencyMs: 2400,
  },
  {
    id: "clef-flash",
    label: "clef-flash",
    backend: "ollama",
    hosted: false,
    contextTokens: 8_000,
    size: "lokal",
    color: "#8e5bd9",
    sharpness: 3.4,
    noise: 0.5,
    baseLatencyMs: 900,
  },
  {
    id: "pplx-decider",
    label: "pplx-decider",
    backend: "ollama",
    hosted: false,
    contextTokens: 16_000,
    size: "27B · 16k",
    color: "#0e9f8e",
    sharpness: 3.0,
    noise: 0.3,
    baseLatencyMs: 6200,
  },
  {
    id: "jev-latest",
    label: "Jev",
    backend: "typesafe",
    hosted: true,
    contextTokens: 64_000,
    size: "gehostet · 64k",
    color: "#2459cf",
    sharpness: 3.8,
    noise: 0.2,
    baseLatencyMs: 650,
  },
];

export const DEFAULT_MODEL: ModelId = "elephant-1:9b-q4-ctx8k";

export const modelById = (id: ModelId) => MODELS.find((m) => m.id === id)!;

let counter = 0;
export const uid = (prefix = "q") => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export function newQuestion(type: QuestionType = "choice"): Question {
  return {
    id: uid(),
    text: "",
    type,
    options: type === "choice" ? ["", "", ""] : [],
    levels: 5,
    scoreLow: "niedrig",
    scoreHigh: "hoch",
  };
}

const q = (id: string, p: Partial<Question> & Pick<Question, "text" | "type">): Question => ({
  id,
  options: [],
  levels: 5,
  scoreLow: "niedrig",
  scoreHigh: "hoch",
  ...p,
});

export const PRESETS: Preset[] = [
  {
    id: "server-role",
    title: "Server-Rolle",
    mode: "single",
    badge: "CHOICE",
    state: [
      "Hostname: SRV-APP-0412",
      "OS: Windows Server 2019 Datacenter (Build 17763.5936)",
      "Features: Web-Server (IIS), .NET Framework 4.8, WinRM",
      "Programme: Microsoft SQL Server 2019 Express 15.0.2000.5; Veeam Agent for Windows 6.1; Notepad++ 8.6",
      "Lauschende Ports: 80, 443, 1433, 5985",
      "Laufende Dienste: W3SVC, MSSQL$SQLEXPRESS, WinRM",
    ].join("\n"),
    facts: [
      { key: "days_since_last_patch", value: "41" },
      { key: "installed_program_count", value: "23" },
      { key: "listening_ports", value: "4" },
    ],
    questions: [
      q("q1", {
        text: "Welche primäre Rolle hat dieser Server?",
        type: "choice",
        options: ["Domain Controller", "Dateiserver", "Datenbankserver", "Webserver", "Anwendungsserver", "Sonstiges"],
        mockTruth: 3,
        mockSecond: 2,
      }),
    ],
  },
  {
    id: "cpe-match",
    title: "CPE-Zuordnung",
    mode: "single",
    badge: "NOUL",
    state: [
      "Installierter Eintrag:",
      "  Name: Microsoft Visual C++ 2015-2022 Redistributable (x64) - 14.38.33135",
      "  Publisher: Microsoft Corporation",
      "  Version: 14.38.33135.0",
      "",
      "CPE-Kandidat:",
      "  cpe:2.3:a:microsoft:visual_c\\+\\+_2015-2022_redistributable:14.38.33135.0:*:*:*:*:*:x64:*",
    ].join("\n"),
    facts: [{ key: "version_in_cpe_range", value: "true" }],
    questions: [
      q("q1", {
        text: "Ist der installierte Eintrag dasselbe Produkt wie der CPE-Kandidat?",
        type: "noul",
        mockTruth: 0,
      }),
    ],
  },
  {
    id: "dll-owner",
    title: "DLL-Zuordnung",
    mode: "single",
    badge: "CHOICE",
    state: [
      "Datei: C:\\Program Files\\Veeam\\Endpoint Backup\\libcrypto-3-x64.dll",
      "Dateiversion: 3.0.12",
      "Geladen von (30 Tage): Veeam.EndPoint.Service.exe",
      "Nachbardateien: Veeam.EndPoint.Manager.exe, Veeam.Common.dll, libssl-3-x64.dll",
    ].join("\n"),
    facts: [{ key: "loaded_by_process_count", value: "1" }],
    questions: [
      q("q1", {
        text: "Zu welchem Programm gehört diese DLL?",
        type: "choice",
        options: ["Veeam Agent for Windows", "OpenSSL (eigenständig)", "Microsoft Windows", "Notepad++", "Unbekannt"],
        mockTruth: 0,
      }),
    ],
  },
  {
    id: "patch-urgency",
    title: "Patch-Dringlichkeit",
    mode: "single",
    badge: "SCORE",
    state: [
      "Hostname: SRV-FS-0107",
      "OS: Windows Server 2016 Standard (Build 14393.6614)",
      "Exponierte Dienste: SMB (445), RDP (3389)",
      "Offene kritische CVEs mit Exploit: 2",
      "Rolle: Dateiserver, 140 Benutzer",
    ].join("\n"),
    facts: [
      { key: "days_since_last_patch", value: "142" },
      { key: "internet_exposed", value: "false" },
    ],
    questions: [
      q("q1", {
        text: "Wie dringend ist ein Patch-Zyklus für dieses System?",
        type: "score",
        levels: 5,
        scoreLow: "nicht dringend",
        scoreHigh: "sofort",
        mockTruth: 3,
        mockSecond: 1,
      }),
    ],
  },
  {
    id: "dll-bundle",
    title: "DLL entfernbar?",
    mode: "multi",
    badge: "3 FRAGEN",
    state: [
      "Datei: C:\\Windows\\System32\\oldhelper.dll",
      "Dateiversion: 2.1.0.88 (Signatur: ungültig)",
      "Zuletzt geändert: 2019-03-04",
      "Pfadeinträge in Programm-Registry: keine",
      "Hash in bekannter Windows-Komponenten-Liste: nein",
    ].join("\n"),
    facts: [
      { key: "loaded_by_process_count", value: "0" },
      { key: "days_since_last_load", value: "> 90" },
    ],
    questions: [
      q("q1", { text: "Wird die DLL von einem laufenden Prozess geladen?", type: "noul", mockTruth: 1 }),
      q("q2", { text: "Gehört die DLL zu einem installierten Programm?", type: "noul", mockTruth: 1 }),
      q("q3", { text: "Ist die DLL ein Windows-Systembestandteil?", type: "noul", mockTruth: 1 }),
    ],
    rule: {
      label: "Entfernungs-Kandidat",
      yes: "Alle drei Antworten „Nein“ → Kandidat zum Entfernen",
      no: "Mindestens eine Antwort „Ja“ → behalten",
    },
  },
  {
    id: "support-routing",
    title: "Support Routing",
    mode: "single",
    badge: "CHOICE",
    state:
      "The customer says: \"I was charged twice for my monthly subscription and I need one of the duplicate charges refunded.\"",
    facts: [],
    questions: [
      q("q1", {
        text: "Which team should handle this customer request?",
        type: "choice",
        options: ["Billing", "Technical", "Sales", "Other"],
        mockTruth: 0,
      }),
    ],
  },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id);

/** Beschriftungen der Ausgabeachse einer Frage. */
export function labelsFor(question: Question): string[] {
  if (question.type === "noul") return ["Ja", "Nein"];
  if (question.type === "score") return Array.from({ length: question.levels }, (_, i) => String(i + 1));
  return question.options.map((o, i) => o.trim() || `Option ${i + 1}`);
}
