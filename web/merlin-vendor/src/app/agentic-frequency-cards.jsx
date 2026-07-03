// Agentic frequency/simulator cards — three self-contained, presentational
// draft→Save cards extracted from Agentic.jsx (Phase 3 decomposition):
//   • TickFrequencyCard          (per-org agent tick cadence; $/day)
//   • SeedFrequencyCard          (synthetic incident cadence; events/day)
//   • DeviceSeedSimulatorCard    (device-event simulator cadence + profiles)
// Pure move — no behavior change. Consumed by AgenticPage's AgentsSection
// and SimulatorTab. No imports from Agentic.jsx (no cycle).
import React, { useState, useEffect } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { confirmDialog } from './dialogs.jsx';
import {
  TICK_FREQUENCY_OPTIONS,
  estimateDailyCostUsd,
  SEED_FREQUENCY_OPTIONS,
  estimateDailyEvents,
  DEVICE_SEED_FREQUENCY_OPTIONS,
  DEVICE_PROFILE_CATALOG,
  SENSOR_CATEGORIES,
  estimateDailyDeviceEvents,
} from './agentic-data.js';

// K-19: per-org agent tick frequency. Cron itself fires every minute;
// the handler skips orgs whose latest run is younger than this. Lets
// a super admin bump a single workspace to 1-min cadence for a demo
// without paying for every demo org to tick that often.
//
// Unlike the rest of the Agentic page (which auto-persists), this card
// uses a draft → Save flow so a stray click on "Every minute" can't
// silently 15x the workspace's cost. Going to a fast cadence (≤5 min)
// also pops a confirm with the projected daily cost.
export function TickFrequencyCard({ frequencyMin, onChange }) {
  const t = useT();
  const persisted =
    TICK_FREQUENCY_OPTIONS.find((o) => o.value === frequencyMin) || TICK_FREQUENCY_OPTIONS.find((o) => o.value === 15);
  const [draft, setDraft] = useState(persisted.value);
  // Sync draft if the persisted value changes from underneath (e.g. another tab saved).
  useEffect(() => {
    setDraft(persisted.value);
  }, [persisted.value]);

  const draftOpt = TICK_FREQUENCY_OPTIONS.find((o) => o.value === draft) || persisted;
  const draftDailyCost = estimateDailyCostUsd(draftOpt.value);
  const persistedDailyCost = estimateDailyCostUsd(persisted.value);
  const draftIsFast = draftOpt.value > 0 && draftOpt.value <= 5;
  const draftIsSuspended = draftOpt.value === 0;
  const persistedIsSuspended = persisted.value === 0;
  const dirty = draft !== persisted.value;

  const save = async () => {
    if (!dirty) return;
    if (draftIsFast) {
      const ok = await confirmDialog(
        t('agentic.tick.confirm_fast', {
          label: draftOpt.label.toLowerCase(),
          cost: draftDailyCost.toFixed(2),
          prev: persistedDailyCost.toFixed(2),
          prevLabel: persisted.label.toLowerCase(),
        }),
      );
      if (!ok) return;
    }
    if (draftIsSuspended) {
      const ok = await confirmDialog(
        t('agentic.tick.confirm_suspend', {
          prev: persistedDailyCost.toFixed(2),
          prevLabel: persisted.label.toLowerCase(),
        }),
      );
      if (!ok) return;
    }
    onChange(draft);
  };

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Icon.bolt size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('agentic.tick_frequency')}</div>
        <Pill tone={persistedIsSuspended ? 'off' : persisted.value <= 5 ? 'warn' : 'accent'}>
          {persistedIsSuspended
            ? t('agentic.tick.live_suspended')
            : t('agentic.tick.live', { label: persisted.label.toLowerCase() })}
        </Pill>
        {dirty && <Pill tone="info">{t('agentic.tick.pending', { label: draftOpt.label.toLowerCase() })}</Pill>}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('agentic.tick.header_hint')}</div>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
          {TICK_FREQUENCY_OPTIONS.map((opt) => {
            const isDraft = opt.value === draft;
            const isPersisted = opt.value === persisted.value;
            return (
              <button
                key={opt.value}
                onClick={() => setDraft(opt.value)}
                style={{
                  padding: '8px 10px',
                  textAlign: 'left',
                  background: isDraft ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: isDraft ? 'var(--accent)' : 'var(--text-soft)',
                  border: `1px solid ${isDraft ? 'var(--accent-line)' : 'var(--border)'}`,
                  borderRadius: 7,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {opt.label}
                  {isPersisted && !isDraft && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'var(--text-dim)',
                        letterSpacing: 0.1,
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('agentic.tick.live_chip')}
                    </span>
                  )}
                </span>
                <span
                  style={{ fontSize: 10.5, color: isDraft ? 'var(--accent)' : 'var(--text-dim)', lineHeight: 1.35 }}
                >
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>

        {(() => {
          const tone = draftIsSuspended ? 'off' : draftIsFast ? 'warn' : 'accent';
          const toneVar = tone === 'off' ? 'var(--text-dim)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)';
          const bg =
            tone === 'off'
              ? 'var(--surface-2)'
              : tone === 'warn'
                ? 'color-mix(in oklch, var(--warn) 8%, var(--surface))'
                : 'var(--surface-2)';
          const border = tone === 'warn' ? 'color-mix(in oklch, var(--warn) 30%, transparent)' : 'var(--border)';
          return (
            <div
              style={{
                padding: '10px 12px',
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 7,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Icon.bolt size={13} style={{ color: toneVar, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 11.5, color: 'var(--text-soft)', lineHeight: 1.5 }}>
                {draftIsSuspended ? (
                  <>
                    <b style={{ color: 'var(--text)' }}>{t('agentic.tick.preview_suspended')}</b>
                    {t('agentic.tick.preview_suspended_tail')}
                  </>
                ) : (
                  <>
                    <b style={{ color: 'var(--text)' }}>
                      {t('agentic.tick.preview_active', { cost: draftDailyCost.toFixed(2) })}
                    </b>
                    {t('agentic.tick.preview_active_at', { label: draftOpt.label.toLowerCase() })}
                    {draftIsFast ? t('agentic.tick.preview_fast') : t('agentic.tick.preview_cheap')}
                  </>
                )}
                {dirty && (
                  <span style={{ display: 'block', marginTop: 4, color: 'var(--text-dim)' }}>
                    {persistedIsSuspended
                      ? t('agentic.tick.preview_dirty_suspended', { cost: persistedDailyCost.toFixed(2) })
                      : t('agentic.tick.preview_dirty_active', {
                          label: persisted.label.toLowerCase(),
                          cost: persistedDailyCost.toFixed(2),
                        })}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {dirty && (
            <button
              onClick={() => setDraft(persisted.value)}
              style={{
                padding: '7px 14px',
                background: 'transparent',
                color: 'var(--text-soft)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('agentic.btn.discard')}
            </button>
          )}
          <button
            onClick={save}
            disabled={!dirty}
            style={{
              padding: '7px 14px',
              background: !dirty
                ? 'var(--surface-2)'
                : draftIsSuspended
                  ? 'var(--text-dim)'
                  : draftIsFast
                    ? 'var(--warn)'
                    : 'var(--accent)',
              color: !dirty ? 'var(--text-dim)' : '#fff',
              border: !dirty ? '1px solid var(--border)' : 'none',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              cursor: dirty ? 'pointer' : 'default',
              opacity: !dirty ? 0.7 : 1,
            }}
            title={!dirty ? t('agentic.btn.save_disabled_title') : ''}
          >
            {!dirty
              ? persistedIsSuspended
                ? t('agentic.btn.saved_suspended')
                : t('agentic.btn.saved_label', { label: persisted.label.toLowerCase() })
              : draftIsSuspended
                ? t('agentic.btn.save_suspend_agents')
                : t('agentic.btn.save_cost', { cost: draftDailyCost.toFixed(2) })}
          </button>
        </div>
      </div>
    </Card>
  );
}

// K-20: per-org Data simulator frequency. Mirrors TickFrequencyCard's
// draft → Save UX, but the headline metric is events/day (synthetic
// incidents written into incident_actions for agents to react to)
// rather than $/day, since seed-signal itself has near-zero direct
// cost. Suspended setting stops all synthetic events.
export function SeedFrequencyCard({ frequencyMin, onChange }) {
  const t = useT();
  const persisted =
    SEED_FREQUENCY_OPTIONS.find((o) => o.value === frequencyMin) || SEED_FREQUENCY_OPTIONS.find((o) => o.value === 10);
  const [draft, setDraft] = useState(persisted.value);
  useEffect(() => {
    setDraft(persisted.value);
  }, [persisted.value]);

  const draftOpt = SEED_FREQUENCY_OPTIONS.find((o) => o.value === draft) || persisted;
  const draftEvents = estimateDailyEvents(draftOpt.value);
  const persistedEvents = estimateDailyEvents(persisted.value);
  const draftIsFirehose = draftOpt.value > 0 && draftOpt.value <= 2;
  const draftIsSuspended = draftOpt.value === 0;
  const persistedIsSuspended = persisted.value === 0;
  const dirty = draft !== persisted.value;

  const save = async () => {
    if (!dirty) return;
    if (draftIsFirehose) {
      const ok = await confirmDialog(
        t('agentic.seed.confirm_firehose', {
          label: draftOpt.label.toLowerCase(),
          events: draftEvents,
          prev: persistedEvents,
          prevLabel: persisted.label.toLowerCase(),
        }),
      );
      if (!ok) return;
    }
    if (draftIsSuspended) {
      const ok = await confirmDialog(t('agentic.seed.confirm_suspend'));
      if (!ok) return;
    }
    onChange(draft);
  };

  const headerPillTone = persistedIsSuspended ? 'off' : persisted.value <= 2 ? 'warn' : 'accent';
  const previewTone = draftIsSuspended ? 'off' : draftIsFirehose ? 'warn' : 'accent';
  const previewToneVar =
    previewTone === 'off' ? 'var(--text-dim)' : previewTone === 'warn' ? 'var(--warn)' : 'var(--accent)';
  const previewBg = previewTone === 'warn' ? 'color-mix(in oklch, var(--warn) 8%, var(--surface))' : 'var(--surface-2)';
  const previewBorder = previewTone === 'warn' ? 'color-mix(in oklch, var(--warn) 30%, transparent)' : 'var(--border)';

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Icon.gateway size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('agentic.data_simulator')}</div>
        <Pill tone={headerPillTone}>
          {persistedIsSuspended
            ? t('agentic.tick.live_suspended')
            : t('agentic.tick.live', { label: persisted.label.toLowerCase() })}
        </Pill>
        {dirty && <Pill tone="info">{t('agentic.tick.pending', { label: draftOpt.label.toLowerCase() })}</Pill>}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('agentic.seed.header_hint')}</div>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
          {SEED_FREQUENCY_OPTIONS.map((opt) => {
            const isDraft = opt.value === draft;
            const isPersisted = opt.value === persisted.value;
            return (
              <button
                key={opt.value}
                onClick={() => setDraft(opt.value)}
                style={{
                  padding: '8px 10px',
                  textAlign: 'left',
                  background: isDraft ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: isDraft ? 'var(--accent)' : 'var(--text-soft)',
                  border: `1px solid ${isDraft ? 'var(--accent-line)' : 'var(--border)'}`,
                  borderRadius: 7,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {opt.label}
                  {isPersisted && !isDraft && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'var(--text-dim)',
                        letterSpacing: 0.1,
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('agentic.tick.live_chip')}
                    </span>
                  )}
                </span>
                <span
                  style={{ fontSize: 10.5, color: isDraft ? 'var(--accent)' : 'var(--text-dim)', lineHeight: 1.35 }}
                >
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            padding: '10px 12px',
            background: previewBg,
            border: `1px solid ${previewBorder}`,
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Icon.gateway size={13} style={{ color: previewToneVar, flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 11.5, color: 'var(--text-soft)', lineHeight: 1.5 }}>
            {draftIsSuspended ? (
              <>
                <b style={{ color: 'var(--text)' }}>{t('agentic.seed.preview_suspended')}</b>
                {t('agentic.seed.preview_suspended_tail')}
              </>
            ) : (
              <>
                <b style={{ color: 'var(--text)' }}>{t('agentic.seed.preview_active', { events: draftEvents })}</b>
                {t('agentic.seed.preview_active_at', { label: draftOpt.label.toLowerCase() })}
                {draftIsFirehose ? t('agentic.seed.preview_firehose') : t('agentic.seed.preview_normal')}
              </>
            )}
            {dirty && (
              <span style={{ display: 'block', marginTop: 4, color: 'var(--text-dim)' }}>
                {persistedIsSuspended
                  ? t('agentic.seed.preview_dirty_suspended', { events: persistedEvents })
                  : t('agentic.seed.preview_dirty', { label: persisted.label.toLowerCase(), events: persistedEvents })}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {dirty && (
            <button
              onClick={() => setDraft(persisted.value)}
              style={{
                padding: '7px 14px',
                background: 'transparent',
                color: 'var(--text-soft)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('agentic.btn.discard')}
            </button>
          )}
          <button
            onClick={save}
            disabled={!dirty}
            style={{
              padding: '7px 14px',
              background: !dirty
                ? 'var(--surface-2)'
                : draftIsSuspended
                  ? 'var(--text-dim)'
                  : draftIsFirehose
                    ? 'var(--warn)'
                    : 'var(--accent)',
              color: !dirty ? 'var(--text-dim)' : '#fff',
              border: !dirty ? '1px solid var(--border)' : 'none',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              cursor: dirty ? 'pointer' : 'default',
              opacity: !dirty ? 0.7 : 1,
            }}
            title={!dirty ? t('agentic.btn.save_disabled_title') : ''}
          >
            {!dirty
              ? persistedIsSuspended
                ? t('agentic.btn.saved_suspended')
                : t('agentic.btn.saved_label', { label: persisted.label.toLowerCase() })
              : draftIsSuspended
                ? t('agentic.btn.save_suspend_sim')
                : t('agentic.btn.save_events', { events: draftEvents })}
          </button>
        </div>
      </div>
    </Card>
  );
}

// L-2.7: Device-event simulator card. Two controls in one card:
//   1. Cadence (mirrors SeedFrequencyCard's options + UX)
//   2. Profile multi-select — which device classes the simulator
//      emits active events for. Empty selection = no active events
//      (heartbeats keep firing fleet-wide regardless).
//
// Persists draft state until Save like the other simulator cards so
// a stray click can't accidentally suspend the simulator or flood the
// firehose. Suspended + firehose cadences pop a confirm dialog.
export function DeviceSeedSimulatorCard({ frequencyMin, profileIds, onChange }) {
  const t = useT();
  const persistedFreq =
    DEVICE_SEED_FREQUENCY_OPTIONS.find((o) => o.value === frequencyMin) ||
    DEVICE_SEED_FREQUENCY_OPTIONS.find((o) => o.value === 5);
  // null in storage means "all enabled"; the UI represents that as
  // every catalog id selected so the user sees what's actually firing.
  const persistedProfiles = profileIds == null ? DEVICE_PROFILE_CATALOG.map((p) => p.id) : profileIds;

  const [draftFreq, setDraftFreq] = useState(persistedFreq.value);
  const [draftProfiles, setDraftProfiles] = useState(persistedProfiles);
  useEffect(() => {
    setDraftFreq(persistedFreq.value);
  }, [persistedFreq.value]);
  useEffect(() => {
    setDraftProfiles(persistedProfiles);
  }, [profileIds]);

  const draftFreqOpt = DEVICE_SEED_FREQUENCY_OPTIONS.find((o) => o.value === draftFreq) || persistedFreq;
  const draftEvents = estimateDailyDeviceEvents(draftFreqOpt.value);
  const persistedEvents = estimateDailyDeviceEvents(persistedFreq.value);
  const draftIsFirehose = draftFreqOpt.value > 0 && draftFreqOpt.value <= 2;
  const draftIsSuspended = draftFreqOpt.value === 0 || draftProfiles.length === 0;
  const persistedIsSuspended = persistedFreq.value === 0 || persistedProfiles.length === 0;

  // Profile selection is dirty if the SET differs (order-independent).
  const profilesDirty = (() => {
    if (draftProfiles.length !== persistedProfiles.length) return true;
    const a = new Set(draftProfiles);
    return persistedProfiles.some((id) => !a.has(id));
  })();
  const dirty = draftFreq !== persistedFreq.value || profilesDirty;

  const toggleProfile = (id) => {
    setDraftProfiles((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const save = async () => {
    if (!dirty) return;
    if (draftIsFirehose) {
      const ok = await confirmDialog(
        t('agentic.dev.confirm_firehose', {
          label: draftFreqOpt.label.toLowerCase(),
          events: draftEvents,
          prev: persistedEvents,
          prevLabel: persistedFreq.label.toLowerCase(),
        }),
      );
      if (!ok) return;
    }
    if (draftIsSuspended && !persistedIsSuspended) {
      const ok = await confirmDialog(t('agentic.dev.confirm_suspend'));
      if (!ok) return;
    }
    // Save: convert "all selected" back to null so the storage stays
    // forward-compatible — adding a future profile auto-enables it on
    // workspaces that have the implicit-all setting.
    const allSelected =
      draftProfiles.length === DEVICE_PROFILE_CATALOG.length &&
      DEVICE_PROFILE_CATALOG.every((p) => draftProfiles.includes(p.id));
    onChange({
      frequency_min: draftFreq,
      profile_ids: allSelected ? null : draftProfiles.slice(),
    });
  };

  const headerPillTone = persistedIsSuspended ? 'off' : persistedFreq.value <= 2 ? 'warn' : 'accent';
  const previewTone = draftIsSuspended ? 'off' : draftIsFirehose ? 'warn' : 'accent';
  const previewBg = previewTone === 'warn' ? 'color-mix(in oklch, var(--warn) 8%, var(--surface))' : 'var(--surface-2)';
  const previewBorder = previewTone === 'warn' ? 'color-mix(in oklch, var(--warn) 30%, transparent)' : 'var(--border)';
  const previewToneVar =
    previewTone === 'off' ? 'var(--text-dim)' : previewTone === 'warn' ? 'var(--warn)' : 'var(--accent)';

  const headerPillLabel = persistedIsSuspended
    ? t('agentic.tick.live_suspended')
    : persistedProfiles.length === 1
      ? t('agentic.dev.live_with_profile', { label: persistedFreq.label.toLowerCase(), n: persistedProfiles.length })
      : t('agentic.dev.live_with_profiles', { label: persistedFreq.label.toLowerCase(), n: persistedProfiles.length });

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Icon.display size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('agentic.device_simulator')}</div>
        <Pill tone={headerPillTone}>{headerPillLabel}</Pill>
        {dirty && <Pill tone="info">{t('agentic.pending')}</Pill>}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('agentic.dev.header_hint')}</div>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Profile multi-select grouped by sensor category */}
        <div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.12,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              marginBottom: 6,
            }}
          >
            {t('agentic.dev.active_profiles')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SENSOR_CATEGORIES.map((cat) => {
              const profilesInCat = DEVICE_PROFILE_CATALOG.filter((p) => p.category === cat.id);
              if (!profilesInCat.length) return null;
              return (
                <div key={cat.id}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.18,
                      textTransform: 'uppercase',
                      color: 'var(--text-dim)',
                      marginBottom: 4,
                      paddingLeft: 2,
                    }}
                  >
                    {cat.label}
                  </div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}
                  >
                    {profilesInCat.map((p) => {
                      const enabled = draftProfiles.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleProfile(p.id)}
                          style={{
                            padding: '8px 10px',
                            textAlign: 'left',
                            background: enabled ? 'var(--accent-soft)' : 'var(--surface-2)',
                            color: enabled ? 'var(--accent)' : 'var(--text-soft)',
                            border: `1px solid ${enabled ? 'var(--accent-line)' : 'var(--border)'}`,
                            borderRadius: 7,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 3,
                              flexShrink: 0,
                              border: `1.5px solid ${enabled ? 'var(--accent)' : 'var(--border-strong)'}`,
                              background: enabled ? 'var(--accent)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {enabled && <Icon.check size={9} style={{ color: '#fff' }} />}
                          </span>
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {draftProfiles.length === 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--warn)' }}>{t('agentic.dev.no_profiles')}</div>
          )}
        </div>

        {/* Cadence picker */}
        <div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.12,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              marginBottom: 6,
            }}
          >
            {t('agentic.dev.cadence')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
            {DEVICE_SEED_FREQUENCY_OPTIONS.map((opt) => {
              const isDraft = opt.value === draftFreq;
              const isPersisted = opt.value === persistedFreq.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setDraftFreq(opt.value)}
                  style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    background: isDraft ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: isDraft ? 'var(--accent)' : 'var(--text-soft)',
                    border: `1px solid ${isDraft ? 'var(--accent-line)' : 'var(--border)'}`,
                    borderRadius: 7,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {opt.label}
                    {isPersisted && !isDraft && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: 'var(--text-dim)',
                          letterSpacing: 0.1,
                          textTransform: 'uppercase',
                        }}
                      >
                        {t('agentic.tick.live_chip')}
                      </span>
                    )}
                  </span>
                  <span
                    style={{ fontSize: 10.5, color: isDraft ? 'var(--accent)' : 'var(--text-dim)', lineHeight: 1.35 }}
                  >
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview + save */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: previewBg,
            border: `1px solid ${previewBorder}`,
            fontSize: 12,
            color: 'var(--text-soft)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Dot
            tone={previewTone === 'warn' ? 'warn' : previewTone === 'off' ? 'off' : 'accent'}
            pulse={!draftIsSuspended}
          />
          <div style={{ flex: 1 }}>
            {draftIsSuspended ? (
              <>
                {t('agentic.dev.preview_idle_pre')}
                <b style={{ color: previewToneVar }}>{t('agentic.dev.preview_idle_bold')}</b>
                {t('agentic.dev.preview_idle_post')}
              </>
            ) : (
              <>
                {t('agentic.dev.preview_will_emit_pre')}
                <b style={{ color: previewToneVar }}>{draftEvents}</b>
                {t('agentic.dev.preview_will_emit_mid_one')}
                <b>{draftProfiles.length}</b>
                {draftProfiles.length === 1
                  ? t('agentic.dev.preview_will_emit_one_profile')
                  : t('agentic.dev.preview_will_emit_many_profiles')}
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {dirty && (
            <button
              onClick={() => {
                setDraftFreq(persistedFreq.value);
                setDraftProfiles(persistedProfiles);
              }}
              style={{
                padding: '7px 14px',
                background: 'transparent',
                color: 'var(--text-soft)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('agentic.btn.discard')}
            </button>
          )}
          <button
            onClick={save}
            disabled={!dirty}
            style={{
              padding: '7px 14px',
              background: !dirty
                ? 'var(--surface-2)'
                : draftIsSuspended
                  ? 'var(--text-dim)'
                  : draftIsFirehose
                    ? 'var(--warn)'
                    : 'var(--accent)',
              color: !dirty ? 'var(--text-dim)' : '#fff',
              border: !dirty ? '1px solid var(--border)' : 'none',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              cursor: dirty ? 'pointer' : 'default',
              opacity: !dirty ? 0.7 : 1,
            }}
            title={!dirty ? t('agentic.btn.save_disabled_title_dev') : ''}
          >
            {!dirty
              ? persistedIsSuspended
                ? t('agentic.btn.saved_suspended')
                : t('agentic.dev.saved_with_profiles', {
                    label: persistedFreq.label.toLowerCase(),
                    n: persistedProfiles.length,
                  })
              : draftIsSuspended
                ? t('agentic.btn.save_suspend_sim')
                : t('agentic.btn.save_events', { events: draftEvents })}
          </button>
        </div>
      </div>
    </Card>
  );
}
