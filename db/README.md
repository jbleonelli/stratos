# db/ — schema & migrations

Aurora PostgreSQL schema. A greenfield migration history that **starts from a
clean authored baseline** — the schema, the ~100 `SECURITY DEFINER` RPCs, and the
RLS policies (kept as the app-layer authz backstop). After the baseline,
migrations are forward-only.

## Layout

```
db/
├── V1_baseline.sql     # authored baseline: tables + RPCs + RLS — TODO
├── migrations/         # forward-only migrations — TODO
├── helpers/            # RLS authz helpers (claim bridge, DB side)
│   └── 001_authz.sql   # ✅ current_user_org(), is_platform_admin(), has_location_access()
└── proof/              # ✅ claim-bridge cross-tenant leak proof (runnable)
```

## Notes

- RLS helpers read `current_setting('request.jwt.claims', true)` so policies work
  under the Lambda claim bridge with no app code.
- `V1_baseline.sql` is authored once, then frozen; changes go through
  `migrations/`.

## Status

🟢 **Claim bridge proven.** `helpers/001_authz.sql` +
[`proof/`](proof/) demonstrate that RLS still enforces tenant isolation when a
Lambda resolver injects Cognito claims by hand (both app-layer-on and
app-layer-bypassed modes). Run it: `cd proof && npm install && npm test`.

🟠 **Next:** author the full `V1_baseline.sql` (structure + ~100 RPCs + all RLS
policies) — step 1 of the build sequence.
