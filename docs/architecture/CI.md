# CI — GitHub Actions

## Workflow

**File:** `.github/workflows/ci.yml`
**Workflow name:** CI
**Job id / name:** `ci` / **Lint, Build & Test**

### Triggers

- Every pull request (any base branch)
- Push to `development` or `main`

### What it runs (in turbo order)

1. `lint` — ESLint across all workspaces
2. `build` — type-check + compile (`turbo run build`)
3. `test` — unit tests (`turbo run test`)

### Caches

- pnpm store — via `actions/setup-node@v4` (`cache: 'pnpm'`)
- Turbo artifacts — `actions/cache@v4` keyed on `pnpm-lock.yaml`, stored in `.turbo/`

**Concurrency:** in-progress runs for the same `github.ref` are cancelled automatically.

**No deploy steps, no secrets, no production targets.**

---

## Making the check required before merge (ONE-TIME ADMIN STEP)

> The steps below must be performed by a repository **admin** once the workflow has run at least once (GitHub registers the check name after the first execution). Do NOT run these as part of CI itself.

### Option A — GitHub UI

1. Go to **Settings → Branches** on `github.com/andrsrjld/wealthme-web`.
2. Add (or edit) a branch protection rule for `development` (repeat for `main`).
3. Enable **"Require status checks to pass before merging"**.
4. Search for and select the check named **`Lint, Build & Test`**.
5. Optionally enable **"Require branches to be up to date before merging"**.
6. Save.

### Option B — GitHub CLI (`gh api`)

Run these commands once from a terminal where you are authenticated as a repo admin:

```bash
# Replace OWNER/REPO if the remote changes.
OWNER=andrsrjld
REPO=wealthme-web

# Protect the `development` branch
gh api --method PUT \
  "repos/${OWNER}/${REPO}/branches/development/protection" \
  --field required_status_checks='{"strict":true,"contexts":["Lint, Build & Test"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews=null \
  --field restrictions=null

# Protect the `main` branch (same rule)
gh api --method PUT \
  "repos/${OWNER}/${REPO}/branches/main/protection" \
  --field required_status_checks='{"strict":true,"contexts":["Lint, Build & Test"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews=null \
  --field restrictions=null
```

> `contexts` must match the job name shown in the GitHub Checks UI exactly. The value here is `Lint, Build & Test` (the `name:` field of job `ci`). If you rename the job, update this value accordingly.
