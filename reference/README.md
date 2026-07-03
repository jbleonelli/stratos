# Reference material

## Merlin UI snapshot (`merlin-ui-snapshot/`)

Frozen copy of Merlin’s customer-app UI as of **2026-07-03** (`659d224`).

- **Purpose:** Stratos UI porting spec — shell, pillars, screens, route map.
- **Not a fork:** No `.git`, no GitHub remote, no sync with live Merlin.
- **Local only:** The snapshot directory is gitignored (see root `.gitignore`).
  It lives in your Dropbox workspace alongside Stratos; it is not pushed to
  `github.com/jbleonelli/stratos`.

Merlin can keep changing in its own repo; Stratos agents should read **only**
`reference/merlin-ui-snapshot/`, never Merlin GitHub or the live Merlin tree.

To refresh the baseline (your call, not automatic):

```bash
./scripts/capture-merlin-ui-snapshot.sh
```

See `merlin-ui-snapshot/SNAPSHOT.md` for the pinned commit and rules.

## AWS cost while porting UI

The Stratos stack is **destroyed by default** between integration passes — that
means **$0** for Aurora, NAT, CloudFront, etc.

| Phase | AWS needed? | Typical cost |
| --- | --- | --- |
| Shell + screen port (`web/` only) | **No** — `npm run dev` locally | $0 |
| CI on PR (unit/build/leak DB proofs) | GitHub Actions only | $0 AWS |
| Integration / demo login | Manual `deploy` workflow `apply` | See below |

When you **do** apply the dev stack, keep costs low:

| Deploy input | Recommendation | Why |
| --- | --- | --- |
| `action` | `plan` until you need to test live | Plan is free |
| `enable_nat` | **`false`** (default) | NAT Gateway ≈ $32+/mo |
| `enable_simulator` | **`false`** (default) | Avoids scheduled Lambda + Bedrock |
| `enable_edge` | `true` only for SPA URL demo | CloudFront + WAF have a small baseline |
| After testing | **`destroy`** | Stops Aurora, Lambda, edge charges |

**UI shell work (Phase 1)** needs no AWS at all. Only run `apply` when testing
Cognito login, AppSync subscriptions, or seeded demo data — then destroy again.
