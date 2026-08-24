#!/usr/bin/env bash
# Apply Drizzle schema to Supabase Postgres.
# Requires DATABASE_URL in .env.local (use Direct connection, port 5432, for migrations).
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.local
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL in .env.local first."
  exit 1
fi

npm run db:push
echo "Schema pushed to Supabase."
