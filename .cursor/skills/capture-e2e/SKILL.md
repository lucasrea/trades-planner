---
name: capture-e2e
description: >-
  Run reproducible Plan, voice, and receipt checks against localhost or
  production. Use when the user asks for an end-to-end test, a production
  check, sample audio, a sample receipt, or to exercise captures, the Plan
  agent, transcription, or receipt photos.
---

# Capture checks

Use `tools/e2e`. Do not invent a one-off upload, and do not run `npm run test:integration` against a live database.

## Steps

1. `node tools/e2e/run.mjs --self-check` to prove the fixtures generate.
2. Local server, fake model (do not set `AI_PROVIDER=live`): `node tools/e2e/run.mjs --target local`.
3. Production: `node tools/e2e/run.mjs --target prod --job <throwaway-job-id>`.
4. Add `--confirm` only when the user asked to save the result, and only onto a throwaway job. Do not pass `--allow-create` unless they asked for a new job or document.

The cookie is `TP_COOKIE` or `tools/e2e/.session`. Never print it, and never commit it.

## Read

`tools/e2e/README.md` for flags and for what a pass does and does not cover. Local expectations come from `apps/web/lib/ai/fake.ts`. If that file changes, update `expectedFakeText` and `expectedFakeReceipt` in `tools/e2e/run.mjs`.

## Report

Say which target ran, each failing check by name, and the capture or job URL when one was created. A production confirm writes real rows.
