import { createHash } from "node:crypto";
import { rng } from "../lib/calibration.ts";
import type { Fact, Question, QuestionType } from "../lib/types.ts";

/**
 * Deterministischer Generator synthetischer Windows-Server-States mit je 5 atomaren Fragen.
 * Alle Fakten und Gold-Labels berechnet der Code; Hostnamen, Hersteller und Programme sind erfunden.
 */
export type Difficulty = "leicht" | "schwer";
export type Split = "calib" | "test";
export type EvalState = {
  id: string;
  difficulty: Difficulty;
  split: Split;
  state: string;
  facts: Fact[];
  questions: Question[];
  /** Index in der Reihenfolge der `probs` von /api/run: Choice = Option, Noul 0 = wahr / 1 = unwahr, Score = Stufe 0–4. */
  gold: number[];
};
export type Item = {
  id: string;
  stateId: string;
  split: Split;
  difficulty: Difficulty;
  question: Question;
  type: QuestionType;
  gold: number;
  /** Kurzer Hash über State, Fakten und Frage: Cache-Schlüssel, damit Generator-Änderungen alte Antworten verwerfen. */
  hash: string;
};

type Rand = () => number;
const pick = <T>(r: Rand, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
function shuffle<T>(r: Rand, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ROLES = [
  {
    name: "Domain Controller",
    features: ["Active Directory-Domänendienste", "DNS-Server", "Gruppenrichtlinienverwaltung"],
    services: ["NTDS", "Kdc", "Netlogon", "DNS"],
    ports: [53, 88, 389, 636, 3268],
  },
  {
    name: "Dateiserver",
    features: ["Dateiserver", "DFS-Namespaces", "DFS-Replikation"],
    services: ["LanmanServer", "DFSR", "Dfs"],
    ports: [139, 445, 5722],
  },
  {
    name: "Datenbankserver",
    features: ["SQL Server-Datenbankmodul", "SQL Server-Agent", "Volltextsuche"],
    services: ["MSSQLSERVER", "SQLSERVERAGENT", "SQLBrowser"],
    ports: [1433, 1434, 4022],
  },
  {
    name: "Webserver",
    features: ["Webserver (IIS)", "ASP.NET 4.8", "IIS-Verwaltungskonsole"],
    services: ["W3SVC", "WAS", "IISADMIN"],
    ports: [80, 443, 8080],
  },
  {
    name: "Druckserver",
    features: ["Druck- und Dokumentdienste", "Druckserver", "LPD-Dienst"],
    services: ["LPDSVC", "PrintNotify", "Spooler"],
    ports: [515, 631, 9100],
  },
];

// Je Hersteller zwei Produkte: Schwesterprodukte für knappe CPE-Fehltreffer.
type Product = [dir: string, cpe: string, exe: string, dlls: string[], year?: number];
type Vendor = { vendor: string; cpe: string; dir: string; products: [Product, Product] };
const VENDORS: Vendor[] = [
  {
    vendor: "Kestrel Software GmbH",
    cpe: "kestrel",
    dir: "Kestrel",
    products: [
      ["Backup Agent", "backup_agent", "KestrelBackup.Service.exe", ["kbk_core.dll", "kbk_vss.dll"]],
      ["Monitor", "monitor", "KestrelMon.Agent.exe", ["kmon_probe.dll", "kmon_net.dll"]],
    ],
  },
  {
    vendor: "Orbis Data AG",
    cpe: "orbis",
    dir: "Orbis",
    products: [
      ["Report Server", "report_server", "Orbis.ReportHost.exe", ["orep_render.dll", "orep_pdf.dll"], 2019],
      ["Connect", "connect", "OrbisConnect.exe", ["ocon_odbc.dll", "ocon_tls.dll"]],
    ],
  },
  {
    vendor: "Fennwick Systems Ltd",
    cpe: "fennwick",
    dir: "Fennwick",
    products: [
      ["PDF Studio", "pdf_studio", "FennwickPdf.exe", ["fpdf_engine.dll", "fpdf_ocr.dll"]],
      ["Scan Gateway", "scan_gateway", "FennScanGw.exe", ["fscan_twain.dll", "fscan_img.dll"]],
    ],
  },
  {
    vendor: "Halvard IT GmbH",
    cpe: "halvard",
    dir: "Halvard",
    products: [
      ["Remote Desk", "remote_desk", "HalvardRD.Host.exe", ["hrd_capture.dll", "hrd_codec.dll"]],
      ["Patch Center", "patch_center", "HalvardPatch.exe", ["hpc_wsus.dll", "hpc_cab.dll"], 2021],
    ],
  },
  {
    vendor: "Lumenta GmbH",
    cpe: "lumenta",
    dir: "Lumenta",
    products: [
      ["Endpoint Shield", "endpoint_shield", "LumentaShield.Svc.exe", ["lsh_scan.dll", "lsh_hook.dll"]],
      ["Log Collector", "log_collector", "LumentaLogs.exe", ["llc_evt.dll", "llc_ship.dll"]],
    ],
  },
  {
    vendor: "Brightmoor Software",
    cpe: "brightmoor",
    dir: "Brightmoor",
    products: [
      ["Archive", "archive", "BrightArchive.exe", ["bma_index.dll", "bma_store.dll"], 2020],
      ["Sync Client", "sync_client", "BrightSync.exe", ["bms_delta.dll", "bms_http.dll"]],
    ],
  },
];

type Program = {
  vendor: Vendor;
  name: string;
  dir: string;
  cpe: string;
  exe: string;
  dlls: string[];
  year?: number;
  sister: string;
};
const PROGRAMS: Program[] = VENDORS.flatMap((v) =>
  v.products.map(([dir, cpe, exe, dlls, year], i): Program => {
    const [, sisterCpe, , , sisterYear] = v.products[1 - i];
    return {
      vendor: v,
      name: `${v.dir} ${dir}${year ? ` ${year}` : ""}`,
      dir,
      cpe: year ? `${cpe}_${year}` : cpe,
      exe,
      dlls,
      year,
      sister: sisterYear ? `${sisterCpe}_${sisterYear}` : sisterCpe,
    };
  }),
);

const WIN_DLLS = ["wldp.dll", "cryptnet.dll", "netutils.dll", "winhttp.dll", "wevtapi.dll", "dsparse.dll"];
const UNKNOWN_DLLS = ["updhook.dll", "tmpbridge.dll", "hlpx32.dll", "svcext.dll", "cfgload.dll"];
const OS = [
  ["Windows Server 2016 Standard", 14393],
  ["Windows Server 2019 Datacenter", 17763],
  ["Windows Server 2022 Standard", 20348],
] as const;
const SITES = ["BER", "MUC", "HAM", "FRA", "KOE", "STR"];

/** Patch-Alter in Tagen → Stufe 0–4: <30, 30–59, 60–89, 90–179, ≥180. */
const BOUNDS = [30, 60, 90, 180];
const bucket = (days: number) => BOUNDS.filter((b) => days >= b).length;

const QUESTION = { options: [], levels: 5, scoreLow: "niedrig", scoreHigh: "hoch" };
const OWNER_OTHERS = ["Microsoft Windows", "Unbekannt"];

function server(r: Rand, index: number, difficulty: Difficulty): Omit<EvalState, "split"> {
  const hard = difficulty === "schwer";
  const version = () => `${int(r, 1, 12)}.${int(r, 0, 9)}.${int(r, 10, 999)}`;
  const [osName, build] = pick(r, OS);
  const installed = shuffle(r, PROGRAMS)
    .slice(0, 4)
    .map((p) => ({ ...p, version: version() }));

  // q1 Rolle: leicht mit Features, Diensten und Ports; schwer nur je zwei Ports und ein Dienst plus neutrales Rauschen.
  const role = ROLES[Math.floor(index / 2) % ROLES.length];
  const roleOptions = shuffle(
    r,
    ROLES.map((x) => x.name),
  );
  const ports = [...(hard ? shuffle(r, role.ports).slice(0, 2) : role.ports), 3389, 5985].toSorted((a, b) => a - b);
  const services = [...(hard ? [pick(r, role.services)] : role.services), "WinRM", "TermService"];
  const noise = [
    `RAM: ${pick(r, [16, 32, 64])} GB`,
    `CPU: ${pick(r, [4, 8, 16])} vCPU`,
    `Virtualisierung: ${pick(r, ["VMware-Gast", "Hyper-V-Gast"])}`,
    "Zeitzone: W. Europe Standard Time",
  ];

  // q2 CPE: leicht exakter Treffer oder fremder Hersteller; schwer knappe Fehltreffer.
  const entry = pick(r, installed);
  const arch = pick(r, ["x64", "x86"]);
  const match = r() < 0.5;
  let cpe = `${entry.vendor.cpe}:${entry.cpe}:${entry.version}:*:*:*:*:*:${arch}:*`;
  let entryVersion = entry.version;
  if (match && hard) {
    entryVersion = `${entry.version}.0`;
    cpe = `${entry.vendor.cpe}:${entry.cpe}:${entry.version}:*:*:*:*:*:*:*`;
  } else if (!match && !hard) {
    const other = pick(
      r,
      PROGRAMS.filter((p) => p.vendor !== entry.vendor),
    );
    cpe = `${other.vendor.cpe}:${other.cpe}:${version()}:*:*:*:*:*:${arch}:*`;
  } else if (!match) {
    const [major, rest] = [Number(entry.version.split(".")[0]), entry.version.replace(/^\d+/, "")];
    const kind = pick(r, ["sister", "arch", "major", "year"]);
    const product =
      kind === "sister"
        ? entry.sister
        : kind === "year" && entry.year
          ? `${entry.cpe.slice(0, -4)}${entry.year - int(r, 1, 3)}`
          : entry.cpe;
    const ver =
      kind === "major" || (kind === "year" && !entry.year)
        ? `${major > 1 ? major - 1 : major + 1}${rest}`
        : entry.version;
    const hw = kind === "arch" ? (arch === "x64" ? "x86" : "x64") : arch;
    cpe = `${entry.vendor.cpe}:${product}:${ver}:*:*:*:*:*:${hw}:*`;
  }

  // q3/q4 DLL: Besitzer installiertes Programm (60 %), Windows (20 %) oder unbekannt (20 %).
  const u = r();
  const owner = u < 0.6 ? pick(r, installed) : null;
  const ownerName = owner?.name ?? (u < 0.8 ? "Microsoft Windows" : "Unbekannt");
  const ownerOptions = shuffle(r, [...installed.map((p) => p.name), ...OWNER_OTHERS]);
  const procs = shuffle(r, [owner?.exe ?? (ownerName === "Unbekannt" ? "rundll32.exe" : "svchost.exe"), "dllhost.exe"]);
  const loaded = r() < 0.5 ? int(r, 1, 2) : 0;
  const winDir = hard
    ? `C:\\Windows\\WinSxS\\amd64_microsoft-windows-${int(r, 1000, 9999)}_31bf3856ad364e35_10.0.${build}.${int(r, 1000, 6000)}_none`
    : "C:\\Windows\\System32";
  const dll = owner
    ? {
        file: hard
          ? pick(r, [`C:\\ProgramData\\${owner.vendor.dir}\\${owner.dir}\\plugins`, "D:\\Tools\\shared"])
          : `C:\\Program Files\\${owner.vendor.dir}\\${owner.dir}`,
        name: pick(r, owner.dlls),
        version: owner.version,
        signature: hard ? null : owner.vendor.vendor,
        neighbours: [owner.exe, ...owner.dlls],
      }
    : ownerName === "Microsoft Windows"
      ? {
          file: winDir,
          name: pick(r, WIN_DLLS),
          version: `10.0.${build}.${int(r, 1000, 6000)}`,
          signature: "Microsoft Windows",
          neighbours: shuffle(r, WIN_DLLS).slice(0, 2),
        }
      : {
          file: hard
            ? `C:\\ProgramData\\Temp\\${int(r, 0x10000, 0xfffff).toString(16)}`
            : "C:\\Users\\Public\\Downloads",
          name: pick(r, UNKNOWN_DLLS),
          version: version(),
          signature: "keine",
          neighbours: hard ? ["setup.tmp"] : [],
        };
  const neighbours = dll.neighbours.filter((n) => n !== dll.name);

  // q5 Patch-Alter: leicht mitten im Bucket, schwer ±3 Tage um eine Grenze.
  const days = hard
    ? pick(r, BOUNDS) + int(r, -3, 3)
    : (() => {
        const level = int(r, 0, 4);
        return int(r, [0, 30, 60, 90, 180][level] + 5, [29, 59, 89, 179, 400][level] - 5);
      })();

  const state = [
    `Hostname: ${pick(r, SITES)}-SRV-${String(int(r, 100, 9999)).padStart(4, "0")}`,
    `OS: ${osName} (Build ${build}.${int(r, 1000, 6000)})`,
    ...(hard ? [] : [`Features: ${role.features.join(", ")}`]),
    `Programme: ${installed.map((p) => `${p.name} ${p.version}`).join("; ")}`,
    `Lauschende Ports: ${ports.join(", ")}`,
    `Laufende Dienste: ${services.join(", ")}`,
    ...(hard ? shuffle(r, noise).slice(0, 2) : []),
    `Letztes Update: KB${int(r, 5000000, 5049999)}`,
    "",
    "Installierter Eintrag:",
    `  Name: ${entry.name} (${arch})`,
    `  Publisher: ${entry.vendor.vendor}`,
    `  Version: ${entryVersion}`,
    "CPE-Kandidat:",
    `  cpe:2.3:a:${cpe}`,
    "",
    "DLL:",
    `  Datei: ${dll.file}\\${dll.name}`,
    `  Dateiversion: ${dll.version}`,
    ...(dll.signature ? [`  Signatur: ${dll.signature}`] : []),
    ...(hard ? [`  Geladen von (30 Tage): ${procs.slice(0, loaded).join(", ") || "keine"}`] : []),
    ...(neighbours.length ? [`  Nachbardateien: ${neighbours.join(", ")}`] : []),
  ].join("\n");

  return {
    id: `s${String(index + 1).padStart(3, "0")}`,
    difficulty,
    state,
    facts: [
      { key: "days_since_last_patch", value: String(days) },
      ...(hard ? [] : [{ key: "loaded_by_process_count", value: String(loaded) }]),
    ],
    questions: [
      { ...QUESTION, id: "q1", text: "Welche primäre Rolle hat dieser Server?", type: "choice", options: roleOptions },
      {
        ...QUESTION,
        id: "q2",
        text: "Ist der installierte Eintrag dasselbe Produkt wie der CPE-Kandidat (inklusive Version und Architektur)?",
        type: "noul",
      },
      { ...QUESTION, id: "q3", text: "Wird die DLL von einem laufenden Prozess geladen?", type: "noul" },
      { ...QUESTION, id: "q4", text: "Zu welchem Programm gehört diese DLL?", type: "choice", options: ownerOptions },
      {
        ...QUESTION,
        id: "q5",
        text: "Wie lange liegt der letzte Patch zurück? Stufen: 0 = unter 30 Tage, 1 = 30–59 Tage, 2 = 60–89 Tage, 3 = 90–179 Tage, 4 = 180 Tage oder mehr.",
        type: "score",
        scoreLow: "unter 30 Tage",
        scoreHigh: "180 Tage oder mehr",
      },
    ],
    gold: [
      roleOptions.indexOf(role.name),
      match ? 0 : 1,
      loaded ? 0 : 1,
      ownerOptions.indexOf(ownerName),
      bucket(days),
    ],
  };
}

/** 120 States (abwechselnd leicht/schwer), geschichteter Split je Schwierigkeit: 40 States Kalibrierung, 80 Test. */
export function generate(seed = 42): EvalState[] {
  const r = rng(seed);
  const states = Array.from({ length: 120 }, (_, i) => server(r, i, i % 2 ? "schwer" : "leicht"));
  const calib = new Set(
    (["leicht", "schwer"] as const).flatMap((d) =>
      shuffle(
        r,
        states.filter((s) => s.difficulty === d),
      )
        .slice(0, 20)
        .map((s) => s.id),
    ),
  );
  return states.map((s) => ({ ...s, split: calib.has(s.id) ? "calib" : "test" }));
}

export const items = (states: EvalState[]): Item[] =>
  states.flatMap((s) =>
    s.questions.map((q, i) => ({
      id: `${s.id}-${q.id}`,
      stateId: s.id,
      split: s.split,
      difficulty: s.difficulty,
      question: q,
      type: q.type,
      gold: s.gold[i],
      hash: createHash("sha256")
        .update(JSON.stringify([s.state, s.facts, q]))
        .digest("hex")
        .slice(0, 12),
    })),
  );
