# web/ — React + Vite SPA

The frontend. **Ported from Merlin's React SPA, then owned by Stratos.** Same UI,
same components, same i18n, same routing. Only the **data layer** changes.

## What changes vs Merlin

| Layer | Merlin | Stratos |
| --- | --- | --- |
| Auth client | `supabase-js` auth | Cognito (Amplify Auth or oidc-client) |
| Data client | `supabase-js` / PostgREST | GraphQL client (Amplify / urql / Apollo) → AppSync |
| Realtime | Supabase channels | AppSync subscriptions |
| Data hooks | `queries/*.ts` (React Query) | Same hooks, GraphQL underneath |

The React Query hook seam (`queries/*.ts`) is why this is a **client swap, not a
component rewrite**. Components, styles, and i18n are carried over unchanged.

## Status

🟠 Empty placeholder. Port begins after the AppSync vertical slice
(ARCHITECTURE.md §10, step 3) proves the data-layer pattern end-to-end.
