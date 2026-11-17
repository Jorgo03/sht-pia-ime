# Backup, restore and rollback — Shtëpia.ime (L25)

Written 2026-10-21 for the setup as it is today: Supabase project
`xzzzhlwmzotibrxdqmcm` on the **Free** plan, website on Vercel deployed from
`master`, phone app not yet built for the stores.

**No restore has been tested.** Everything below is the documented procedure;
the first real drill is a task in itself (see §5).

## 1. What exists today

| Asset | Backed up automatically? | Source |
| --- | --- | --- |
| Database (listings, profiles, messages…) | **No.** Supabase takes daily backups only for Pro, Team and Enterprise projects; for Free projects its docs recommend exporting regularly with `supabase db dump` and keeping off-site copies. | supabase.com/docs/guides/platform/backups (via Supabase docs search, 2026-10-21) |
| Storage files (listing photos) | **No**, on any plan: "Database backups do not include objects you store via the Storage API." | same page |
| Schema | Yes, in git: `supabase/migrations/*.sql` | this repo |
| Website | Yes: every Vercel deployment stays available and can be promoted again | Vercel dashboard |
| Phone app | Not released yet. After release, the stores keep earlier builds; EAS keeps build artifacts | — |

Free-plan risk on top of that: Supabase pauses a Free project after about a
week of low activity, and a paused project can be resumed from the dashboard
for 90 days (supabase.com/docs/guides/platform/free-project-pausing). At launch
traffic that is unlikely, but it is not zero.

## 2. Manual database backup (Free plan, do weekly and before every migration)

Needs the Supabase CLI and the database password (Dashboard → Project Settings
→ Database). The password is a secret: type it at the prompt, never commit it
or paste it into a chat.

```bash
npx supabase login
npx supabase link --project-ref xzzzhlwmzotibrxdqmcm
mkdir -p ~/shtepia-backups/$(date +%F)
cd ~/shtepia-backups/$(date +%F)
npx supabase db dump -f roles.sql --role-only
npx supabase db dump -f schema.sql
npx supabase db dump -f data.sql --use-copy --data-only
```

Keep the folder **off this laptop** too (an encrypted cloud drive). The dump
contains personal data (names, emails, phone numbers, messages): treat it like
the production database.

Photos: `npx supabase storage cp -r ss://property-images ./property-images --experimental`
(the Supabase CLI's documented way to download a bucket).

## 3. Restore

- **Pro plan and above:** Dashboard → Database → Backups → choose the backup
  just before the incident. The project is unavailable during the restore.
- **Free plan (from your own dump):** restore into a **new** project first, never
  over production blind:
  ```bash
  psql "$NEW_PROJECT_DB_URL" -f roles.sql
  psql "$NEW_PROJECT_DB_URL" -f schema.sql
  psql "$NEW_PROJECT_DB_URL" -c 'SET session_replication_role = replica' -f data.sql
  ```
  Then run `supabase/tests/*.sql` against it (they roll back), compare row
  counts with production, and only then point the apps at it or copy data back.

## 4. Rolling back a change

| What went wrong | Rollback |
| --- | --- |
| Website release | Vercel → Deployments → the last good deployment → "Promote to Production". Then `git revert` the bad commit on `master` so the next deploy does not bring it back. |
| A migration | The pending files in `supabase/pending/` list their exact reverse in the header. The applied ones do not; their headers say what they add (the 2026-10 ones are additive: triggers, new tables, one restrictive policy), so the reverse is to drop exactly those objects. Write the reverse as a **new** migration; never edit an applied one. Take a dump (§2) before applying anything. |
| Data deleted by mistake | Pro: restore a backup or use PITR (paid add-on). Free: only your latest dump can bring it back — which is why §2 runs before risky work. |
| Phone app release | Stores do not roll back: ship a fixed build. EAS Update can push a JavaScript-only fix to installed builds; native changes need a new store build. |
| Edge Function | Redeploy the previous version from git (`supabase/functions/<name>`). |

## 5. What still has to happen (owner)

1. Decide the Supabase plan (L21). Pro gives daily backups (7 days) and
   leaked-password protection, which is "available on the Pro Plan and above"
   (supabase.com/docs/guides/auth/password-security).
2. Until then: run §2 weekly and before each migration, and store the copy
   off-site.
3. Do one restore drill into a scratch project (§3), time it, and write the
   result here. Until that drill happens, treat restore time as unknown.
