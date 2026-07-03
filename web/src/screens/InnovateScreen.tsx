import { useMemo, useState } from 'react';
import {
  statusLabel,
  statusTone,
  VENDOR_CATEGORIES,
  VENDORS,
  type VendorStatus,
} from '../app/innovate-catalog';
import { Card, PanelHead, Pill } from '../ui/primitives';

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-soft)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

export function InnovateScreen() {
  const [category, setCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<VendorStatus | 'all'>('all');

  const featured = useMemo(() => VENDORS.filter((v) => v.featured), []);

  const filtered = useMemo(() => {
    return VENDORS.filter((v) => {
      if (category !== 'all' && v.categoryId !== category) return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      return true;
    });
  }, [category, statusFilter]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-pink)' }}>INNOVATE</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>Partner marketplace</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-dim)' }}>
          Vetted vendors for wellbeing, energy, safety, and operations — Merlin-ready integrations.
        </p>
      </div>

      {featured.length > 0 && (
        <div>
          <PanelHead title="Featured" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {featured.map((v) => (
              <Card key={v.id} style={{ padding: 16, borderColor: 'var(--accent-line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{v.name}</div>
                  <Pill tone={statusTone(v.status)}>{statusLabel(v.status)}</Pill>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.45 }}>{v.desc}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  <Pill tone="neutral">{v.deployType}</Pill>
                  <Pill tone="info">{v.region.toUpperCase()}</Pill>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card style={{ padding: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <FilterChip active={category === 'all'} label="All" onClick={() => setCategory('all')} />
          {VENDOR_CATEGORIES.map((c) => (
            <FilterChip key={c.id} active={category === c.id} label={c.label} onClick={() => setCategory(c.id)} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['all', 'available', 'beta', 'coming-soon'] as const).map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              label={s === 'all' ? 'Any status' : statusLabel(s)}
              onClick={() => setStatusFilter(s)}
            />
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {filtered.map((v) => (
          <Card key={v.id} style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{v.name}</div>
              <Pill tone={statusTone(v.status)}>{statusLabel(v.status)}</Pill>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.45 }}>{v.desc}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <Pill tone="neutral">
                {VENDOR_CATEGORIES.find((c) => c.id === v.categoryId)?.label ?? v.categoryId}
              </Pill>
              <Pill tone="neutral">{v.deployType}</Pill>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
          No partners match these filters.
        </Card>
      )}
    </div>
  );
}
