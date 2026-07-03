// Admin — Notifications section: opt the org into outbound ticket-event
// notifications (email via Resend / Slack webhook) on top of the in-app bell.
// Extracted from Admin.jsx (G2 split). Exports NotificationsSection.

import React, { useState, useEffect } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useActiveOrg, useIsOrgAdmin, updateOrgNotificationsSettings } from './org-data.js';

// Outbound notification settings (migration 182). The in-app bell always
// fires; this opts the org into ALSO sending ticket events (assigned,
// completed, breached, blocked) to email (Resend) and/or a Slack webhook.
// api/cron/tickets-sla-sweep.ts reads organizations.notifications_settings
// and drains the notification outbox to these channels.
export function NotificationsSection() {
  const org = useActiveOrg();
  const isAdmin = useIsOrgAdmin();
  const settings = org?.notifications_settings || {};

  const [ticketEvents, setTicketEvents] = useState(true);
  const [emails, setEmails] = useState('');
  const [slackUrl, setSlackUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  // Hydrate local state when the org row arrives / changes.
  useEffect(() => {
    setTicketEvents(settings.ticket_events !== false);
    setEmails(Array.isArray(settings.email_to) ? settings.email_to.join(', ') : '');
    setSlackUrl(typeof settings.slack_webhook_url === 'string' ? settings.slack_webhook_url : '');
  }, [org?.id, JSON.stringify(settings)]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsedEmails = emails
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes('@'));
  const outboundOn = parsedEmails.length > 0 || slackUrl.trim().length > 0;

  const save = async () => {
    if (!org?.id) return;
    setSaving(true);
    setErr('');
    setSaved(false);
    try {
      await updateOrgNotificationsSettings(org.id, {
        ticket_events: ticketEvents,
        email_to: parsedEmails,
        slack_webhook_url: slackUrl.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e?.message || 'Could not save settings.');
    }
    setSaving(false);
  };

  const inputStyle = {
    width: '100%',
    fontSize: 13,
    fontFamily: 'inherit',
    color: 'var(--text)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 7,
    padding: '8px 10px',
    boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 5 };

  return (
    <div style={{ maxWidth: 640 }}>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon.bell size={17} style={{ color: 'var(--accent)' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Outbound notifications</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
              The in-app bell always fires. Add email or Slack to also push ticket events (assigned, completed, overdue)
              to your team.
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <Pill tone={outboundOn && ticketEvents ? 'ok' : 'neutral'}>
            {outboundOn && ticketEvents ? 'On' : 'Bell only'}
          </Pill>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            cursor: isAdmin ? 'pointer' : 'default',
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={ticketEvents}
            disabled={!isAdmin}
            onChange={(e) => setTicketEvents(e.target.checked)}
          />
          Send ticket events to the channels below
        </label>

        <div>
          <label style={labelStyle}>Email recipients</label>
          <input
            value={emails}
            disabled={!isAdmin}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="ops@acme.com, fm@acme.com"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
            Comma-separated.{' '}
            {parsedEmails.length > 0
              ? `${parsedEmails.length} address${parsedEmails.length === 1 ? '' : 'es'}.`
              : 'None set.'}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Slack incoming webhook URL</label>
          <input
            value={slackUrl}
            disabled={!isAdmin}
            onChange={(e) => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/…"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
            Create one in Slack → Apps → Incoming Webhooks.
          </div>
        </div>

        {err && <div style={{ fontSize: 12.5, color: 'var(--risk)' }}>{err}</div>}

        {isAdmin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                background: 'var(--accent)',
                color: 'var(--accent-fg, #fff)',
                border: '1px solid var(--accent-line)',
                borderRadius: 7,
                cursor: saving ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            {saved && <span style={{ fontSize: 12.5, color: 'var(--ok)' }}>✓ Saved</span>}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Only org admins can change notification settings.
          </div>
        )}
      </Card>
    </div>
  );
}
