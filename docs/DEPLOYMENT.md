# Deployment

DEV only. There is no automated production deploy path in this repo — see
`WM_CONVENTIONS.md` and `scripts/deploy-dev.sh`'s own guardrails. Vercel's Git
integration may separately build/preview the `apps/web` frontend on its own;
that is unrelated to the self-hosted stack this file covers.

## Why images are built in CI, not on the dev server

The shared dev server's local Docker builds became unreliable: `apt-get
install`, `pnpm install`, and `next build` each failed at different times with
a different package corrupted mid-decompress (`lzma error: compressed data is
corrupt`), and `journalctl -k` showed unrelated binaries (`gdb`, `node`,
`nginx`) segfaulting at identical instruction offsets across different CPU
cores in the same window — the fingerprint of failing RAM, not a code or
Docker bug. Retrying a build on that host fixes nothing durably. Run
`memtest86+` on that host before trusting local builds there again.

Until then (and as the default going forward regardless), images are built on
GitHub's own runners and the dev server only ever runs `docker compose pull`.

## How it works

1. `.github/workflows/ci.yml`'s `build-and-push-images` job runs after `ci`
   passes, only on a push to `development` (never a PR, never `main`). It
   builds `apps/api/Dockerfile` and `apps/web/Dockerfile` and pushes both to
   GHCR:
   - `ghcr.io/andrsrjld/wealthme-web-api:dev` / `:sha-<commit>`
   - `ghcr.io/andrsrjld/wealthme-web-web:dev` / `:sha-<commit>`

   `dev` is a moving tag updated on every green build; `sha-<commit>` is
   permanent, for rollback.

2. `docker-compose.yml`'s `api`, `migrate`, and `web` services each carry both
   `image:` (the GHCR tag above, `${DEPLOY_IMAGE_TAG:-dev}`) and `build:`.
   Compose uses whichever is already present locally under that image name
   for a plain `pull`/`up`; `--build` forces a local build under the same
   name instead. One file serves both the CI-image path and a from-source
   fallback.

3. `scripts/deploy-dev.sh` defaults to `DEPLOY_MODE=pull`: it runs
   `docker compose pull` then `up -d --wait` — no local build, no
   `apt-get`/`pnpm install`/`next build` on the dev server at all.
   `DEPLOY_MODE=build` restores the old build-locally path, e.g. for the very
   first deploy before any CI image exists.

## One-time setup on the dev server

The repo is private, so the pushed images are private too. Pulling them
needs an authenticated `docker login` on that host, once:

```bash
# A fine-grained PAT with "read:packages" access to this repo is enough.
# Create one at https://github.com/settings/tokens?type=beta
docker login ghcr.io -u <your-github-username>
# paste the PAT when prompted for a password
```

Docker caches this in `~/.docker/config.json` on that host — you do not need
to log in again on every deploy, only if the token expires or the host's
Docker config is wiped.

## Public build-time URLs

`apps/web`'s Docker build bakes `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_APP_URL`
into the client bundle — they're browser-visible, not secrets, but they must
match the dev server's real public origin (e.g. a tunnel domain) or auth and
API calls from the browser will silently target the wrong host.

Set them once as **GitHub Actions repository variables** (Settings → Secrets
and variables → Actions → Variables tab — _variables_, not _secrets_):

```bash
gh variable set NEXT_PUBLIC_API_URL --body "https://your-dev-domain.example/api"
gh variable set NEXT_PUBLIC_APP_URL --body "https://your-dev-domain.example"
```

If unset, the workflow falls back to `http://localhost:*` (the same default
`docker-compose.yml` already uses for local builds) and prints a loud
`::warning::` in the build log rather than silently baking in a guess — that
fallback is almost certainly wrong for the shared dev server's public origin,
so treat that warning as a blocker before relying on a freshly-pushed image.

Changing these variables does not retroactively fix an already-pushed image;
re-run the workflow (or push a new commit to `development`) afterward.

## Rolling back

```bash
DEPLOY_IMAGE_TAG=sha-<short-sha> ./scripts/deploy-dev.sh
```

Pins that exact commit's images instead of the moving `dev` tag. Set
`DEPLOY_IMAGE_TAG` in the dev server's own `.env` to make a pin persistent
across deploys, or pass it inline for one run.

## Fresh database

`CLEAN_DB=1 ./scripts/deploy-dev.sh` drops volumes for a clean migrate+seed —
unchanged by any of the above, and still DEV-only (the script refuses any
`prod`/`production` target regardless of `DEPLOY_MODE`).
