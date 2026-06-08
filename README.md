# WealthMe — Personal Wealth OS (monorepo)

Monorepo untuk WealthMe: aplikasi manajemen kekayaan personal & keluarga (web + API).

## Struktur
```
apps/
  web/        # Next.js 16 frontend (sudah jadi; lihat apps/web/README.md)
  api/        # NestJS backend (modular monolith — discaffold di Epic 1)
packages/
  contracts/  # Zod schema + tipe DTO bersama (web ⇄ api ⇄ mobile)
  config/     # tsconfig base bersama
docs/         # WealthMe_Backend_Plan.md, WealthMe_Development.md, demo HTML
```

## Prasyarat
- Node.js 20+ (`.nvmrc`)
- pnpm 9 (via corepack: `corepack enable && corepack prepare pnpm@9 --activate`)

## Mulai
```bash
pnpm install
pnpm dev            # jalankan semua app (turbo)
pnpm --filter web dev   # hanya frontend
```

## Build & cek
```bash
pnpm build          # turbo build semua workspace
pnpm lint
```

## Dokumentasi
- Rencana & rekomendasi stack backend: `docs/WealthMe_Backend_Plan.md`
- Roadmap / backlog (GitHub Projects): `docs/BACKLOG.md`
- Dokumentasi produk & demo asli: `docs/WealthMe_Development.md`, `docs/WealthMe_Demo.html`
