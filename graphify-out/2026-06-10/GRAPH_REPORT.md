# Graph Report - .  (2026-06-10)

## Corpus Check
- 230 files · ~93,673 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1078 nodes · 1654 edges · 88 communities (67 shown, 21 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.82)
- Token cost: 24,000 input · 7,000 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth & Session Management|Auth & Session Management]]
- [[_COMMUNITY_Next.js App Shell & Routing|Next.js App Shell & Routing]]
- [[_COMMUNITY_Dev Tooling & Git Hooks|Dev Tooling & Git Hooks]]
- [[_COMMUNITY_AI Agent Orchestration|AI Agent Orchestration]]
- [[_COMMUNITY_Product Architecture Concepts|Product Architecture Concepts]]
- [[_COMMUNITY_Frontend UI Dependencies|Frontend UI Dependencies]]
- [[_COMMUNITY_Account Management UI|Account Management UI]]
- [[_COMMUNITY_Wealth & Liability Tracking|Wealth & Liability Tracking]]
- [[_COMMUNITY_Financial Reports UI|Financial Reports UI]]
- [[_COMMUNITY_Budget Management UI|Budget Management UI]]
- [[_COMMUNITY_Calculators & Donations UI|Calculators & Donations UI]]
- [[_COMMUNITY_API Runtime Dependencies|API Runtime Dependencies]]
- [[_COMMUNITY_Shared Contracts Package|Shared Contracts Package]]
- [[_COMMUNITY_shadcn UI Components|shadcn UI Components]]
- [[_COMMUNITY_Web App Component Config|Web App Component Config]]
- [[_COMMUNITY_API Dev Dependencies|API Dev Dependencies]]
- [[_COMMUNITY_Audit Logging Service|Audit Logging Service]]
- [[_COMMUNITY_Frontend TypeScript Config|Frontend TypeScript Config]]
- [[_COMMUNITY_Insurance Management UI|Insurance Management UI]]
- [[_COMMUNITY_Dashboard Home UI|Dashboard Home UI]]
- [[_COMMUNITY_Shared Config Package|Shared Config Package]]
- [[_COMMUNITY_Utility & Theme Components|Utility & Theme Components]]
- [[_COMMUNITY_CASL Authorization|CASL Authorization]]
- [[_COMMUNITY_Dropdown Menu Component|Dropdown Menu Component]]
- [[_COMMUNITY_API TypeScript Config|API TypeScript Config]]
- [[_COMMUNITY_Base TypeScript Config|Base TypeScript Config]]
- [[_COMMUNITY_Root Layout & Fonts|Root Layout & Fonts]]
- [[_COMMUNITY_Auth Domain Contracts|Auth Domain Contracts]]
- [[_COMMUNITY_AI Chat Feature|AI Chat Feature]]
- [[_COMMUNITY_API E2E Test Config|API E2E Test Config]]
- [[_COMMUNITY_API Guards & Search|API Guards & Search]]
- [[_COMMUNITY_API Build Scripts|API Build Scripts]]
- [[_COMMUNITY_NestJS Module Registry|NestJS Module Registry]]
- [[_COMMUNITY_Inheritance Planning UI|Inheritance Planning UI]]
- [[_COMMUNITY_API Unit Test Config|API Unit Test Config]]
- [[_COMMUNITY_Audit Interceptor Logic|Audit Interceptor Logic]]
- [[_COMMUNITY_GitHub Project Scripts|GitHub Project Scripts]]
- [[_COMMUNITY_Transaction Dialog Shell|Transaction Dialog Shell]]
- [[_COMMUNITY_Donation Tracking UI|Donation Tracking UI]]
- [[_COMMUNITY_Transactions List UI|Transactions List UI]]
- [[_COMMUNITY_Asset Tracking UI|Asset Tracking UI]]
- [[_COMMUNITY_Claude Code Settings|Claude Code Settings]]
- [[_COMMUNITY_Contracts TypeScript Config|Contracts TypeScript Config]]
- [[_COMMUNITY_Cash & Funds UI|Cash & Funds UI]]
- [[_COMMUNITY_Tenant Guard Tests|Tenant Guard Tests]]
- [[_COMMUNITY_Health Check Endpoint|Health Check Endpoint]]
- [[_COMMUNITY_GitHub Setup Script|GitHub Setup Script]]
- [[_COMMUNITY_NextAuth Route Handler|NextAuth Route Handler]]
- [[_COMMUNITY_Avatar Component|Avatar Component]]
- [[_COMMUNITY_Card Component|Card Component]]
- [[_COMMUNITY_NestJS CLI Config|NestJS CLI Config]]
- [[_COMMUNITY_API Package & Seed|API Package & Seed]]
- [[_COMMUNITY_Login E2E Tests|Login E2E Tests]]
- [[_COMMUNITY_Progress Component|Progress Component]]
- [[_COMMUNITY_Tabs Component|Tabs Component]]
- [[_COMMUNITY_API Build TypeScript Config|API Build TypeScript Config]]
- [[_COMMUNITY_Epic Loop Documentation|Epic Loop Documentation]]
- [[_COMMUNITY_Security Check Script|Security Check Script]]
- [[_COMMUNITY_Env Validation|Env Validation]]
- [[_COMMUNITY_Lint-Staged Config|Lint-Staged Config]]
- [[_COMMUNITY_Auth E2E Failures|Auth E2E Failures]]
- [[_COMMUNITY_Bar Chart Component|Bar Chart Component]]
- [[_COMMUNITY_Claude Guardrail Hook|Claude Guardrail Hook]]
- [[_COMMUNITY_Database Seed|Database Seed]]
- [[_COMMUNITY_NextAuth Type Definitions|NextAuth Type Definitions]]
- [[_COMMUNITY_Tenant Context Types|Tenant Context Types]]
- [[_COMMUNITY_Badge Component|Badge Component]]
- [[_COMMUNITY_Route Protection Tests|Route Protection Tests]]
- [[_COMMUNITY_Commitlint Config|Commitlint Config]]
- [[_COMMUNITY_ESLint Base Config|ESLint Base Config]]
- [[_COMMUNITY_Prettier Config|Prettier Config]]
- [[_COMMUNITY_API Types Generator|API Types Generator]]
- [[_COMMUNITY_DEV Deploy Script|DEV Deploy Script]]
- [[_COMMUNITY_QA Script|QA Script]]
- [[_COMMUNITY_Test Script|Test Script]]
- [[_COMMUNITY_Web App AI Instructions|Web App AI Instructions]]
- [[_COMMUNITY_Web ESLint Config|Web ESLint Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 110 edges
2. `Project CLAUDE.md — Operating System` - 25 edges
3. `WealthMe Backend Stack & Plan` - 20 edges
4. `PrismaService` - 18 edges
5. `SectionCard()` - 16 edges
6. `compilerOptions` - 16 edges
7. `StatusBadge()` - 15 edges
8. `AuthService` - 14 edges
9. `Button()` - 14 edges
10. `Epic Loop Command` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Playwright E2E Test Failure Screenshot — 404 Page Not Found on /beranda redirect` --tests--> `apps/web — Next.js 16 Frontend App`  [INFERRED]
  apps/web/test-results/auth-login-Login-—-redirec-52761--beranda-redirects-to-login-chromium/test-failed-1.png → docs/WealthMe_Backend_Plan.md
- `Deploy Agent` --invokes--> `scripts/deploy-dev.sh — DEV-only Deploy`  [EXTRACTED]
  .claude/agents/deploy-agent.md → CLAUDE.md
- `Security Agent` --invokes--> `scripts/security-check.sh — Secrets + Auth Risks`  [EXTRACTED]
  .claude/agents/security-agent.md → CLAUDE.md
- `Test Agent` --invokes--> `scripts/qa.sh — Formatting + Bug Patterns`  [EXTRACTED]
  .claude/agents/test-agent.md → CLAUDE.md
- `Test Agent` --invokes--> `scripts/test.sh — Lint + TypeScript + Build`  [EXTRACTED]
  .claude/agents/test-agent.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Epic Loop Gate Pipeline (Review + Security + Test)** — commands_epic_loop, agents_review_qa_agent, agents_security_agent, agents_test_agent, ecc_react_reviewer, ecc_typescript_reviewer, ecc_security_reviewer [EXTRACTED 1.00]
- **Local Dev Infrastructure Stack** — docker_compose, infra_postgres, infra_redis, infra_minio, infra_mailhog [EXTRACTED 1.00]
- **WealthMe Monorepo Applications** — concept_monorepo_layout, app_web, app_api, pkg_contracts [EXTRACTED 1.00]
- **Custom Project Agent Suite** — agents_code_agent, agents_deploy_agent, agents_epic_orchestrator, agents_review_qa_agent, agents_security_agent, agents_test_agent [EXTRACTED 1.00]
- **E2E Auth Redirect Test Failures (Playwright)** — e2e_test_auth_login_beranda, e2e_test_auth_login_transaksi, app_web [EXTRACTED 1.00]
- **MVP Epic Dependency Chain (EPIC-000 → 001 → 002)** — epics_epic_000, epics_epic_001, epics_epic_002 [EXTRACTED 1.00]
- **Core Backend Technology Stack** — concept_nestjs_modular_monolith, concept_prisma_postgres, concept_redis_bullmq, concept_jwt_passport, concept_rbac_casl [EXTRACTED 1.00]
- **Monorepo Workspace Apps and Packages** — concept_apps_web, concept_apps_api, concept_wealthme_contracts, concept_monorepo [EXTRACTED 1.00]
- **Epic Loop Agent Pipeline (code → review → security → test → deploy)** — concept_epic_loop, concept_epic_agents, concept_guardrails [EXTRACTED 1.00]
- **CI/CD and Deployment Pipeline** — concept_ci_workflow, concept_vercel_deployment, concept_docker_compose_infra [EXTRACTED 1.00]

## Communities (88 total, 21 thin omitted)

### Community 0 - "Auth & Session Management"
Cohesion: 0.06
Nodes (25): AuthController, AuthenticatedRequest, GoogleCallbackRequest, AuthService, mockConfig, mockJwt, mockPrisma, mockRedis (+17 more)

### Community 1 - "Next.js App Shell & Routing"
Cohesion: 0.08
Nodes (35): Home(), BadgeVariant, MOBILE_NAV, MobileNavItem, NAV_SECTIONS, NavItem, NavSection, PAGE_TITLES (+27 more)

### Community 2 - "Dev Tooling & Git Hooks"
Cohesion: 0.05
Nodes (41): husky.sh script, devDependencies, @commitlint/cli, @commitlint/config-conventional, husky, lint-staged, prettier, turbo (+33 more)

### Community 3 - "AI Agent Orchestration"
Cohesion: 0.12
Nodes (43): Code Agent, Deploy Agent, Epic Orchestrator Agent, Review QA Agent, Security Agent, Test Agent, WealthMe API (NestJS) README, apps/api — NestJS Backend (+35 more)

### Community 4 - "Product Architecture Concepts"
Cohesion: 0.10
Nodes (42): AI Advisor via Claude (claude-sonnet-4-6 streaming), apps/api — NestJS Backend API, apps/web — Next.js 16 Frontend App, Auth.js (NextAuth) Session Layer for Web, CI GitHub Actions Workflow (Lint + Build + Test), Docker Compose Local Dev Infra (Postgres/Redis/MinIO/MailHog), Passport + JWT Access/Refresh Auth (NestJS), MinIO Object Storage (S3-compatible, self-hosted) (+34 more)

### Community 5 - "Frontend UI Dependencies"
Cohesion: 0.05
Nodes (40): dependencies, @base-ui/react, class-variance-authority, clsx, lucide-react, next, next-auth, next-themes (+32 more)

### Community 6 - "Account Management UI"
Cohesion: 0.07
Nodes (11): CURRENCIES, FAQS, MeResponse, SUBPAGE_TITLES, SubPageId, ApiError, apiFetch(), Accordion() (+3 more)

### Community 7 - "Wealth & Liability Tracking"
Cohesion: 0.09
Nodes (21): Holding, HOLDINGS, LIABILITIES, LiabilityCard, MetaItem, Notif, NOTIFS, MATCH_ROWS (+13 more)

### Community 8 - "Financial Reports UI"
Cohesion: 0.06
Nodes (10): BULANAN_ROWS, DETAIL_ROWS, EXPENSE_ALLOC, FAMILY_MEMBERS, INV_TYPES, PERFORMA, RASIO, TABS (+2 more)

### Community 9 - "Budget Management UI"
Cohesion: 0.09
Nodes (19): BudgetCategory, ICON_OPTIONS, INITIAL_CATEGORIES, TRAILING_CATEGORY, queryKeys, ICONS, SearchDialog(), useDebounce() (+11 more)

### Community 10 - "Calculators & Donations UI"
Cohesion: 0.12
Nodes (21): DonationPage(), GROUP_NAMES, InvestasiTab(), KreditTab(), MONTHS, PensiunTab(), SplitGroupTab(), TabKey (+13 more)

### Community 11 - "API Runtime Dependencies"
Cohesion: 0.08
Nodes (26): dependencies, argon2, @casl/ability, class-transformer, class-validator, helmet, ioredis, @nestjs/common (+18 more)

### Community 12 - "Shared Contracts Package"
Cohesion: 0.08
Nodes (25): dependencies, zod, devDependencies, tsup, typescript, @wealthme/config, exports, files (+17 more)

### Community 13 - "shadcn UI Components"
Cohesion: 0.16
Nodes (20): cn(), ScrollArea(), ScrollBar(), SelectContent(), SelectGroup(), SelectItem(), SelectLabel(), SelectScrollDownButton() (+12 more)

### Community 14 - "Web App Component Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 15 - "API Dev Dependencies"
Cohesion: 0.10
Nodes (20): devDependencies, eslint, globals, jest, @nestjs/cli, @nestjs/schematics, @nestjs/testing, prisma (+12 more)

### Community 16 - "Audit Logging Service"
Cohesion: 0.15
Nodes (5): AuditService, mockPrisma, CreateAuditLogDto, TestApp, PrismaService

### Community 17 - "Frontend TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 18 - "Insurance Management UI"
Cohesion: 0.13
Nodes (10): MetaItem, POLICIES, Policy, Account, AccountAction, ACCOUNTS, Goal, GOALS (+2 more)

### Community 19 - "Dashboard Home UI"
Cohesion: 0.14
Nodes (15): ACTIVITIES, ALLOCATION, BerandaPage(), getGreeting(), GOALS, PERIODS, SPARK_LABELS, SUMMARY (+7 more)

### Community 20 - "Shared Config Package"
Cohesion: 0.11
Nodes (17): devDependencies, eslint, eslint-config-prettier, eslint-plugin-import, prettier, typescript-eslint, @typescript-eslint/eslint-plugin, @typescript-eslint/parser (+9 more)

### Community 21 - "Utility & Theme Components"
Cohesion: 0.11
Nodes (7): ThemeToggle(), Input(), Label(), Separator(), Switch(), Textarea(), TooltipContent()

### Community 22 - "CASL Authorization"
Cohesion: 0.19
Nodes (8): Action, AppAbility, CaslAbilityFactory, Subject, CaslModule, CommonModule, PolicyHandler, AbilitiesGuard

### Community 23 - "Dropdown Menu Component"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 24 - "API TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, emitDecoratorMetadata, experimentalDecorators, incremental, lib, module, moduleResolution, outDir (+6 more)

### Community 25 - "Base TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution (+6 more)

### Community 26 - "Root Layout & Fonts"
Cohesion: 0.19
Nodes (8): dmMono, metadata, sora, viewport, AppQueryClientProvider(), SessionProviderWrapper(), ThemeProvider(), Toaster()

### Community 27 - "Auth Domain Contracts"
Cohesion: 0.14
Nodes (10): AuthUser, AuthUserSchema, LoginInput, LoginInputSchema, CONTRACTS_VERSION, Rupiah, RupiahSchema, SearchResponseDto (+2 more)

### Community 28 - "AI Chat Feature"
Cohesion: 0.18
Nodes (9): ChatMessage, AI_CHIPS, AI_RESPONSES, CASHFLOW, resolveAiResponse(), SEARCH_DATA, SearchEntry, SPARKLINE_POINTS (+1 more)

### Community 29 - "API E2E Test Config"
Cohesion: 0.15
Nodes (12): forceExit, globalSetup, globalTeardown, maxWorkers, moduleFileExtensions, rootDir, roots, testEnvironment (+4 more)

### Community 30 - "API Guards & Search"
Cohesion: 0.26
Nodes (5): CheckAbility(), JwtAuthGuard, SearchController, SearchModule, SearchService

### Community 31 - "API Build Scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:generate, db:migrate, db:migrate:dev, db:reset, db:seed, dev (+3 more)

### Community 32 - "NestJS Module Registry"
Cohesion: 0.29
Nodes (6): AuditInterceptor, AuditModule, AuthModule, PrismaModule, RedisModule, AppModule

### Community 33 - "Inheritance Planning UI"
Cohesion: 0.18
Nodes (7): Asset, ASSET_GROUPS, AssetGroup, CATEGORIES, Category, Heir, HEIRS

### Community 34 - "API Unit Test Config"
Cohesion: 0.20
Nodes (10): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, roots, testEnvironment, testRegex (+2 more)

### Community 35 - "Audit Interceptor Logic"
Cohesion: 0.22
Nodes (6): ACTION_MAP, deriveEntity(), MUTATING_METHODS, sanitize(), SENSITIVE_KEYS, mockAuditService

### Community 36 - "GitHub Project Scripts"
Cohesion: 0.20
Nodes (9): epics, fields, Area, Priority, Status, milestones, owner, project (+1 more)

### Community 37 - "Transaction Dialog Shell"
Cohesion: 0.20
Nodes (7): ACCOUNTS, CATEGORIES, Corner(), OCR_ITEMS, RECENT, TABS, View

### Community 38 - "Donation Tracking UI"
Cohesion: 0.25
Nodes (8): CATEGORIES, HISTORY, HistoryItem, JENIS_OPTIONS, LEMBAGA_OPTIONS, SUMBER_OPTIONS, ZkInput(), formatAmountInput()

### Community 39 - "Transactions List UI"
Cohesion: 0.25
Nodes (6): FILTERS, GROUPS, Txn, TxnGroup, TxnType, MoneyStat()

### Community 40 - "Asset Tracking UI"
Cohesion: 0.29
Nodes (4): AssetGroup, AssetRow, GROUPS, TABS

### Community 41 - "Claude Code Settings"
Cohesion: 0.29
Nodes (6): enabledPlugins, ecc@ecc, hooks, PreToolUse, permissions, deny

### Community 42 - "Contracts TypeScript Config"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, outDir, rootDir, extends, include

### Community 43 - "Cash & Funds UI"
Cohesion: 0.29
Nodes (4): CASH_ITEMS, WALLET_ITEMS, WalletItem, HeroCard()

### Community 45 - "Health Check Endpoint"
Cohesion: 0.38
Nodes (3): HealthController, HealthResponse, HealthModule

### Community 46 - "GitHub Setup Script"
Cohesion: 0.43
Nodes (4): setup-github-project.sh script, ensure_field(), mklabel(), setf()

### Community 47 - "NextAuth Route Handler"
Cohesion: 0.29
Nodes (4): GET, POST, { handlers, signIn, signOut, auth }, config

### Community 48 - "Avatar Component"
Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 49 - "Card Component"
Cohesion: 0.29
Nodes (6): CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle()

### Community 50 - "NestJS CLI Config"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 51 - "API Package & Seed"
Cohesion: 0.33
Nodes (5): name, prisma, seed, private, version

### Community 53 - "Progress Component"
Cohesion: 0.33
Nodes (5): Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue()

### Community 54 - "Tabs Component"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 55 - "API Build TypeScript Config"
Cohesion: 0.50
Nodes (3): exclude, extends, $schema

### Community 56 - "Epic Loop Documentation"
Cohesion: 0.83
Nodes (4): Epic Loop Agents (epic-orchestrator, code-agent, review-qa-agent, security-agent, test-agent, deploy-agent), Autonomous Epic Loop (/epic-loop Command), Automation Guardrails (no secrets, no prod deploy, no force push), How-To: Autonomous Epic Loop

### Community 57 - "Security Check Script"
Cohesion: 0.83
Nodes (3): security-check.sh script, bad(), note()

### Community 59 - "Lint-Staged Config"
Cohesion: 0.67
Nodes (3): config, eslintPerPackage(), findEslintConfig()

### Community 61 - "Auth E2E Failures"
Cohesion: 1.00
Nodes (3): Auth Login Redirect E2E Test (Chromium), Login Redirect Test Failure Screenshot (Chromium), Next.js 404 Not Found Page

## Knowledge Gaps
- **434 isolated node(s):** `deny`, `PreToolUse`, `ecc@ecc`, `husky.sh script`, `moduleFileExtensions` (+429 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `shadcn UI Components` to `Next.js App Shell & Routing`, `Badge Component`, `Transaction Dialog Shell`, `Account Management UI`, `Wealth & Liability Tracking`, `Transactions List UI`, `Budget Management UI`, `Cash & Funds UI`, `Avatar Component`, `Card Component`, `Insurance Management UI`, `Dashboard Home UI`, `Utility & Theme Components`, `Progress Component`, `Dropdown Menu Component`, `Tabs Component`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `SectionCard()` connect `Wealth & Liability Tracking` to `Donation Tracking UI`, `Account Management UI`, `Financial Reports UI`, `Budget Management UI`, `Calculators & Donations UI`, `Cash & Funds UI`, `Transactions List UI`, `shadcn UI Components`, `Dashboard Home UI`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `StatusBadge()` connect `Wealth & Liability Tracking` to `Inheritance Planning UI`, `Donation Tracking UI`, `Account Management UI`, `Financial Reports UI`, `Budget Management UI`, `shadcn UI Components`, `Insurance Management UI`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `deny`, `PreToolUse`, `ecc@ecc` to the rest of the system?**
  _435 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth & Session Management` be split into smaller, more focused modules?**
  _Cohesion score 0.05541346973572037 - nodes in this community are weakly interconnected._
- **Should `Next.js App Shell & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.07535460992907801 - nodes in this community are weakly interconnected._
- **Should `Dev Tooling & Git Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._