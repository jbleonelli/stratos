# web/ — React + Vite SPA

The frontend: a single React + Vite single-page app. Its only backend seam is the
**data layer**, kept behind a stable hook API so the transport is swappable and
testable in isolation.

## Data layer

| Concern | Choice |
| --- | --- |
| Auth client | Cognito (Amplify Auth or oidc-client) |
| Data client | GraphQL client (Amplify / urql / Apollo) → AppSync |
| Realtime | AppSync subscriptions |
| Data hooks | `queries/*.ts` (React Query), GraphQL underneath |

Centralizing data access in React Query hooks (`queries/*.ts`) means components,
styles, and i18n never touch AppSync directly — the whole app talks to one thin,
mockable seam.

## Status

🟠 Empty placeholder. Frontend work begins after the AppSync vertical slice
(ARCHITECTURE.md §10, step 3) proves the data-layer pattern end-to-end.
