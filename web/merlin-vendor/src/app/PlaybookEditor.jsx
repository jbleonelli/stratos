// Playbook editor — modal for configuring a single agent's playbook.
// Three tabs: Steps (trigger → action rules), Responses (message templates),
// Guardrails (quiet hours + excluded zones + rate cap). State is drafted in
// local React state and only written to the Agentic config on Save.
import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot } from './primitives.jsx';
import { ACTION_CATALOG, STEP_AUTONOMY, DATA_SOURCE_STATUSES, resolveDataSource } from './agentic-data.js';
import { useT } from './i18n.js';
import { promptDialog } from './dialogs.jsx';

const TABS = [
  { id: 'steps', labelKey: 'playbook.tab.steps', icon: 'sla' },
  { id: 'responses', labelKey: 'playbook.tab.responses', icon: 'chat' },
  { id: 'guardrails', labelKey: 'playbook.tab.guardrails', icon: 'shield' },
];

export function PlaybookEditor({ agentId, meta, cfg, allSources, onSave, onAddTrigger, onClose }) {
  const t = useT();
  const [tab, setTab] = useState('steps');
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(cfg.playbook)));
  const actions = ACTION_CATALOG[agentId] || [];
  const triggers = cfg.triggers || [];
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(cfg.playbook), [draft, cfg.playbook]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const IconC = Icon[cfg.icon] || Icon.sparkle;
  const save = () => {
    onSave(draft);
    onClose();
  };
  const revert = () => setDraft(JSON.parse(JSON.stringify(cfg.playbook)));

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'color-mix(in oklch, var(--surface) 40%, rgba(0,0,0,0.5))',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 780,
          maxHeight: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              flexShrink: 0,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconC size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 0.12,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              {t('playbook.eyebrow')}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{meta?.name || agentId}</div>
          </div>
          {dirty && <Pill tone="warn">{t('playbook.unsaved_changes')}</Pill>}
          <button
            onClick={onClose}
            title={t('action.close')}
            style={{
              width: 30,
              height: 30,
              padding: 0,
              background: 'transparent',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon.close size={12} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: '8px 12px 0',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
          }}
        >
          {TABS.map((x) => {
            const IconT = Icon[x.icon] || Icon.sparkle;
            const active = tab === x.id;
            return (
              <button
                key={x.id}
                onClick={() => setTab(x.id)}
                style={{
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  border: '1px solid',
                  borderColor: active ? 'var(--border)' : 'transparent',
                  borderBottomColor: active ? 'var(--surface)' : 'transparent',
                  borderRadius: '7px 7px 0 0',
                  marginBottom: -1,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <IconT size={11} />
                {t(x.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
          {tab === 'steps' && (
            <StepsTab
              draft={draft}
              setDraft={setDraft}
              triggers={triggers}
              actions={actions}
              agentSources={cfg.dataSources || []}
              allSources={allSources}
              onAddTrigger={onAddTrigger}
            />
          )}
          {tab === 'responses' && <ResponsesTab draft={draft} setDraft={setDraft} />}
          {tab === 'guardrails' && <GuardrailsTab draft={draft} setDraft={setDraft} />}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('playbook.save_note')}</div>
          <div style={{ flex: 1 }} />
          <button
            onClick={revert}
            disabled={!dirty}
            style={{
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              color: dirty ? 'var(--text-soft)' : 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              cursor: dirty ? 'pointer' : 'not-allowed',
            }}
          >
            {t('settings.profile.revert')}
          </button>
          <button
            onClick={save}
            disabled={!dirty}
            style={{
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              background: dirty ? 'var(--accent)' : 'var(--surface-3)',
              color: dirty ? '#fff' : 'var(--text-dim)',
              border: 'none',
              borderRadius: 7,
              cursor: dirty ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon.check size={11} /> {t('playbook.btn.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Steps tab ───────────────────────────

function StepsTab({ draft, setDraft, triggers, actions, agentSources, allSources, onAddTrigger }) {
  const t = useT();
  const addStep = () => {
    const id = `s-${Date.now()}`;
    setDraft({
      ...draft,
      steps: [
        ...draft.steps,
        {
          id,
          trigger: triggers[0] || '',
          condition: '',
          action: actions[0]?.id || '',
          autonomy: 'inherit',
          sources: [],
        },
      ],
    });
  };
  const updateStep = (id, patch) =>
    setDraft({
      ...draft,
      steps: draft.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  const handleTriggerChange = async (stepId, value) => {
    if (value === '__new__') {
      const name = ((await promptDialog(t('playbook.steps.new_trigger_prompt'))) || '').trim();
      if (!name) return;
      onAddTrigger?.(name);
      updateStep(stepId, { trigger: name });
      return;
    }
    updateStep(stepId, { trigger: value });
  };
  const removeStep = (id) =>
    setDraft({
      ...draft,
      steps: draft.steps.filter((s) => s.id !== id),
    });
  const moveStep = (id, dir) => {
    const i = draft.steps.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= draft.steps.length) return;
    const next = draft.steps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setDraft({ ...draft, steps: next });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {t('playbook.steps.intro_pre')}
        <b style={{ color: 'var(--text-soft)' }}>{t('playbook.steps.intro_trigger')}</b>
        {t('playbook.steps.intro_mid')}
        <b style={{ color: 'var(--text-soft)' }}>{t('playbook.steps.intro_condition')}</b>
        {t('playbook.steps.intro_runs')}
        <b style={{ color: 'var(--text-soft)' }}>{t('playbook.steps.intro_action')}</b>
        {t('playbook.steps.intro_post')}
      </div>

      {draft.steps.map((s, i) => (
        <div
          key={s.id}
          style={{
            padding: 12,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {i + 1}
            </span>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-soft)' }}>
              {t('playbook.steps.step_n', { n: i + 1 })}
            </div>
            <div style={{ flex: 1 }} />
            <IconButton title={t('playbook.steps.move_up')} disabled={i === 0} onClick={() => moveStep(s.id, -1)}>
              <Icon.chevD size={11} style={{ transform: 'rotate(180deg)' }} />
            </IconButton>
            <IconButton
              title={t('playbook.steps.move_down')}
              disabled={i === draft.steps.length - 1}
              onClick={() => moveStep(s.id, +1)}
            >
              <Icon.chevD size={11} />
            </IconButton>
            <IconButton title={t('playbook.steps.delete')} onClick={() => removeStep(s.id)}>
              <Icon.close size={11} />
            </IconButton>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label={t('playbook.steps.field.trigger')}>
              <select value={s.trigger} onChange={(e) => handleTriggerChange(s.id, e.target.value)} style={selectStyle}>
                {!triggers.includes(s.trigger) && s.trigger && <option value={s.trigger}>{s.trigger}</option>}
                {triggers.map((trig) => (
                  <option key={trig} value={trig}>
                    {trig}
                  </option>
                ))}
                <option disabled>────────</option>
                <option value="__new__">{t('playbook.steps.new_trigger')}</option>
              </select>
            </Field>
            <Field label={t('playbook.steps.field.action')}>
              <select
                value={s.action}
                onChange={(e) => updateStep(s.id, { action: e.target.value })}
                style={selectStyle}
              >
                {actions.find((a) => a.id === s.action)
                  ? null
                  : s.action && <option value={s.action}>{s.action}</option>}
                {actions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t('playbook.steps.field.condition')}>
            <input
              value={s.condition}
              onChange={(e) => updateStep(s.id, { condition: e.target.value })}
              placeholder={t('playbook.steps.field.condition_ph')}
              style={selectStyle}
            />
          </Field>

          <Field label={t('playbook.steps.field.autonomy')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {STEP_AUTONOMY.map((a) => (
                <button
                  key={a.id}
                  onClick={() => updateStep(s.id, { autonomy: a.id })}
                  style={{
                    padding: '6px 0',
                    fontSize: 10.5,
                    fontWeight: 600,
                    background: s.autonomy === a.id ? 'var(--accent-soft)' : 'var(--surface)',
                    color: s.autonomy === a.id ? 'var(--accent)' : 'var(--text-dim)',
                    border: `1px solid ${s.autonomy === a.id ? 'var(--accent-line)' : 'var(--border)'}`,
                    borderRadius: 5,
                    cursor: 'pointer',
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </Field>

          <StepSources
            sources={s.sources || []}
            agentSources={agentSources}
            allSources={allSources}
            onChange={(next) => updateStep(s.id, { sources: next })}
          />
        </div>
      ))}

      <button
        onClick={addStep}
        style={{
          padding: '10px 12px',
          background: 'var(--surface-2)',
          color: 'var(--accent)',
          border: '1px dashed var(--accent-line)',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Icon.plus size={11} /> {t('playbook.steps.add')}
      </button>
    </div>
  );
}

function StepSources({ sources, agentSources, allSources, onChange }) {
  const t = useT();
  const resolve = (ref) => resolveDataSource({ dataSources: allSources || {} }, ref);
  const linkedSet = new Set(sources);
  const unlinked = agentSources.filter((ref) => !linkedSet.has(ref)).map(resolve);
  const unlink = (ref) => onChange(sources.filter((r) => r !== ref));
  const link = (ref) => onChange([...sources, ref]);
  const fallbackHint =
    sources.length === 0 ? (
      <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>
        {t('playbook.steps.fallback_hint')}
      </span>
    ) : null;

  return (
    <Field label={t('playbook.steps.field.reads_from')}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {sources.map((ref) => {
          const src = resolve(ref);
          const tone = (DATA_SOURCE_STATUSES.find((x) => x.id === src.status) || DATA_SOURCE_STATUSES[0]).tone;
          return (
            <span
              key={ref}
              title={src.description || src.name}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 4px 3px 8px',
                fontSize: 10.5,
                fontWeight: 600,
                background: 'color-mix(in oklch, var(--accent) 8%, var(--surface))',
                color: 'var(--accent)',
                border: '1px solid var(--accent-line)',
                borderRadius: 4,
              }}
            >
              <Dot tone={tone} size={5} />
              {src.name}
              <button
                onClick={() => unlink(ref)}
                title={t('playbook.steps.unlink')}
                style={{
                  width: 14,
                  height: 14,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--accent)',
                  borderRadius: 3,
                  cursor: 'pointer',
                  opacity: 0.7,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon.close size={9} />
              </button>
            </span>
          );
        })}
        {unlinked.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && link(e.target.value)}
            style={{
              padding: '3px 6px',
              fontSize: 10.5,
              fontWeight: 600,
              background: 'var(--surface-2)',
              color: 'var(--accent)',
              border: '1px dashed var(--accent-line)',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              outline: 'none',
            }}
          >
            <option value="">{t('playbook.steps.link_source')}</option>
            {unlinked.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        {fallbackHint}
      </div>
    </Field>
  );
}

// ─────────────────────────── Responses tab ───────────────────────────

function ResponsesTab({ draft, setDraft }) {
  const t = useT();
  const set = (key, value) => setDraft({ ...draft, responses: { ...draft.responses, [key]: value } });
  const FIELDS = [
    { key: 'acting', label: t('playbook.responses.acting.label'), desc: t('playbook.responses.acting.desc') },
    { key: 'proposing', label: t('playbook.responses.proposing.label'), desc: t('playbook.responses.proposing.desc') },
    {
      key: 'escalating',
      label: t('playbook.responses.escalating.label'),
      desc: t('playbook.responses.escalating.desc'),
    },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {t('playbook.responses.intro_pre')}
        <code style={codeStyle}>{t('playbook.responses.intro_braces')}</code>
        {t('playbook.responses.intro_mid')}
        <code style={codeStyle}>{t('playbook.responses.var_room')}</code>,{' '}
        <code style={codeStyle}>{t('playbook.responses.var_confidence')}</code>,{' '}
        <code style={codeStyle}>{t('playbook.responses.var_eta')}</code>
        {t('playbook.responses.intro_post')}
      </div>
      {FIELDS.map((f) => (
        <Field key={f.key} label={f.label} desc={f.desc}>
          <textarea
            value={draft.responses[f.key] || ''}
            onChange={(e) => set(f.key, e.target.value)}
            rows={3}
            style={{ ...selectStyle, resize: 'vertical', fontFamily: 'var(--font)', lineHeight: 1.5 }}
          />
        </Field>
      ))}
    </div>
  );
}

// ─────────────────────────── Guardrails tab ───────────────────────────

function GuardrailsTab({ draft, setDraft }) {
  const t = useT();
  const set = (patch) => setDraft({ ...draft, guardrails: { ...draft.guardrails, ...patch } });
  const g = draft.guardrails;
  const [fromH, toH] = g.quietHours;
  const quietEnabled = !(fromH === 0 && toH === 0);

  const addZone = () => set({ excludedZones: [...(g.excludedZones || []), ''] });
  const updateZone = (i, v) => {
    const next = [...(g.excludedZones || [])];
    next[i] = v;
    set({ excludedZones: next });
  };
  const removeZone = (i) => {
    const next = [...(g.excludedZones || [])];
    next.splice(i, 1);
    set({ excludedZones: next });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label={t('playbook.guard.quiet_label')} desc={t('playbook.guard.quiet_desc')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={quietEnabled}
              onChange={(e) => set({ quietHours: e.target.checked ? [22, 6] : [0, 0] })}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span style={{ color: quietEnabled ? 'var(--accent)' : 'var(--text-soft)', fontWeight: 600 }}>
              {t('playbook.guard.enable')}
            </span>
          </label>
          {quietEnabled && (
            <>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('playbook.guard.from')}</span>
              <HourInput value={fromH} onChange={(v) => set({ quietHours: [v, toH] })} />
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('playbook.guard.to')}</span>
              <HourInput value={toH} onChange={(v) => set({ quietHours: [fromH, v] })} />
            </>
          )}
        </div>
      </Field>

      <Field label={t('playbook.guard.zones_label')} desc={t('playbook.guard.zones_desc')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(g.excludedZones || []).map((z, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input
                value={z}
                onChange={(e) => updateZone(i, e.target.value)}
                placeholder={t('playbook.guard.zone_ph')}
                style={{ ...selectStyle, flex: 1 }}
              />
              <IconButton title={t('playbook.guard.zone_remove')} onClick={() => removeZone(i)}>
                <Icon.close size={11} />
              </IconButton>
            </div>
          ))}
          <button
            onClick={addZone}
            style={{
              padding: '8px 10px',
              background: 'var(--surface-2)',
              color: 'var(--accent)',
              border: '1px dashed var(--accent-line)',
              borderRadius: 7,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Icon.plus size={11} /> {t('playbook.guard.zone_add')}
          </button>
        </div>
      </Field>

      <Field label={t('playbook.guard.cap_label')} desc={t('playbook.guard.cap_desc')}>
        <input
          type="number"
          min={1}
          max={120}
          value={g.maxActionsPerHour}
          onChange={(e) => set({ maxActionsPerHour: Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1)) })}
          style={{ ...selectStyle, width: 100, fontFamily: 'var(--mono)' }}
        />
      </Field>
    </div>
  );
}

// ─────────────────────────── atoms ───────────────────────────

function Field({ label, desc, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          letterSpacing: 0.1,
          textTransform: 'uppercase',
          marginBottom: desc ? 3 : 5,
        }}
      >
        {label}
      </div>
      {desc && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.4 }}>{desc}</div>}
      {children}
    </div>
  );
}

function IconButton({ children, onClick, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 26,
        height: 26,
        padding: 0,
        background: 'transparent',
        color: disabled ? 'var(--text-faint)' : 'var(--text-dim)',
        border: '1px solid var(--border)',
        borderRadius: 5,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function HourInput({ value, onChange }) {
  return (
    <input
      type="number"
      min={0}
      max={23}
      value={value}
      onChange={(e) => onChange(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
      style={{ ...selectStyle, width: 60, fontFamily: 'var(--mono)' }}
    />
  );
}

const selectStyle = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 12,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontFamily: 'var(--font)',
  outline: 'none',
};

const codeStyle = {
  padding: '1px 5px',
  fontSize: 10.5,
  fontFamily: 'var(--mono)',
  background: 'var(--surface-2)',
  color: 'var(--accent)',
  border: '1px solid var(--border)',
  borderRadius: 4,
};
