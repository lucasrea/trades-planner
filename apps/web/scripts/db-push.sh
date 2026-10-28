#!/usr/bin/env bash
# Apply Drizzle schema to Supabase Postgres.
# Requires DATABASE_URL in .env.local (use Direct connection, port 5432, for migrations).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
APP="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="$APP/.env.local"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env.local"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL in .env.local first."
  exit 1
fi

cd "$APP"
npm run db:push
echo "Schema pushed to Supabase."
