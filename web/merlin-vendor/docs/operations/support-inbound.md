# Inbound-email support system (Phase 1)

The Adaptiv help desk: clients (tenant orgs, contractors) email a support
address; each email becomes a trackable, threaded **support ticket** that
Adaptiv staff triage in Excalibur (`/platform/support/tickets`, Phase 2).

This doc covers the **operations side you own**: pointing mail at the webhook
and setting the env vars. The app side (DB + webhook) ships in migration 221
and `api/inbound/support.ts`.

## Architecture

```
client email ──▶ support@adaptiv.systems
                      │  (your MX / forwarder parses the message)
                      ▼
        POST /api/inbound/support   (JSON contract below, secret-authed)
                      │
                      ▼
        support_tickets + support_messages   (migration 221)
                      │
            ┌─────────┴─────────┐
            ▼                   ▼
   staff notify email     Excalibur triage UI (Phase 2)
   (SUPPORT_NOTIFY_DEST)   /platform/support/tickets
```

The app **does not receive SMTP directly**. You stand up the mail-receiving
side (Cloudflare Email Routing, SendGrid Inbound Parse, a forwarding mailbox +
script, etc.) and have it POST the parsed email as JSON to the webhook.

## 1. Webhook contract

`POST https://merlin.adaptiv.systems/api/inbound/support`

Headers:

- `content-type: application/json`
- `x-support-secret: <SUPPORT_INBOUND_SECRET>` ← shared secret, see §3

Body:

```json
{
  "from": { "email": "jamie@meridian.com", "name": "Jamie Lin" },
  "to": "support@adaptiv.systems",
  "subject": "Device offline on Floor 4",
  "text": "plain-text body",
  "html": "<p>optional html body</p>",
  "messageId": "<rfc-message-id@meridian.com>",
  "inReplyTo": "<optional-parent-message-id>",
  "references": ["<msg-id>", "..."],
  "attachments": [{ "filename": "error.png", "contentType": "image/png", "contentBase64": "iVBORw0K…" }],
  "receivedAt": "2026-06-12T10:30:00Z"
}
```

Notes:

- `from` may be `{email,name}` **or** a bare `"Jamie Lin <jamie@x.com>"` string.
- `references` may be an array **or** a whitespace/comma-separated string.
- `text` **or** `html` is required; everything else is best-effort.
- Send `messageId`, `inReplyTo`, `references` (the raw RFC headers) whenever you
  have them — they drive reply threading and de-duplication. Without them every
  email starts a new ticket.

Responses:

- `200 {ok, ticket_id, ref_code, threaded, deduped}` — ingested.
- `400` — missing/invalid `from.email` or empty body.
- `401 {error:"unauthorized"}` — bad/absent `x-support-secret`.
- `500 {error:"inbound not configured"}` — `SUPPORT_INBOUND_SECRET` not set
  (the endpoint is **fail-closed** until you set it).

## 2. Behaviour

- **De-dupe**: a repeat delivery of the same `messageId` is a no-op.
- **Thread**: a `[ADX-1042]` token in the subject, or an `inReplyTo`/`references`
  matching a stored Message-ID, appends the email to that ticket and re-opens it
  if it was resolved. Otherwise a new ticket is minted (`ADX-####`).
- **Map**: sender email is matched against `profiles.email` to best-effort link
  the ticket to a tenant org; unmapped senders still create a ticket.
- **Copy + acknowledge** (editable in Excalibur → Support → **Settings**): a
  copy of each new ticket's email is sent to the configured recipient list
  (falls back to `SUPPORT_NOTIFY_DEST` when empty) as a **branded HTML email** —
  its **send-from, subject + body are editable** (`{{ref}}`/`{{subject}}`/
  `{{from}}`/`{{from_name}}`/`{{from_email}}`/`{{org}}` (org name)/`{{body}}`/
  `{{triage_url}}`; blank send-from falls back to `SUPPORT_NOTIFY_FROM`). The
  requester receives
  a **branded HTML acknowledgement**. Everything is editable — **Send from**
  (the From address, also used for staff replies), subject, header label,
  headline, ticket-chip label, body, footer, the footer **brand name + link
  URL**, and the two **brand colours** (the stripe gradient + heading/chip/link
  accents). Placeholders `{{ref}}`/`{{name}}`/`{{subject}}`; the `[ADX-####]`
  token is always enforced on the subject so replies thread. Colours/URLs are
  sanitized server-side before they hit the HTML. Stored in
  `platform_settings.support_config`; `SUPPORT_REPLY_FROM` is the fallback when
  "Send from" is left blank.
- **Full thread to the team**: the `copy_to` list receives a copy of **every
  inbound message** — new tickets _and_ customer replies on existing tickets —
  and is **BCC'd on every staff reply** sent from Excalibur. So the configured
  inboxes see the entire back-and-forth. (BCC, not visible CC, so customers
  never see the internal addresses.)
- **Attachments**: any `attachments[]` are uploaded to the private
  `support-attachments` Storage bucket and shown per message in the triage UI
  (downloaded via a short-lived signed URL). The forwarder skips files over
  ~3.5 MB (Vercel request-body cap).

## 3. Environment variables (set in Vercel → merlin → Settings → Env)

| Var                            | Required      | Default                                     | Notes                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPPORT_INBOUND_SECRET`       | **yes**       | —                                           | Shared secret. Put the same value in your forwarder's `x-support-secret` header. Endpoint is fail-closed until set.                                                                                                                                                                           |
| `SUPPORT_NOTIFY_DEST`          | no            | `hello@adaptiv.systems`                     | **Fallback** copy recipient when the Settings "Copy incoming emails to" list is empty. **Must differ from the forwarded support address** (see warning).                                                                                                                                      |
| `SUPPORT_NOTIFY_FROM`          | no            | `Adaptiv Support <noreply@adaptiv.systems>` | From address on the staff notification.                                                                                                                                                                                                                                                       |
| `SUPPORT_REPLY_FROM`           | recommended   | `Adaptiv Support <support@adaptiv.systems>` | **Phase 2.** From address on staff replies sent from the Excalibur triage UI. **Set this to the same address your inbox monitors** (e.g. `abm@adaptiv.systems`) so the customer's reply comes back through the webhook and threads. Must be on a Resend-verified domain (adaptiv.systems is). |
| `SUPPORT_AUTOREPLY`            | no            | `on`                                        | **Phase 3.** Set to `off` to stop the auto-acknowledgement email to the requester on new tickets.                                                                                                                                                                                             |
| `SUPPORT_FIRST_RESPONSE_HOURS` | no            | `24`                                        | **Phase 3.** First-response SLA target (hours). Stamped onto `sla_due_at` at intake; the sweep cron pings staff once when a ticket passes it unanswered.                                                                                                                                      |
| `RESEND_API_KEY`               | (already set) | —                                           | Reused for outbound. Without it, ingestion still works; only the notification/reply/auto-ack is skipped.                                                                                                                                                                                      |
| `CRON_SECRET`                  | (already set) | —                                           | Authes the SLA sweep cron. Already required by existing crons.                                                                                                                                                                                                                                |

After setting/changing env vars, redeploy (a Vercel **redeploy** is enough for
env — unlike `CRON_SECRET`, no fresh git push is required here).

> ⚠️ **Loop hazard.** `SUPPORT_NOTIFY_DEST` must **not** be the same address your
> MX forwards into the webhook (e.g. `support@adaptiv.systems`). If it is, each
> new ticket's notification email is itself forwarded back into the webhook and
> creates an endless ticket loop. Keep the notify inbox separate.

## 4. Smoke test

Once `SUPPORT_INBOUND_SECRET` is set and deployed:

```bash
SECRET='<your secret>'
curl -sS -X POST https://merlin.adaptiv.systems/api/inbound/support \
  -H 'content-type: application/json' \
  -H "x-support-secret: $SECRET" \
  -d '{
    "from": {"email":"VERIFYTMP-you@example.com","name":"Smoke Test"},
    "subject":"VERIFYTMP smoke test",
    "text":"does this become a ticket?",
    "messageId":"<verifytmp-smoke-1@example.com>"
  }'
# → {"ok":true,"ticket_id":"…","ref_code":"ADX-1042","threaded":false,"deduped":false}
```

Then reply-threading:

```bash
# Re-POST with the same messageId → {"deduped":true}
# POST a new messageId whose subject contains [ADX-1042] → {"threaded":true}
```

Clean up test rows (they're real tickets):

```sql
delete from public.support_tickets where requester_email like 'VERIFYTMP-%';
```

## Appendix: Gmail forwarder (Google Apps Script)

The chosen transport (2026-06-12): `support@adaptiv.systems` mail lands in a
Gmail account; a Google Apps Script bound to that account polls new messages,
reshapes each into the §1 contract, and POSTs it to the webhook. No third-party
vendor. The server's Message-ID dedupe makes re-runs safe.

**Setup**

1. Signed into the Gmail account that receives the support mail, go to
   [script.google.com](https://script.google.com) → **New project**.
2. Paste the script below.
3. **Project Settings → Script properties** → add
   `SUPPORT_INBOUND_SECRET` = the same value set in Vercel. (Never hardcode it.)
4. Run `pollSupportInbox` once → approve the Gmail + external-request scopes.
5. **Triggers** (clock icon) → Add trigger → `pollSupportInbox`, _time-driven_,
   every 1–5 minutes.

**Prerequisite:** mail must reach this inbox — either support@ is a Workspace
mailbox/alias on this account, or you add a forward rule (support@ → this Gmail)
at the adaptiv.systems mail host.

**Threading caveat (Phase 1):** Gmail _auto-forwarding_ rewrites the Message-ID,
so cross-forward reply-threading is best-effort. New emails reliably become new
tickets; client replies may open a new ticket until Phase 3 adds the
`[ADX-####]` auto-reply subject token (the robust threading key). A native
Workspace mailbox (no re-forward) preserves original headers and threads best.

```javascript
// Adaptiv support inbox → Merlin /api/inbound/support bridge.
// Time-driven trigger every 1–5 min. Reads new support emails, posts each to
// the webhook, labels the thread done. Server dedupes on Message-ID, so a
// re-run never creates duplicate tickets.

const WEBHOOK_URL = 'https://merlin.adaptiv.systems/api/inbound/support';
const SUPPORT_ADDR = 'abm@adaptiv.systems'; // only ingest mail addressed here
const DONE_LABEL = 'merlin-ingested';
const MAX_ATTACH_BYTES = 3_500_000; // skip bigger files (Vercel body cap)

function pollSupportInbox() {
  const secret = PropertiesService.getScriptProperties().getProperty('SUPPORT_INBOUND_SECRET');
  if (!secret) throw new Error('Set SUPPORT_INBOUND_SECRET in Project Settings → Script properties');

  const label = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  // `to:SUPPORT_ADDR` keeps the account's own Google/newsletter mail out of the
  // queue — only messages actually sent to the support address become tickets.
  const threads = GmailApp.search('in:inbox to:' + SUPPORT_ADDR + ' -label:' + DONE_LABEL + ' newer_than:7d', 0, 50);

  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      const res = postMessage_(msg, secret);
      const code = res.getResponseCode();
      if (code < 200 || code >= 300) {
        // Leave the thread unlabeled so the next run retries it.
        console.error('HTTP ' + code + ' for "' + msg.getSubject() + '": ' + res.getContentText());
        return;
      }
    }
    thread.addLabel(label);
    thread.markRead();
    // thread.moveToArchive();  // uncomment to keep the inbox clean
  }
}

function postMessage_(msg, secret) {
  const raw = msg.getRawContent();
  const payload = {
    from: parseFrom_(msg.getFrom()),
    to: SUPPORT_ADDR,
    subject: stripFwd_(msg.getSubject()),
    text: msg.getPlainBody(),
    html: msg.getBody(),
    messageId: header_(raw, 'Message-ID'),
    inReplyTo: header_(raw, 'In-Reply-To'),
    references: splitRefs_(header_(raw, 'References')),
    attachments: collectAttachments_(msg),
    receivedAt: msg.getDate().toISOString(),
  };
  return UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-support-secret': secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

function parseFrom_(h) {
  const m = (h || '').match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2].trim().toLowerCase(), name: m[1].replace(/^"|"$/g, '').trim() || null };
  return { email: (h || '').trim().toLowerCase(), name: null };
}
function stripFwd_(s) {
  return (s || '').replace(/^\s*(fwd?:|tr:)\s*/i, '').trim() || '(no subject)';
}
function header_(raw, name) {
  const m = raw.match(new RegExp('^' + name + ':\\s*(.*(?:\\r?\\n[ \\t].*)*)', 'im'));
  return m ? m[1].replace(/\r?\n[ \t]+/g, ' ').trim() : null;
}
function splitRefs_(r) {
  return r ? r.split(/\s+/).filter(String) : [];
}

// Base64-encode each attachment, skipping anything over the size cap.
function collectAttachments_(msg) {
  const out = [];
  const atts = msg.getAttachments({ includeInlineImages: false, includeAttachments: true });
  for (const a of atts) {
    if (a.getSize() > MAX_ATTACH_BYTES) continue;
    out.push({
      filename: a.getName(),
      contentType: a.getContentType(),
      contentBase64: Utilities.base64Encode(a.getBytes()),
    });
  }
  return out;
}
```

## Roadmap

- **Phase 2 (shipped)** — Excalibur triage UI at `/platform/support/tickets`:
  queue with status filters, the email thread, **reply** (`/api/platform/support/reply`
  → Resend with `In-Reply-To`/`References` + an `[ADX-####]` subject token;
  stamps `first_response_at`, moves `open`→`pending`), status/priority/assign-to-me.
  Staff replies go out as **branded HTML** (same eyebrow/chip/colours/footer as
  the acknowledgement, from the same `support_config`) and append the **full
  conversation history** (each prior message with sender + Europe/Paris
  timestamp) plus a "Ticket opened …" line. Set `SUPPORT_REPLY_FROM` (above)
  before replying. All branded emails declare `color-scheme: light` so
  well-behaved clients don't dark-invert them (some clients still override).
- **Phase 3 (partly shipped)** — **auto-acknowledgement** to the requester on a
  new ticket (tracking ref + seeds the `[ADX-####]` thread token; skips
  automated/own-domain senders; not logged as a message so it doesn't satisfy
  the SLA) + **first-response SLA sweep** (`/api/cron/support-sla-sweep`, every
  15 min: open/pending tickets past `sla_due_at` with no first response → one
  staff ping, deduped by `sla_breach_notified_at`). **Inbound attachments**
  (Storage bucket + `support_attachments` + signed-URL download in the UI) and
  **canned responses** (reply templates), **outbound attachments** on staff
  replies (uploaded to the same bucket, carried to the customer via Resend),
  and **link-an-unmapped-ticket-to-an-org** (org picker in the ticket detail)
  are all wired. The support system is feature-complete end to end.

> The SLA cron is registered in `vercel.json`; Vercel re-reads crons on the
> next git push (already done by this change). It auths via the existing
> `CRON_SECRET`.
