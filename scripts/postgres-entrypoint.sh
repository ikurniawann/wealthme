#!/bin/bash
# Wrapper around the postgres Docker entrypoint.
# On every startup, re-syncs the stored password to the current POSTGRES_PASSWORD
# env var. This prevents P1000 auth failures when the volume was created with a
# different password (e.g. after changing .env without docker compose down -v).

set -e

# Start postgres in the background via original entrypoint.
/usr/local/bin/docker-entrypoint.sh postgres &
PG_PID=$!

# Forward signals so docker stop/restart works correctly.
trap "kill -TERM $PG_PID 2>/dev/null; wait $PG_PID 2>/dev/null" SIGTERM SIGINT SIGQUIT

# Wait until postgres is accepting connections (use 'postgres' system DB to avoid
# "database does not exist" FATAL errors before POSTGRES_DB is created).
until pg_isready -U "${POSTGRES_USER:-wealthme}" -d postgres -q 2>/dev/null; do
  sleep 1
done

# Re-hash the password using the current env value (local socket = trust auth,
# so no password needed even if the stored hash is stale).
psql -U "${POSTGRES_USER:-wealthme}" -d postgres \
  -c "ALTER USER \"${POSTGRES_USER:-wealthme}\" WITH PASSWORD '${POSTGRES_PASSWORD:-postgres}'" \
  2>/dev/null || true

# Hand off to postgres and wait for it to exit.
wait $PG_PID
