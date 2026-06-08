# EPIC-007: Hardening & Launch (Phase 7)

status: backlog
environment: dev
retries: 0

## Goal

Make the product production-ready: rate limiting, secrets management, Indonesia
compliance (PDP/OJK), full observability stack, E2E test suite, load testing,
self-hosted deployment manifests, and WCAG accessibility pass. After this phase
the app is ready for real users.

GitHub Milestone: Phase 7 — Hardening & Launch (issues #72–#79)
Depends on: All previous epics

## Tasks

### Security & Compliance
- [ ] #72 Rate limiting + throttling — @nestjs/throttler; per-route limits
- [ ] #73 Secrets management (Vault / Doppler) — no secrets in env files in prod
- [ ] #74 Compliance: PDP/OJK, data residency, audit retention — Indonesia data region; retention policy; consent records

### Observability
- [ ] #75 Observability: pino + OpenTelemetry + Sentry + Grafana — logs, traces, metrics, error tracking

### Testing
- [ ] #76 E2E test suite (Playwright web + supertest api) — critical flows: auth, transaction create, RBAC
- [ ] #77 Load testing (k6) — baseline capacity; regression benchmarks

### Deployment
- [ ] #78 Deploy: K8s/Swarm manifests + DB backups + runbook — self-host prod; automated DB backups; on-call runbook

### Quality
- [ ] #79 Accessibility & i18n pass (WCAG 2.2, EN locale) — a11y audit + language switch (id/en)

## Acceptance Criteria

- API rate limits enforced per route; 429 returned on exceeded limits
- No secrets in env files; all loaded from Vault/Doppler in production
- User data stored in Indonesia region; consent records auditable; retention policy enforced
- Pino structured logs, OpenTelemetry traces, and Sentry errors all ship to Grafana
- E2E suite covers: register, login, add transaction, check budget, RBAC restrictions
- k6 load test establishes baseline; p95 latency < 500ms under expected load
- K8s/Swarm manifests deploy full stack; automated DB backup runs nightly
- WCAG 2.2 Level AA compliant; keyboard navigation works on all critical flows
- Language switch toggles between Bahasa Indonesia and English without reload
- `npm run test:e2e` and `npm run test:load` pass in CI

## Automation Log

<!-- Automation appends results here after each run -->
