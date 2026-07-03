# SAMSIC CRM — Notion mirror

`/platform/payments/samsic-crm` mirrors the SAMSIC CRM database from Notion into Postgres so JB + super admins can browse the deal pipeline from inside the Adaptiv back-office without bouncing to Notion. Notion remains the source of truth — editing happens there until the inline-editing follow-up ships.

## Architecture

```
┌─────────────────────┐  notion.dataSources.query()  ┌────────────────┐
│  Notion             │  ──────────────────────────► │  Vercel cron   │
│  SAMSIC CRM         │                              │  /api/cron/    │
│  data source        │                              │  samsic-crm-   │
│  c1dd4cc4-...       │                              │  sync (15 min) │
└─────────────────────┘                              └────────┬───────┘
                                                              │ upsert
                                                              ▼
                                            ┌────────────────────────────┐
                                            │  public.sales_crm_samsic   │
                                            │  (migration 153, RLS:      │
                                            │   Owner + Super Admin)     │
                                            └────────────┬───────────────┘
                                                         │ select
                                                         ▼
                                          ┌────────────────────────────┐
                                          │  /platform/payments/       │
                                          │  samsic-crm UI             │
                                          └────────────────────────────┘
```

## One-time setup (Notion side)

1. **Create an internal integration.** Go to <https://www.notion.so/profile/integrations> → **New integration** → name it "Merlin Platform Sync" → workspace = Adaptiv → submit. Copy the **Internal Integration Secret** (starts with `ntn_` or `secret_`).
2. **Share the database with the integration.** Open the SAMSIC CRM database in Notion → click ⋯ at top right → **Connections** → search for "Merlin Platform Sync" → **Connect**. Alternatively share the entire **Sales** parent page so any future child database is also accessible.
3. **Add the secret to Vercel.** Project settings → Environment Variables → add `NOTION_API_TOKEN` = `<the secret>` for Production. (Staging too if you want syncs in preview deployments.)
4. **Redeploy.** New env vars are picked up on the next deploy; the cron starts firing every 15 minutes.

Optional: override `NOTION_SAMSIC_CRM_DATA_SOURCE_ID` if the Notion data source gets migrated. Default = `c1dd4cc4-85a4-42a2-8bad-f047fb847442`.

## How sync works

- The 15-minute cron (`api/cron/samsic-crm-sync.ts`) calls `notion.dataSources.query()`, paginates at 100 rows per call, transforms each Notion page into a `sales_crm_samsic` row (via `api/_lib/notion-samsic.ts`), and upserts by `notion_page_id`.
- A `Sync now` button at the top of the page hits `/api/sales/sync-now` (platform-admin gated) which runs the same code path immediately.
- We do not delete rows from Postgres when they disappear from Notion. If you need to archive, do it in Notion + the row simply stops updating in Postgres. (Add a hard-delete path later if archived rows clutter the UI.)
- Status values with Notion emoji (`Proposal 👀`, `Closed 💪`) are stripped on sync — the Postgres CHECK constraint stores `Proposal` / `Closed` for clean filtering. The UI shows the cleaned form.

## File attachments

Notion file URLs are pre-signed and expire roughly hourly. The sync stores the full file object (URL + expiry + filename) in `jsonb` columns, but by the time JB clicks a file chip the original URL is usually stale. The proxy endpoint `/api/notion/file/<pageId>?prop=<NotionPropertyName>&i=<index>` re-fetches the page from Notion at click-time and 302-redirects to a fresh signed URL. Platform-admin gated; cache headers say `no-store`.

## RLS

`public.sales_crm_samsic` is platform-wide (no `organization_id`). The single SELECT policy gates reads via `public.is_super_admin_or_owner()` (migration 131). Lower platform tiers (Admin, Normal User) can't see sales pipeline data. Service-role writes (the sync cron) bypass RLS.

## File binaries mirrored to Supabase Storage (PR 5)

Files referenced in the jsonb columns of both mirror tables (Devis, Facture, Bon de Livraison, Paramétrage, etc.) used to live only on Notion's S3 with ~hourly-expiring signed URLs. Now we download them to our own bucket so the data is independent of Notion — revoking the integration or archiving the database no longer loses anything.

**Bucket**: `samsic-files` (private, migration 156). Service-role uploads + generates short-lived signed URLs on click. No client-side direct access; the auth gate is the platform-admin check on the file proxy endpoint.

**Backfill cron**: `/api/cron/samsic-files-sync` runs every 5 minutes and picks up to 20 un-mirrored files per tick. Pending = "no `local` block on the jsonb entry yet." Idempotent; re-runs are cheap. The `Sync now` button also kicks off a batch so JB sees progress immediately.

**Storage shape per file**: the existing jsonb entries gain a `local` block alongside the Notion metadata:

```json
{
  "name": "Devis_BLAVET.pdf",
  "type": "file",
  "file": { "url": "<notion-signed>", "expiry_time": "..." },
  "local": {
    "bucket": "samsic-files",
    "path": "sales_crm_samsic/<page_id>/devis_file/0-Devis_BLAVET.pdf",
    "size_bytes": 12345,
    "content_type": "application/pdf",
    "downloaded_at": "2026-05-19T..."
  }
}
```

**File proxy resolution order**: `/api/notion/file/<pageId>` now (1) looks up the row in the mirror tables, (2) if the requested file has a `local` block, generates a Supabase Storage signed URL + 302s to it, (3) otherwise falls through to fetching a fresh Notion signed URL. The local path is preferred because it works even if Notion is down, rate-limited, or the integration is later revoked.

**Page property → table/column map** lives in `api/notion/file/[pageId].ts` as `PROP_TO_COL`. When a new file column gets added on either mirror table, update three sites in lock-step: the property extractor (`pageToSamsicRow` / `pageToSavRow`), the UI's `FILE_PROPS` list, and `PROP_TO_COL`.

## Suivi SAV cross-database join (PR 4)

Migration 155 adds `public.sales_crm_samsic_sav` mirroring the "📋 Suivi SAV" Notion database (data source `57ab2dcf-…`). One row per SAV ticket with status (`A traiter` / `En attente` / `Fini`), device kinds (`Type de boitier` multi-select), ADL number, todo, comment, and the back-relation array of SAMSIC page IDs it links to.

The same `samsic-crm-sync` cron + manual `Sync now` now also pulls the SAV pages — same query/transform/upsert pattern. SAV errors land in `sav_errors` in the response payload; they don't fail the main SAMSIC sync.

UI integration: a new **SAV** column on each SAMSIC row shows a chip "SAV · N (M open)". Click → popover lists each linked SAV record with its status pill, device-kind chips, ADL number, comment, and TODO. Click an entry → opens the SAV page in Notion. Read-only; editing SAV records happens in Notion (same v1 trade-off as SAMSIC pre-PR 2).

**Gotcha — column suffix `_urls` actually holds page IDs.** The migration named the back-relation columns `samsic_page_urls`, `samsic_contact_page_urls`, `ville_page_urls` — but Notion's API returns relation values as `{ id }` not URLs, so the columns contain bare UUIDs. The UI normalises by stripping dashes before joining against `sales_crm_samsic.notion_page_id`. Cosmetic name issue not worth a rename migration.

## Lead name resolution (PR 3)

Migration 154 adds `public.notion_users` — a small cache (`id`, `name`, `avatar_url`, `email`, `kind`) populated by the same sync that pulls SAMSIC CRM pages. The sync now calls `notion.users.list()` at the end of each tick and upserts the whole workspace user set in one paginated pass.

The Lead column in `/platform/payments/samsic-crm` joins `lead_user_id` → `notion_users.id` client-side and renders an avatar + first name. If the cache hasn't been populated yet (first run, or the Notion integration can't see workspace users), the column falls back to `?…<last-6-of-id>` so the data is still readable.

**Failure is non-fatal**: if `notion.users.list()` fails (integration scope too narrow, API hiccup), the sync logs `users_error` in the response but the page-row sync still succeeds. Lead column shows the fallback; everything else works.

## Inline editing (PR 2)

Seven columns are editable inline in `/platform/payments/samsic-crm`. Editing any other column (title, files, relations) still happens in Notion — click the row's site name to open the page there.

| Column       | Editor                                     | Notion property                                          |
| ------------ | ------------------------------------------ | -------------------------------------------------------- |
| Status       | Single-select dropdown                     | `Statut` (emoji round-trips: `Proposal` ↔ `Proposal 👀`) |
| Priorité     | Multi-select checkbox popup                | `Priorité`                                               |
| Montant      | Number input (€)                           | `Montant`                                                |
| Pilot Samsic | Text input                                 | `Nom pilote Samsic`                                      |
| Date butoir  | Native date picker                         | `Date butoir`                                            |
| Date relance | Native date picker                         | `Date relance`                                           |
| Commentaire  | Multi-line textarea (⌘/Ctrl+Enter to save) | `Commentaire`                                            |

**Save flow**: client → `POST /api/sales/samsic/update` with `{ page_id, column, value, expected_last_edited_at }` → server retrieves the live Notion page, compares `last_edited_time` against the baseline, applies the patch via `notion.pages.update()`, re-fetches, and upserts our mirror. Two Notion API calls per save; not ideal at high volume but fine at human-edit cadence.

**Conflict handling**: if `last_edited_time` differs (someone edited the row in Notion since the UI loaded), the server returns 409 with the live row. The UI snaps the row to live values, surfaces a one-line warn banner under the row, and the last edit is NOT applied — JB retries to overwrite. This catches the "I tweaked it from my phone and then forgot" case without silently clobbering.

**Status emoji round-trip**: Notion's source-of-truth option names include emoji (`Proposal 👀`, `Closed 💪`). The mirror stores the clean form (`Proposal`, `Closed`) for predictable CHECK constraints and UI. Writes reverse-map via `STATUS_REWRITE_REVERSE` in `api/_lib/notion-samsic-writer.ts` — keep that in lock-step with `STATUS_REWRITE` in `notion-samsic.ts` if Notion adds options.

## What's still not in v1

- **Title editing.** `SITE - NOM DOSSIER` is the Notion title — rarely changes, low value to wire up.
- **File uploads.** Files added in Notion sync down + open via the proxy; we don't currently let JB upload from /platform.
- **Per-row deletion.** If a row is archived in Notion, the Postgres row stays until manually purged.
- **Cross-database joins.** The `Related to Suivi SAV (Property)` relation is stored as a `text[]` of Notion page URLs — clicking them opens Notion. When the Suivi SAV table joins the mirror, the relation can render inline.
- **Editable Lead column.** The Lead avatar + name is shown read-only (PR 3). Editing requires a workspace user picker, which is a future enhancement.

## Troubleshooting

**`syncMsg: NOTION_API_TOKEN is not configured on the server`** — env var missing on Vercel. See setup step 3.

**Sync returns `fetched: 0`** — the integration doesn't have access to the database. Re-check setup step 2 (Connections panel must list the integration).

**File click 401s** — the user lost their platform-admin gate. Check `is_platform_admin()` for their user_id.

**Status filter pill shows `0`** but Notion has rows in that status — Notion changed an option name (e.g. renamed `Closed 💪` → `Won`). Update `STATUS_REWRITE` in `api/_lib/notion-samsic.ts` and the CHECK constraint in migration 153 (or write a follow-up migration that ALTERs the constraint).

**Cron runs but `upserted` doesn't match `fetched`** — `first_error` in the response will show the row that broke (usually a malformed property or a CHECK violation from a new status option). Fix the data in Notion or extend the schema.
