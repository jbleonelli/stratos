# Backup & restore — Runbook (self-host on AWS)

**Last reviewed:** 2026-06-28 (DR drill) · **Owner:** Adaptiv platform admins

Merlin's database runs on the **self-hosted Supabase** stack on AWS EC2
(`merlindb.adaptiv.systems`) since the 2026-06-28 migration. Managed Supabase PITR
no longer applies — backups are our own. This runbook is **drill-verified** (see the
log at the bottom).

---

## What we have

| Layer                 | Mechanism                                                                                    | Cadence / retention             | Proven               |
| --------------------- | -------------------------------------------------------------------------------------------- | ------------------------------- | -------------------- |
| **Logical dump**      | `pg_dump` → versioned S3 (`merlin-supabase-saas-<acct>/backups/`), via the EC2 instance role | nightly `0 3 * * *` UTC         | ✅ drill 2026-06-28  |
| **Block snapshot**    | EBS snapshots of the `/mnt/pgdata` data volume (DLM)                                         | every 12 h, retain 14 (~7 days) | ✅ snapshots present |
| **Instance recovery** | CloudWatch status-check alarm → EC2 auto-recover (keeps instance + EBS + EIP)                | on host failure                 | configured           |
| **Warm fallback**     | the **paused managed Supabase** project (untouched pre-cutover copy)                         | static, during soak             | rollback only        |

**Force a backup now** (read-only; same as the cron):

```bash
ssh -i ~/.ssh/merlin-poc.pem ec2-user@32.197.171.128 'sudo /usr/local/bin/pg-backup.sh'
aws s3 ls s3://merlin-supabase-saas-112039069587/backups/ --human-readable | tail -3
```

> ⚠️ **Dump format.** Backups must use `pg_dump -U supabase_admin --no-owner --no-privileges -Fc`
> (a `.dump` file). The old plain `pg_dump -U postgres … | gzip` (`.sql.gz`) restores the
> **data** fine but throws ~467 ownership/GRANT errors (restore-as-`postgres` can't `SET ROLE`
> to the Supabase roles). The cloud-init template is fixed (PR #1144); **the LIVE instance's
> script may still be the old line** until updated — see "Action items".

---

## When to restore

Restore is for **lost or corrupted data**, not "the app is broken" (that's a deploy
rollback — see the cutover runbook / CI/CD). Warranted by: a bad migration
(`DROP`/unfiltered `UPDATE`), an import to the wrong org, a hard-delete via SQL, or a
security incident. **Not** for app bugs, single-tenant bad data (use a targeted RPC),
or "an earlier version" (no row-history beyond `location_edits`). A full restore is
**destructive** — it rolls every tenant back. Prefer surgical repair.

---

## Restore options (fastest → most complete)

### A. EBS snapshot — roll the whole data volume back

Best for "the box/volume is corrupt, restore to a point in time" (12 h granularity).

1. `aws ec2 describe-snapshots --owner-ids self --filters Name=tag:Project,Values=merlin --query 'reverse(sort_by(Snapshots,&StartTime))[:5]'` — pick one.
2. Create a volume from it (`aws ec2 create-volume --snapshot-id … --availability-zone <az>`).
3. Stop the instance, detach the live data volume, attach the restored one at the same device, start. (Or stand up a fresh stack and attach.)
4. Verify (queries below).

### B. Restore a logical dump into a scratch DB — extract specific data (non-destructive)

Drill-proven path. Restore the `.dump` into a **fresh empty database** on any
`supabase/postgres:17.6` host, then copy out what you need.

```bash
aws s3 cp s3://merlin-supabase-saas-112039069587/backups/<TS>.dump /tmp/r.dump
scp -i ~/.ssh/merlin-poc.pem /tmp/r.dump ec2-user@<host>:/tmp/r.dump
ssh … 'sudo docker cp /tmp/r.dump supabase-db:/tmp/r.dump
  sudo docker exec supabase-db psql -U postgres -d postgres -c "CREATE DATABASE drill_restore TEMPLATE template0;"
  sudo docker exec supabase-db pg_restore --no-owner -U supabase_admin -d drill_restore /tmp/r.dump'   # exit 0, 0 errors with the fixed format
```

Then `COPY … TO STDOUT` from the restored DB and `COPY … FROM STDIN` into live for the
affected rows. (With the OLD plain `.sql.gz`: `gunzip -c … | psql -d drill_restore` —
data lands but expect the ownership-error noise.)

### C. Restore into a fresh self-host (full DR — the box is gone)

Stand up a new stack (`infra/aws`, a tfvars) and restore the dump using the
**cutover-proven selective procedure** (auth + storage data-only first, then public,
excluding the service-owned schemas realtime/vault/extensions/graphql/pgbouncer).
Full step-by-step: [`../aws-migration.md`](../aws-migration.md) → "Cutover restore runbook".
⚠️ Reuse the real `jwt_secret` + anon/service keys (else sessions break) and migrate
storage blobs via `scripts/migrate-storage.mjs` (the dump carries `storage.objects`
rows but not the blobs).

### D. Fail over to the paused managed Supabase (warm rollback, during soak only)

The pre-cutover managed instance is intact. Repoint the 4 Vercel/Lambda env vars back
(see [`../aws-cutover-runbook.md`](../aws-cutover-runbook.md)). Only valid until that
instance is retired after the soak.

---

## Post-restore verification

```sql
select count(*) from public.organizations;                 -- expect 15
select count(*) from auth.users;                            -- expect 71
select count(*) from public.locations;                      -- expect 1210
select count(*) from storage.objects;                       -- expect 5509
select version, name from supabase_migrations.schema_migrations order by version desc limit 3;
```

If anything looks off, **stop** — re-restore a different snapshot/dump or escalate.

---

## Action items (from the 2026-06-28 drill)

- [ ] **Update the LIVE prod `pg-backup.sh`** to the fixed format (cloud-init is fixed in PR #1144 but only applies on a fresh boot):
  ```bash
  ssh -i ~/.ssh/merlin-poc.pem ec2-user@32.197.171.128 'sudo tee /usr/local/bin/pg-backup.sh >/dev/null <<BK
  #!/bin/bash
  set -euo pipefail
  TS=$(date -u +%Y%m%dT%H%M%SZ)
  /usr/bin/docker exec supabase-db pg_dump -U supabase_admin --no-owner --no-privileges -Fc -d postgres | aws s3 cp - "s3://merlin-supabase-saas-112039069587/backups/$TS.dump"
  BK
  sudo chmod +x /usr/local/bin/pg-backup.sh'
  ```
- [ ] **Dump-freshness alarm** — CloudWatch alarm if no new `backups/` object in 26 h (catches a silently-broken cron). Folds into the gap-#3 observability work.
- [ ] Re-run this drill quarterly, and once after the live script is on the fixed format.

---

## Drill log

| Date       | What                                                                                                                                                                                                                                  | Result                                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-06-28 | First DR drill on the self-host. Found the nightly dump had **never run** (instance launched after 03:00); forced one (85 MB, data-complete). Restored into a throwaway box (isolated TF workspace; prod untouched; destroyed after). | **Backup path ✅, data-complete ✅** (15 orgs / 71 users / 1210 locations / 5509 storage rows). Plain dump → 467 ownership/GRANT errors (no data loss). **Fixed format (`-Fc --no-owner --no-privileges`) → restore exit 0, 0 errors.** Cloud-init fixed (PR #1144); live script + freshness alarm = action items above. |
