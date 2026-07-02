# db/ — schema & migrations

Aurora PostgreSQL schema. A greenfield migration history that **starts from a
clean authored baseline** — the schema, the ~100 `SECURITY DEFINER` RPCs, and the
RLS policies (kept as the app-layer authz backstop). After the baseline,
migrations are forward-only.

## Layout

```
db/
├── V1_baseline.sql     # ✅ authored baseline: identity + events/asks core (tables + RLS + RPCs)
├── migrations/         # forward-only migrations — TODO
├── seed/
│   └── dev.sql         # ✅ deterministic dev/demo/test seed for the baseline
├── helpers/            # RLS authz helpers (claim bridge, DB side)
│   └── 001_authz.sql   # ✅ current_user_org(), is_platform_admin(), has_location_access()
└── proof/              # ✅ runnable tests: claim-bridge leak proof + baseline slice
```

## Apply order

`helpers/001_authz.sql` → `V1_baseline.sql` → `seed/dev.sql` (dev/test only).

## Notes

- RLS helpers read `current_setting('request.jwt.claims', true)` so policies work
  under the Lambda claim bridge with no app code.
- `V1_baseline.sql` is authored once, then frozen; changes go through
  `migrations/`.

## Status

🟢 **Claim bridge proven + baseline slice landed.** `helpers/001_authz.sql`,
`V1_baseline.sql` (identity + events/asks core), and `seed/dev.sql` are exercised
by two runnable suites in [`proof/`](proof/): the cross-tenant leak proof and the
baseline vertical slice (reads + RPC writes + authz + RLS write backstop).
Run: `cd proof && npm install && npm test` → 22/22.

🟠 **Next:** grow `V1_baseline.sql` domain-by-domain toward the full surface
(~100 tables + RPCs), each covered by the suites.
