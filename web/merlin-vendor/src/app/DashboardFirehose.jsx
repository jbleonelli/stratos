// Super-admin event Firehose — extracted from Dashboard.jsx.
//
// Live stream of every raw event landing in a workspace (incident_actions
// + device_events), each row tagged with a derived `source` pill; device
// rows deep-link to /device/<external_id>. Rendered as a section inside
// Agentic.jsx (the only consumer); the Dashboard itself is the Metrics
// surface now.
//
// Exported: FirehosePanel. FirehoseRow + the NY-friendly timestamp
// formatter are private to this module.

import React from 'react';
import { Pill, Dot, Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import { useEventFirehose, SOURCE_TONES } from './event-firehose.js';
import { navigateTo } from './use-route.js';

// K-25/K-26/K-28/L-2.5: Super-admin Firehose. Live stream of every
// raw event landing in the workspace — incident_actions (simulator
// seed signal + human approve/hold/dismiss) AND device_events
// (Adaptiv smart-display ratings, button presses, cleaner badge
// taps, server-derived resolutions). Each row carries a derived
// `source` so a small kind pill can disambiguate. Device-event rows
// are clickable → deep-link to /device/<external_id>.
export function FirehosePanel({ building }) {
  const t = useT();
  const session = useSession();
  const { rows, todayCount } = useEventFirehose(session?.organizationId, building?.id);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Card pad={false}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Dot tone="ok" size={5} pulse />
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('firehose.title')}</div>
            <Pill tone="accent" title={t('firehose.events_today_tooltip', { n: todayCount })}>
              {t('firehose.events_today', { n: todayCount.toLocaleString() })}
            </Pill>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.45 }}>
            {t('firehose.subtitle')}
          </div>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: '24px 16px', fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
            {t('firehose.empty')}
          </div>
        ) : (
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '170px 90px 200px 130px minmax(0, 1fr)',
                gap: 12,
                alignItems: 'center',
                padding: '8px 16px',
                borderBottom: '1px solid var(--border)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.12,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                position: 'sticky',
                top: 0,
                background: 'var(--surface)',
                zIndex: 1,
              }}
            >
              <div>{t('firehose.col.when')}</div>
              <div>{t('firehose.col.source')}</div>
              <div>{t('firehose.col.org')}</div>
              <div>{t('firehose.col.device')}</div>
              <div>{t('firehose.col.event')}</div>
            </div>
            {rows.map((r, i) => (
              <FirehoseRow key={r.id} row={r} last={i === rows.length - 1} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// One row of the firehose. Device-event rows are clickable
// (cursor-pointer + hover tint + navigate to /device/<external_id>).
// Incident-action rows have no per-row deep-link surface yet, so
// they stay non-interactive.
function FirehoseRow({ row: r, last }) {
  const t = useT();
  const clickable = r.kind === 'device_event' && r.device_external_id;
  const onClick = clickable ? () => navigateTo(`/device/${r.device_external_id}`) : undefined;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '170px 90px 200px 130px minmax(0, 1fr)',
        gap: 12,
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        fontSize: 12,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background 80ms ease',
      }}
      onMouseEnter={(e) => {
        if (clickable) e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        if (clickable) e.currentTarget.style.background = '';
      }}
      title={clickable ? t('firehose.row.open', { device: r.device_external_id }) : undefined}
    >
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }} title={r.created_at}>
        {formatFirehoseTs(r.created_at)}
      </div>
      <div>
        <Pill
          tone={SOURCE_TONES[r.source] || 'off'}
          title={`${r.actor_name || r.action || 'event'} · ${r.action || '—'}`}
        >
          {r.source}
        </Pill>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--text-soft)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {r.organization_name || r.organization_id?.slice(0, 8) || '—'}
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: r.device_external_id ? 'var(--accent)' : 'var(--text-dim)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {r.device_label || r.device_external_id || '—'}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {r.title || r.event_id}
      </div>
    </div>
  );
}

// K-25: detailed timestamp for the firehose. "MMM dd · HH:mm:ss" —
// info-dense, readable in mono. Falls back gracefully on bad input.
function formatFirehoseTs(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${m} ${dd} · ${hh}:${mm}:${ss}`;
}
