#!/usr/bin/env bash
# Proves deploy/nginx/default.conf routes and sizes requests the way its
# comments claim — `nginx -t` only proves the file parses.
#
# Why this exists: that config's own comments record the /api/auth/
# location precedence being got wrong TWICE in production (Better Auth vs
# NestJS auth, then the devices routes), each time discovered only after
# deploy. Adding regex locations for the upload routes is exactly the same
# class of change — a regex location outranks a plain prefix — so the
# routing is asserted here instead of reasoned about.
#
# Runs real nginx in Docker against the real config, with stub upstreams
# that echo back "<upstream> <method> <path-as-received>", and asserts the
# proxied path for a representative URL from EVERY location block plus the
# per-route body-size ceilings.
#
# Usage: scripts/nginx-routing-check.sh [path/to/default.conf]
#   (defaults to deploy/nginx/default.conf; pass another to diff behaviour
#    against a previous revision, e.g. a file written by `git show`)
set -euo pipefail
cd "$(dirname "$0")/.."

CONF="${1:-deploy/nginx/default.conf}"
NET="wm-nginx-routing-check"
PORT="${NGINX_CHECK_PORT:-18080}"
BASE="http://127.0.0.1:${PORT}"
TMP="$(mktemp -d)"
FAILURES=0

cleanup() {
  docker rm -f wm-check-nginx wm-check-api wm-check-web >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

# ── Stub upstream: 200 with "<name> <method> <path>", body drained ────────
cat > "$TMP/stub.py" <<'PY'
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

NAME = sys.argv[1]
PORT = int(sys.argv[2])


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _respond(self):
        remaining = int(self.headers.get("Content-Length") or 0)
        while remaining > 0:
            chunk = self.rfile.read(min(65536, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
        body = f"{NAME} {self.command} {self.path}".encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_GET = _respond
    do_POST = _respond

    def log_message(self, *args):
        pass


HTTPServer(("", PORT), Handler).serve_forever()
PY

start_stub() {
  local name="$1" port="$2" container="$3"
  docker create --name "$container" --network "$NET" --network-alias "$name" \
    python:3.12-alpine python /stub.py "$name" "$port" >/dev/null
  docker cp "$TMP/stub.py" "$container:/stub.py" >/dev/null
  docker start "$container" >/dev/null
}

echo "[nginx-check] config under test: $CONF"
docker network create "$NET" >/dev/null
start_stub api 4000 wm-check-api
start_stub web 3000 wm-check-web

docker create --name wm-check-nginx --network "$NET" \
  -p "127.0.0.1:${PORT}:80" nginx:alpine >/dev/null
docker cp "$CONF" wm-check-nginx:/etc/nginx/conf.d/default.conf >/dev/null
docker start wm-check-nginx >/dev/null

# Wait for the proxy to answer at all.
for _ in $(seq 1 50); do
  curl -s -o /dev/null --max-time 1 "$BASE/" && break
  sleep 0.2
done

# ── Assertions ────────────────────────────────────────────────────────────
# Every request carries the Host the config's server_name expects.
req() { curl -s --max-time 30 -H "Host: wealthme.demo-wit.id" "$@"; }

expect_route() { # <description> <method> <url-path> <expected upstream+path>
  local desc="$1" method="$2" path="$3" expected="$4" actual
  actual="$(req -X "$method" "$BASE$path")"
  if [ "$actual" = "$expected" ]; then
    echo "  PASS  $desc"
  else
    echo "  FAIL  $desc"
    echo "        expected: $expected"
    echo "        actual:   $actual"
    FAILURES=$((FAILURES + 1))
  fi
}

expect_status() { # <description> <url-path> <body-bytes> <expected status>
  local desc="$1" path="$2" bytes="$3" expected="$4" actual
  head -c "$bytes" /dev/zero | tr '\0' 'A' > "$TMP/body.bin"
  actual="$(req -o /dev/null -w '%{http_code}' -X POST \
    -H 'Content-Type: application/octet-stream' \
    --data-binary "@$TMP/body.bin" "$BASE$path")"
  if [ "$actual" = "$expected" ]; then
    echo "  PASS  $desc"
  else
    echo "  FAIL  $desc (expected HTTP $expected, got $actual)"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "[nginx-check] routing — one URL per existing location block:"
# location / — the Next.js app.
expect_route "/                        -> web"            GET  "/"                          "web GET /"
# location /api/auth/ — Better Auth on the web container, prefix intact.
expect_route "/api/auth/sign-in/email  -> web (intact)"   POST "/api/auth/sign-in/email"     "web POST /api/auth/sign-in/email"
# location ~ ^/api/auth/(...)$ — NestJS auth, allowlisted names only.
expect_route "/api/auth/login          -> api /auth/login" POST "/api/auth/login"            "api POST /auth/login"
expect_route "/api/auth/devices/d1/unlock -> api"         POST "/api/auth/devices/d1/unlock" "api POST /auth/devices/d1/unlock"
# location = /api/device-unlock — the Next.js BFF route, prefix intact.
expect_route "/api/device-unlock       -> web (intact)"   POST "/api/device-unlock"          "web POST /api/device-unlock"
# location /api/ — generic NestJS, prefix stripped.
expect_route "/api/calculators/zakat   -> api (stripped)" POST "/api/calculators/zakat"      "api POST /calculators/zakat"
expect_route "/api/health              -> api (stripped)" GET  "/api/health"                 "api GET /health"

echo "[nginx-check] routing — the three narrowed upload routes must strip identically:"
expect_route "scan        -> api (stripped)" POST "/api/family-groups/fg-1/transactions/scan" \
  "api POST /family-groups/fg-1/transactions/scan"
expect_route "attachments -> api (stripped)" POST "/api/family-groups/fg-1/transactions/tx-1/attachments" \
  "api POST /family-groups/fg-1/transactions/tx-1/attachments"
expect_route "upload-file -> api (stripped)" POST "/api/family-groups/fg-1/reconciliation/upload-file" \
  "api POST /family-groups/fg-1/reconciliation/upload-file"

echo "[nginx-check] routing — trailing-slash variants take the same block (Express is non-strict):"
expect_route "scan/        -> api (stripped)" POST "/api/family-groups/fg-1/transactions/scan/" \
  "api POST /family-groups/fg-1/transactions/scan/"
expect_route "attachments/ -> api (stripped)" POST "/api/family-groups/fg-1/transactions/tx-1/attachments/" \
  "api POST /family-groups/fg-1/transactions/tx-1/attachments/"
expect_route "upload-file/ -> api (stripped)" POST "/api/family-groups/fg-1/reconciliation/upload-file/" \
  "api POST /family-groups/fg-1/reconciliation/upload-file/"

echo "[nginx-check] routing — the AI statement routes keep their own longer read timeout:"
# A regex location wins over `location /api/` regardless of prefix length, so
# these four must land on the api upstream path-stripped exactly like the
# generic block would have — the only difference being proxy_read_timeout.
expect_route "statement-pdf         -> api (stripped)" POST "/api/family-groups/fg-1/reconciliation/statement-pdf" \
  "api POST /family-groups/fg-1/reconciliation/statement-pdf"
expect_route "statement-pdf/page    -> api (stripped)" POST "/api/family-groups/fg-1/reconciliation/statement-pdf/page" \
  "api POST /family-groups/fg-1/reconciliation/statement-pdf/page"
expect_route "statement-pdf/preview -> api (stripped)" POST "/api/family-groups/fg-1/reconciliation/statement-pdf/preview" \
  "api POST /family-groups/fg-1/reconciliation/statement-pdf/preview"
expect_route "statement-pdf/confirm -> api (stripped)" POST "/api/family-groups/fg-1/reconciliation/statement-pdf/confirm" \
  "api POST /family-groups/fg-1/reconciliation/statement-pdf/confirm"
expect_route "statement-pdf/page/   -> api (stripped)" POST "/api/family-groups/fg-1/reconciliation/statement-pdf/page/" \
  "api POST /family-groups/fg-1/reconciliation/statement-pdf/page/"
# The regex is anchored, so a route that merely STARTS with the same text
# must fall through to the generic block rather than silently inheriting the
# longer timeout.
expect_route "statement-pdfx        -> api (generic block)" POST "/api/family-groups/fg-1/reconciliation/statement-pdfx" \
  "api POST /family-groups/fg-1/reconciliation/statement-pdfx"

echo "[nginx-check] body-size ceilings — narrow, not global:"
expect_status "public calculator refuses 2 MB (stays at the 1m default)" \
  "/api/calculators/zakat" 2000000 413
expect_status "public calculator accepts 500 KB" \
  "/api/calculators/zakat" 500000 200
expect_status "scan accepts 2 MB" \
  "/api/family-groups/fg-1/transactions/scan" 2000000 200
expect_status "scan refuses 4 MB (over its own 3m)" \
  "/api/family-groups/fg-1/transactions/scan" 4000000 413
expect_status "attachments accept 5 MB" \
  "/api/family-groups/fg-1/transactions/tx-1/attachments" 5000000 200
expect_status "attachments refuse 7 MB (over their own 6m)" \
  "/api/family-groups/fg-1/transactions/tx-1/attachments" 7000000 413
expect_status "upload-file accepts 20 MB" \
  "/api/family-groups/fg-1/reconciliation/upload-file" 20000000 200
expect_status "upload-file refuses 23 MB (over its own 21m)" \
  "/api/family-groups/fg-1/reconciliation/upload-file" 23000000 413
# The trailing-slash variant must get the ROUTE's ceiling, not the 1m
# default it fell back to before `/?$` was added (security review, LOW).
expect_status "scan/ (trailing slash) accepts 2 MB" \
  "/api/family-groups/fg-1/transactions/scan/" 2000000 200
expect_status "upload-file/ (trailing slash) accepts 20 MB" \
  "/api/family-groups/fg-1/reconciliation/upload-file/" 20000000 200

if [ "$FAILURES" -ne 0 ]; then
  echo "[nginx-check] FAILED — $FAILURES assertion(s)"
  exit 1
fi
echo "[nginx-check] OK"
