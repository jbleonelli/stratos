# Authorization & the Cognito → RLS claim bridge

**Status:** 🟠 Design · 2026-07-02

The mandate: authorization moves to the **application layer** (AppSync/Lambda),
no PostgREST. This doc defines how we do that **without losing** database-enforced
tenant isolation.

---

## The problem

Merlin's isolation is declarative RLS in Postgres, keyed off `auth.uid()` /
`current_user_org()`, which PostgREST injects from GoTrue JWTs. Removing
PostgREST removes that automatic claim injection. Naively, all tenant scoping
would become hand-written resolver code — the classic place a rewrite leaks data.

## The approach: defense in depth

Two enforcement layers, both active:

1. **App layer (primary, mandated).** AppSync + Lambda resolvers enforce
   org/location/contract/platform-admin rules explicitly, reading Cognito claims.
2. **Database backstop (safety net).** RLS stays enabled in Aurora. Resolvers
   open the DB session with the caller's claims set, so the same policies fire
   even if an app-layer check is missing or wrong.

RLS is a PostgreSQL feature (not PostgREST, not Supabase), so it is fully
compatible with the "AWS-native managed (RDS/Aurora)" constraint.

---

## Claim flow

```mermaid
sequenceDiagram
  participant U as SPA
  participant C as Cognito
  participant A as AppSync
  participant L as Lambda resolver
  participant DB as Aurora (RLS)

  U->>C: sign in
  C-->>U: JWT (sub, organization_id, platform_role)
  U->>A: GraphQL request + JWT
  A->>A: Cognito authorizer validates JWT, exposes claims
  A->>L: invoke resolver with identity claims
  L->>L: app-layer authz check (org/location/contract)
  L->>DB: BEGIN; SET LOCAL request.jwt.claims = '{...}'; query; COMMIT
  DB->>DB: RLS policies evaluate current_user_org() etc.
  DB-->>L: rows (double-gated)
  L-->>U: result
```

## Session claim injection

Every resolver DB call runs inside a transaction that sets the claims the RLS
helpers read, mirroring what PostgREST did:

```sql
BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"<uuid>","organization_id":"<org>","platform_role":"<role>"}';
-- ... query / rpc ...
COMMIT;
```

The Postgres helper functions (`current_user_org()`, `is_platform_admin()`,
`has_location_access()`) are ported verbatim from Merlin and read from
`current_setting('request.jwt.claims', true)` — unchanged.

## Cognito claim model

| Claim | Source | Used by |
| --- | --- | --- |
| `sub` | Cognito user id | user identity, audit |
| `organization_id` | custom attribute / pre-token-gen Lambda | `current_user_org()` |
| `platform_role` | custom attribute | `is_platform_admin()` + tiers |
| `email` | standard | display, support |

A **pre-token-generation Lambda** resolves the active org + role at sign-in
(and on org switch) and injects them as claims, replacing Merlin's `active_org`
mechanism.

## Connection strategy

- **RDS Data API** for stateless resolver queries (no pooling to manage), or
- **Lambda + RDS Proxy** where a persistent connection / complex transaction is
  needed (e.g. multi-statement RPC flows).

Either way the claim-setting transaction wraps the work.

## Testing (the gate)

The ported **cross-tenant leak suite** runs against this stack with two modes:

1. **App-layer on, RLS on** — production shape.
2. **App-layer bypassed, RLS on** — proves the backstop actually blocks a
   resolver bug.

Both must pass in CI. This is how we prove the re-implemented authorization is
correct before trusting it with tenant data.

## Open questions

- RDS Data API vs RDS Proxy as the default resolver connection path (benchmark
  in the vertical slice).
- Whether to codegen resolver authz wrappers from a policy table to reduce
  hand-written per-table risk.
