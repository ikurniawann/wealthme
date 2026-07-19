# WealthMe Agentic Agent Loop

Dokumen ini menjelaskan loop kerja dari task/enhancement mentah sampai menjadi
epic, lalu masuk development dengan memaksimalkan Claude Code, ECC, Ruflo,
AgentDB, Graphify, dan Codex.

Workflow ringkas:

```text
Drop task -> Intake -> Evidence map -> Epic/task shaping -> Agent routing ->
Development loop -> Review/security/test gates -> PR/dev deploy -> Codex hygiene ->
Durable docs/memory
```

Untuk project baru dengan brief dokumen besar, sisipkan fase product synthesis:

```text
Brief docs -> Product synthesis -> PRD/User Stories/Engineering Tasks ->
Epics -> Development loop
```

## 1. Mental Model

| Layer       | Fungsi utama                               | Output yang harus bertahan                               |
| ----------- | ------------------------------------------ | -------------------------------------------------------- |
| `docs/`     | Source of truth pekerjaan                  | Epic, task group, acceptance criteria, Automation Log    |
| Claude Code | Development runner                         | Branch, code changes, tests, PR                          |
| ECC         | Planner, reviewers, quality/security gates | Review verdict, test plan, framework guidance            |
| Ruflo swarm | Parallel exploration                       | Evidence map, scoped findings, risk list                 |
| AgentDB     | Persistent memory/patterns                 | Reusable decisions and learned task patterns             |
| Graphify    | Codebase knowledge graph                   | Architecture map, relationship query, GraphRAG artifacts |
| Codex       | Workflow hygiene                           | Clean instructions, normalized statuses, runbook updates |

Prinsip utamanya: **Ruflo/AgentDB/Graphify boleh mempercepat discovery, tapi
keputusan penting harus tetap masuk dokumen tracked**. Memory runtime bukan
pengganti `docs/epics/*`.

## 2. Command Yang Dipakai

### Intake otomatis

Gunakan ini di Claude Code saat kamu punya task/enhancement mentah:

```text
/agentic-start "<task atau enhancement>"
```

Command ini melakukan:

1. membaca workflow user-level dan repo-level
2. mencari apakah task sudah ada di `docs/epics/`
3. memakai ECC/Ruflo/Graphify untuk scoping bila perlu
4. membuat atau memperbarui epic/task group
5. menentukan agent routing
6. bila task sudah jelas, memulai development loop satu task group

### Membuat epic saja

```text
/epic-new "<feature description>"
```

Pakai ini kalau kamu hanya ingin membuat epic `status: backlog`, lalu review
manual sebelum development.

### Mengerjakan satu task group

```text
/task-work EPIC-XXX <n>
```

Ini jalur utama untuk development harian. Satu `### task group` berarti satu
branch, satu gate cycle, dan satu PR.

### Mengerjakan seluruh epic

```text
/epic-loop docs/epics/EPIC-XXX-slug.md
```

Pakai hanya jika epic sudah bersih, task kecil-kecil, dan acceptance criteria
jelas. Untuk task yang masih berantakan, pakai `/agentic-start` atau
`/task-work`.

## 3. Dari Drop Task Ke Epic

### Step A — Drop task

Contoh input:

```text
/agentic-start "Tambah fitur recurring transaction untuk transaksi bulanan, termasuk reminder dan edit schedule"
```

### Step B — Intake classifier

Agent utama mengklasifikasikan task:

| Jenis input                | Aksi                                                                           |
| -------------------------- | ------------------------------------------------------------------------------ |
| Bug/regression jelas       | cari epic bug aktif atau buat epic bug baru                                    |
| Enhancement produk         | cek `docs/product/*`, `docs/BACKLOG.md`, `docs/epics/*`                        |
| Refactor/infra             | cek blast radius dan test gate sebelum dibuat epic                             |
| Security/compliance        | route ke ECC security + project security-agent                                 |
| UI/page work               | baca `apps/web/WM_CONVENTIONS.md` dan Next.js docs lokal                       |
| Initial project brief docs | generate `docs/product/PRD.md`, `USER-STORIES.md`, `ENGINEERING-TASKS.md` dulu |

Done signal intake:

- ada epic target yang cocok, atau
- ada epic baru di `docs/epics/EPIC-XXX-*.md`
- untuk brief project baru, ada product docs di `docs/product/`

### Step B2 — Product synthesis dari brief docs

Jika input awal berupa dokumen project seperti `PROJECT`, `DATABASE`,
`Development`, `Backend_Plan`, atau roadmap besar, `/agentic-start` harus
membuat product docs sebelum epics:

```text
docs/product/PRD.md
docs/product/USER-STORIES.md
docs/product/ENGINEERING-TASKS.md
```

Routing:

- ECC `product-capability` untuk mengubah product intent menjadi constraints.
- ECC planner/architect untuk sequencing.
- Ruflo/AgentDB untuk ekstraksi paralel dari beberapa brief docs dan lookup
  keputusan lama.
- Graphify hanya jika ada graph existing atau brief merujuk arsitektur kode.

Output minimal:

- PRD: goal, personas, scope, non-goals, features, metrics, risks, open questions.
- User Stories: persona/domain, story, acceptance criteria, priority.
- Engineering Tasks: task ID, area, complexity, dependencies, test plan, risk,
  candidate epic.

### Step C — Evidence map

Sebelum coding, agent membuat evidence map:

```markdown
#### Evidence

- Source doc/user request:
- Existing related epic/task:
- Existing implementation:
- Missing behavior:
- Relevant files:
- Risks:
- Test targets:
```

Gunakan alat sesuai kebutuhan:

| Situasi                                          | Tool                       |
| ------------------------------------------------ | -------------------------- |
| Perlu tahu arsitektur/file relationship          | Graphify query             |
| Perlu eksplorasi paralel lintas web/api/packages | Ruflo swarm                |
| Perlu ingatan keputusan sebelumnya               | AgentDB memory search      |
| Perlu API/framework docs terbaru                 | ECC docs-lookup / Context7 |
| Perlu rencana task breakdown                     | ECC planner / `/ecc:plan`  |

### Step D — Epic shaping

Epic baru atau task baru harus punya bentuk ini:

```markdown
# EPIC-XXX: Title

status: backlog
environment: dev
phase: <n>
priority: <P0|P1|P2>
area: <Frontend|Backend|Infra|Backend + Frontend>

## Goal

...

## Tasks

### Task group title

- [ ] Implementation sub-step
- [ ] Verification sub-step
- [ ] Docs/handoff sub-step

#### Evidence

- ...

#### Scope

- In:
- Out:

#### Acceptance Criteria

- ...

#### Test Plan

- Static:
- Unit/integration:
- E2E/manual:

#### Agent Routing

- Scope:
- Implement:
- Review:
- Verify:

#### Done Signal

- ...

## Acceptance Criteria

- Epic-level criteria

## Dependencies

- ...

## Automation Log

<!-- agent loop appends here -->
```

Default status untuk epic baru adalah `backlog`. Ubah ke `on-progress` hanya
ketika task sudah direview dan siap dijalankan.

## 4. Agent Routing Yang Dimaksimalkan

Gunakan agent berdasarkan fase, area, risiko, dan uncertainty; **bukan semua
agent sekaligus**. Maksimal berarti presisi routing, bukan fan-out paling besar.

### Agent Inventory

Saat `/agentic-start` mulai, agent utama harus membuat inventory mental:

| Kelompok               | Contoh                                                                                                                           | Dipakai untuk                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Custom WealthMe agents | `code-agent`, `review-qa-agent`, `security-agent`, `test-agent`, `deploy-agent`, `epic-orchestrator`                             | aturan repo, WM conventions, scripts, tenant scoping, DEV deploy |
| ECC agents/skills      | planner, architect, React/TS reviewers, security reviewer, build resolver, database reviewer, docs lookup, TDD, framework skills | generic engineering expertise dan gates                          |
| Ruflo/AgentDB          | memory search/store, swarm init, agent spawn, task orchestration                                                                 | discovery paralel, memory keputusan, pattern reuse               |
| Graphify               | `graphify query`, `path`, `explain`, `--update`                                                                                  | arsitektur dan hubungan file berbasis graph/cache                |

### Custom Agents vs ECC/Ruflo

Jangan pilih salah satu secara mutlak. Pola terbaik untuk repo ini adalah
**hybrid**:

- ECC menjadi default untuk generic expertise: React, TypeScript, security,
  build failures, database, framework docs, planning.
- Ruflo menjadi default untuk multi-agent exploration dan memory, terutama saat
  task lintas area atau belum jelas.
- Custom `.claude/agents` tetap dipakai untuk hal yang sangat WealthMe-specific:
  WM conventions, acceptance criteria, tenant scoping, repo scripts, dan
  DEV-only deploy.

Custom agent bagus jika ia menambahkan konteks lokal yang ECC/Ruflo tidak tahu.
Custom agent buruk jika hanya menduplikasi ECC reviewer generik. Kalau agent
custom tidak punya aturan WealthMe-specific, lebih baik pakai ECC built-in.

### Dynamic Route Packages

`/agentic-start` memilih route package berikut:

| Task shape                          | Route                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Simple one-file docs/workflow       | main session + Codex hygiene later; no Ruflo swarm                                                                       |
| Simple web page/component           | `code-agent` + Context7/Next docs if API-specific + `ecc:react-reviewer` + `ecc:typescript-reviewer` + `review-qa-agent` |
| API/NestJS endpoint                 | `code-agent` + `nestjs-best-practices` + `ecc:typescript-reviewer` + `security-agent`                                    |
| Prisma/schema/query                 | `database-migrations` / `prisma-patterns` / `postgres-patterns` + `database-reviewer` + `security-agent`                 |
| Auth, tenant, role, money/security  | ECC security reviewer + project `security-agent` from the start; add Ruflo exploration if cross-cutting                  |
| Build failure                       | `ecc:react-build` or build resolver first, then rerun gates                                                              |
| Unknown or broad cross-area task    | Ruflo hierarchical swarm for read-only scoping + ECC planner/architect before implementation                             |
| Possible duplicate/existing feature | Graphify query + Ruflo scout before creating files                                                                       |

| Fase           | Primary                                      | Support                                       | Output              |
| -------------- | -------------------------------------------- | --------------------------------------------- | ------------------- |
| Intake         | Claude main session                          | ECC planner, AgentDB memory                   | target epic/task    |
| Evidence       | Ruflo swarm                                  | Graphify, RTK, repository search              | evidence map        |
| Architecture   | ECC architect/planner                        | Context7/docs-lookup                          | implementation plan |
| Implementation | `code-agent`                                 | framework skill sesuai area                   | code diff           |
| React review   | `ecc:react-reviewer`                         | `review-qa-agent`                             | PASS/FAIL           |
| TS review      | `ecc:typescript-reviewer`                    | `type-design-analyzer` if needed              | PASS/FAIL           |
| Backend review | `nestjs-best-practices`, `database-reviewer` | security reviewer                             | PASS/FAIL           |
| Security       | `ecc:security-reviewer`                      | `security-agent`                              | PASS/FAIL           |
| Tests          | `test-agent`                                 | `ecc:react-build` / build resolver on failure | PASS/FAIL           |
| E2E            | `e2e-runner` / Playwright                    | browser evidence                              | screenshots/logs    |
| Hygiene        | Codex                                        | docs/runbook diff                             | clean workflow docs |

### When To Escalate

| Problem                       | Escalate to                                |
| ----------------------------- | ------------------------------------------ |
| Ambiguous product scope       | ECC planner / architect                    |
| Multi-area unknowns           | Ruflo hierarchical swarm                   |
| Framework API uncertainty     | Context7 / docs-lookup                     |
| Repeated build failure        | `ecc:react-build` or build resolver        |
| Possible tenant leakage       | `security-agent` + `ecc:security-reviewer` |
| Large stale docs/instructions | Codex workflow hygiene                     |

## 5. Development Loop

Set epic to `on-progress`, then run:

```text
/task-work EPIC-XXX 1
```

Loop internal:

```text
code-agent
  -> ECC review gate
  -> project QA gate
  -> ECC security gate
  -> project security gate
  -> test-agent
  -> retry up to 3
  -> update epic log
  -> commit/push/PR to development
```

Rules:

- satu task group = satu focused diff
- maksimal 3 attempts
- test tidak boleh dilemahkan agar lulus
- high/critical review finding memblokir
- production deploy selalu manual

## 6. Ruflo + AgentDB Usage

Ruflo paling bernilai di awal task, bukan di akhir.

Gunakan untuk:

- memetakan file relevan sebelum edit
- membandingkan apakah fitur sudah ada dengan route/nama berbeda
- mencari coupling web/api/packages
- menyimpan pattern sukses seperti "route audit false positive" atau
  "BetterAuthGuard vs legacy JwtAuthGuard"

Pattern penyimpanan:

```text
namespace: wealthme-<epic-id>
key: <short-finding-name>
content:
  - conclusion
  - evidence
  - affected files
  - decision
  - test proof
```

Setelah disimpan ke AgentDB, salin ringkasannya ke `Automation Log`. Jika hanya
tersimpan di `.swarm/memory.db`, session berikutnya bisa menemukannya, tapi
manusia dan GitHub tidak akan melihat keputusan itu.

## 7. Graphify vs AgentDB

Graphify **tidak di-takeover** oleh AgentDB. Mereka beda pekerjaan.

| Tool          | Cocok untuk                                                           | Hemat token dari                                   |
| ------------- | --------------------------------------------------------------------- | -------------------------------------------------- |
| Graphify      | pertanyaan arsitektur, hubungan file, dependency path, komunitas kode | tidak membaca ulang banyak file; query graph/cache |
| AgentDB/Ruflo | ingatan keputusan, pattern task, swarm coordination, session memory   | tidak mengulang reasoning dan discovery agent      |

Gunakan Graphify ketika pertanyaannya:

- "file mana yang terkait?"
- "alur data dari auth ke controller apa?"
- "komponen ini dipakai di mana?"
- "apa shortest path antara modul A dan B?"

Gunakan AgentDB/Ruflo ketika pertanyaannya:

- "apa keputusan terakhir soal EPIC-009?"
- "pattern apa yang sudah terbukti untuk audit menu?"
- "agent mana harus memetakan backend/frontend paralel?"
- "temuan swarm sebelumnya apa?"

Graphify bisa menghemat token jika `graphify-out/graph.json` sudah ada karena
agent dapat query graph daripada membaca repo luas. Untuk codebase yang berubah,
pakai:

```text
/graphify . --update
```

Jangan jalankan full graphify setiap task kecil. Gunakan:

- full/rebuild setelah perubahan arsitektur besar
- `--update` setelah batch perubahan signifikan
- `graphify query` untuk discovery harian

## 8. Codex Hygiene Pass

Setelah Claude Code selesai development atau beberapa PR selesai, jalankan Codex
untuk merapikan workflow:

```bash
codex -p workflow-hygiene
```

Prompt yang disarankan:

```text
Use the claude-codex docs workflow. Audit the WealthMe workflow docs after the
latest Claude Code development pass. Normalize statuses, check AGENTS/CLAUDE
alignment, ensure Ruflo findings are durable, and review the diff.
```

Codex tidak menggantikan `/task-work`; Codex menjaga supaya sistem kerja tetap
bersih dan tidak makin kusut setelah banyak agent berjalan.

## 9. Automatic Workflow Policy

Jika user memberikan task mentah di Claude Code, default runner seharusnya:

1. menjalankan `/agentic-start "<task>"`
2. membuat atau memilih epic
3. menulis evidence map
4. route ke ECC/Ruflo/Graphify sesuai kebutuhan
5. jika task sudah PR-sized dan user meminta mulai, lanjut ke `/task-work`
6. setelah selesai, update docs dan Automation Log

Jika user hanya berkata "rapihkan workflow", Codex yang mengambil alih.

## 10. Anti-Patterns

- Menjalankan Ruflo swarm untuk task satu file yang jelas.
- Membuat fitur baru tanpa cek apakah sudah ada dengan nama route berbeda.
- Menyimpan keputusan hanya di AgentDB tanpa mencatat di docs.
- Menjalankan Graphify full rebuild setiap task kecil.
- Menggunakan semua ECC reviewers tanpa mempertimbangkan file yang berubah.
- Mengubah `status: on-progress` sebelum task punya acceptance criteria.
- Membiarkan `docs/BACKLOG.md` mengalahkan status canonical di `docs/epics/`.
