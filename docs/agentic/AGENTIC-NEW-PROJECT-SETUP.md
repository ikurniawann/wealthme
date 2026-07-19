# Setup Awal Project Baru Untuk Agentic Looping Agent

Dokumen ini adalah checklist saat membuat project baru agar langsung bisa
memakai workflow agentic seperti WealthMe: `/agentic-start`, ECC, Ruflo,
AgentDB, Graphify, Claude Code, dan Codex.

## 0. Tujuan Setup

Setelah setup ini selesai, project baru harus bisa:

- menerima task mentah lewat `/agentic-start`
- mengubah task menjadi epic/task group di `docs/epics/`
- memilih agent route yang sesuai dari ECC + Ruflo + Graphify
- menjalankan development satu task group per PR
- menyimpan keputusan penting ke docs, bukan hanya memory runtime
- memakai Codex untuk hygiene pass setelah Claude Code development

## 1. Prasyarat User-Level

Pastikan file user-level ini ada:

```text
~/.claude/commands/agentic-start.md
~/.agentic-workflows/claude-codex-docs-workflow.md
~/.agentic-workflows/bootstrap-new-project.md
~/.agentic-workflows/templates/
~/.codex/AGENTS.md
~/.codex/config.toml
```

Fungsi masing-masing:

| File                                                 | Fungsi                                               |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `~/.claude/commands/agentic-start.md`                | Global Claude Code command untuk mulai dari raw task |
| `~/.agentic-workflows/claude-codex-docs-workflow.md` | Workflow pusat lintas project                        |
| `~/.agentic-workflows/bootstrap-new-project.md`      | Panduan bootstrap project baru                       |
| `~/.agentic-workflows/templates/`                    | Template minimal untuk repo baru                     |
| `~/.codex/AGENTS.md`                                 | Instruksi global Codex                               |
| `~/.codex/config.toml`                               | Profile Codex, termasuk `workflow-hygiene`           |

## 2. Buat Project Baru

Contoh:

```bash
mkdir my-crm
cd my-crm
git init
```

Kalau project sudah ada:

```bash
cd existing-project
```

## 3. Jalankan Claude Code Dan Drop Task Pertama

Di Claude Code, jalankan:

```text
/agentic-start "Build an MVP CRM with contacts, companies, deals, auth, dashboard, and activity timeline"
```

Expected behavior:

1. Claude Code membaca workflow user-level.
2. Claude Code mendeteksi project belum agentic-ready.
3. Claude Code melakukan bootstrap workflow sebelum coding.
4. Claude Code membuat atau mengusulkan file minimal:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `docs/AGENTIC-WORKFLOW.md`
   - `docs/epics/README.md`
   - `docs/epics/EPIC-000-project-bootstrap.md`
5. Claude Code membuat epic awal dengan `status: backlog`.

> Catatan: kalau Claude Code belum otomatis menulis template, minta eksplisit:
> "Bootstrap this repo using `~/.agentic-workflows/templates/`, then create the first epic from the task."

## 3A. Jika Brief Awal Berupa Dokumen Project

Kalau input awal project berupa dokumen seperti:

```text
docs/WealthMe_PROJECT.md
docs/WealthMe_DATABASE.md
docs/WealthMe_Development.md
docs/WealthMe_Backend_Plan.md
```

jalankan:

```text
/agentic-start "Initialize product docs from docs/WealthMe_PROJECT.md docs/WealthMe_DATABASE.md docs/WealthMe_Development.md docs/WealthMe_Backend_Plan.md"
```

Expected behavior:

1. `/agentic-start` mengklasifikasikan input sebagai `product-synthesis`.
2. ECC `product-capability` dipakai untuk mengekstrak constraint produk dan engineering.
3. ECC planner/architect membantu sequencing capability.
4. Ruflo/AgentDB dipakai jika perlu ekstraksi paralel dari beberapa brief docs atau lookup keputusan lama.
5. Graphify dipakai hanya jika sudah ada code graph atau brief merujuk arsitektur kode existing.
6. File berikut dibuat atau direfresh:
   - `docs/product/PRD.md`
   - `docs/product/USER-STORIES.md`
   - `docs/product/ENGINEERING-TASKS.md`
7. Baru setelah itu epics dibuat dari engineering tasks.

Aturan penting: agent tidak boleh mengarang product truth. Asumsi yang belum
jelas harus masuk bagian `Open Questions`.

## 4. Struktur Minimal Yang Harus Ada

```text
my-crm/
  AGENTS.md
  CLAUDE.md
  docs/
    AGENTIC-WORKFLOW.md
    epics/
      README.md
      EPIC-000-project-bootstrap.md
  .gitignore
```

Opsional setelah project matang:

```text
  .claude/
    commands/
      agentic-start.md
      epic-new.md
      task-work.md
      epic-loop.md
    agents/
      project-review-agent.md
      project-security-agent.md
      project-test-agent.md
```

Jangan buat custom agents terlalu cepat. Mulai dengan ECC + Ruflo dulu.

## 5. Isi Minimal `AGENTS.md`

`AGENTS.md` adalah entrypoint Codex.

Minimal harus menjawab:

- project ini pakai workflow apa?
- docs source of truth ada di mana?
- command Claude Code apa yang dipakai?
- guardrails apa yang wajib?
- kapan pakai ECC, Ruflo, Graphify?

Gunakan template:

```text
~/.agentic-workflows/templates/AGENTS.md
```

## 6. Isi Minimal `CLAUDE.md`

`CLAUDE.md` adalah entrypoint Claude Code.

Minimal harus menjawab:

- kalau user drop raw task, default ke `/agentic-start`
- custom/project agents apa yang ada
- command local apa yang tersedia
- review/security/test gate apa yang wajib
- production boundaries apa yang tidak boleh disentuh

Gunakan template:

```text
~/.agentic-workflows/templates/CLAUDE.md
```

## 7. Buat Epic Pertama

Epic pertama biasanya bootstrap/foundation.

Kalau product docs sudah dibuat, epic pertama sebaiknya diturunkan dari:

```text
docs/product/PRD.md
docs/product/USER-STORIES.md
docs/product/ENGINEERING-TASKS.md
```

Gunakan template:

```text
~/.agentic-workflows/templates/docs/EPIC-000-project-bootstrap.md
```

Status awal:

```markdown
status: backlog
```

Ubah menjadi:

```markdown
status: on-progress
```

hanya setelah kamu siap memulai development.

## 8. Jalankan Development Pertama

Jika project belum punya `/task-work`, gunakan `/agentic-start` lagi:

```text
/agentic-start "Start EPIC-000 task 1"
```

Jika project sudah punya `/task-work`:

```text
/task-work EPIC-000 1
```

Expected development loop:

```text
task group
-> evidence map
-> agent route selection
-> implementation
-> ECC review/security gates
-> project scripts/tests
-> update Automation Log
-> optional PR
```

## 9. Agent Routing Di Project Baru

Default routing:

| Task shape                     | Agent route                                            |
| ------------------------------ | ------------------------------------------------------ |
| Simple docs/workflow           | main session, Codex hygiene later                      |
| React/web UI                   | ECC React/TS reviewers, project UI conventions if any  |
| Backend/API                    | ECC framework skill, TS reviewer, security gate        |
| Database/schema                | ECC database/prisma/postgres skills, database reviewer |
| Auth/security/money/tenant     | ECC security reviewer from the start                   |
| Unknown/broad task             | Ruflo swarm + AgentDB memory + ECC planner/architect   |
| Architecture/file relationship | Graphify query if graph exists                         |

Custom agents baru dibuat hanya jika ada local behavior yang berulang:

- domain-specific acceptance criteria
- project-specific test/deploy scripts
- security/tenant policy khusus
- UI conventions khusus
- release/deploy boundary khusus

Kalau cuma generic React/TS/security/database review, pakai ECC built-ins.

## 10. Ruflo, AgentDB, Dan Graphify

Gunakan Ruflo/AgentDB untuk:

- discovery paralel
- memory keputusan
- pattern yang berulang
- mencari temuan dari epic/session sebelumnya

Gunakan Graphify untuk:

- hubungan antar file
- arsitektur
- dependency path
- query codebase tanpa membaca ulang banyak file

Graphify tidak menggantikan AgentDB. AgentDB menyimpan memory/pattern; Graphify
menyimpan graph arsitektur/code relationship.

## 11. Codex Hygiene Pass

Setelah 1-2 task/epic berjalan, jalankan:

```bash
codex -p workflow-hygiene
```

Prompt:

```text
Use the claude-codex docs workflow. Audit this new project's agentic workflow.
Normalize AGENTS.md, CLAUDE.md, docs/AGENTIC-WORKFLOW.md, docs/epics status
vocabulary, runtime ignores, and command docs. Keep the workflow reusable.
```

Codex bertugas merapikan workflow, bukan menggantikan Claude Code sebagai
development runner.

## 12. Kapan Project Dianggap Agentic-Ready

Project siap untuk agentic looping kalau:

- [ ] `AGENTS.md` ada dan jelas
- [ ] `CLAUDE.md` ada dan jelas
- [ ] `docs/AGENTIC-WORKFLOW.md` ada
- [ ] `docs/epics/README.md` ada
- [ ] minimal satu epic ada
- [ ] status vocabulary canonical dipakai
- [ ] guardrails tertulis
- [ ] test/build/lint/security command diketahui
- [ ] `.swarm/`, `.claude-flow/`, `graphify-out/` di-ignore bila runtime-local
- [ ] hasil Ruflo/AgentDB wajib dicatat di docs
- [ ] Codex hygiene pass bisa dijalankan

## 13. Kapan Project Menjadi Template

Project bisa dijadikan template setelah:

1. minimal satu raw task berhasil menjadi epic
2. minimal satu task group berhasil masuk development loop
3. review/security/test gate terdokumentasi
4. custom agents, jika ada, benar-benar project-specific
5. Codex hygiene pass sudah merapikan instruksi

Setelah itu, copy pola project tersebut ke:

```text
~/.agentic-workflows/templates/<project-type>/
```

atau jadikan repo template Git.

## 14. Real-Case Ringkas

```text
User:
/agentic-start "Build MVP CRM: contacts, companies, deals, auth, dashboard"

Claude:
- project belum agentic-ready
- bootstrap AGENTS/CLAUDE/docs/epics
- create EPIC-000 Project Bootstrap
- create EPIC-001 CRM MVP
- route: ECC planner + Ruflo discovery later
- status: backlog

User review:
ubah EPIC-001 ke status: on-progress

User:
/agentic-start "Start EPIC-001 task 1"

Claude:
- pilih task group pertama
- route: ECC planner + code-agent/main session
- implement focused diff
- run gates
- update Automation Log
```
