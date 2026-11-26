# Backups: what to confirm, and how to restore

Written 2026-11-26. Nobody has checked the production Supabase project against this. Everything under "Confirm" is a check for the owner, and the table stays blank until it is done. Finish it before real customer data goes in.

## What Supabase said on this date

From [Database Backups](https://supabase.com/docs/guides/platform/backups). Plans and prices change, so read the page again when you do the checks.

- Pro, Team and Enterprise projects are backed up daily. Pro keeps the last 7 days, Team 14, Enterprise up to 30. The page promises no automatic backup for Free projects and tells them to export their own.
- Point-in-time recovery (PITR) is a paid add-on for Pro and above, listed at about US$100 a month for 7 days, US$200 for 14 and US$400 for 28. Worst-case data loss is about two minutes. With PITR on, daily backups stop.
- A restore replaces the current database, and the project is unavailable while it runs.
- Database backups do not include files in Storage, only the rows that describe them. Restoring does not bring back a deleted file.
- Deleting a project deletes its backups too.

## Confirm

| Check | Where | Answer | Date |
|---|---|---|---|
| Plan tier of the production project | Organization → Billing | | |
| Daily backups are listed, and the newest is under 24 hours old | Database → Backups | | |
| How many days of backups are listed | Database → Backups | | |
| PITR on or off; if on, the earliest and latest restore points | Database → Backups → Point in Time | | |
| Postgres version (needed for `pg_dump`) | Project Settings → Infrastructure | | |
| Who can restore or delete the project, and that each has two-factor sign-in | Organization → Team | | |
| The `receipts` bucket exists, is private, and has a copy outside the project | Storage | | |
| Copies of `AUTH_SECRET` and the other Vercel variables are in a password manager | Vercel → Settings → Environment Variables | | |

## Decide

- **How much work can be lost.** Daily backups can lose up to a day of quotes, invoices and logged hours. If that is too much for the beta contractors, turn on PITR.
- **Free tier.** If the project is on Free, upgrade before the beta. If you stay on Free, the dump below is the only database backup, and someone has to run it every day.
- **Receipt photos.** No plan tier covers them. Copy the `receipts` bucket on a schedule (below), or accept in writing that a lost bucket means lost photos. The expense lines survive in the database either way.

## Your own copies

Keep these outside Supabase, encrypted, with access limited to you. They hold client names, addresses, emails and amounts. Never put them in this repository. Delete old copies on a schedule you can state in the privacy policy, so deleted accounts don't live on in them.

**Database.** Use the direct connection string (port 5432) and a `pg_dump` at least as new as the server. All app tables are in `public`.

```bash
pg_dump "$PRODUCTION_DIRECT_URL" --schema=public --format=custom --file="trades-planner-$(date +%F).dump"
```

**Receipt photos.** Object keys are `receipts/{contractor_id}/{capture_id}.jpg` inside the `receipts` bucket, and `captures.image_path` records each one. Copy the whole bucket with any S3 client through Supabase Storage's S3-compatible access, or with the Supabase CLI's storage commands. Check the copy against the database:

```sql
select count(*) from captures where image_path is not null;
```

## Restore checklist

For a real loss. Work down the list.

1. **Stop writes.** Take the app offline in Vercel (pause the project), so nothing new is written to a database that is about to be replaced. `AI_CAPTURE_ENABLED=false` stops only captures.
2. **Note the times:** when the damage happened (UTC) and when you stopped writes.
3. **Save what is there now** with the `pg_dump` command above, even if it is damaged.
4. **Choose the restore point,** the latest one before the damage. If only some rows are lost, restore into a new project instead and copy them across, leaving production in place.
5. **Restore** from Database → Backups. If the project uses replication slots or subscriptions of your own, follow the docs on dropping them first.
6. **Reset custom database role passwords,** if you made any roles. Daily backups don't keep them. Update `DATABASE_URL` in Vercel if the connection details changed.
7. **Undo what the restore brought back.** Anything done after the restore point is gone, including removals:
   - delete again any account deleted since then, and its receipt photos;
   - sign phones out: `delete from mobile_sessions;`
   - revoke again any share link revoked since then.
8. **Check document numbers.** Quotes and invoices sent after the restore point may have their numbers issued again. Compare sent emails with `contractors.next_quote_number` and `next_invoice_number`, and raise them where needed.
9. **Check the app:** every migration in `supabase/migrations/` is applied, Row Level Security is on for every table, receipt photos open, and sign-in works on web and phone.
10. **Bring the app back,** tell affected contractors what window was lost, and write down what happened.

## Rehearse once before the beta

Restore into a throwaway project or a local Postgres, never into production:

```bash
pg_restore --no-owner --no-privileges --dbname="$SCRATCH_URL" trades-planner-YYYY-MM-DD.dump
```

A message that schema `public` already exists is expected. Then compare row counts for `contractors`, `documents`, `line_items` and `captures` with production, and open one receipt photo from your bucket copy. Record how long it took.

The commands in this file have not been run against this project. The rehearsal is where they get proven.

**Done when** the table above is filled in, the decisions are made, and one rehearsal restore has worked.
