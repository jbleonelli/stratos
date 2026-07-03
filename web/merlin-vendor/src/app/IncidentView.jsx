// Full-page incident detail view.
import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card, Sparkline } from './primitives.jsx';
import { SENSOR_VOC_F32 } from './data.js';
import { usePinned, togglePinIncident } from './pins.js';
import { logIncidentAction } from './incident-actions.js';
import { handleIncident } from './simulator.js';
import { getSession } from './auth.js';
import { useT } from './i18n.js';

const TONE_BY_PRIORITY = { critical: 'risk', high: 'warn', medium: 'info', info: 'info' };

export function IncidentView({ incident, building, onBack, onAskMerlin }) {
  const t = useT();
  const locationId = building?.id || null;
  const pinned = usePinned();
  const isPinned = pinned.has(incident.id);
  const tone = TONE_BY_PRIORITY[incident.priority];
  const IconC = Icon[incident.icon] || Icon.bell;
  // Tracks the action currently in flight + the action just completed
  // (for a brief success flash before the buttons collapse into the
  // "Handled by …" state once the simulator updates the incident).
  const [busyAction, setBusyAction] = useState(null);
  const [doneAction, setDoneAction] = useState(null);

  const runAction = async (actionId) => {
    if (busyAction) return;
    setBusyAction(actionId);
    setDoneAction(null);
    const session = getSession();
    const actorName = session?.name || session?.email || 'you';
    try {
      // Audit row first (best-effort; logIncidentAction already swallows
      // its own errors). Fire-and-forget: the local state change below
      // is what the user actually sees.
      logIncidentAction({
        incidentId: incident.id,
        incidentTitle: incident.title,
        incidentPriority: incident.priority,
        action: actionId,
        locationId,
      });
      // Synchronous local state update via the simulator. Flips the
      // incident's status to "Dispatched by JB · 09:14" and marks
      // _humanHandled so the tick loop won't overwrite it.
      handleIncident(incident.id, actionId, actorName);
      setDoneAction(actionId);
      // Clear the brief "✓ Dispatched" flash after a beat. The
      // _humanHandled section below takes over rendering after that.
      setTimeout(() => setDoneAction(null), 1500);
    } finally {
      setBusyAction(null);
    }
  };

  const timeline = useMemo(() => buildTimeline(incident, t), [incident.status, incident.id, t]);
  const merlinActions = useMemo(
    () => buildMerlinActions(incident, t),
    [incident.status, incident.icon, incident.id, t],
  );
  const location = useMemo(() => parseLocation(incident.title, t), [incident.title, t]);
  const sensor = useMemo(() => buildSensorSeries(incident, t), [incident.id, incident.icon, t]);
  const slaInfo = useMemo(() => parseSla(incident.sla, t), [incident.sla, t]);
  const assignee = useMemo(() => pickAssignee(incident, t), [incident.icon, incident.id, t]);

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--pad)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pad)',
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-soft)',
            fontSize: 11.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Icon.chevR size={9} style={{ transform: 'rotate(180deg)' }} /> {t('action.back_dash')}
        </button>
        <Icon.chevR size={10} />
        <span>{t('incview.crumb.incidents')}</span>
        <Icon.chevR size={10} />
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{incident.id}</span>
      </div>

      {/* Hero */}
      <Card pad={false} style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--${tone}) 14%, transparent), transparent 60%)`,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{ padding: 'var(--pad)', display: 'flex', gap: 20, alignItems: 'flex-start', position: 'relative' }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              flexShrink: 0,
              borderRadius: 14,
              background: `color-mix(in oklch, var(--${tone}) 18%, var(--surface-2))`,
              color: `var(--${tone})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 0 1px var(--border)',
            }}
          >
            <IconC size={32} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Dot tone={tone} pulse={incident.priority === 'critical'} />
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 0.15,
                  textTransform: 'uppercase',
                  color: 'var(--text-dim)',
                  fontWeight: 700,
                }}
              >
                {t('incview.eyebrow', {
                  priority: t(`priority.${incident.priority}`) || incident.priority,
                  time: incidentTime(incident),
                  sla: incident.sla,
                })}
              </span>
              {isPinned && (
                <Pill tone="accent">
                  <Icon.pin size={9} style={{ fill: 'var(--accent)' }} /> {t('action.pinned')}
                </Pill>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: -0.01 }}>{incident.title}</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-soft)', maxWidth: 720 }}>
              {incident.sub}
            </p>

            <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
              <Stat label={t('incview.stat.status')} value={incident.status} tone="info" />
              <Stat
                label={t('incview.stat.sla')}
                value={slaInfo.primary}
                sub={slaInfo.secondary}
                tone={slaInfo.tone}
                pulse={slaInfo.tone === 'risk'}
              />
              <Stat label={t('incview.stat.eta')} value={slaInfo.eta} sub={t('incview.stat.eta_sub')} tone="accent" />
              <Stat label={t('incview.stat.assignee')} value={assignee.name} sub={assignee.role} tone="ok" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, minWidth: 180 }}>
            <button
              onClick={() => {
                const wasPinned = isPinned;
                togglePinIncident(incident.id);
                logIncidentAction({
                  incidentId: incident.id,
                  incidentTitle: incident.title,
                  incidentPriority: incident.priority,
                  action: wasPinned ? 'unpin' : 'pin',
                  locationId,
                });
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 14px',
                background: isPinned ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: isPinned ? 'var(--accent)' : 'var(--text-soft)',
                border: `1px solid ${isPinned ? 'var(--accent-line)' : 'var(--border)'}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Icon.pin size={12} style={{ fill: isPinned ? 'var(--accent)' : 'none' }} />
              {isPinned ? t('action.pinned') : t('action.pin')}
            </button>
            {incident._humanHandled ? (
              <div
                style={{
                  padding: '10px 12px',
                  background: 'var(--ok-soft, color-mix(in oklch, var(--ok) 12%, var(--surface-2)))',
                  border: '1px solid color-mix(in oklch, var(--ok) 30%, var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--ok)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon.check size={12} />
                {incident._handledBy
                  ? t('incview.handled_by', {
                      verb: t(`incview.action.${incident._handledBy.action}.done_short`) || t('action.back'),
                      who: incident._handledBy.name,
                    })
                  : t('incview.handled')}
              </div>
            ) : incident.action === 'approve' ? (
              <>
                <ActionButton id="approve" busy={busyAction} done={doneAction} onClick={runAction} primary />
                <ActionButton id="hold" busy={busyAction} done={doneAction} onClick={runAction} />
              </>
            ) : (
              <>
                <ActionButton id="escalate" busy={busyAction} done={doneAction} onClick={runAction} />
                <ActionButton id="reassign" busy={busyAction} done={doneAction} onClick={runAction} />
              </>
            )}
            <button
              onClick={() => onAskMerlin?.(t('incview.ask_prompt', { id: incident.id, title: incident.title }))}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                color: 'var(--accent)',
                border: '1px solid var(--accent-line)',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <Icon.sparkle size={12} /> {t('action.ask_merlin')}
            </button>
          </div>
        </div>
      </Card>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--pad)' }}>
        {/* Left column: timeline + Merlin actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
          <Card>
            <SectionTitle
              icon="sla"
              title={t('incview.timeline.title')}
              sub={t('incview.timeline.sub', { n: timeline.length })}
            />
            <div style={{ marginTop: 12, position: 'relative' }}>
              {/* vertical rail */}
              <div
                style={{ position: 'absolute', left: 13, top: 10, bottom: 10, width: 2, background: 'var(--border)' }}
              />
              {timeline.map((e, i) => (
                <div key={i} style={{ position: 'relative', display: 'flex', gap: 12, padding: '6px 0 10px' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: `color-mix(in oklch, var(--${e.tone}) 16%, var(--surface))`,
                      color: `var(--${e.tone})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `inset 0 0 0 1.5px color-mix(in oklch, var(--${e.tone}) 50%, transparent)`,
                      zIndex: 1,
                    }}
                  >
                    {React.createElement(Icon[e.icon] || Icon.check, { size: 13 })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{e.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                        {e.time}
                      </span>
                      {e.active && (
                        <Pill tone="accent">
                          <Dot tone="accent" size={4} pulse /> {t('incview.in_progress')}
                        </Pill>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{e.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon="sparkle" title={t('incview.merlin_did.title')} sub={t('incview.merlin_did.sub')} />
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {merlinActions.map((a, i) => {
                const ActIcon = Icon[a.icon] || Icon.check;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      padding: '8px 10px',
                      background: 'var(--surface-2)',
                      borderRadius: 7,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        flexShrink: 0,
                        background: `color-mix(in oklch, var(--${a.tone}) 14%, transparent)`,
                        color: `var(--${a.tone})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ActIcon size={12} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.text}</div>
                      {a.sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{a.sub}</div>}
                    </div>
                    <div
                      style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)', flexShrink: 0 }}
                    >
                      {a.time}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right column: sensor + location + related */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
          {sensor && (
            <Card>
              <SectionTitle icon={sensor.icon} title={sensor.title} sub={sensor.sub} />
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    marginBottom: 4,
                  }}
                >
                  <span>{sensor.axis}</span>
                  <span style={{ color: `var(--${sensor.tone})`, fontWeight: 700, fontFamily: 'var(--mono)' }}>
                    {sensor.latest}
                  </span>
                </div>
                <Sparkline
                  data={sensor.data}
                  w={400}
                  h={60}
                  stroke={`var(--${sensor.tone})`}
                  fill={`color-mix(in oklch, var(--${sensor.tone}) 14%, transparent)`}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                {sensor.readings.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 10px',
                      background: 'var(--surface-2)',
                      borderRadius: 7,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-dim)',
                        fontWeight: 700,
                        letterSpacing: 0.12,
                        textTransform: 'uppercase',
                      }}
                    >
                      {r.label}
                    </div>
                    <div
                      style={{ fontSize: 14, fontWeight: 700, color: `var(--${r.tone})`, fontFamily: 'var(--mono)' }}
                    >
                      {r.value}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle icon="floor" title={t('incview.location.title')} sub={location.sub} />
            <div
              style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 12 }}
            >
              <span style={{ color: 'var(--text-dim)' }}>{t('incview.location.building')}</span>{' '}
              <span style={{ fontWeight: 600 }}>Meridian HQ</span>
              <span style={{ color: 'var(--text-dim)' }}>{t('incview.location.floor')}</span>{' '}
              <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{location.floor}</span>
              <span style={{ color: 'var(--text-dim)' }}>{t('incview.location.zone')}</span>{' '}
              <span style={{ fontWeight: 600 }}>{location.zone}</span>
              <span style={{ color: 'var(--text-dim)' }}>{t('incview.location.room')}</span>{' '}
              <span style={{ fontWeight: 600 }}>{location.room}</span>
              <span style={{ color: 'var(--text-dim)' }}>{t('incview.location.category')}</span>{' '}
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{location.category}</span>
            </div>
          </Card>

          <Card>
            <SectionTitle icon="bell" title={t('incview.related.title')} sub={t('incview.related.sub')} />
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                {
                  id: 'i-past-1',
                  title: t('incview.related.item.same_location'),
                  when: t('incview.related.when.2d'),
                  status: t('incview.related.status.resolved'),
                  tone: 'ok',
                },
                {
                  id: 'i-past-2',
                  title: t('incview.related.item.same_category'),
                  when: t('incview.related.when.1w'),
                  status: t('incview.related.status.resolved'),
                  tone: 'ok',
                },
                {
                  id: 'i-past-3',
                  title: t('incview.related.item.sensor_drift'),
                  when: t('incview.related.when.3w'),
                  status: t('incview.related.status.resolved'),
                  tone: 'ok',
                },
              ].map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                  }}
                >
                  <Dot tone={r.tone} size={6} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.title}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                      {r.when} · {r.status}
                    </div>
                  </div>
                  <Icon.chevR size={11} style={{ color: 'var(--text-dim)' }} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Ask Merlin */}
      <Card style={{ background: 'color-mix(in oklch, var(--accent) 5%, var(--surface))', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Icon.sparkle size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('incview.ask.title')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            t('incview.ask.q1'),
            t('incview.ask.q2'),
            t('incview.ask.q3'),
            t('incview.ask.q4'),
            t('incview.ask.q5'),
          ].map((q, i) => (
            <button
              key={i}
              onClick={() => onAskMerlin?.(q)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                background: 'var(--surface-2)',
                color: 'var(--text-soft)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              <Icon.sparkle size={11} style={{ marginRight: 4, verticalAlign: '-2px' }} /> {q}
            </button>
          ))}
        </div>
      </Card>
    </main>
  );
}

// ─── helpers ───

function Stat({ label, value, sub, tone, pulse }) {
  const color =
    { ok: 'var(--ok)', risk: 'var(--risk)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent)' }[tone] ||
    'var(--text)';
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.12,
        }}
      >
        {pulse && <Dot tone={tone} size={5} pulse />}
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ icon, title, sub }) {
  const IconC = Icon[icon] || Icon.bell;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconC size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const btnGhost = {
  padding: '8px 14px',
  background: 'var(--surface-2)',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};

// Action button with idle / busy / done copy + visible feedback.
// `primary` switches to the filled accent style for "Approve & dispatch".
function ActionButton({ id, busy, done, onClick, primary }) {
  const t = useT();
  const isBusy = busy === id;
  const isDone = done === id;
  const anyBusy = busy != null;
  const state = isBusy ? 'busy' : isDone ? 'done' : 'idle';
  const label = t(`incview.action.${id}.${state}`);
  const baseStyle = primary
    ? {
        padding: '9px 14px',
        background: 'var(--accent)',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontSize: 12.5,
        fontWeight: 600,
        boxShadow: '0 2px 8px color-mix(in oklch, var(--accent) 25%, transparent)',
        fontFamily: 'var(--font)',
      }
    : btnGhost;
  const doneStyle = isDone
    ? {
        background: 'color-mix(in oklch, var(--ok) 14%, var(--surface-2))',
        color: 'var(--ok)',
        border: '1px solid color-mix(in oklch, var(--ok) 35%, var(--border))',
        boxShadow: 'none',
      }
    : {};
  return (
    <button
      onClick={() => onClick(id)}
      disabled={anyBusy || isDone}
      style={{
        ...baseStyle,
        ...doneStyle,
        cursor: anyBusy || isDone ? 'default' : 'pointer',
        opacity: anyBusy && !isBusy ? 0.5 : 1,
        transition: 'background .15s, color .15s, opacity .15s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
      }}
    >
      {label}
    </button>
  );
}

// Generate a plausible timeline based on the incident's current status.
// Same stable time derivation the dashboard uses, kept local to avoid a
// cross-module helper for one field.
function incidentTime(inc) {
  if (inc.time) return inc.time;
  if (inc._spawnedAt) {
    const d = new Date(inc._spawnedAt);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  let h = 2166136261;
  const id = inc.id || '';
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const mins = Math.abs(h) % (14 * 60);
  const hh = Math.floor(mins / 60) + 7;
  const mm = mins % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function buildTimeline(inc, t) {
  const s = (inc.status || '').toLowerCase();
  const events = [{ label: t('incview.tl.detected'), desc: inc.sub, icon: 'bell', tone: 'risk' }];

  if (/auto-closed|notif/.test(s) || inc.icon === 'warn') {
    events.push({
      label: t('incview.tl.auto_mit'),
      desc: t('incview.tl.auto_mit_desc'),
      icon: 'shield',
      tone: 'accent',
    });
  }
  if (/dispatched|eta|on-site|working|completing|resolved|contained|plumber/.test(s)) {
    events.push({
      label: t('incview.tl.dispatched'),
      desc: t('incview.tl.dispatched_desc'),
      icon: 'play',
      tone: 'accent',
    });
  }
  if (/on-site|working|completing|resolved|plumber on-site/.test(s)) {
    events.push({ label: t('incview.tl.on_site'), desc: t('incview.tl.on_site_desc'), icon: 'shield', tone: 'info' });
  }
  if (/completing|resolved|closing/.test(s)) {
    events.push({
      label: t('incview.tl.completing'),
      desc: t('incview.tl.completing_desc'),
      icon: 'check',
      tone: 'info',
      active: !/resolved|recovered|handled/.test(s),
    });
  }
  if (/resolved|recovered|handled|false alarm|ticket #/.test(s)) {
    events.push({ label: t('incview.tl.resolved'), desc: t('incview.tl.resolved_desc'), icon: 'check', tone: 'ok' });
  }

  // Assign times backward from "now" — 3 min intervals.
  const now = new Date();
  events.forEach((e, i) => {
    const d = new Date(now.getTime() - (events.length - 1 - i) * 3 * 60000);
    e.time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  return events;
}

function buildMerlinActions(inc, t) {
  const s = (inc.status || '').toLowerCase();
  const actions = [];
  const ago = (n) => t('incview.act.time_min_ago', { n });

  if (inc.icon === 'warn' && /valve|auto-closed/.test(s)) {
    actions.push({
      icon: 'check',
      text: t('incview.act.valve'),
      sub: t('incview.act.valve_sub'),
      tone: 'ok',
      time: ago(8),
    });
  }
  if (/dispatched|eta|on-site|working/.test(s)) {
    actions.push({
      icon: 'play',
      text: t('incview.act.dispatch'),
      sub: t('incview.act.dispatch_sub'),
      tone: 'accent',
      time: ago(6),
    });
  }
  if (/notif/.test(s)) {
    actions.push({
      icon: 'bell',
      text: t('incview.act.notify'),
      sub: t('incview.act.notify_sub'),
      tone: 'info',
      time: ago(5),
    });
  }
  if (inc.icon === 'air') {
    actions.push({
      icon: 'hvac',
      text: t('incview.act.air_boost'),
      sub: t('incview.act.air_boost_sub'),
      tone: 'info',
      time: ago(4),
    });
  }
  if (inc.icon === 'people') {
    actions.push({
      icon: 'people',
      text: t('incview.act.cleaning_pull'),
      sub: t('incview.act.cleaning_pull_sub'),
      tone: 'info',
      time: ago(3),
    });
  }
  if (inc.action === 'approve') {
    actions.push({
      icon: 'sparkle',
      text: t('incview.act.proposed'),
      sub: inc.status,
      tone: 'accent',
      time: t('incview.act.time_now'),
    });
  }

  // Always
  actions.push({
    icon: 'shield',
    text: t('incview.act.audit'),
    sub: t('incview.act.audit_sub'),
    tone: 'info',
    time: t('incview.act.time_continuous'),
  });

  return actions;
}

function parseLocation(title, t) {
  const m = title.match(/Floor (\d+|\w+)/i);
  const floor = m ? m[1] : '—';
  const zone = m
    ? Number(floor) <= 18
      ? t('incview.loc.low_rise')
      : Number(floor) <= 36
        ? t('incview.loc.mid_rise')
        : t('incview.loc.high_rise')
    : t('incview.loc.ground_mech');
  const roomM = title.match(/\u2014\s+(.+)$/) || title.match(/—\s+(.+)$/);
  const room = roomM ? roomM[1] : t('incview.loc.zone_area');
  const categoryByIcon = {
    air: 'air',
    hvac: 'hvac',
    supply: 'supply',
    warn: 'warn',
    shield: 'shield',
    people: 'people',
    sla: 'sla',
    room: 'room',
    building: 'building',
    bolt: 'bolt',
    light: 'light',
  };
  const catKey = categoryByIcon[title] ? `incview.loc.cat.${categoryByIcon[title]}` : 'incview.loc.cat.general';
  return {
    floor: floor === '—' ? t('incview.loc.ground') : t('incview.loc.fl_n', { n: floor }),
    zone,
    room,
    category: t(catKey),
    sub: t('incview.loc.sub', { room }),
  };
}

function parseSla(slaText, t) {
  const s = slaText || '';
  const breachM = s.match(/breach in (\d+m)/i);
  const riskM = s.match(/at risk/i);
  if (breachM) {
    return {
      primary: t('incview.sla.breach_in', { x: breachM[1] }),
      secondary: t('incview.sla.hygiene_sla'),
      eta: '6m',
      tone: 'risk',
    };
  }
  if (riskM)
    return { primary: t('incview.sla.at_risk'), secondary: t('incview.sla.monitoring'), eta: '—', tone: 'warn' };
  if (/nominal/i.test(s))
    return { primary: t('incview.sla.nominal'), secondary: t('incview.sla.within'), eta: '—', tone: 'ok' };
  if (/immediate/i.test(s))
    return {
      primary: t('incview.sla.immediate'),
      secondary: t('incview.sla.safety_triggered'),
      eta: t('incview.act.time_now'),
      tone: 'risk',
    };
  if (/scheduled/i.test(s))
    return { primary: t('incview.sla.scheduled'), secondary: t('incview.sla.on_calendar'), eta: '—', tone: 'info' };
  return { primary: t('incview.sla.ok'), secondary: s, eta: '—', tone: 'ok' };
}

function pickAssignee(inc, t) {
  const lead = t('incview.assignee.role.lead_custodian');
  const compliance = t('incview.assignee.role.compliance');
  const hvac = t('incview.assignee.role.hvac_maint');
  const vendor = t('incview.assignee.role.vendor');
  const securityLead = t('incview.assignee.role.security_lead');
  const facMgr = t('incview.assignee.role.facility_mgr');
  const autonomous = t('incview.assignee.role.autonomous');
  const byIcon = {
    air: { name: 'Maria Chen', role: lead },
    people: { name: 'Maria Chen', role: lead },
    sla: { name: 'Priya Shah', role: compliance },
    supply: { name: 'Maria Chen', role: lead },
    warn: { name: 'Darnell Price', role: hvac },
    hvac: { name: 'Darnell Price', role: hvac },
    building: { name: 'OTIS Service', role: vendor },
    shield: { name: 'Ivan Kovac', role: securityLead },
    room: { name: 'Ayesha Rahman', role: facMgr },
    bolt: { name: 'Merlin', role: autonomous },
    light: { name: 'Merlin', role: autonomous },
  };
  return byIcon[inc.icon] || { name: 'Merlin', role: autonomous };
}

function buildSensorSeries(inc, t) {
  if (inc.icon === 'air') {
    const latestPpb = SENSOR_VOC_F32[SENSOR_VOC_F32.length - 1].v;
    return {
      icon: 'air',
      title: t('incview.sensor.air.title'),
      sub: t('incview.sensor.air.sub'),
      data: SENSOR_VOC_F32,
      latest: `${latestPpb} ppb`,
      axis: t('incview.sensor.air.axis'),
      tone: 'risk',
      readings: [
        { label: t('incview.sensor.air.tvoc'), value: `${latestPpb} ppb`, tone: 'risk' },
        { label: 'CO\u2082', value: '900 ppm', tone: 'warn' },
        { label: t('incview.sensor.air.temp'), value: '23.1°C', tone: 'ok' },
      ],
    };
  }
  if (inc.icon === 'hvac') {
    const data = [
      { v: 22.0 },
      { v: 22.2 },
      { v: 22.5 },
      { v: 22.8 },
      { v: 23.1 },
      { v: 23.4 },
      { v: 23.9 },
      { v: 24.3 },
      { v: 24.6 },
    ];
    return {
      icon: 'hvac',
      title: t('incview.sensor.hvac.title'),
      sub: t('incview.sensor.hvac.sub'),
      data,
      latest: `${data[data.length - 1].v} °C`,
      axis: '°C',
      tone: 'warn',
      readings: [
        { label: t('incview.sensor.hvac.current'), value: '24.6°C', tone: 'warn' },
        { label: t('incview.sensor.hvac.setpoint'), value: '22.0°C', tone: 'ok' },
        { label: t('incview.sensor.hvac.drift'), value: '+2.6°C', tone: 'warn' },
      ],
    };
  }
  if (inc.icon === 'people') {
    const data = [{ v: 2 }, { v: 3 }, { v: 4 }, { v: 6 }, { v: 8 }, { v: 10 }, { v: 11 }, { v: 13 }, { v: 14 }];
    return {
      icon: 'people',
      title: t('incview.sensor.people.title'),
      sub: t('incview.sensor.people.sub'),
      data,
      latest: t('incview.sensor.people.visitors_unit', { n: data[data.length - 1].v }),
      axis: t('incview.sensor.people.axis'),
      tone: 'warn',
      readings: [
        { label: t('incview.sensor.people.visitors'), value: '14', tone: 'warn' },
        { label: t('incview.sensor.people.threshold'), value: '12', tone: 'info' },
        { label: t('incview.sensor.people.peak'), value: '12:40', tone: 'info' },
      ],
    };
  }
  if (inc.icon === 'supply') {
    const data = [{ v: 60 }, { v: 50 }, { v: 42 }, { v: 34 }, { v: 28 }, { v: 22 }, { v: 18 }, { v: 14 }, { v: 10 }];
    return {
      icon: 'supply',
      title: t('incview.sensor.supply.title'),
      sub: t('incview.sensor.supply.sub'),
      data,
      latest: `${data[data.length - 1].v}%`,
      axis: '%',
      tone: 'warn',
      readings: [
        { label: t('incview.sensor.supply.remaining'), value: '10%', tone: 'warn' },
        {
          label: t('incview.sensor.supply.avg_burn'),
          value: t('incview.sensor.supply.refill', { h: 9 }),
          tone: 'info',
        },
        { label: t('incview.sensor.supply.queued'), value: '16:00', tone: 'ok' },
      ],
    };
  }
  if (inc.icon === 'warn') {
    const data = [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0.1 }, { v: 0.3 }, { v: 0.6 }, { v: 1.2 }, { v: 2.4 }, { v: 2.5 }];
    return {
      icon: 'droplet',
      title: t('incview.sensor.warn.title'),
      sub: t('incview.sensor.warn.sub'),
      data,
      latest: `${data[data.length - 1].v} pF`,
      axis: 'pF',
      tone: 'risk',
      readings: [
        { label: t('incview.sensor.warn.now'), value: '2.5 pF', tone: 'risk' },
        { label: t('incview.sensor.warn.baseline'), value: '0.0 pF', tone: 'ok' },
        { label: t('incview.sensor.warn.valve'), value: t('incview.sensor.warn.closed'), tone: 'ok' },
      ],
    };
  }
  return null;
}
