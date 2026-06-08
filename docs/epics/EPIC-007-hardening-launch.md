# EPIC-007: Hardening & Launch

status: planned
environment: dev
phase: 7
priority: P2
area: Backend + Infra + Frontend

## Goal
Menyiapkan produk untuk produksi: keamanan, kepatuhan (PDP/OJK), observability, pengujian
menyeluruh, dan deployment self-host yang andal.

## Tasks
- [ ] Enkripsi at-rest + kolom sensitif (nomor rekening, dokumen) via AES-GCM/pgcrypto
- [ ] Rate limiting + throttling (@nestjs/throttler)
- [ ] Secrets management (Vault/Doppler) - tanpa secret di env produksi
- [ ] Kepatuhan PDP/OJK: residensi data Indonesia, retensi audit, catatan consent
- [ ] Observability: pino + OpenTelemetry + Sentry + Grafana (log/trace/metric/error)
- [ ] E2E test suite (Playwright web + supertest api) untuk alur kritis
- [ ] Load testing (k6) + baseline kapasitas
- [ ] Deploy: manifest K8s/Swarm + backup DB + runbook on-call
- [ ] Accessibility & i18n pass (WCAG 2.2, locale EN)

## Acceptance Criteria
- Data sensitif terenkripsi; tidak ada secret di env produksi.
- Rate limit aktif; penyalahgunaan tertahan.
- Log/trace/metric/error termonitor dengan dashboard + alert.
- E2E & load test lulus target.
- Deployment reproducible; backup & restore teruji; runbook tersedia.
- Audit aksesibilitas lulus; pergantian bahasa id/en berfungsi.

## Dependencies
- Idealnya seluruh epic fungsional (EPIC-001..006) selesai; sebagian item (observability,
  CI security, secrets) dapat dimulai lebih awal secara paralel.
