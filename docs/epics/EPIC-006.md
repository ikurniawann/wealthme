# EPIC-006: Integrations & AI (Phase 6)

status: backlog
environment: dev
retries: 0

## Goal

Replace all mock adapters with real external integrations: open-banking data sync,
live market prices (IDX/RTI), real OCR for receipts, Claude AI Advisor with streaming,
AI-powered transaction categorization, real email/push notifications, and optional
Meilisearch upgrade. Add encryption at rest for sensitive fields.

GitHub Milestone: Phase 6 — Integrations & AI (issues #63–#71)
Depends on: EPIC-002 (Core MVP), EPIC-003 (Wealth — for market data)

## Tasks

### Real Integrations
- [ ] #63 OCR real provider (Google Vision / Textract) + BullMQ async pipeline — replace MockOcr; image storage; async processing
- [ ] #64 Open-banking adapter (Brick / Ayoconnect) replace mock bank sync — consent flow; account sync; transaction feed
- [ ] #65 Market data real (IDX / RTI) replace mock — live prices for stocks/funds/gold/bonds

### AI Features
- [ ] #66 AI Advisor → Claude via AI SDK (streaming chat) — AiAdvisorPort; claude-sonnet-4-6 streaming; grounded on user financial data
- [ ] #67 Web: wire AI Advisor page to streaming API — streamed responses; keep quick-select chips
- [ ] #68 AI transaction categorization (claude-haiku-4-5) — auto-categorize new transactions; anomaly detection

### Notifications & Search
- [ ] #69 Email/push notifications real (SendGrid / SES / FCM) — replace mock NotificationPort channels
- [ ] #70 Search upgrade to Meilisearch — if Postgres FTS is outgrown; sync index pipeline

### Security
- [ ] #71 Encryption at rest + column-level for sensitive fields — AES-GCM / pgcrypto for account numbers, documents

## Acceptance Criteria

- Receipt photo upload triggers async OCR (BullMQ); result pre-fills transaction modal
- Open-banking consent flow (Brick/Ayoconnect) syncs real account transactions on schedule
- Investasi page shows live IDX/RTI prices with last-updated timestamp
- AI Advisor streams responses grounded on user's actual accounts, transactions, and goals
- Quick-select chips on AI page remain functional; conversation history persists
- New transactions are auto-categorized by claude-haiku-4-5 within 2 seconds
- Budget 80% alert sends real email/push notification to user
- Account numbers and sensitive documents encrypted at column level
- Meilisearch (if enabled) returns search results with typo tolerance
- All external API keys loaded from environment variables — none hardcoded

## Automation Log

<!-- Automation appends results here after each run -->
