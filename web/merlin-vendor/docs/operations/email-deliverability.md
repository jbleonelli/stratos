# Email deliverability — DNS for `adaptiv.systems`

Runbook for the SPF / DKIM / DMARC records that keep mail from `@adaptiv.systems` out of spam. Read this before touching DNS at Route 53; reach for it when something starts landing in junk folders.

## Who sends mail as `@adaptiv.systems`

| Sender                                   | Path                                                  | What it sends                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Resend** (Amazon SES under the hood)   | `api/_lib/email.ts` → Resend API                      | Demo invites, password resets, sales-inquiry auto-replies, daily budget watchdog alarms, Stripe customer notes |
| **Supabase Auth** (custom SMTP → Resend) | Supabase dashboard → Authentication → Email Templates | Sign-up confirmation, password reset, magic link, invite, email-change, reauth                                 |
| **Google Workspace**                     | Gmail compose                                         | Humans (jb@, robin@, philippe@, …) replying to customers                                                       |

All three send with a `From:` address on the **apex** `adaptiv.systems` (not `send.adaptiv.systems`). That means DNS at the apex is what receivers check.

## Canonical record set (as of 2026-05-19)

| Record                                                | Type  | Value                                                                                  | Purpose                                                                                                |
| ----------------------------------------------------- | ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `adaptiv.systems`                                     | TXT   | `v=spf1 include:_spf.google.com include:amazonses.com ~all`                            | Apex SPF — authorizes Google + SES (Resend) to send as `@adaptiv.systems`                              |
| `adaptiv.systems`                                     | TXT   | `google-site-verification=...`                                                         | Unrelated, leave alone                                                                                 |
| `_dmarc.adaptiv.systems`                              | TXT   | `v=DMARC1; p=none; sp=none; adkim=r; aspf=r; rua=mailto:dmarc-reports@adaptiv.systems` | DMARC policy + aggregate-report mailbox                                                                |
| `resend._domainkey.adaptiv.systems`                   | TXT   | `v=DKIM1; k=rsa; p=MIGfMA0G…IDAQAB`                                                    | Resend's DKIM public key. **The `v=DKIM1; k=rsa;` prefix is required** — see 2026-05-19 incident below |
| `kkr…`, `pu2…`, `ugnc…` `._domainkey.adaptiv.systems` | CNAME | (Amazon SES Easy DKIM CNAMEs)                                                          | SES domain-identity DKIM keys; leave alone                                                             |
| `send.adaptiv.systems`                                | MX    | `10 feedback-smtp.us-east-1.amazonses.com.`                                            | Where SES sends bounces back                                                                           |
| `send.adaptiv.systems`                                | TXT   | `v=spf1 include:amazonses.com ~all`                                                    | SPF on the bounce subdomain (Return-Path domain)                                                       |

Google Workspace DKIM is published separately under the random-selector CNAMEs and does not need maintenance — managed inside the Google Workspace admin console.

## DMARC ramp-up policy

DMARC has three enforcement levels: `none` (observe only), `quarantine` (failures → spam), `reject` (failures bounced). Always ramp gradually so a misconfigured sender doesn't black-hole legit mail overnight.

```
   p=none          p=quarantine       p=reject
   (observe)  →    (spam folder)  →   (bounce)
   week 1          week 2-3           week 4+
```

Move to the next level **only after** the `rua=` aggregate reports show 100% DKIM-aligned + SPF-aligned mail across Gmail, Yahoo, Microsoft, and the long tail. The reports are XML attachments, parseable by any DMARC analyzer (Postmark's free tool works well for ad-hoc reading).

Live state: **`p=none`** as of 2026-05-19, post-incident. Candidate to raise once one week of clean aggregate reports is in.

## Verify the records (any time)

```bash
# Apex — should show TWO TXT values
dig TXT adaptiv.systems +short

# DKIM — should start with "v=DKIM1; k=rsa;"
dig TXT resend._domainkey.adaptiv.systems +short

# DMARC — should include rua= for aggregate reports
dig TXT _dmarc.adaptiv.systems +short
```

Don't trust local DNS cache — `dig @8.8.8.8 ...` to hit Google's resolver directly if recent changes don't show up.

## Verify a live send (Gmail's authentication report)

Send a test from the app to a Gmail address. Open it → ⋮ → **Show original**. The first lines list authentication results:

```
SPF:     PASS with domain adaptiv.systems
DKIM:    'PASS' with domain adaptiv.systems
DMARC:   'PASS'
```

All three should say PASS. A single FAIL is enough to land the message in spam once DMARC is at `quarantine` or `reject`.

## When emails start going to spam — diagnosis order

1. **Run the three `dig` commands above.** Confirm all three records still match the canonical set above. DNS changes by other admins are the #1 cause of regression.
2. **Send a test to Gmail + Outlook + a Yahoo address.** Different receivers, different signals — one might pass while another flags it.
3. **Open Show original on a failed delivery.** Look at which of SPF / DKIM / DMARC says FAIL.
4. **If DKIM fails:** verify the `resend._domainkey.adaptiv.systems` TXT still has the `v=DKIM1; k=rsa;` prefix and the key material wasn't truncated. Manual copy-paste from the Resend dashboard frequently drops the version tag — see the 2026-05-19 incident.
5. **If SPF fails:** check the apex SPF TXT exists and includes both `_spf.google.com` and `amazonses.com`. Check the total DNS lookup count is ≤ 10 (`dig +trace` to count includes).
6. **If DMARC fails but SPF + DKIM pass:** check `adkim=` and `aspf=`. Should both be `r` (relaxed). Strict alignment (`s`) requires the `From:` domain to exactly match the signing/return-path domain, which we don't guarantee.
7. **If all three records look correct but mail still flags:** read the latest aggregate report at `dmarc-reports@adaptiv.systems`. Look for receivers reporting `<dkim>fail</dkim>` or `<spf>fail</spf>` — those tell you exactly which selector or include is broken in the wild.
8. **Reputation as last resort:** if records are correct AND aggregate reports show clean alignment, the cause is Resend's shared-IP reputation. Fix is operational, not DNS: lower send volume temporarily, scrub bounce-prone addresses, and `warm up` over a week.

## Incident — 2026-05-19: tightening DMARC sent all mail to spam

**Symptom**: real prospect signups stopped seeing transactional mail. Edge Eight Capital signed up, never received their confirmation email. JB checked spam folders across personal accounts and found everything from `@adaptiv.systems` in junk.

**Cause**: DMARC had recently been tightened from `p=none` to `p=quarantine; sp=quarantine`. With that policy in force, anything that didn't strictly align went to spam. Three latent issues then surfaced:

1. **No SPF at the apex.** `adaptiv.systems` had only a `google-site-verification` TXT — no SPF. Receivers consulted SPF for `From: demo@adaptiv.systems`, found nothing, and counted it as a failure signal.
2. **DKIM record missing the `v=DKIM1; k=rsa;` prefix.** The `resend._domainkey.adaptiv.systems` TXT was published as a bare `p=MIGfMA0G…` blob. RFC 6376 says `v=DKIM1` is "recommended" and `k=rsa` is implicit, but enough verifiers reject the bare form that DKIM validation was failing intermittently at receivers.
3. **DMARC was enforcing without `rua=`.** No aggregate-report mailbox configured, so there was no visibility into what was actually failing.

**Fix sequence**:

1. Rolled DMARC back to `p=none; rua=mailto:dmarc-reports@adaptiv.systems` to restore deliverability + start collecting reports.
2. Added `v=DKIM1; k=rsa;` prefix to the Resend DKIM TXT — same key material, just the proper RFC-6376 form.
3. Added apex SPF: `v=spf1 include:_spf.google.com include:amazonses.com ~all`.

**Lessons applied to this doc**:

- DMARC ramp section now codifies the never-jump-straight-to-quarantine rule.
- Canonical-record table above is the diff target on every future DNS change.
- Always add `rua=` _first_ and read a week of reports _before_ raising enforcement.

## Where the From: address is set in code

| What                | File                                       | Value                                                      |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| Default Resend From | `api/_lib/email.ts:24`                     | `Adaptiv <demo@adaptiv.systems>`                           |
| Env override        | `api/_lib/email.ts:90`                     | `process.env.RESEND_FROM` if set                           |
| Supabase Auth From  | Supabase dashboard → Authentication → SMTP | `Merlin <noreply@adaptiv.systems>` (configured 2026-05-13) |

All three must remain on the apex `adaptiv.systems` (not a subdomain) so they keep aligning with the apex DKIM + apex SPF. Adding a new sender on a subdomain like `notify.adaptiv.systems` requires a new DKIM key + SPF record on that subdomain before any mail goes out.
