// Per-widget settings — the shared settings hook + UI primitives + the
// per-widget settings panels. Extracted from MetricsWidgets.jsx (2026-06-05)
// to break up a 2.5k-line file and give the widget files a clean leaf
// dependency (nothing here imports MetricsWidgets, so no cycle). Re-exported
// by MetricsWidgets so Dashboard / MetricsLayout import sites are unchanged.

import React, { useEffect, useReducer } from 'react';
import { Card } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import {
  getSettings as readWidgetSettings,
  setSettings as writeWidgetSettings,
  subscribe as subscribeWidgetSettings,
} from './widget-settings-store.js';

// ─────────────────────────────────────────────────────────────────
// Per-widget settings
// ─────────────────────────────────────────────────────────────────

// Hook every widget can call to read + write its own settings JSON.
// Re-renders when this widget's settings change (any source — same
// tab, future cross-tab via storage event, or programmatic).
export function useWidgetSettings(widgetId, defaults = {}) {
  const session = useSession();
  const userId = session?.userId;
  const orgId = session?.organizationId;
  const [, bump] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    const off = subscribeWidgetSettings(({ userId: u, orgId: o, widgetId: w }) => {
      if (u === userId && o === orgId && w === widgetId) bump();
    });
    return off;
  }, [userId, orgId, widgetId]);
  const stored = readWidgetSettings(userId, orgId, widgetId) || {};
  const settings = { ...defaults, ...stored };
  const update = (patch) => {
    writeWidgetSettings(userId, orgId, widgetId, { ...settings, ...patch });
  };
  return [settings, update];
}

// Shared layout + visual primitives for the back face of a widget.
// SettingsBack: header with title + a body slot. Cards are absolutely
// positioned inside the FlipCard (back face) and fill the cell.
export function SettingsBack({ title, children }) {
  const t = useT();
  return (
    <Card
      pad={false}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <Icon.cog size={13} style={{ color: 'var(--accent)' }} />
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title || t('widget.settings.title')}
        </div>
      </div>
      <div style={{ padding: '12px 14px', overflowY: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
    </Card>
  );
}

export function SettingsRow({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.12,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export function SettingsSeg({ value, onChange, options }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 3,
        background: 'var(--surface-2)',
        borderRadius: 7,
        border: '1px solid var(--border)',
      }}
    >
      {options.map(([v, l]) => {
        const active = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              background: active ? 'var(--accent-soft)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-dim)',
              border: active ? '1px solid var(--accent-line)' : '1px solid transparent',
              borderRadius: 5,
              cursor: 'pointer',
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

// Generic placeholder for widgets that don't have settings yet.
export function NoSettingsPanel() {
  const t = useT();
  return (
    <SettingsBack>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>{t('widget.settings.none')}</div>
    </SettingsBack>
  );
}

// ─────────────────────────────────────────────────────────────────
// Per-widget Settings panels
// ─────────────────────────────────────────────────────────────────

export function GradientAreaSettings() {
  const t = useT();
  const [settings, update] = useWidgetSettings('gradient-area', { days: 14 });
  return (
    <SettingsBack title={t('widget.cat.area.label')}>
      <SettingsRow label={t('widget.settings.timeframe')}>
        <SettingsSeg
          value={settings.days}
          onChange={(v) => update({ days: v })}
          options={[
            [7, '7d'],
            [14, '14d'],
            [30, '30d'],
            [90, '90d'],
          ]}
        />
      </SettingsRow>
      <SettingsRow label={t('widget.settings.critical_overlay')}>
        <SettingsSeg
          value={settings.showCritical !== false ? 'on' : 'off'}
          onChange={(v) => update({ showCritical: v === 'on' })}
          options={[
            ['on', t('widget.settings.on')],
            ['off', t('widget.settings.off')],
          ]}
        />
      </SettingsRow>
    </SettingsBack>
  );
}

export function LiveStreamSettings() {
  const t = useT();
  const [settings, update] = useWidgetSettings('live-stream', { cap: 100, source: 'all' });
  return (
    <SettingsBack title={t('widget.cat.stream.label')}>
      <SettingsRow label={t('widget.settings.row_cap')}>
        <SettingsSeg
          value={settings.cap}
          onChange={(v) => update({ cap: v })}
          options={[
            [20, '20'],
            [50, '50'],
            [100, '100'],
            [200, '200'],
          ]}
        />
      </SettingsRow>
      <SettingsRow label={t('widget.settings.source_filter')}>
        <SettingsSeg
          value={settings.source}
          onChange={(v) => update({ source: v })}
          options={[
            ['all', t('widget.settings.all')],
            ['Sensor', 'Sensor'],
            ['Operator', 'Operator'],
            ['System', 'System'],
            ['Simulator', 'Simulator'],
          ]}
        />
      </SettingsRow>
    </SettingsBack>
  );
}

export function WeatherSettings() {
  const t = useT();
  const [settings, update] = useWidgetSettings('weather', { units: 'celsius' });
  return (
    <SettingsBack title={t('widget.cat.weather.label')}>
      <SettingsRow label={t('widget.settings.units')}>
        <SettingsSeg
          value={settings.units}
          onChange={(v) => update({ units: v })}
          options={[
            ['celsius', '°C'],
            ['fahrenheit', '°F'],
          ]}
        />
      </SettingsRow>
    </SettingsBack>
  );
}
