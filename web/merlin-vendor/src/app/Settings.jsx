// Settings — profile, appearance, language.
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { useT, setLanguage, useLanguage } from './i18n.js';
import { useSession, updateProfile, updatePreferences, splitName, initialsOf, uploadProfilePicture } from './auth.js';

const NAV = [
  { id: 'profile', labelKey: 'settings.profile.title', icon: 'people' },
  { id: 'appearance', labelKey: 'settings.appearance', icon: 'sparkle' },
  { id: 'language', labelKey: 'settings.language', icon: 'chat' },
];

export function SettingsPage({ tweaks, onClose }) {
  const t = useT();
  const lang = useLanguage();
  const session = useSession();
  const [section, setSection] = useState(() => {
    try {
      return localStorage.getItem('merlinSettingsSection') || 'profile';
    } catch {
      return 'profile';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('merlinSettingsSection', section);
    } catch {}
  }, [section]);

  // Tweak setter that ALSO persists to the current user's preferences
  // so the next login lands in the same appearance.
  const setTweak = (edits) => {
    try {
      window.setMerlinTweaks?.(edits);
    } catch {}
    try {
      if (session) updatePreferences(edits);
    } catch {}
  };
  const setLang = (lng) => {
    setLanguage(lng);
    try {
      if (session) updatePreferences({ language: lng });
    } catch {}
  };

  const resetDefaults = () => {
    const defaults = { theme: 'light', accent: 'pink', density: 'comfortable', sidebar: 'wide', variant: 'bold' };
    setTweak(defaults);
    setLang('en');
  };

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
          onClick={onClose}
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
          <Icon.chevR size={9} style={{ transform: 'rotate(180deg)' }} /> {t('action.back')}
        </button>
      </div>

      {/* Hero */}
      <Card pad={false} style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ padding: 'var(--pad)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              {t('settings.title')}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.01, color: 'var(--text)' }}>
            {t('settings.title')}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 640 }}>
            {t('settings.subtitle')}
          </p>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--pad)', maxWidth: 980 }}>
        {/* Nav rail */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((n) => (
            <NavItem
              key={n.id}
              icon={n.icon}
              label={t(n.labelKey)}
              active={section === n.id}
              onClick={() => setSection(n.id)}
            />
          ))}
        </nav>

        {/* Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
          {section === 'profile' && <ProfileCard session={session} />}

          {section === 'appearance' && (
            <Card>
              <SectionHead icon="sparkle" title={t('settings.appearance')} />
              <Setting label={t('settings.theme')}>
                <Seg
                  value={tweaks.theme}
                  onChange={(v) => setTweak({ theme: v })}
                  options={[
                    ['light', t('settings.theme.light')],
                    ['dark', t('settings.theme.dark')],
                  ]}
                />
              </Setting>
              <Setting label={t('settings.accent')}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { id: 'pink', hex: '#FF00B2' },
                    { id: 'indigo', hex: '#20286D' },
                    { id: 'blue', hex: '#2185D0' },
                  ].map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setTweak({ accent: a.id })}
                      title={t(`settings.accent.${a.id}`)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        background: a.hex,
                        boxShadow:
                          tweaks.accent === a.id
                            ? `0 0 0 2px var(--surface), 0 0 0 4px ${a.hex}`
                            : '0 0 0 1px color-mix(in oklch, var(--border-strong) 70%, transparent)',
                        transition: 'box-shadow .12s',
                      }}
                    />
                  ))}
                </div>
              </Setting>
              <Setting label={t('settings.density')}>
                <Seg
                  value={tweaks.density}
                  onChange={(v) => setTweak({ density: v })}
                  options={[
                    ['comfortable', t('settings.density.comfort')],
                    ['compact', t('settings.density.compact')],
                  ]}
                />
              </Setting>
              {/* Sidebar mode toggle removed — the agent bar is gone,
                only the 52px icon rail remains (no opt-out). */}
              <Setting label={t('settings.variant')}>
                <Seg
                  value={tweaks.variant}
                  onChange={(v) => setTweak({ variant: v })}
                  options={[
                    ['conservative', t('settings.variant.conservative')],
                    ['bold', t('settings.variant.bold')],
                  ]}
                />
              </Setting>
              <Setting label={t('settings.chat_mode')} last>
                <Seg
                  value={tweaks.chatMode || 'floating'}
                  onChange={(v) => setTweak({ chatMode: v })}
                  options={[
                    ['floating', t('settings.chat_mode.floating')],
                    ['sidebar', t('settings.chat_mode.sidebar')],
                  ]}
                />
              </Setting>
            </Card>
          )}

          {section === 'language' && (
            <Card>
              <SectionHead icon="chat" title={t('settings.language')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {[
                  { id: 'en', flag: '\ud83c\uddec\ud83c\udde7', name: t('settings.lang.en') },
                  { id: 'fr', flag: '\ud83c\uddeb\ud83c\uddf7', name: t('settings.lang.fr') },
                  { id: 'de', flag: '\ud83c\udde9\ud83c\uddea', name: t('settings.lang.de') },
                ].map((l) => {
                  const active = lang === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => setLang(l.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                        border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                        borderRadius: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all .12s',
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{l.flag}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text)' }}>
                          {l.name}
                        </div>
                        <div
                          style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'var(--mono)' }}
                        >
                          {l.id.toUpperCase()}
                        </div>
                      </div>
                      {active && <Icon.check size={16} style={{ color: 'var(--accent)' }} />}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 12, fontStyle: 'italic' }}>
                {t('settings.lang.hint')}
              </div>
            </Card>
          )}

          {/* Reset — only meaningful for Appearance/Language tabs */}
          {section !== 'profile' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={resetDefaults}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('action.reset')}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function ProfileCard({ session }) {
  const t = useT();
  const fileRef = useRef(null);
  const [draft, setDraft] = useState(() => initialDraftFrom(session));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null); // { tone, text }
  const [error, setError] = useState(null);
  // If session updates externally (e.g. login) while the page is open,
  // seed the draft once.
  useEffect(() => {
    setDraft(initialDraftFrom(session));
  }, [session?.email]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraftFrom(session));
  const patch = (edits) => setDraft((d) => ({ ...d, ...edits }));
  const initials = initialsOf([draft.firstName, draft.lastName].filter(Boolean).join(' ') || session?.name);

  // On file pick we show a local preview immediately (data URL) but
  // stash the File object so save() can upload the real bytes to
  // Supabase Storage.
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setError(t('settings.profile.image_too_big'));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      patch({ picture: reader.result, pictureFile: file });
      setError(null);
    };
    reader.onerror = () => setError(t('settings.profile.read_failed'));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      let pictureUrl = draft.picture;
      // If the user picked a new file, upload the bytes now and swap
      // the data-URL preview for the persistent public URL.
      if (draft.pictureFile) {
        pictureUrl = await uploadProfilePicture(draft.pictureFile);
      }
      await updateProfile({
        firstName: draft.firstName,
        lastName: draft.lastName,
        phone: draft.phone,
        title: draft.title,
        picture: pictureUrl,
      });
      // Clear the stashed File object so a second save doesn't re-upload.
      setDraft((d) => ({ ...d, picture: pictureUrl, pictureFile: undefined }));
      setFlash({ tone: 'ok', text: t('settings.profile.saved') });
      setTimeout(() => setFlash(null), 2400);
    } catch (e) {
      setError(e.message || t('settings.profile.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setDraft(initialDraftFrom(session));
    setError(null);
  };

  return (
    <Card>
      <SectionHead icon="people" title={t('settings.profile.title')} />
      <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
        {/* Picture */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: '50%',
              backgroundColor: draft.picture ? 'var(--surface-2)' : undefined,
              backgroundImage: draft.picture ? `url(${draft.picture})` : 'linear-gradient(135deg, #FF00B2, #20286D)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 700,
              border: '1px solid var(--border)',
            }}
          >
            {!draft.picture && initials}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => fileRef.current?.click()} style={pillBtn('accent-soft')}>
              {draft.picture ? t('settings.profile.change') : t('settings.profile.upload')}
            </button>
            {draft.picture && (
              <button onClick={() => patch({ picture: null })} style={pillBtn('plain')}>
                {t('settings.profile.remove')}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        </div>

        {/* Fields */}
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label={t('settings.profile.first_name')}>
            <TextInput
              value={draft.firstName}
              onChange={(v) => patch({ firstName: v })}
              placeholder={t('settings.profile.first_name')}
            />
          </Field>
          <Field label={t('settings.profile.last_name')}>
            <TextInput
              value={draft.lastName}
              onChange={(v) => patch({ lastName: v })}
              placeholder={t('settings.profile.last_name')}
            />
          </Field>
          <Field label={t('settings.profile.email')} hint={t('settings.profile.email_hint')}>
            <TextInput value={draft.email} readOnly />
          </Field>
          <Field label={t('settings.profile.phone')}>
            <TextInput value={draft.phone} onChange={(v) => patch({ phone: v })} placeholder="+1 415 …" />
          </Field>
          <Field label={t('settings.profile.job_title')} full>
            <TextInput
              value={draft.title}
              onChange={(v) => patch({ title: v })}
              placeholder={t('settings.profile.job_title_placeholder')}
            />
          </Field>
        </div>
      </div>

      {(error || flash) && (
        <div
          style={{
            marginTop: 14,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            background: error
              ? 'color-mix(in oklch, var(--risk) 12%, transparent)'
              : 'color-mix(in oklch, var(--ok) 12%, transparent)',
            color: error ? 'var(--risk)' : 'var(--ok)',
            border: `1px solid color-mix(in oklch, ${error ? 'var(--risk)' : 'var(--ok)'} 35%, transparent)`,
            borderRadius: 7,
          }}
        >
          {error || flash?.text}
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={revert}
          disabled={!dirty || saving}
          style={{
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 600,
            background: 'transparent',
            color: dirty && !saving ? 'var(--text-soft)' : 'var(--text-dim)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            cursor: dirty && !saving ? 'pointer' : 'not-allowed',
          }}
        >
          {t('settings.profile.revert')}
        </button>
        <button
          onClick={save}
          disabled={!dirty || saving}
          style={{
            padding: '8px 16px',
            fontSize: 12.5,
            fontWeight: 700,
            background: dirty && !saving ? 'var(--accent)' : 'var(--surface-3)',
            color: dirty && !saving ? '#fff' : 'var(--text-dim)',
            border: 'none',
            borderRadius: 7,
            cursor: dirty && !saving ? 'pointer' : 'not-allowed',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon.check size={11} /> {saving ? t('settings.profile.saving') : t('settings.profile.save_changes')}
        </button>
      </div>
    </Card>
  );
}

function initialDraftFrom(session) {
  if (!session) return { firstName: '', lastName: '', email: '', phone: '', title: '', picture: null };
  const split = splitName(session.name);
  return {
    firstName: session.firstName ?? split.firstName ?? '',
    lastName: session.lastName ?? split.lastName ?? '',
    email: session.email ?? '',
    phone: session.phone ?? '',
    title: session.title ?? '',
    picture: session.picture ?? null,
  };
}

function Field({ label, hint, full, children }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          letterSpacing: 0.1,
          textTransform: 'uppercase',
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, readOnly }) {
  return (
    <input
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{
        width: '100%',
        padding: '8px 10px',
        fontSize: 12.5,
        background: readOnly ? 'var(--surface-3)' : 'var(--surface-2)',
        color: readOnly ? 'var(--text-dim)' : 'var(--text)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        fontFamily: 'var(--font)',
        outline: 'none',
      }}
    />
  );
}

function pillBtn(style) {
  const accent = style === 'accent-soft';
  return {
    padding: '5px 12px',
    fontSize: 11.5,
    fontWeight: 600,
    background: accent ? 'var(--accent-soft)' : 'transparent',
    color: accent ? 'var(--accent)' : 'var(--text-dim)',
    border: `1px solid ${accent ? 'var(--accent-line)' : 'var(--border)'}`,
    borderRadius: 6,
    cursor: 'pointer',
  };
}

function NavItem({ icon, label, active, onClick }) {
  const IconC = Icon[icon] || Icon.sparkle;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        width: '100%',
        textAlign: 'left',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-soft)',
        border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
        borderRadius: 8,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <IconC size={13} />
      {label}
    </button>
  );
}

function SectionHead({ icon, title }) {
  const IconC = Icon[icon] || Icon.sparkle;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <IconC size={13} style={{ color: 'var(--text-dim)' }} />
      <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
    </div>
  );
}

function Setting({ label, children, last }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: 16,
        padding: '14px 0',
        alignItems: 'center',
        borderBottom: last ? 'none' : '1px dashed var(--border)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)' }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Seg({ value, onChange, options }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2, background: 'var(--surface-3)', padding: 2, borderRadius: 7 }}>
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            background: value === v ? 'var(--surface)' : 'transparent',
            color: value === v ? 'var(--text)' : 'var(--text-dim)',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
            boxShadow: value === v ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
