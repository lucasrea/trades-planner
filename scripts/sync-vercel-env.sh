#!/usr/bin/env bash
# Sync .env.local secrets to Vercel (production + preview).
# Usage: ./scripts/sync-vercel-env.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local — copy .env.example and fill in values."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.local
set +a

REQUIRED=(AUTH_SECRET AUTH_URL AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET DATABASE_URL)
for key in "${REQUIRED[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing $key in .env.local"
    exit 1
  fi
done

echo "Linking Vercel project (if needed)…"
npx vercel link --yes --project trades-planner >/dev/null 2>&1 || true

for target in production preview; do
  echo "Syncing to $target…"
  for key in "${REQUIRED[@]}"; do
    value="${!key}"
    if [[ "$key" == "AUTH_URL" && "$target" == "production" ]]; then
      value="${AUTH_URL_PRODUCTION:-https://trades-planner-bay.vercel.app}"
    fi
    printf '%s' "$value" | npx vercel env add "$key" "$target" --force
  done
done

echo "Removing legacy Turso env vars (if present)…"
for target in production preview; do
  npx vercel env rm TURSO_DATABASE_URL "$target" --yes 2>/dev/null || true
  npx vercel env rm TURSO_AUTH_TOKEN "$target" --yes 2>/dev/null || true
done

echo "Done. Redeploy with: npx vercel --prod"
