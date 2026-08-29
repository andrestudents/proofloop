# ProofLoop — Product Requirements Document

**Event:** Kane CLI Online Hackathon (TestMu AI) — *deadline diperpanjang (tanggal baru: TBD, konfirmasi ke organizer)*
**Stack:** TypeScript (backend + frontend)
**Status:** Draft v2 — revisi pasca-review

> **Changelog v2** (dari v1):
> 1. ❌ `claude --cwd` → **bukan flag yang ada** (diverifikasi via `claude --help`). Working directory diatur lewat opsi `cwd` di `spawn()`.
> 2. ❌ `--max-turns` → tidak tersedia di CLI build ini. Diganti **`--max-budget-usd`** + watchdog wall-clock di backend.
> 3. `--allowedTools` diperluas: `Glob, Grep, TodoWrite` (tanpa ini claude pincang menjelajah kode).
> 4. Windows: spawn `claude.cmd` (Node 20+ menolak `.cmd` tanpa shell) + **prompt dikirim via stdin** (menghindari quoting & batas panjang argumen).
> 5. **Race SSE diperbaiki**: buffer semua event per run + replay saat klien connect/reconnect.
> 6. Routing dirapikan: `GET /api/stream/:runId` (v1 men-mount stream di dalam `/api/generate` → jalur tidak sesuai kontrak).
> 7. Korelasi hasil Kane via `tool_use_id` (bukan "semua tool_result dicurigai kane").
> 8. **Link bukti dari Kane** (`test_url` + `session_dir` dari baris `run_end`) ditampilkan di UI — penguat kriteria *Verified*.
> 9. Target-app jadi **self-contained**: `CLAUDE.md` + skill kane-cli di dalam foldernya.
> 10. Strategi submission ditambah: **satu perintah lokal + fallback hosted replay** (aturan lomba: juri harus bisa lihat app <30 detik).
> 11. Koreksi realita format lomba: tidak ada demo live ke juri — **video 3 menit dinilai duluan**; rencana video ditambahkan (§18).

---

## 1. Overview

ProofLoop adalah web app dengan satu kotak prompt. User mengetik permintaan fitur dalam bahasa natural (contoh: *"tambahkan validasi email di form signup"*). Di belakang layar, **Claude Code** (headless) menerima prompt itu, menulis kode fiturnya ke sebuah target app kecil, lalu **memanggil Kane CLI sendiri** untuk memverifikasi fitur itu benar-benar berfungsi di browser sungguhan. Kalau Kane menemukan kegagalan, Claude Code membaca hasil itu dan memperbaiki kode dalam sesi yang sama, lalu memverifikasi ulang — semua ini terjadi dalam satu proses agentic loop tunggal.

ProofLoop **tidak membangun loop itu sendiri**. Loop-nya sudah bawaan dari cara Claude Code bekerja (dia bisa memutuskan sendiri untuk memanggil tool Bash berulang kali dalam satu sesi). Tugas ProofLoop adalah **mengekspos loop yang sudah ada itu ke sebuah UI web yang bisa ditonton secara live** — menerjemahkan aliran event mentah dari terminal menjadi status yang mudah dipahami manusia, lengkap dengan bukti klik-able (link dashboard & evidence pack) untuk setiap verifikasi.

## 2. Konteks & Kenapa Ini Relevan untuk Judging

Kriteria penilaian (bobot sama): **Ships**, **Verified**, **Closed loop**, **Craft**. Tie-break: Verified dulu, baru Closed loop.

**Realita format yang harus diakui (koreksi dari v1):** tidak ada sesi demo interaktif dengan juri. Yang dinilai duluan adalah **video 3 menit** (juri berhenti menonton di 3:00), lalu repo + live URL/runnable command. Konsekuensinya:

- Klaim "juri memicu loop live" tidak bisa diandalkan. Penggantinya yang tetap jujur: **rekaman tanpa cut** yang memperlihatkan prompt diketik segar di depan kamera → loop jalan → status berubah real-time → kane gagal → claude memperbaiki → kane lulus. Tidak ada edit di momen kunci = bukti kejujuran yang setara dengan demo live.
- Ide ini secara harfiah tercantum sebagai contoh Lane 1 (*"a prompt-to-feature playground where users type 'add a dark mode toggle' and watch the whole loop close in real time"*). Artinya tervalidasi, tapi **pasti ada pesaing dengan ide serupa**. Pembeda: (a) craft visualisasi loop di UI, (b) bukti klik-able per run (`test_url` LambdaTest + evidence pack), (c) loop yang terjadi murni via agent tool-use — tidak ada orchestration script yang memalsukan status.

## 3. Goals

1. User bisa mengetik prompt fitur di UI dan melihat fitur itu benar-benar dibangun ke target app.
2. Setiap fitur yang dibangun **wajib** melalui verifikasi Kane CLI sebelum dianggap selesai.
3. UI menampilkan status loop secara **real-time**: Building → Verifying → (Fixing jika gagal) → Verified.
4. Log dari Kane CLI (ringkasan hasil run, bukan seluruh output mentah) ditampilkan ke user **beserta link buktinya** (dashboard URL & evidence pack) sebagai bukti bahwa verifikasi itu nyata.
5. Riwayat setiap run tersimpan selama sesi berjalan (tidak perlu persist permanen).
6. Seluruh pengalaman bisa dijalankan **satu perintah** di lokal, dan ada **mode fallback replay** yang bisa di-deploy supaya juri tetap bisa melihat UI bekerja <30 detik tanpa setup apa pun.

## 4. Non-Goals (Di Luar Scope)

- Tidak ada sistem autentikasi/login multi-user.
- Tidak ada database persisten (in-memory cukup).
- Tidak ada **deployment penuh loop ke cloud** (claude + kane + Chrome tetap berjalan lokal). Yang di-host hanyalah fallback read-only yang me-replay transkrip run asli (§18.3) — diberi label jelas "replay", bukan live.
- Tidak menangani banyak sesi/prompt secara paralel — satu sesi build berjalan sampai selesai sebelum menerima prompt berikutnya.
- Tidak membangun UI editor kode manual — user tidak mengedit kode langsung, hanya lewat prompt.

## 5. Alur Pengguna (User Flow)

1. User membuka ProofLoop di browser, melihat kotak prompt kosong dan preview target app di sebelahnya.
2. User mengetik permintaan fitur, klik "Generate".
3. UI langsung membuka koneksi SSE (`GET /api/stream/:runId`) — semua event sejak awal run di-guarantee sampai via **buffer + replay** (tidak ada event yang hilang karena race connect).
4. Backend men-spawn proses `claude -p` (prompt user dibungkus wrapper §14.4, dikirim via **stdin**), working directory-nya folder `target-app` (via opsi `cwd` spawn, bukan flag CLI).
5. Claude Code mulai bekerja: membaca kode target-app, menulis/mengedit file yang relevan → status **Building**.
6. Setelah edit, Claude Code memutuskan sendiri untuk memanggil `kane-cli run` lewat tool Bash-nya, mengarah ke URL lokal target-app → status **Verifying**.
7. Kane CLI membuka Chrome sungguhan, menjalankan flow, mengembalikan hasil (NDJSON) ke Claude Code.
8. Jika hasil **gagal**: status UI **Kane: gagal** + alasan singkat + link bukti. Claude Code lanjut mengedit kode lagi (backend mendeteksi ini sebagai **Fixing**), lalu memanggil Kane lagi (kembali ke langkah 6).
9. Jika hasil **lulus**: status UI **Verified**, ringkasan run + link bukti disimpan ke riwayat sesi.
10. Sesi `claude -p` selesai (event terminal `result` dari stream-json DAN proses exit) → `run_complete` dikirim, SSE ditutup, UI siap menerima prompt berikutnya.

## 6. Arsitektur Sistem

```
Browser (React UI)
     |  POST /api/generate { prompt }
     |  GET  /api/stream/:runId  (Server-Sent Events, buffer + replay)
     v
Backend server (Express + TypeScript, port 3001)
     |  spawn (Windows: via shell/cmd — aman, argumen semua statis):
     |    claude -p --output-format stream-json --verbose* 
     |          --allowedTools "Bash,Edit,Write,Read,Glob,Grep,TodoWrite"
     |          --permission-mode acceptEdits
     |          --max-budget-usd 3
     |    opsi spawn: { cwd: <absolute-path>/target-app }
     |    prompt (wrapper §14.4) dikirim via STDIN, bukan argumen
     |    env tambahan: KANE_CLI_USER_AGENT=claude-code
     |    watchdog: kill tree jika > 20 menit
     v
Claude Code (headless subprocess)
     |  membaca & mengedit file di /target-app (dibimbing CLAUDE.md target-app)
     |  memanggil via Bash tool:
     |    kane-cli run --agent --url http://localhost:4000 --timeout 300 "<objective>"
     v
Kane CLI (dipanggil OLEH Claude Code, bukan oleh backend)
     |  sudah ter-autentikasi sekali: kane-cli login
     |  membuka Chrome, menjalankan flow, hasil NDJSON balik ke Claude Code
     |  baris terminal: {"type":"run_end","status":"passed"|"failed",...,"test_url":...}
     v
Chrome browser (real) --> mengunjungi target-app yang jalan di localhost:4000
```

\* `--verbose`: beberapa build claude mensyaratkannya agar `stream-json` keluar di `-p` mode — **verifikasi sekali dengan dry-run manual** sebelum finalisasi (lihat §15 langkah 3).

**Prinsip penting:** backend **tidak pernah memanggil Kane CLI secara langsung**. Backend hanya memanggil `claude`. Seluruh keputusan "edit dulu atau verifikasi dulu" ada di tangan Claude Code sepenuhnya. Backend murni **pendengar pasif** yang menerjemahkan stream event jadi status UI.

Dua layanan eksternal yang dipakai (bukan bagian dari kode ProofLoop, tapi wajib dikonfigurasi di environment):
- **Anthropic API** — dipanggil dari dalam proses `claude`, otentikasi via `ANTHROPIC_API_KEY` di environment variable (atau subscription login yang sudah aktif).
- **TestMu AI cloud** — dipanggil dari dalam proses `kane-cli`, otentikasi via `kane-cli login` (dilakukan sekali di environment, tersimpan lokal).

## 7. Tech Stack

| Layer | Pilihan | Catatan |
|---|---|---|
| Bahasa | TypeScript (backend & frontend) | Strict mode aktif |
| Backend runtime | Node.js (v20+) | |
| Backend framework | Express | |
| Realtime channel | Server-Sent Events (native) | Satu arah cukup; **buffer + replay per run** |
| Frontend | React + Vite + TypeScript | Dev pakai Vite dev server; **ship: hasil build diserve dari Express** (1 port, 1 perintah) |
| Styling | Tailwind CSS | |
| Penyimpanan | In-memory + event buffer per run | Tidak ada database |
| Orkestrasi agent | `child_process.spawn` memanggil `claude` CLI langsung | Bukan Agent SDK; Windows: `.cmd`/shell — lihat §14.2 |
| Verifikasi | Kane CLI, dipanggil oleh Claude Code sendiri | Backend tidak invoke langsung |
| Pengembangan parser | **Fixture NDJSON** (transkrip run asli) | Parser dites offline — tidak perlu spawn claude tiap iterasi |
| Target app | Express + HTML/CSS/JS statis | Lihat §11 |

## 8. Core Features

### 8.1 Prompt Input & Trigger
Kotak teks + tombol "Generate". Validasi: prompt tidak boleh kosong. Selama satu run masih berjalan, tombol disabled untuk mencegah run paralel.

### 8.2 Live Status Stepper
Menampilkan salah satu state: `idle | building | verifying | fixing | verified | failed | unverified`. Berubah berdasarkan event yang diterima dari SSE.

### 8.3 Kane Run Log Panel
Menampilkan ringkasan tiap kali Kane CLI dipanggil: objective yang dijalankan, hasil (pass/fail), pesan singkat kalau gagal, **plus link bukti**: `test_url` (dashboard LambdaTest) dan lokasi evidence pack lokal (`session_dir`, bisa dibuka via `kane-cli evidence serve`). Bersumber dari parsing `tool_use` + `tool_result` (dikorelasikan via `tool_use_id`) di stream Claude Code.

### 8.4 Target App Preview
`<iframe>` yang menunjuk ke `http://localhost:4000`. Di-refresh otomatis setiap kali status berubah jadi `verified`.

### 8.5 Run History
Daftar prompt yang pernah dijalankan di sesi ini, dengan status akhir dan jumlah percobaan Kane sebelum lulus (menunjukkan bukti loop bekerja, bukan kebetulan sekali jalan).

### 8.6 Demo Replay Mode (fallback untuk juri)
Flag `DEMO_MODE=1`: backend me-replay transkrip run asli (fixture) melewati pipeline SSE & UI yang sama persis, tanpa menjalankan claude/kane. Header UI menampilkan banner "Replay of a real run" — jujur, dan membuat UI tetap bisa didemokan <30 detik di hosted fallback (§18.3).

## 9. Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | Sistem menerima prompt teks via `POST /api/generate`; tolak prompt kosong |
| FR-2 | Sistem men-spawn `claude` dengan: `-p --output-format stream-json --verbose* --allowedTools "Bash,Edit,Write,Read,Glob,Grep,TodoWrite" --permission-mode acceptEdits --max-budget-usd 3`; working directory target-app diatur via opsi `cwd` spawn (absolute path); **prompt dikirim via stdin**; di Windows command di-resolve ke `claude.cmd`/native build (detail §14.2) |
| FR-3 | Sistem mem-parsing setiap baris stdout sebagai JSON; baris non-JSON di-skip dan dicatat ke log debug, tidak crash |
| FR-4 | Event `tool_use` dengan tool `Edit`/`Write` → status `building` (atau `fixing` jika sudah ada percobaan Kane sebelumnya) |
| FR-5 | Event `tool_use` dengan tool `Bash` yang command-nya mengandung `kane-cli run` → status `verifying`, dan `tool_use_id`-nya disimpan |
| FR-6 | Event `tool_result` **hanya** diproses sebagai hasil Kane jika `tool_use_id`-nya cocok dengan yang tersimpan (FR-5); dari output-nya ekstrak baris `run_end` → status passed/failed, alasan singkat, `test_url`, `session_dir` |
| FR-7 | Setiap perubahan status dikirim ke browser via SSE dalam <500ms sejak event diterima |
| FR-8 | **Semua event per run di-buffer di server**; saat klien SSE connect (termasuk reconnect setelah refresh), seluruh buffer di-replay dulu sebelum event live — tidak ada event yang hilang karena race |
| FR-9 | Setiap run disimpan in-memory: prompt, status akhir, jumlah percobaan Kane, Kane log + link bukti |
| FR-10 | `GET /api/history` mengembalikan riwayat run |
| FR-11 | Run baru ditolak (HTTP 409) selama run lain masih berjalan |
| FR-12 | Sinal terminal ganda: event `type:"result"` dari stream-json (memuat `is_error`, `num_turns`) **dan** exit code proses → keduanya memicu `run_complete` (idempotent) |
| FR-13 | Watchdog wall-clock (default 20 menit, dinaikkan dari 10 setelah E2E: satu run kane nyata bisa 200s+, jadi 3 attempt + build/fix butuh ruang): jika run belum selesai, **kill seluruh process tree** (di Windows: `taskkill /PID <pid> /T /F`) → status `failed` dengan alasan "watchdog timeout" — jangan biarkan proses claude/kane menggantung selamanya |
| FR-14 | Prompt wrapper membatasi **maksimal 3 percobaan verifikasi Kane** per run; jika tercapai tanpa pass, run berakhir `failed` (melindungi kredit Kane ~20/run) |
| FR-15 | Link bukti (FR-6) tampil di Kane Log Panel dan tersimpan di history |
| FR-16 | Proses `claude` yang exit dengan error (budget habis, API error) dilaporkan sebagai status `failed` + pesan ke UI, bukan diam |
| FR-17 | `DEMO_MODE=1` menjalankan replay fixture tanpa spawn proses apa pun (§8.6) |

## 10. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Backend tetap responsif menerima request lain walau ada subprocess berjalan (non-blocking I/O, native di Node) |
| NFR-2 | Koneksi SSE putus (refresh) tidak meng-kill subprocess; browser reconnect ke stream yang sama via `runId` dan menerima replay buffer (FR-8) |
| NFR-3 | Semua path yang diberikan ke spawn (`cwd`) harus absolute; penanganan path Windows (`\`, spasi di path seperti `D:\8. Hackathon\...`) di-test eksplisit |
| NFR-4 | Tidak ada API key/access key ter-hardcode — semua lewat environment variable (`.env`, di-gitignore) |
| NFR-5 | Parser stream-json dan parser NDJSON kane dikembangkan & dites melalui **fixture** (transkrip asli), bukan dengan menjalankan claude/kane tiap iterasi |
| NFR-6 | Batas biaya: `--max-budget-usd` per run + cap percobaan kane (FR-14) + watchdog (FR-13) — tiga lapis pengaman agar satu prompt nakal tidak membakar kuota |

## 11. Target App (Aplikasi yang Diverifikasi)

Target-app adalah app kecil, terpisah dari kode ProofLoop, yang berfungsi sebagai "kelinci percobaan" — inilah yang benar-benar diedit Claude Code dan diverifikasi Kane CLI.

- Framework: Express + HTML/CSS/JS statis sederhana (hindari build step tambahan supaya perubahan kode langsung terlihat tanpa rebuild). **Prioritaskan logika di sisi client** (form handling, validasi) supaya edit claude langsung live tanpa restart server.
- Jalan di port tetap: `4000`.
- Berisi skeleton awal yang punya minimal satu flow yang bisa diverifikasi dari prompt pertama (form signup sederhana dengan field email & password, tanpa validasi apa pun) — supaya demo pertama (*"tambahkan validasi email"*) langsung punya sesuatu yang nyata untuk diubah.
- Dijalankan sebagai proses terpisah yang **di-spawn otomatis oleh backend ProofLoop saat startup** (satu perintah untuk semuanya), dengan pengecekan port: jika 4000 terpakai, laporkan jelas dan gagal cepat.
- **Self-contained (baru di v2):**
  - `target-app/CLAUDE.md` — instruksi permanen untuk claude yang bekerja di folder ini: selalu verifikasi dengan kane setelah mengubah kode, objective grammar, batas percobaan (isi lengkap §14.4).
  - `target-app/.claude/skills/kane-cli/` — salinan skill kane-cli (playbook NDJSON, timeout, grammar) sehingga tidak bergantung pada skill level-user di mesin tertentu.
  - `target-app/.testmuai/context.md` — context file opsional untuk kane: deskripsi singkat app, port, dan flow yang ada (kane membacanya otomatis dari cwd).

## 12. Kontrak API

### `POST /api/generate`
Request:
```ts
{ prompt: string }
```
Response (langsung, tidak menunggu proses selesai):
```ts
{ runId: string, status: "started" }
```
Error jika ada run aktif:
```ts
{ error: "A run is already in progress" }  // HTTP 409
```

### `GET /api/stream/:runId` (Server-Sent Events)
Saat connect, server mengirim replay buffer dulu, lalu event live:
```
event: status
data: {"status":"verifying","detail":"kane-cli run --url http://localhost:4000 \"...\""}

event: kane_result
data: {"passed":false,"reason":"Email field accepts empty string","testUrl":"https://test-manager.lambdatest.com/...","evidenceDir":"~/.testmuai/kaneai/sessions/..."}

event: run_complete
data: {"finalStatus":"verified","attempts":2,"numTurns":14,"isError":false}
```

### `GET /api/history`
Response:
```ts
{
  runs: Array<{
    id: string
    prompt: string
    finalStatus: "verified" | "failed" | "unverified"
    kaneAttempts: number
    kaneLog: Array<{ flow: string; passed: boolean; reason?: string; testUrl?: string }>
    startedAt: string
    endedAt: string
  }>
}
```

## 13. Tipe Data (TypeScript)

```ts
type RunStatus =
  | "idle"
  | "building"
  | "verifying"
  | "fixing"
  | "verified"
  | "failed"
  | "unverified"; // fitur selesai tapi tidak pernah diverifikasi kane

interface RunRecord {
  id: string;
  prompt: string;
  status: RunStatus;
  kaneAttempts: number;
  kaneLog: KaneLogEntry[];
  events: RunEvent[];      // buffer untuk replay SSE (FR-8)
  startedAt: Date;
  endedAt?: Date;
}

interface KaneLogEntry {
  flowDescription: string;
  passed: boolean;
  reason?: string;
  testUrl?: string;        // dari run_end.test_url
  evidenceDir?: string;    // dari run_end.session_dir
  timestamp: Date;
}

interface RunEvent {
  kind: "status" | "kane_result" | "run_complete";
  payload: unknown;
  at: Date;
}

interface ClaudeStreamEvent {
  type: "system" | "assistant" | "user" | "result" | string;
  message?: {
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } // id = tool_use_id
      | { type: "tool_result"; tool_use_id: string; content: unknown; is_error?: boolean }
    >;
  };
  subtype?: string;
}
```

> **Catatan implementasi:** skema persis `stream-json` perlu dikonfirmasi dengan satu dry-run manual (`claude -p "list files" --output-format stream-json --verbose` di folder target-app) **sebelum** menulis parser final, lalu hasilnya disimpan sebagai fixture (NFR-5). Kunci korelasi adalah `tool_use.id` ↔ `tool_result.tool_use_id`.

## 14. Pseudocode Backend

### 14.1 Entry point (`server.ts`)
```ts
import express from "express";
import { spawnTargetApp } from "./targetApp";
import { generateRouter } from "./routes/generate";
import { streamRouter } from "./routes/stream";   // mount terpisah — konsisten dengan §12
import { historyRouter } from "./routes/history";

const app = express();
app.use(express.json());
app.use("/api/generate", generateRouter);
app.use("/api/stream", streamRouter);             // GET /api/stream/:runId
app.use("/api/history", historyRouter);
app.use(express.static("frontend-dist"));         // hasil build Vite — 1 port untuk semua

spawnTargetApp(); // start target-app di :4000 sebagai child process (cek port dulu)

app.listen(3001, () => console.log("ProofLoop running on http://localhost:3001"));
```

### 14.2 Menjalankan Claude Code & parsing stream (`runManager.ts`)
```ts
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { EventEmitter } from "events";

const runs = new Map<string, RunRecord>();
let activeRunId: string | null = null;

const TARGET_APP_DIR = path.resolve(__dirname, "../../target-app"); // absolute (NFR-3)
const WATCHDOG_MS = 10 * 60 * 1000;

// Windows: claude terpasang sebagai claude.cmd (npm) atau claude.exe (native build).
// Node >= 20 menolak spawn .cmd tanpa shell. Karena SEMUA argumen statis dan
// prompt dikirim via stdin, spawn via shell aman dari injection.
// Alternatif tanpa shell: pastikan native build terpasang lalu spawn path .exe langsung.
function claudeCommand(): { cmd: string; shell: boolean } {
  return process.platform === "win32"
    ? { cmd: "claude", shell: true }
    : { cmd: "claude", shell: false };
}

export function startRun(prompt: string): string {
  if (activeRunId) throw new Error("RUN_IN_PROGRESS");

  const runId = randomUUID();
  const emitter = new EventEmitter();
  const record: RunRecord = { /* id, prompt, status: "building", kaneAttempts: 0, kaneLog: [], events: [], startedAt: new Date() */ };
  runs.set(runId, record);
  activeRunId = runId;

  const { cmd, shell } = claudeCommand();
  const child = spawn(cmd, [
    "-p",
    "--output-format", "stream-json",
    "--verbose",                                   // verifikasi kebutuhannya via dry-run (§15)
    "--allowedTools", "Bash,Edit,Write,Read,Glob,Grep,TodoWrite",
    "--permission-mode", "acceptEdits",
    "--max-budget-usd", "3",
  ], {
    cwd: TARGET_APP_DIR,                           // ← cara yang benar set working dir (bukan --cwd)
    shell,
    env: { ...process.env, KANE_CLI_USER_AGENT: "claude-code" },
  });

  // Prompt dikirim via stdin — hindari quoting & batas panjang argumen (kritis di Windows)
  child.stdin.write(buildPromptWrapper(prompt));   // template §14.4
  child.stdin.end();

  const pendingKane = new Map<string, { flow: string }>(); // tool_use_id → konteks kane

  const watchdog = setTimeout(() => {
    killTree(child.pid);                           // Windows: taskkill /PID x /T /F
    finalizeRun(runId, "failed", "watchdog timeout");
  }, WATCHDOG_MS);

  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: ClaudeStreamEvent;
      try { event = JSON.parse(line); } catch { logDebug(line); continue; } // FR-3
      handleStreamEvent(runId, event, emitter, pendingKane);
    }
  });

  // FR-12: dua sinyal terminal, idempotent
  let finalized = false;
  const finalize = (finalStatus: RunStatus, why: string) => {
    if (finalized) return; finalized = true;
    clearTimeout(watchdog);
    finalizeRun(runId, finalStatus, why);          // set endedAt, emit run_complete, activeRunId = null
  };

  // catat event result dari stream-json (lebih kaya dari exit code saja)
  // ...di handleStreamEvent: if (event.type === "result") finalize(mapResult(event), "result event");

  child.on("exit", (code) => {
    const r = runs.get(runId)!;
    if (!finalized) finalize(code === 0 ? (r.status === "verified" ? "verified" : "unverified") : "failed", `exit ${code}`);
  });

  return runId;
}

function handleStreamEvent(runId: string, event: ClaudeStreamEvent, emitter: EventEmitter, pendingKane: Map<string, { flow: string }>) {
  const record = runs.get(runId)!;
  const blocks = event.message?.content ?? [];
  if (!Array.isArray(blocks)) return;

  for (const block of blocks) {
    if (block.type === "tool_use" && (block.name === "Edit" || block.name === "Write")) {
      setStatus(record, record.kaneAttempts > 0 ? "fixing" : "building", emitter);
    }

    if (block.type === "tool_use" && block.name === "Bash") {
      const cmd = String(block.input.command ?? "");
      if (cmd.includes("kane-cli run")) {          // spesifik "run" — bukan sekadar "kane-cli"
        pendingKane.set(block.id, { flow: extractObjective(cmd) });
        setStatus(record, "verifying", emitter, cmd);
      }
    }

    if (block.type === "tool_result" && pendingKane.has(block.tool_use_id)) {  // FR-6: korelasi id
      pendingKane.delete(block.tool_use_id);
      const parsed = tryParseKaneResult(block.content); // cari baris {"type":"run_end",...}
      if (parsed) {
        record.kaneAttempts += 1;
        record.kaneLog.push({
          flowDescription: pendingKaneFlowHint(record) ?? parsed.flow,
          passed: parsed.passed,
          reason: parsed.reason,
          testUrl: parsed.testUrl,                 // run_end.test_url  → link bukti (FR-15)
          evidenceDir: parsed.sessionDir,          // run_end.session_dir
          timestamp: new Date(),
        });
        emit(record, emitter, "kane_result", parsed);
        if (parsed.passed) setStatus(record, "verified", emitter);
      }
    }
  }
}

// Semua emit() juga push ke record.events (buffer) — di-replay saat SSE connect (FR-8)
```

> **Catatan:** `tryParseKaneResult` mencari baris `"type":"run_end"` di `tool_result.content` (output kane `--agent` berupa NDJSON multi-baris). Bentuk aslinya sudah terdokumentasi dari 4 run nyata sesi sebelumnya; simpan sebagai fixture — **pastikan fixture mencakup run passed DAN failed**.

### 14.3 Endpoint SSE dengan replay buffer (`routes/stream.ts`)
```ts
router.get("/:runId", (req, res) => {
  const record = getRun(req.params.runId);
  if (!record) return res.status(404).end();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (kind: string, payload: unknown) =>
    res.write(`event: ${kind}\ndata: ${JSON.stringify(payload)}\n\n`);

  // 1) Replay seluruh riwayat run ini dulu — menutup race connect & reconnect (FR-8, NFR-2)
  for (const ev of record.events) send(ev.kind, ev.payload);

  // 2) Lanjut live
  const live = (kind: string, payload: unknown) => send(kind, payload);
  subscribeLive(record, live);

  req.on("close", () => unsubscribeLive(record, live)); // hanya lepas listener klien ini
});
```

### 14.4 Prompt Wrapper & CLAUDE.md target-app

Dua lapis instruksi (wrapper per-run + CLAUDE.md permanen). CLAUDE.md di `target-app/` (dibaca otomatis claude):

```markdown
# Target App — Petunjuk Kerja Agent

App ini di-serve statis di http://localhost:4000 dan sudah berjalan — jangan restart/build.

Aturan:
1. Setelah MENGUBAH kode apa pun, kamu WAJIB memverifikasi dengan Kane CLI sebelum
   menganggap tugas selesai:
   kane-cli run --agent --url http://localhost:4000 --timeout 300 "<objective>"
2. Output kane adalah NDJSON; run berakhir di baris {"type":"run_end","status":"passed"|"failed"}.
   Jika failed: baca summary/remark, perbaiki kode, verifikasi lagi. Maksimal 3 percobaan.
3. Objective grammar (hasil empiris — patuhi):
   - Tulis aksi sebagai perintah langsung. JANGAN pakai frasa kondisional ("if not logged in...")
     — kane membacanya sebagai checkpoint analisis, bukan aksi.
   - Klik dulu sebuah field untuk fokus sebelum mengetik (type tanpa fokus kadang tidak landing).
   - Akhiri objective dengan assertion terminal yang jelas ("verify that ... appears").
4. Jangan mengubah server Express kecuali benar-benar perlu — utamakan logika di sisi client
   supaya perubahan langsung live.
```

Wrapper per-run (dikirim via stdin setelah prompt user):

```
Implement this feature request in the current repository (a small Express + static web app):

"""<PROMPT_USER>"""

Follow the rules in CLAUDE.md. Summary:
- Make the change with minimal edits.
- The app is already running at http://localhost:4000 (static files are live — no rebuild needed).
- Verify with kane-cli after every change (max 3 attempts), as described in CLAUDE.md.
- Finish with a one-paragraph report: what changed, verification status, evidence URL.
```

## 15. Setup Environment (Prasyarat Sebelum Coding)

1. `npm install -g @anthropic-ai/claude-code` — pastikan `claude` bisa dipanggil dari terminal mana pun (di Windows: cek `claude.cmd` di PATH npm global, atau pasang native build).
2. `ANTHROPIC_API_KEY` sudah di-set (atau subscription login aktif) — di `.env`, di-gitignore.
3. **Dry-run stream-json (satu kali, sebelum parser ditulis):** `claude -p "list the files" --output-format stream-json --verbose` di folder target-app → simpan output sebagai fixture; konfirmasi apakah `--verbose` diperlukan dan bentuk persis event `tool_use`/`tool_result`/`result`.
4. `npm install -g @testmuai/kane-cli`, lalu `kane-cli login` — sekali per mesin.
5. Chrome terinstal (dibutuhkan Kane CLI).
6. Node.js v20+ terinstal.
7. **Fixture kane:** jalankan 1 run passed + 1 run failed yang direkam dari sesi uji sebelumnya (sudah ada 4 transkrip failed — yang perlu ditambah: satu passed) → simpan di `fixtures/`.
8. Repo GitHub baru, **di-init di dalam window event** (aturan lomba: commit history dicek). Konfirmasi tanggal window perpanjangan ke organizer.

## 16. Definition of Done (Selaras Kriteria Juri)

- [ ] **Ships**: user buka ProofLoop (satu perintah `npm start`), ketik prompt apa pun, dan target-app benar-benar berubah sesuai prompt.
- [ ] **Verified**: setiap fitur yang selesai punya minimal satu run Kane yang lulus, terlihat di log panel **beserta link dashboard/evidence yang bisa diklik juri** — bukan status hardcode.
- [ ] **Closed loop**: terdapat momen Kane gagal → Claude Code edit ulang tanpa campur tangan manusia → Kane lulus, semua dalam satu sesi `claude -p` yang sama; momen ini terekam utuh tanpa cut di video.
- [ ] **Craft**: UI menampilkan loop secara visual real-time (stepper + log + bukti), Chrome Kane tetap visible saat demo, dan fallback replay mode bekerja di URL hosted.
- [ ] **Submission lengkap**: repo public + README setup, video ≤3 menit (§18.2), satu paragraf deskripsi, live URL fallback / runnable command.

## 17. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Claude Code tidak memanggil Kane CLI (menganggap tidak perlu verifikasi) | Dua lapis: `CLAUDE.md` permanen di target-app + wrapper per-run (§14.4); status akhir `unverified` diekspos jujur di UI/history — tidak bisa dianggap selesai diam-diam |
| Skema `stream-json` berbeda dari asumsi §13 | Dry-run manual + fixture sebelum parser final (§15.3) |
| Claude Code stuck loop / membakar biaya | `--max-budget-usd 3` + cap 3 percobaan kane + watchdog kill-tree 10 menit (FR-13/14, NFR-6) |
| Kane hang di tengah run (terjadi nyata di sesi uji: macet ~90 detik) | `--timeout 300` di command kane (dipakai claude) + watchdog backend |
| Port 4000 terpakai proses lain | Cek port saat startup, gagal cepat dengan pesan jelas |
| Windows: spawn `.cmd` ditolak Node 20+ | §14.2 `claudeCommand()` — shell:true aman karena prompt via stdin & argumen statis; atau native build `.exe` |
| Event SSE hilang karena race connect/reconnect | Buffer + replay (FR-8) |
| Juri tidak bisa/mau setup lokal | Fallback hosted replay mode (§8.6, §18.3) + video sebagai bukti utama + README satu perintah |
| Kredit Kane habis saat event | Cap percobaan per run; flow kane yang sama di-cache dan replay gratis; DM organizer Slack sebelum habis |
| Ide serupa dipakai peserta lain (Lane 1) | Diferensiasi: bukti klik-able per run, visualisasi loop, kejujuran arsitektur passive-listener (§2) |

## 18. Strategi Demo & Submission

### 18.1 Satu perintah lokal
`npm start` di root repo: cek prasyarat (node, claude, kane auth, port 3001/4000 bebas) → install deps → spawn target-app → serve backend + frontend build. README menulis prasyarat yang tidak bisa diotomasi (claude auth, kane auth, `ANTHROPIC_API_KEY`).

### 18.2 Rencana video (≤3 menit, hard cap — juri berhenti di 3:00)
1. **0:00–0:20 — Hook:** "Agent membangun fitur, Kane membuktikannya bekerja, tanpa manusia menyentuh browser." Tampilkan UI ProofLoop.
2. **0:20–1:00 — Trigger live:** ketik prompt segar (tanpa cut), tekan Generate. Stepper jalan: Building.
3. **1:00–2:20 — Momen kunci (real-time):** Chrome Kane terbuka & menjalankan flow → Verifying → Kane **gagal** → alasan muncul di panel + link bukti → claude kembali Fixing → verifikasi ulang → **Verified**. Inilah "the good part" — jangan di-time-lapse.
4. **2:20–2:50 — Bukti:** klik `test_url` dashboard LambdaTest + evidence pack; buka history (attempts: 2 — loop bekerja).
5. **2:50–3:00 — Closing:** satu kalimat: repo, satu perintah, fallback URL.

Praktik: latih dengan 2–3 prompt yang **terbukti** memicu siklus gagal→perbaiki→lulus (mis. validasi email yang sengaja mengecoh di percobaan pertama) — tetap jujur karena bug & perbaikannya nyata, hanya saja sudah diketahui andalnya.

### 18.3 Fallback hosted
Deploy `DEMO_MODE=1` build (backend replay + frontend) ke host statis/node gratisan. Banner "Replay of a real run (recorded <tanggal>)" selalu tampil. Ini memenuhi "live URL" untuk akses <30 detik, dengan aturan lomba sendiri yang mengizinkan fallback ("include a fallback, a recorded run or a backup deploy").

### 18.4 Paragraf submission (draft)
> ProofLoop is a live window into an agent's build-verify loop. Type a feature request in plain English; a headless Claude Code session implements it in a small target app, then calls Kane CLI itself to verify the change in a real browser — reading Kane's NDJSON result, fixing what failed, and re-verifying, all in one autonomous session. ProofLoop's backend never calls Kane: it only translates the agent's own tool stream into a real-time status UI, with clickable Kane evidence (dashboard run URL + evidence pack) for every verification. Built with Claude Code; verified with Kane CLI; ships with a one-command local setup and an honest hosted replay fallback.

---

**Selanjutnya:** PRD v2 siap dieksekusi. Urutan yang disarankan: (1) prasyarat §15 termasuk dry-run stream-json & fixture passed-run, (2) target-app + CLAUDE.md + skill, (3) backend parser dengan fixture, (4) UI, (5) latihan momen demo & rekam video.
