# EPIC-007: Hardening & Launch

status: on-progress
environment: dev
phase: 7
priority: P2
area: Backend + Infra + Frontend
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (§1 Auth & Profile / PDP, §9 RBAC isolation)
tasks: ../product/ENGINEERING-TASKS.md (T-701 … T-710)

## Goal

Menyiapkan produk untuk produksi: keamanan, kepatuhan (PDP/OJK), observability, pengujian
menyeluruh, dan deployment self-host yang andal.

## User Stories

- **US-AUTH-8** — ekspor data & hapus akun (PDP).
- **US-FAM-4, US-FAM-7** — isolasi data antar-member diverifikasi end-to-end.
- Cross-cutting non-functional: keamanan, kepatuhan, observability, a11y, i18n.

## Tasks

- [x] **T-701** Enkripsi at-rest + kolom sensitif (nomor rekening, dokumen) via AES-GCM/pgcrypto
- [x] **T-702** Rate limiting + throttling (@nestjs/throttler)
- [x] **T-703** Secrets management (Vault/Doppler) — tanpa secret di env produksi
- [x] **T-704** Kepatuhan PDP/OJK: residensi data Indonesia, retensi audit, catatan consent
- [x] **T-705** Observability: pino + OpenTelemetry + Sentry + Grafana (log/trace/metric/error)
- [ ] **T-706** E2E test suite (Playwright web + supertest api) untuk alur kritis termasuk isolasi RBAC
- [ ] **T-707** Load testing (k6) + baseline kapasitas
- [ ] **T-708** Deploy: manifest K8s/Swarm + backup DB + runbook on-call
- [ ] **T-709** Accessibility pass (WCAG 2.2) di seluruh halaman
- [ ] **T-710** i18n: locale EN berdampingan dengan ID

## Acceptance Criteria

**Epic-level**

- Data sensitif terenkripsi; tidak ada secret di env produksi.
- Rate limit aktif; penyalahgunaan tertahan.
- Log/trace/metric/error termonitor dengan dashboard + alert.
- E2E & load test lulus target.
- Deployment reproducible; backup & restore teruji; runbook tersedia.
- Audit aksesibilitas lulus; pergantian bahasa id/en berfungsi.

**Per-task**

- **T-701** — kolom sensitif terenkripsi (AES-GCM/pgcrypto); data at-rest terlindungi.
- **T-702** — rate limit di semua endpoint; abuse tertahan.
- **T-703** — tidak ada secret di env produksi; rotasi terdukung.
- **T-704** — data di region ID; retensi audit & catatan consent sesuai PDP.
- **T-705** — dashboard log/trace/metric/error dengan alert aktif.
- **T-706** — alur kritis (login→tambah transaksi→dashboard) + isolasi RBAC member lulus E2E.
- **T-707** — baseline kapasitas terdokumentasi; target throughput tercapai.
- **T-708** — deploy reproducible; backup/restore teruji; runbook on-call tersedia.
- **T-709** — audit WCAG 2.2 lulus di seluruh 21 halaman.
- **T-710** — switch bahasa id/en berfungsi penuh.

## Automation Log

- 2026-06-14 /epic-loop EPIC-007 #1 "Rate Limiting" → PASS (attempts: 1), PR: https://github.com/andrsrjld/wealthme-web/pull/135
- 2026-06-14 /epic-loop EPIC-007 #2 "Encryption at-rest" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/136
- 2026-06-14 /epic-loop EPIC-007 #3 "Secrets & PDP Compliance" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/137
- 2026-06-14 /epic-loop EPIC-007 #4 "Observability" → PASS (attempts: 2), PR: pending

## Dependencies

- Idealnya seluruh epic fungsional (EPIC-001..006) selesai; sebagian item (observability,
  CI security, secrets) dapat dimulai lebih awal secara paralel.
