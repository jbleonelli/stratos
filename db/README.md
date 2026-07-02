# db/ — schema & migrations

Aurora PostgreSQL schema. Greenfield migration history that **starts from a clean
baseline snapshot of Merlin's domain model** — the schema, the ~100
`SECURITY DEFINER` RPCs, and the RLS policies (kept as the app-layer authz
backstop). After the baseline, migrations evolve independently of Merlin.

## Layout (planned)

```
db/
├── V1_baseline.sql     # snapshot: tables + RPCs + RLS (from Merlin, one-time)
├── migrations/         # forward-only migrations, Stratos-owned
└── helpers/            # current_user_org(), is_platform_admin(), has_location_access()
```

## Notes

- RLS helpers read `current_setting('request.jwt.claims', true)` — ported
  verbatim so policies work unchanged under the Lambda claim bridge.
- `V1_baseline.sql` is generated once during data-seed
  (see [`../docs/data-seed/`](../docs/data-seed/)), then frozen.

## Status

🟠 Empty placeholder. Baseline snapshot is step 1 of the build sequence.
