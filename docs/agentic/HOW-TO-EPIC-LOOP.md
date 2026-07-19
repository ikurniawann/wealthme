# How-To: Autonomous Epic Loop (`/epic-loop`)

Runbook untuk menjalankan automasi berbasis epic di repo WealthMe.
Ringkasan konfigurasi ada juga di `../CLAUDE.md` dan `AGENTIC-WORKFLOW.md`.

Workflow user-level lintas Claude Code + Codex:

`/home/stealth/.agentic-workflows/claude-codex-docs-workflow.md`

```
Epic -> Plan -> Code -> Review & QA -> Security -> Test -> Deploy DEV -> Update Epic -> Continue
```

## 1. Prasyarat

- Node 20+ & pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- `pnpm install` di root monorepo sudah jalan
- Layanan dev (opsional, untuk task backend): `docker compose up` (postgres/redis/minio/mailhog)
- Buka repo di Claude Code untuk sesi development (config otomatis terbaca dari `.claude/`)
- Gunakan Codex untuk hygiene pass: sinkron `AGENTS.md`/`CLAUDE.md`, status docs,
  runbook, dan verifikasi diff setelah development.

## 2. Menyiapkan epic

Loop **hanya** memproses epic yang `status: on-progress`. Edit frontmatter epic target:

```markdown
# EPIC-001: Backend Foundation

status: on-progress <-- ubah dari "planned" ke "on-progress"
environment: dev
```

Status lifecycle canonical:
`backlog -> on-progress -> coding -> review -> testing -> deploying-dev -> ready-for-qa`
(atau `blocked`; `done` untuk pekerjaan yang sudah ditutup).

## 3. Menjalankan

Dari sesi utama Claude Code:

Untuk task/enhancement mentah, mulai dari:

```text
/agentic-start "deskripsi task/enhancement"
```

Command ini akan mencari/membuat epic, membuat evidence map, memakai ECC/Ruflo/
Graphify bila relevan, lalu memulai development hanya jika task sudah PR-sized.

```text
/epic-loop docs/epics/EPIC-001-backend-foundation.md
```

- Tanpa argumen: `/epic-loop` -> otomatis memilih epic pertama yang `status: on-progress`.
- Command ada di `.claude/commands/epic-loop.md` (terdaftar juga sebagai skill `epic-loop`).

Untuk satu task/PR saja, lebih aman gunakan:

```text
/task-work EPIC-XXX <n>
```

Codex tidak menjalankan slash command Claude secara native. Jika diminta merapikan
workflow, Codex menerjemahkan instruksi itu menjadi langkah konkret: baca epic,
normalisasi task/status, update runbook/instruksi, jalankan verifikasi yang relevan,
dan laporkan diff.

## 4. Yang terjadi di tiap task

Untuk setiap task `- [ ]` di epic, dengan **maksimum 3 percobaan**:

1. `code-agent` mengimplementasikan task (perubahan kecil, sesuai konvensi, tanpa secret).
2. `review-qa-agent` mereview -> `VERDICT: PASS/FAIL`.
3. `security-agent` memeriksa secret/kerentanan/auth/config -> `VERDICT: PASS/FAIL`.
4. `test-agent` menjalankan `scripts/qa.sh` + `scripts/test.sh` -> `VERDICT: PASS/FAIL`.
5. Jika salah satu FAIL -> temuan dikirim balik ke `code-agent`, ulang (maks 3x).
6. Jika semua PASS -> task ditandai `- [x]` di file epic.

Untuk task lintas area atau root cause belum jelas, lakukan scoping read-only
dengan Ruflo/AgentDB terlebih dahulu. Simpan temuan penting ke `Automation Log`;
jangan jadikan `.swarm/` atau `.claude-flow/` satu-satunya sumber kebenaran.

Setelah **semua** task lulus:

- `deploy-agent` menjalankan `scripts/deploy-dev.sh` (**DEV saja**).
- Epic `status:` diset ke `ready-for-qa`.

Jika masih gagal setelah 3 percobaan:

- Epic `status:` diset ke `blocked` + ditambahkan section `## Blocker` berisi alasan & temuan.

## 5. Agents (`.claude/agents/`)

| Agent               | Peran                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `epic-orchestrator` | Menggerakkan loop: baca epic -> pecah task -> koordinasi agent -> retry -> update status |
| `code-agent`        | Implementasi satu task kecil                                                             |
| `review-qa-agent`   | Review kualitas/kebenaran                                                                |
| `security-agent`    | Secret, kerentanan, kode tidak aman, authn/authz, risiko config                          |
| `test-agent`        | Lint, test, build                                                                        |
| `deploy-agent`      | Deploy DEV saja; menolak production                                                      |

> Orkestrasi berjalan di **sesi utama** (via `/epic-loop`) karena sub-agent Claude Code tidak bisa
> memanggil sub-agent lain. Sesi utama mendelegasikan ke agent di atas lewat tool Task.

## 6. Scripts (`scripts/`)

| Script                      | Fungsi                                                                      |
| --------------------------- | --------------------------------------------------------------------------- |
| `scripts/qa.sh`             | Lint / static check (`turbo run lint`)                                      |
| `scripts/test.sh`           | Install, build (type-check), test                                           |
| `scripts/security-check.sh` | Scan secret, cek file env ter-commit, scan SQL destruktif, audit dependensi |
| `scripts/deploy-dev.sh`     | Build + deploy ke **DEV saja**; menolak target production                   |

Bisa dijalankan manual, mis. `bash scripts/qa.sh`.

## 7. Guardrails (aturan keselamatan)

Ditegakkan oleh `.claude/settings.json` (deny-list permission) + `.claude/hooks/guardrail.sh`
(PreToolUse pada Bash) + instruksi agent/command:

- **Tanpa secret hardcoded** - pakai env var / `.env.example`.
- **Tanpa perintah database destruktif** - drop, truncate, dan reset migrasi paksa diblokir.
- **Tanpa deploy production** - hanya `scripts/deploy-dev.sh` (DEV); target production diblokir.
- **Tanpa force push** - push git paksa diblokir.
- **Tanpa hapus file** kecuali perlu dan dijelaskan.
- **Tanpa ubah target deploy CI/CD** (`.github/workflows/`) tanpa review.

Pengecualian yang sudah direview manusia bisa melewati hook Bash dengan prefiks
`WEALTHME_OVERRIDE=1` (gunakan seperlunya).

Runtime state agent (`.swarm/`, `.claude-flow/`) bersifat machine-specific dan
di-ignore dari git. Ringkasan keputusan harus masuk ke dokumen tracked.

## 8. Contoh alur singkat

```text
# 1) tandai epic siap dikerjakan
#    docs/epics/EPIC-001-backend-foundation.md -> status: on-progress
# 2) jalankan loop
/epic-loop docs/epics/EPIC-001-backend-foundation.md
# 3) pantau log: per task -> attempt -> verdict tiap agent -> [x]
# 4) hasil: epic jadi ready-for-qa (atau blocked + alasan)
```

## 9. Troubleshooting

- **"status bukan on-progress"** -> loop berhenti & lapor; ubah frontmatter epic.
- **Selalu gagal di test-agent** -> jalankan `bash scripts/test.sh` manual untuk lihat error penuh.
- **security-agent FAIL** -> jalankan `bash scripts/security-check.sh`; perbaiki temuan (jangan hardcode secret).
- **Hook GateGuard (ECC) memblokir** -> jalankan sesi dengan `ECC_GATEGUARD=off` atau tambahkan
  `pre:edit-write:gateguard-fact-force` / `pre:bash:gateguard-fact-force` ke `ECC_DISABLED_HOOKS`.
