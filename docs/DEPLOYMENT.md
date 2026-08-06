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
re-run the workflow (or push a new commit to `development`) afterward. A
value that is baked in but doesn't match how the domain is actually routed
(see the next section) fails the same way a wrong value does — same-origin
requests reaching a 404 — and looks identical from the browser's side, so
change both together, never one without the other.

## Path-based API routing via nginx (`/api/*`)

The dev server's public domain sits behind a **token-based Cloudflare
Tunnel** — its ingress (which hostname routes to which local port) is
managed entirely from the Cloudflare Zero Trust dashboard, not a local config
file this repo can edit. That matters because it rules out the obvious fix
for wanting one domain to serve both the app and a path-prefixed API
(`wealthme.demo-wit.id/api/*` → the api container): a Cloudflare-side path
rule needs dashboard access this repo's automation does not have.

`deploy/nginx/default.conf` + the `nginx` service in `docker-compose.yml`
solve this without needing that access at all. `nginx` sits between the
tunnel and `web`/`api`, entirely inside this stack's own docker network (not
published on a host port — the tunnel container is already a member of the
same network, confirmed via `docker network inspect`, so it reaches `nginx`
by service name exactly like it already reaches `web`/`api` today). Path
routing becomes nginx's job, fully in-repo:

- `/api/*` → `api:4000`, with the `/api` prefix **stripped** by
  `proxy_pass http://api:4000/;`'s trailing slash — the api container's own
  routes stay unprefixed (`/health`, `/family-groups/...`), so this needed
  **no NestJS code change** (no `app.setGlobalPrefix`).
- everything else → `web:3000`, unchanged from today.

Verified end-to-end against the real containers before this was written:
`GET /` → 307 (the app's normal redirect-to-login), `GET /api/health` → the
real NestJS health response, `GET /api/<nonexistent>` → NestJS's own 404
JSON (`{"statusCode":404,...,"message":"Cannot GET /<nonexistent>"}` — note
the message shows the path _after_ stripping), proving the request reached
the real api container rather than falling through to `web`'s catch-all.

**One manual step remains, and only a human with Cloudflare Zero Trust
dashboard access can do it**: repoint the existing `wealthme.demo-wit.id`
Public Hostname's target service from `http://web:3000` to `http://nginx:80`.
`wealthme-api.demo-wit.id` (if it exists as a separate hostname) needs no
change — it can keep pointing directly at `api:4000` unaffected, or be
retired later once `/api/*` routing is confirmed working end-to-end from a
real browser.

**Do this in order, not in parallel** — the app went down once already this
way (the `NEXT_PUBLIC_API_URL` build-time value and the tunnel's actual
routing must agree, or every browser-side API call 404s and login can
complete but never reaches past it):

1. Deploy this change first (`nginx` up and healthy) — the `/api/*` path
   isn't reachable from outside until the tunnel is repointed, but nothing
   about deploying `nginx` itself changes today's working setup.
2. Repoint the Cloudflare Public Hostname (the manual step above).
3. Verify from a real browser (or `curl https://wealthme.demo-wit.id/api/health`
   from off this host) that `/api/health` now returns the real NestJS
   response, **before** touching the build-time URL.
4. Only then: `gh variable set NEXT_PUBLIC_API_URL --body "https://wealthme.demo-wit.id/api"`,
   re-run the image-build workflow, redeploy.

A note on the healthcheck, since it looked like a proxy bug and wasn't one:
`docker-compose.yml`'s `nginx` healthcheck uses `http://127.0.0.1/...`, not
`http://localhost/...`. This network assigns IPv4-only addresses (no IPv6 on
`wealthme_net`), and `nginx:alpine`'s own IPv6-auto-listen entrypoint script
can't inject a `listen [::]:80` line into the mounted, read-only config file
— so nginx binds IPv4 only, while busybox `wget` resolves `localhost` to
`::1` first per `/etc/hosts` and gets a real connection-refused against a
socket nginx never opened. Proven live on this host, not theoretical: the
identical check failed with `localhost` and succeeded with `127.0.0.1`.

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
