# api/ — AppSync Lambda resolvers & BFF

AppSync resolver functions. This is where **application-layer authorization**
lives (the primary enforcement point) and where the **RLS claim bridge** is set
on each DB call (the backstop).

## Responsibilities

- Enforce org / location / contract / platform-admin scoping in code.
- Open each DB transaction with the caller's Cognito claims
  (`SET LOCAL request.jwt.claims = ...`) so RLS fires as a backstop.
- Call the `SECURITY DEFINER` RPCs for write flows.
- Integrate Stripe (billing) and SES (email) where a resolver initiates them.

See [`../docs/architecture/authorization-and-claim-bridge.md`](../docs/architecture/authorization-and-claim-bridge.md).

## Layout

```
api/
├── schema.graphql        # GraphQL SDL (events/asks slice) — schema of record
├── build.mjs             # esbuild bundler → dist/*.mjs (deployed by Terraform)
├── src/
│   ├── resolver.mjs      # AppSync Lambda: dispatch → authz → claim bridge
│   ├── pre-token.mjs     # Cognito pre-token-gen Lambda: injects org/role claims
│   ├── migrate.mjs       # migration Lambda: applies db/ SQL slices to Aurora
│   ├── migrate-core.mjs  # tracked, idempotent slice runner (pure/testable)
│   ├── claim-bridge.mjs  # withClaims() tx + claimsFromIdentity()
│   ├── authz.mjs         # app-layer checks (requireOrg, assertOrgAccess, …)
│   ├── mappers.mjs       # DB rows → GraphQL shapes
│   └── pg-client.mjs     # prod connection (pg + Secrets Manager). Tests inject PGlite.
└── test/
    ├── resolver.test.mjs  # runs the real resolver against the baseline schema
    ├── pre-token.test.mjs # runs the real pre-token handler (claim resolution)
    └── migrate.test.mjs   # runs the migration runner (order, idempotency, seed)
```

## Status

🟢 **Events/asks vertical slice implemented + proven.** `Query.{organization,
events,asks}`, `Mutation.{raiseAsk,answerAsk,ingestEvent}`, and the
`onAskRaised` / `onEventIngested` subscriptions are defined; the resolver runs
against the `db/V1_baseline.sql` schema through the claim bridge. Subscriptions
are AppSync-native (published by the mutations).

🟢 **Pre-token-generation handler implemented + proven.** `src/pre-token.mjs`
resolves the caller's `organization_id` / `platform_role` (via
`public.resolve_login_claims`) and injects them into the token — the input side
of the claim bridge. Wired into `infra/modules/cognito`.

🟢 **Deployable end-to-end.** `pg-client.mjs` builds its connection from the
Secrets Manager secret at cold start; `infra/modules/{lambda,appsync}` deploy the
resolver behind AppSync (Cognito auth), and `src/migrate.mjs` applies the `db/`
schema to Aurora.

`npm install && npm test` → 18/18.

🟠 **Next:** extend the resolver + SDL as new domains land in `db/`.

## Run

```bash
npm install
npm test          # 18/18 (resolver + pre-token + migrate) against PGlite
npm run build     # bundle handlers → dist/ (what Terraform deploys)
```
