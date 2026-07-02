# api/ — Lambda resolvers & BFF

AppSync resolver functions and any BFF logic. This is where **application-layer
authorization** lives (the mandated shape) and where the **RLS claim bridge** is
set on each DB call.

## Responsibilities

- Enforce org / location / contract / platform-admin scoping in code.
- Open each Aurora transaction with the caller's Cognito claims
  (`SET LOCAL request.jwt.claims = ...`) so RLS fires as a backstop.
- Call the ported `SECURITY DEFINER` RPCs for write flows.
- Integrate Stripe (billing) and SES (email) where a resolver initiates them.

See [`../docs/architecture/authorization-and-claim-bridge.md`](../docs/architecture/authorization-and-claim-bridge.md).

## Status

🟠 Empty placeholder. First function = the vertical-slice resolver
(events/asks) that proves query + mutation + subscription + authz.
