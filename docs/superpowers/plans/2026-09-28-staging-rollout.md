# Staging rollout: development → staging.wealthme.id (real user data)

Status: PLAN, not executed. Every step that touches staging needs a human go-ahead.

## What changes

- The `main` branch (d382c9fb) is 682 commits behind `development`. It adds 72 Prisma migrations.
- It is not known which commit staging runs. Staging is not deployed from this repo (no staging workflow in `.github/workflows`, and `docs/DEPLOYMENT.md` is DEV-only).
- 15 of the new migrations rewrite data rather than only adding tables or columns (UPDATE/backfill, SET NOT NULL, ALTER TYPE, RENAME):
  - `add_category_coa_link`
  - `add_net_worth_snapshot_date_unique`
  - `epic021_group_d_heirs_beneficiaries`
  - `backfill_ineligible_tax_deductible_donations`
  - `fix_coa_shelves_transfer_and_loan_interest`
  - `add_member_relationship_and_role_tiers`
  - `epic023_f2_family_religion_and_persepuluhan`
  - `epic023_f3_split_bill_confirm_and_payout`
  - `epic023_f_religion_unconfirmed`
  - `epic024_c2_deposito_purchase_maturity_dates`
  - `epic031_family_login_handle`
  - `epic033_family_religion_five`
  - `epic033_default_banks`
  - `epic032_istri_co_master`
  - `asset_type_emas`
- **The compose `migrate` service runs `prisma db seed` after `migrate deploy`.** The seed creates demo@wealthme.id and demo data. It must NOT run against staging.

## Phase 0 findings (2026-09-28, read-only)

- **Host and deploy method:**
  - `wm@103.30.195.66` (IDCloudHost), 1.9 GiB RAM, 13 GB free disk.
  - The stack runs from `/home/wm/wealthme`, which is a copied source tree, not a git checkout.
  - It deploys with `build.sh`, which builds the api, migrate and web images on the box, then runs `migrate` with **no seed** (via a compose override), then starts api and web.
- **Running version:**
  - The images are tagged `ghcr.io/andrsrjld/wealthme-web-{api,web}:dev` but were built locally on 2026-09-04.
  - Risk: a `docker compose pull` on staging would silently replace them with the current DEV images. Never pull on staging. Pin tags to a commit SHA in the rollout.
- **Database:**
  - Postgres 17, 21 MB.
  - 11 users, 8 family groups, 14 transactions, 1 transaction with `createdByUserId` NULL.
- **Migrations:**
  - 55 are applied, 0 failed or rolled back, and none are unknown to `development`.
  - Latest applied: `20260902090000_epic022_d2_investment_transactions`.
- **Pending: 16 migrations**, `20260924120000_epic030_iam_access_roles` through `20260926180000_revisi_l_tax`.
  - Data-rewriting ones among them: `epic031_family_login_handle`, `epic033_family_religion_five`, `epic033_default_banks`, `epic032_istri_co_master`, `asset_type_emas`. Verify each in the rehearsal.
- **Building on the box:** 1.9 GiB RAM builds the web image slowly and risks OOM. Prefer building the images elsewhere (CI or the dev host), then transferring them (`docker save | ssh docker load`) or pulling from GHCR by SHA tag, so staging only runs `migrate` and `up`.
- **Edit-rights impact:** only 1 legacy transaction has no creator, so the impact is negligible.

## Guardrails

- No `prisma migrate dev`, `db push`, `migrate reset`, or hand-applied DDL on staging. See the lesson in memory: a hand-applied DDL change causes P3018 on the next deploy.
- There is no down-migration path. Rollback means restoring the pre-migration dump, together with the previous images.
- Deploy images pinned to a commit SHA, not the moving `:dev` tag.
- Keep writes stopped from the final backup until verification passes, so a rollback loses no user data.

## Phase 0: Discovery (read-only, needs staging access)

1. Find out where staging runs (host, compose or other), which images and tag it uses, which DB it connects to, and where its object storage lives (attachments and documents).
2. Run `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY 1;`.
   - Diff the result against `apps/api/prisma/migrations` on `development`. That gives the exact pending set.
   - Any row with `rolled_back_at` set, or with `finished_at` NULL, is a blocker and must be resolved first.
3. Drift check: run `prisma migrate diff --from-url <staging-copy-url> --to-migrations apps/api/prisma/migrations --shadow-database-url <scratch>` against a restored copy. Anything unexpected means someone hand-edited the schema.
4. Collect the baseline metrics, and save the output:
   - row counts per table;
   - per family group: account balances sum, transaction count, liability remaining sum, investment count;
   - user and member counts;
   - count of transactions with `createdByUserId IS NULL`.

## Phase 1: Backup

1. Run `pg_dump -Fc` of the staging DB. Restore it into a scratch DB to prove the dump is usable. Store it off-host.
2. Snapshot object storage (the MinIO/S3 bucket), since attachments and asset documents reference keys in it.

## Phase 2: Rehearsal on a copy (must pass before cutover)

1. Restore the dump into a rehearsal DB with the same Postgres major version as staging.
2. Run `prisma migrate deploy` only, with no seed, using the target commit's API image: `docker run --rm -e DATABASE_URL=… ghcr.io/…-api:<sha> npx prisma migrate deploy`. Time it; that number sets the maintenance window.
3. Re-run the Phase 0 metrics.
   - Row counts and money sums must match, apart from the tables new migrations intentionally backfill (reference items, default banks, fx tables, tax registry, rate periods). Explain every difference.
4. Point the new web and API images at the rehearsal DB and click through the main pages as a real user:
   - beranda, rekening, transaksi, liabilitas (KPR), investasi, tax, iam;
   - check that login works for an email user and a username user.
5. If anything fails: fix it in code with a new migration or a fix, rebuild, then repeat Phase 2 from a fresh restore.

## Phase 3: Cutover (maintenance window)

1. Announce the window. Stop web and API (or turn on maintenance mode), so there are no writes.
2. Take the final `pg_dump -Fc` and the storage snapshot.
3. Run `prisma migrate deploy` only (no seed) with the target SHA image.
4. Start the new API and web images (the target SHA).
5. Verify:
   - health checks pass;
   - the Phase 0 metrics match the rehearsal;
   - a smoke login as one real user, read-only.
6. Reopen the site.

## Rollback

- **Migrate fails mid-way:** stop, restore the final dump, and start the previous images.
- **An app bug is found after reopening:**
  - If it isn't data-corrupting, fix it forward.
  - Otherwise, restore the final dump plus the previous images, which loses any writes made after the reopen. That is why the reopen waits until verification passes.

## Product changes real users will notice

- **Edit rights (new rule):** only the recorder of a transaction or the owner of the private account can edit or delete it.
  - Old transactions with `createdByUserId IS NULL` on shared accounts become editable only by Master and Co-Master.
  - Check the Phase 0 count. If it is large, tell users, or decide on a backfill only where the creator is provable (e.g. single-member families).
- **Input Cepat** is now for Master and Co-Master only.
- **Money inputs:** every money input has a currency picker, and FX conversions are stored with an audit trail.
- **KPR:** new rate plans, a flat/anuitas choice, and prepayment.
- **Tax:** new tax pages.
- **Sessions:** users stay logged in, since session tables are untouched unless the migration list says otherwise. Confirm this in the rehearsal.

## Open questions for the user

1. Staging host and access (SSH, DB credentials via a secret, not chat) and its deploy method.
2. The acceptable maintenance window length, once the rehearsal timing is known.
3. Whether real users should be told about the edit-rights change beforehand.
