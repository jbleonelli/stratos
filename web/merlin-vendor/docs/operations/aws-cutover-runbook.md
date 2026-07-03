# AWS data-plane cutover runbook (Phase 3)

The day-of plan for moving Merlin's **data layer** (Postgres + GoTrue auth + Storage + Realtime) from managed Supabase to our self-hosted Supabase stack on AWS. Companion to the plan of record [`aws-migration.md`](aws-migration.md); the restore mechanics are validated there (the 2026-06-28 rehearsal).

**This is the one high-risk, write-blocking step.** Everything before it (per-client module, durable DB, PG17 pin, Secrets Manager, TLS, the rehearsal) is done and live-validated.

> **➡️ Compute also migrated (Phase 2, same day).** This runbook covers only the data layer. The app, API, crons, and frontend later moved off Vercel onto AWS (Lambda + API Gateway + EventBridge + S3/CloudFront) — a separate, **stateless, zero-downtime DNS-flip** cutover with its own runbook in [`infra/aws-compute/README.md`](../../infra/aws-compute/README.md). After both, Merlin is 100% on our AWS.

> ## 🟢 EXECUTED — LIVE IN PROD 2026-06-28
>
> The big-bang cutover ran successfully. Merlin's data layer is live on the self-host at **`merlindb.adaptiv.systems`** (EC2 `m6i.xlarge`, EIP `32.197.171.128`, us-east-1); the Vercel app was repointed via the 4 env vars. Managed Supabase is the untouched warm rollback.
>
> **One issue surfaced live and was fixed in-window:** real-estate users hit the "add your first building" first-run screen because the building loader's per-row RLS query (`locations.select('*')`) ran ~15s through PostgREST and tripped the 8s `statement_timeout`. Fix = **migration `265_location_rls_perf_subselect.sql`** (wrap `current_user_org()`/`is_platform_admin()` in `(select …)` → 15.8s→1.5s). _TODO: apply mig 265 to managed prod too._
>
> **Lessons learned (read before re-doing any cutover):**
>
> 1. **Vercel "Redeploy" reuses the old build** → `VITE_*` env changes don't take effect. Force a fresh build (push a commit / `vercel --prod --force` / build-cache OFF). Verify the live bundle references the new `SUPABASE_URL`.
> 2. **Merlin is a PWA** — the service worker serves a stale cached app after deploy. **Verify in Incognito**, never your normal browser.
> 3. **Run `ANALYZE` immediately after the restore** (planner statistics) — easy to forget, hurts query plans.
> 4. **PostgREST runs RLS queries ~5× slower than `psql SET ROLE`** (non-superuser SECURITY DEFINER context-switching). Always measure the heavy reads **through the gateway**, not just psql, before declaring perf OK.
> 5. The self-host is CPU/infra-weaker than managed Supabase, so **borderline-slow RLS queries that pass on prod will time out here** — rehearse the actual app paths (not just login/RLS) as a real user with a large org (e.g. Meridian, 491 locations) before go-live.
> 6. Lock the SG to a **stable** admin IP — a flapping home IP breaks `:22`/`:8000` mid-cutover.

> **✅ FULL DRY RUN PASSED 2026-06-28.** Stood up the production-shaped stack from `clients/saas.tfvars` (**`m6i.xlarge`** + HA: DLM snapshots + EC2 auto-recovery) and validated the entire procedure end-to-end, then torn down: PG 17.6; **storage durability fix confirmed live** (`volumes/storage → /mnt/pgdata/storage-data` on the persistent EBS); clean restore (100 tables / 71 users / 15 orgs / 5,509 storage rows); **realtime publication carried automatically** by the `public` restore (all 17 tables already members — no manual step); login via the **freshly-minted `saas` anon key** (HS256) + RLS row-scoping correct; **TLS** (Caddy + Let's Encrypt) issued on the real config. **Storage blob path also rehearsed (2026-06-28, 2nd session)** and a naive file-sync was ruled out — blobs must be re-uploaded **through the storage API** (see open item 1); validated byte-identical round-trip. The real window is now a known, rehearsed sequence on `db.adaptiv.systems`; the one build left is a per-object storage-migration script.

---

## Scope (recommended): data-layer-only, app stays on Vercel

The validated thesis is **env-swap, not rewrite**. So the minimal, highest-value cutover keeps the Vercel app exactly as-is and only repoints it at our self-host gateway:

| Env var                         | Today (managed Supabase)    | After cutover (our self-host)           |
| ------------------------------- | --------------------------- | --------------------------------------- |
| `VITE_SUPABASE_URL` (frontend)  | `https://<ref>.supabase.co` | `https://<our-domain>` (Kong via Caddy) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…`          | self-host **anon JWT**                  |
| `SUPABASE_URL` (api/)           | `https://<ref>.supabase.co` | `https://<our-domain>`                  |
| `SUPABASE_SECRET_KEY` (api/)    | `sb_secret_…`               | self-host **service_role JWT**          |

- **Compute stays on Vercel** (SPA + 134 fns + 18 crons). Moving fns→Lambda / crons→EventBridge is a _separate, later_ effort — do NOT couple it to the DB cutover.
- **Crons fire on one side only** (Vercel) — no double-fire risk because we are not standing up EventBridge in this cutover.
- **No direct-Postgres consumers** — verified: all DB access is `supabase-js → Kong → PostgREST`. (`api/_lib/notion-samsic.ts` is the Notion client, not PG.) So the crash-looping Supavisor pooler is irrelevant to the app.
- **Parallel-path**: managed Supabase stays the source of truth until the flip; it is the rollback. Never allow writes to both DBs (split-brain).

---

## Decisions

- **✅ First target = BIG-BANG the whole SaaS** (decided 2026-06-28). Cut over the entire multi-tenant production DB as instance #1 — there is no per-org partial cutover (all orgs share one DB). So the storage-blob copy, realtime publication carry, and the maintenance window are all customer-facing across every org.
- **✅ Auth = users re-login once** (resolved 2026-06-28). Prod signs user JWTs with **asymmetric ES256 keys** (JWKS `kty:EC`, P-256, kid `6ee17ec6…`); Supabase holds the private key and does **not** export it, so it **cannot be carried** into self-host GoTrue. ⇒ **no seamless session continuity** — at the flip, active sessions invalidate and users sign in again (one-time UX hit, not data-loss). Self-host runs the classic **HS256 `jwt_secret`** model with freshly-generated anon/service JWTs (as in the rehearsal); the app's publishable/secret env vars become those self-host JWTs. _Tell users to expect a re-login; consider a heads-up notice._

## Open items (resolve BEFORE scheduling a window)

1. **🟢 Storage durability FIXED + approach chosen 2026-06-28** (blob copy still a window step). **Backend = file-on-persistent-EBS** (decided). ⚠️ Durability bug the module had: the compose default is `STORAGE_BACKEND=file` at `./volumes/storage`, which lands on the **ephemeral root disk** → blobs lost on instance replacement. **Fixed**: cloud-init now symlinks `volumes/storage → /mnt/pgdata/storage-data` (the persistent EBS), mirroring the DB data dir. (S3 backend = `STORAGE_BACKEND=s3` + `GLOBAL_S3_BUCKET` remains the scale-up alt.) **Volume sizing:** the persistent volume now holds DB (~0.9 GB) + blobs (~1.6 GB) — fits the 20 GB default with headroom; bump `db_volume_size` if needed. **Blob copy (window step) — ⚠️ NOT a file/S3 sync; must go THROUGH the storage API.** Rehearsed 2026-06-28: a plain copy of blobs onto the file backend **FAILS** — the backend stores each object at `…/stub/stub/<bucket>/<key>/<version-uuid>` (key is a dir, blob named by `storage.objects.version`) **and keeps metadata in POSIX xattrs**; a copied file 500s with `ENODATA` ("extended attribute does not exist"). **Validated method:** for each object, download from Supabase (its S3 connection: dashboard → Storage → S3 connection creds, `aws s3 cp --endpoint-url …`) → **re-upload via the self-host storage API** (`POST /storage/v1/object/<bucket>/<key>` with service key + correct `Content-Type`). The API writes the blob, xattrs, version path, AND the `storage.objects` row — proven byte-identical round-trip. **Implication:** do NOT restore `storage.objects` from the dump (the re-upload creates the rows; restoring them would conflict/orphan) — restore `storage.buckets` (or create buckets via API) only. Sized at **5,509 objects / 1.6 GB** (99.6% the private `samsic-files` back-office bucket; customer-app buckets ~4 objs/2.8 MB). Migration tool: **`scripts/migrate-storage.mjs`** (pure `supabase-js`, needs only the two service keys — `SOURCE_*` prod + `TARGET_*` self-host; recursive list → download → API-upload, bounded concurrency, `--dry-run`, `--skip-existing` for fast delta runs, idempotent upsert). ~1.6 GB down+up ≈ 10–20 min, pre-syncable before the freeze. **Pre-flight before the window:** run with `--dry-run` and confirm it enumerates ~5,509 objects. _Durability fix (`volumes/storage → /mnt/pgdata/storage-data`) ✅ confirmed live; **the API-to-API blob method is now the only validated path** (file-sync ruled out)._
2. **✅ Realtime — NO MANUAL STEP (proven in the dry run 2026-06-28).** The `public` schema restore **carries the `supabase_realtime` publication membership automatically** — the `ALTER PUBLICATION … ADD TABLE` statements live in the public dump, so after restore all **17 tables** were already members (and `REPLICA IDENTITY` rides along too). Earlier assumption that this needed a manual re-apply was wrong. Just **verify** post-restore: `select count(*) from pg_publication_tables where pubname='supabase_realtime';` should be 17.
3. **✅ Vault — CLOSED 2026-06-28.** `vault.secrets` has **0 rows** in prod; nothing to carry. Skip entirely.
4. **🟢 HA — DECIDED + hardened 2026-06-28 (Option 1: hardened single box).** Instance #1 carries the whole SaaS on one box (single-AZ); chosen over a standby replica (which ~2×s spend). Implemented in `ha.tf`: **EC2 auto-recovery** (system-status-check alarm → recover the same instance, keeping EBS + EIP, RTO ~minutes) + **DLM EBS snapshots** of the persistent DATA volume (every 12h, retain 14 ≈ 1 week) on top of the nightly `pg_dump`→S3. Instance default sized up to **`m6i.xlarge`** (4 vCPU/16 GB, non-burstable). ⚠️ Applying these may need `dlm:*` + `cloudwatch:*` added to the `merlin-migration` policy. A streaming-replica standby (true cross-AZ HA, RPO≈0) remains the documented fast-follow once real load justifies the cost. _✅ Live-validated in the 2026-06-28 dry run: DLM policy + auto-recovery alarm both created (needed the `dlm:*`+`cloudwatch:*` grant, now on the `merlin-migration` policy)._
5. **🟡 DNS** — the gateway domain must live in the **live** `adaptiv.systems` zone (NOT the migration account's shadow zone — see the gotcha in `aws-migration.md`). Pick a stable hostname (e.g. `db.adaptiv.systems`).

---

## Pre-cutover prep (days before; zero downtime, zero risk)

1. **Stand up the production stack** from the module: `clients/<target>.tfvars` with `domain` set (live zone), real sizing, **secrets that match the resolution of decision #1**, `replay_mode` considerations N/A (real data). Apply → confirm PG 17.6 on the persistent volume + TLS cert (validated mechanics).
2. **Pre-sync storage blobs** via the **API-to-API** migration script (open item 1) — bulk-copy the bulk now (mostly `samsic-files`), leaving a small delta for the window. NOT a file sync.
3. **Dry-run the restore** against the live stack using the validated runbook in `aws-migration.md` (we've done this once already on a throwaway).
4. **Stage the Vercel env change** as a ready-to-apply set (don't apply yet).
5. **Pick the window** (low-traffic), announce maintenance.

## Cutover window (brief write-freeze)

1. **Freeze writes** — put the app in maintenance mode (the `/?staff=1` bypass keeps an admin path open). Confirm no writers hitting managed Supabase.
2. **Final dump → restore** — `pg_dump -Fc` the now-quiescent managed DB over the **session-mode pooler `:5432`** → restore order: `auth` **data-only** (identities first, so `public` FKs validate) → pre-create `demo_fixtures`/`supabase_migrations` → `public`/`demo_fixtures`/`supabase_migrations` **full**. **EXCLUDE the `storage` schema** (the migration script owns buckets + objects + blobs) **and** `realtime`/`vault`/`extensions`/`graphql*`/`pgbouncer`. Expect only the 1 benign `auth.schema_migrations` dup-key.
3. **Storage** — final API-to-API delta via `scripts/migrate-storage.mjs` (creates buckets w/ config + objects + blobs), **then apply `infra/aws/storage-rls-policies.sql`** — the **12 custom `storage.objects` RLS policies** (per-bucket access control) that neither the init nor the script create. ⚠️ Skipping this leaves storage access wide-open/closed-wrong.
4. **Verify** realtime publication = 17 tables (carried automatically by the public restore — no action). Vault = nothing to do (0 secrets).
5. **Repoint the app** — set the four Vercel env vars to the self-host URL + JWT keys; **redeploy** (env changes need a fresh deploy to take effect; see [`vercel_cron_secret`] note that crons re-register on a git push).
6. **Smoke test** (below). If green → **lift maintenance mode**. If red → **rollback** (below).

## Smoke tests (exit criteria — mirror the rehearsal + add the deltas)

- **Login** (GoTrue) — users re-login (prod's ES256 sessions don't carry); confirm a fresh sign-in issues a working self-host session against the restored identities.
- **RLS row-scoping** — a contractor sees only their grant-scoped orgs; anon → 0 (validated pattern).
- **Realtime** — a `supabase.channel()` subscription fires on an insert (publication carried).
- **Storage** — open an existing object URL (blobs copied) + a fresh upload/download round-trip.
- **Writes** — create a ticket / complete a task; confirm it persists in the self-host DB.
- **Crons** — confirm the next per-minute tick runs against the new DB (and only once).
- **Claude/Bedrock** — chat path works (Bedrock layer is independent; only `AWS_REGION`-derived geo matters).

## Rollback

Until we permit **writes** to the self-host DB (i.e., until step 6 goes green and maintenance lifts), rollback is clean: **revert the four Vercel env vars to managed Supabase + redeploy.** The managed DB was only read from, so it is untouched and authoritative. The point of no return is the first write to the new DB after lifting maintenance — after that, rolling back means reconciling divergence, so **do not lift maintenance until smoke tests pass.**

## Post-cutover

- Monitor (Sentry, gateway, DB) through a soak period.
- Keep managed Supabase **paused but intact** as a warm rollback for N days.
- **Decommission** managed Supabase (and, later, migrate compute) only after the soak is clean.
