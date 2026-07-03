# Auth email templates

Adaptiv-branded HTML for Supabase Auth's six transactional emails. These are pasted **into the Supabase dashboard** (Authentication → Email Templates) — Supabase Auth doesn't read templates from this repo. This doc is the canonical source so the templates can be re-pasted into a new Supabase project or restored after a bad edit.

## Setup status (2026-05-13)

- **SMTP**: Custom SMTP via Resend. Project: `jatenmlbczwqmdlnhjbq`. Sender `Merlin <noreply@adaptiv.systems>`. Verified end-to-end via the password-reset flow (SPF + DKIM + DMARC all pass, IP `54.240.9.20` = Resend/AWS SES).
- **Domain auth**: `adaptiv.systems` already verified in Resend; DKIM at `resend._domainkey.adaptiv.systems`, SPF on `send.adaptiv.systems`, DMARC at `_dmarc.adaptiv.systems` (`p=none` — candidate to tighten to `p=quarantine`).

## Design language

Mirrors the demo-invite email (`api/demos/send.ts`):

- Container: 560px max-width, white card on slate-100 page background, 12px radius
- Top: 4px gradient bar `linear-gradient(90deg, #FF00B2, #20286D)` (Adaptiv pink → navy)
- Eyebrow: `ADAPTIV · MERLIN` in 11px pink-uppercase
- Headline: 22px slate-900 (`#0F172A`), -0.01em tracking
- Body: 14px slate-900 (`#111827`), 1.6 line-height
- CTA: pink (`#FF00B2`) fill, white text, 11/22 padding, 8px radius
- Footer: 11px slate-400 on slate-50, centered, with org name + tagline + domain

Mobile-friendly via fluid `max-width: 560px`. Works in Gmail / Outlook 365 / Apple Mail / iOS Mail tested clients. Use `<div>` not `<table>` — modern mail clients all handle it.

## Master shell (used by 5 of 6 templates)

Replace `{{HEADLINE}}`, `{{BODY}}`, `{{CTA_LABEL}}`, and `{{EXPIRY_NOTE}}` per template. The `{{ .ConfirmationURL }}` Supabase variable is the action link; keep that as-is.

```html
<div
  style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#F3F4F6;padding:32px 16px;"
>
  <div
    style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);"
  >
    <div style="height:4px;background:linear-gradient(90deg,#FF00B2,#20286D);"></div>
    <div style="padding:28px 32px 8px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#FF00B2;text-transform:uppercase;">
        ADAPTIV · MERLIN
      </div>
      <h1 style="margin:14px 0 6px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#0F172A;">
        {{HEADLINE}}
      </h1>
    </div>
    <div style="padding:8px 32px 24px;font-size:14px;color:#111827;line-height:1.6;">
      <p style="margin:0 0 18px;">{{BODY}}</p>
      <a
        href="{{ .ConfirmationURL }}"
        style="display:inline-block;padding:11px 22px;background:#FF00B2;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;"
        >{{CTA_LABEL}}</a
      >
      <p style="margin:22px 0 0;font-size:12.5px;color:#6B7280;line-height:1.55;">{{EXPIRY_NOTE}}</p>
    </div>
    <div
      style="padding:14px 32px;border-top:1px solid #E5E7EB;background:#F9FAFB;font-size:11px;color:#9CA3AF;text-align:center;"
    >
      Adaptiv Systems · operations intelligence for the built world · adaptiv.systems
    </div>
  </div>
</div>
```

## Pre-baked templates (copy-paste ready)

Each block below is the full HTML — paste straight into the matching slot in **Supabase → Authentication → Email Templates**. The master shell above documents the structure; you only need it if you're editing one of these or adding a new template.

### Confirm signup

**Subject**:

```
Confirm your Merlin account
```

**Message body**:

```html
<div
  style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#F3F4F6;padding:32px 16px;"
>
  <div
    style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);"
  >
    <div style="height:4px;background:linear-gradient(90deg,#FF00B2,#20286D);"></div>
    <div style="padding:28px 32px 8px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#FF00B2;text-transform:uppercase;">
        ADAPTIV · MERLIN
      </div>
      <h1 style="margin:14px 0 6px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#0F172A;">
        Welcome to Merlin
      </h1>
    </div>
    <div style="padding:8px 32px 24px;font-size:14px;color:#111827;line-height:1.6;">
      <p style="margin:0 0 18px;">Click below to confirm your email and finish setting up your account.</p>
      <a
        href="{{ .ConfirmationURL }}"
        style="display:inline-block;padding:11px 22px;background:#FF00B2;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;"
        >Confirm email</a
      >
      <p style="margin:22px 0 0;font-size:12.5px;color:#6B7280;line-height:1.55;">
        This link expires in 24 hours. If you didn't sign up for Merlin, you can safely ignore this email.
      </p>
    </div>
    <div
      style="padding:14px 32px;border-top:1px solid #E5E7EB;background:#F9FAFB;font-size:11px;color:#9CA3AF;text-align:center;"
    >
      Adaptiv Systems · operations intelligence for the built world · adaptiv.systems
    </div>
  </div>
</div>
```

### Reset password

**Subject**:

```
Reset your Merlin password
```

**Message body**:

```html
<div
  style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#F3F4F6;padding:32px 16px;"
>
  <div
    style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);"
  >
    <div style="height:4px;background:linear-gradient(90deg,#FF00B2,#20286D);"></div>
    <div style="padding:28px 32px 8px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#FF00B2;text-transform:uppercase;">
        ADAPTIV · MERLIN
      </div>
      <h1 style="margin:14px 0 6px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#0F172A;">
        Reset your password
      </h1>
    </div>
    <div style="padding:8px 32px 24px;font-size:14px;color:#111827;line-height:1.6;">
      <p style="margin:0 0 18px;">
        You asked to reset the password on your Merlin account. Click the button below to set a new one.
      </p>
      <a
        href="{{ .ConfirmationURL }}"
        style="display:inline-block;padding:11px 22px;background:#FF00B2;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;"
        >Reset password</a
      >
      <p style="margin:22px 0 0;font-size:12.5px;color:#6B7280;line-height:1.55;">
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your
        password won't change.
      </p>
    </div>
    <div
      style="padding:14px 32px;border-top:1px solid #E5E7EB;background:#F9FAFB;font-size:11px;color:#9CA3AF;text-align:center;"
    >
      Adaptiv Systems · operations intelligence for the built world · adaptiv.systems
    </div>
  </div>
</div>
```

### Magic link

**Subject**:

```
Your Merlin sign-in link
```

**Message body**:

```html
<div
  style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#F3F4F6;padding:32px 16px;"
>
  <div
    style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);"
  >
    <div style="height:4px;background:linear-gradient(90deg,#FF00B2,#20286D);"></div>
    <div style="padding:28px 32px 8px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#FF00B2;text-transform:uppercase;">
        ADAPTIV · MERLIN
      </div>
      <h1 style="margin:14px 0 6px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#0F172A;">
        Sign in to Merlin
      </h1>
    </div>
    <div style="padding:8px 32px 24px;font-size:14px;color:#111827;line-height:1.6;">
      <p style="margin:0 0 18px;">Click below to sign in. No password needed — this link is good once.</p>
      <a
        href="{{ .ConfirmationURL }}"
        style="display:inline-block;padding:11px 22px;background:#FF00B2;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;"
        >Sign in to Merlin</a
      >
      <p style="margin:22px 0 0;font-size:12.5px;color:#6B7280;line-height:1.55;">
        This link expires in 1 hour and can only be used once. If you didn't request a sign-in link, you can safely
        ignore this email.
      </p>
    </div>
    <div
      style="padding:14px 32px;border-top:1px solid #E5E7EB;background:#F9FAFB;font-size:11px;color:#9CA3AF;text-align:center;"
    >
      Adaptiv Systems · operations intelligence for the built world · adaptiv.systems
    </div>
  </div>
</div>
```

### Change email address

**Subject**:

```
Confirm your new Merlin email
```

**Message body**:

```html
<div
  style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#F3F4F6;padding:32px 16px;"
>
  <div
    style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);"
  >
    <div style="height:4px;background:linear-gradient(90deg,#FF00B2,#20286D);"></div>
    <div style="padding:28px 32px 8px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#FF00B2;text-transform:uppercase;">
        ADAPTIV · MERLIN
      </div>
      <h1 style="margin:14px 0 6px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#0F172A;">
        Confirm your new email
      </h1>
    </div>
    <div style="padding:8px 32px 24px;font-size:14px;color:#111827;line-height:1.6;">
      <p style="margin:0 0 18px;">
        You asked to change the email on your Merlin account to <strong>{{ .NewEmail }}</strong>. Click below to
        confirm.
      </p>
      <a
        href="{{ .ConfirmationURL }}"
        style="display:inline-block;padding:11px 22px;background:#FF00B2;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;"
        >Confirm new email</a
      >
      <p style="margin:22px 0 0;font-size:12.5px;color:#6B7280;line-height:1.55;">
        This link expires in 24 hours. If you didn't request this change, you can safely ignore this email and we'll
        keep your current address.
      </p>
    </div>
    <div
      style="padding:14px 32px;border-top:1px solid #E5E7EB;background:#F9FAFB;font-size:11px;color:#9CA3AF;text-align:center;"
    >
      Adaptiv Systems · operations intelligence for the built world · adaptiv.systems
    </div>
  </div>
</div>
```

### Invite user

**Subject**:

```
You're invited to Merlin
```

**Message body**:

```html
<div
  style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#F3F4F6;padding:32px 16px;"
>
  <div
    style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);"
  >
    <div style="height:4px;background:linear-gradient(90deg,#FF00B2,#20286D);"></div>
    <div style="padding:28px 32px 8px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#FF00B2;text-transform:uppercase;">
        ADAPTIV · MERLIN
      </div>
      <h1 style="margin:14px 0 6px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#0F172A;">
        You're invited to Merlin
      </h1>
    </div>
    <div style="padding:8px 32px 24px;font-size:14px;color:#111827;line-height:1.6;">
      <p style="margin:0 0 18px;">
        Someone at Adaptiv has invited you to Merlin — the agentic operations co-pilot for facility teams. Click below
        to set up your account and pick a password.
      </p>
      <a
        href="{{ .ConfirmationURL }}"
        style="display:inline-block;padding:11px 22px;background:#FF00B2;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;"
        >Accept invite</a
      >
      <p style="margin:22px 0 0;font-size:12.5px;color:#6B7280;line-height:1.55;">
        This invite link expires in 7 days. If you weren't expecting this, you can safely ignore it.
      </p>
    </div>
    <div
      style="padding:14px 32px;border-top:1px solid #E5E7EB;background:#F9FAFB;font-size:11px;color:#9CA3AF;text-align:center;"
    >
      Adaptiv Systems · operations intelligence for the built world · adaptiv.systems
    </div>
  </div>
</div>
```

### Reauthentication (code-only — different shape)

This template uses a 6-digit code, not a clickable link. Use this variant of the shell (no `<a>` button):

**Subject**:

```
Confirm your identity
```

**Message body**:

```html
<div
  style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#F3F4F6;padding:32px 16px;"
>
  <div
    style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);"
  >
    <div style="height:4px;background:linear-gradient(90deg,#FF00B2,#20286D);"></div>
    <div style="padding:28px 32px 8px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#FF00B2;text-transform:uppercase;">
        ADAPTIV · MERLIN
      </div>
      <h1 style="margin:14px 0 6px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#0F172A;">
        Confirm your identity
      </h1>
    </div>
    <div style="padding:8px 32px 24px;font-size:14px;color:#111827;line-height:1.6;">
      <p style="margin:0 0 18px;">Enter the following 6-digit code in Merlin to confirm it's you.</p>
      <div
        style="display:inline-block;padding:14px 22px;background:#F3F4F6;color:#0F172A;font-family:'SF Mono',Menlo,Monaco,Consolas,monospace;font-size:22px;font-weight:700;letter-spacing:0.18em;border-radius:8px;border:1px solid #E5E7EB;"
      >
        {{ .Token }}
      </div>
      <p style="margin:22px 0 0;font-size:12.5px;color:#6B7280;line-height:1.55;">
        This code expires in 10 minutes. If you didn't request reauthentication, you can safely ignore this email.
      </p>
    </div>
    <div
      style="padding:14px 32px;border-top:1px solid #E5E7EB;background:#F9FAFB;font-size:11px;color:#9CA3AF;text-align:center;"
    >
      Adaptiv Systems · operations intelligence for the built world · adaptiv.systems
    </div>
  </div>
</div>
```

## Notes

- **Supabase variables**: `{{ .ConfirmationURL }}` is the action link Supabase generates per send. `{{ .NewEmail }}` is the user-supplied new address (change-email only). `{{ .Token }}` is the 6-digit code (reauth only). Other available variables — `{{ .Email }}`, `{{ .SiteURL }}`, `{{ .RedirectTo }}`, `{{ .TokenHash }}` — aren't used in these templates.
- **Plain-text fallback**: Supabase Auth auto-generates a plain-text version from the HTML. No manual plain-text version needed.
- **Sender**: Set the From name + email under **Project Settings → Authentication → SMTP Settings → Sender details**, NOT inside the template HTML. Default: `Merlin <noreply@adaptiv.systems>`.
- **Don't override `<title>` or include `<html>`/`<head>`**: Supabase wraps the body in its own document shell. Pasting a full HTML doc breaks the wrap.
- **Mail-client testing**: Send a real test to Gmail, Outlook 365 web, Apple Mail iOS, and Apple Mail macOS before declaring done. The shell renders identically in all four; the gradient bar degrades gracefully (Outlook ignores `linear-gradient` and renders a transparent line — visually fine but consider a flat `background:#FF00B2` fallback if you care).
- **Spam-folder note**: New sending domains (even with SPF/DKIM/DMARC all passing) cold-start in Gmail's spam folder for the first 1-2 weeks until reputation builds. Mark-as-not-spam on the first few sends accelerates this. Branded templates also help — Gmail's classifier rewards "this looks like a real company email" over "this looks templated".

## Deliverability follow-ups

Not strictly tied to the templates but worth doing in the same pass:

1. **Tighten DMARC**: Route 53 `_dmarc.adaptiv.systems` TXT — change `"v=DMARC1; p=none;"` to `"v=DMARC1; p=quarantine; sp=quarantine; adkim=r; aspf=r;"`. Safe to do once verified SPF + DKIM align (they do, as of 2026-05-13).
2. **Dedicated auth subdomain (optional)**: If we eventually want to isolate auth-email reputation from marketing/demo sends, verify `auth.adaptiv.systems` separately in Resend and update the Supabase SMTP sender to `noreply@auth.adaptiv.systems`. Slower setup but cleaner long-term reputation hygiene.
