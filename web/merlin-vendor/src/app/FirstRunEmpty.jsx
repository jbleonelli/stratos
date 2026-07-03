// First-run empty state for brand-new tenants who have zero buildings.
//
// Before this, App.jsx fell back to `BUILDINGS.hq` (the static Meridian
// HQ template) when allBuildings was empty, which silently rendered
// another org's demo data for fresh users — a perceived data leak even
// though DB-level RLS was correctly scoping. See App.jsx render gate.
//
// This component takes over the full canvas (no sidebar, no top nav)
// for that one-shot moment between "tenant exists" and "first building
// created". On create success the parent re-renders with the new
// building auto-selected via the existing buildingsReady useEffect at
// App.jsx:394-402 — no manual hand-off needed.
//
// Escape hatch: sign-out link in the top-right, in case the user
// realises they signed in to the wrong account.
import { useState } from 'react';
import { createBuilding } from './custom-locations.js';
import { logout as doLogout } from './auth.js';

function slugify(name) {
  return (
    (name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'building'
  );
}

export function FirstRunEmpty({ org }) {
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const orgName = org?.name || 'your workspace';

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Please enter a name.');
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      const id = slugify(name);
      await createBuilding({ id, name: name.trim(), addr: addr.trim(), floors: 1 });
      // Parent's auto-select effect picks up the new building from the
      // hydrated cache; this component unmounts on the next render.
    } catch (ex) {
      setErr(ex.message || 'Could not create the building.');
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '14px 20px',
        }}
      >
        <button
          type="button"
          onClick={() => doLogout()}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 12,
            cursor: 'pointer',
            padding: '6px 10px',
          }}
        >
          Sign out
        </button>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 20px',
        }}
      >
        <form
          onSubmit={onSubmit}
          style={{
            maxWidth: 460,
            width: '100%',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '28px 28px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
              }}
            >
              Welcome to {orgName}
            </div>
            <h1 style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 700, letterSpacing: -0.01 }}>
              Add your first building
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              Buildings are the unit Merlin monitors — spaces, devices, schedules, and agents all attach to one. You can
              add more later from Operations → Hypervisor.
            </p>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Name</span>
            <input
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Headquarters"
              style={{
                padding: '10px 12px',
                fontSize: 14,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg-elev)',
                color: 'var(--text)',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Address (optional)</span>
            <input
              type="text"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="123 Main St, San Francisco, CA"
              style={{
                padding: '10px 12px',
                fontSize: 14,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg-elev)',
                color: 'var(--text)',
              }}
            />
          </label>

          {err && <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.5 }}>{err}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 4,
              padding: '10px 14px',
              fontSize: 14,
              fontWeight: 600,
              background: 'var(--accent)',
              color: 'var(--accent-fg, #fff)',
              border: 'none',
              borderRadius: 8,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Creating…' : 'Create building'}
          </button>
        </form>
      </div>
    </div>
  );
}
