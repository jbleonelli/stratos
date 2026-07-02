# web/ — React + Vite SPA

The frontend: a single React + Vite single-page app. Its only backend seam is the
**data layer**, kept behind a stable hook API so the transport is swappable and
testable in isolation.

## Data layer

| Concern | Choice |
| --- | --- |
| Auth client | Cognito via `aws-amplify` (`@aws-amplify/ui-react` Authenticator) |
| Data client | Amplify GraphQL client → AppSync (`userPool` auth mode) |
| Realtime | AppSync subscriptions (`onAskRaised`, `onEventIngested`) |
| Data hooks | `queries/*.ts` (React Query), GraphQL underneath |

Components never touch Amplify: they call the React Query hooks in
`src/queries/`, which call the thin client seam in `src/api/client.ts`
(`gql()` / `subscribe()`). Swapping the transport or mocking it in tests means
touching only that one file.

## Layout

```
web/
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx           # Amplify config + Authenticator + React Query provider
│   ├── App.tsx
│   ├── amplify.ts         # Amplify.configure() from VITE_* env
│   ├── api/
│   │   ├── client.ts      # gql() / subscribe() — the only Amplify seam
│   │   ├── graphql.ts     # query/mutation/subscription documents
│   │   └── types.ts       # TS shapes mirroring api/schema.graphql
│   ├── queries/           # React Query hooks (useOrganization, useEvents, …)
│   └── components/        # Dashboard, AsksPanel, EventsPanel
└── .env.example           # VITE_* config (from terraform output)
```

## Status

🟢 **Events/asks dashboard implemented.** Cognito sign-in, org header, live asks
(raise + answer) and events (with a test-ingest action), refreshed by AppSync
subscriptions. `npm install && npm run build` passes (typecheck + Vite bundle).

🟠 **Next:** point it at a live stack, then grow the UI as new domains land.

## Run

```bash
npm install
cp .env.example .env.local     # fill from `cd ../infra && terraform output`
npm run dev                    # http://localhost:5173
npm run build                  # typecheck + production bundle → dist/
```

## Deploy

The built `dist/` is served by the `edge` module (S3 + CloudFront):

```bash
npm run build
aws s3 sync dist/ "s3://$(cd ../infra && terraform output -raw spa_bucket)/" --delete
aws cloudfront create-invalidation \
  --distribution-id "$(cd ../infra && terraform output -raw cloudfront_distribution_id)" \
  --paths '/*'
```
