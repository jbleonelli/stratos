import { Card } from '../ui/primitives';

export function PlaceholderScreen({ title, pillar }: { title: string; pillar?: string }) {
  return (
    <div style={{ padding: 8, height: '100%', boxSizing: 'border-box' }}>
      <Card style={{ padding: 28, maxWidth: 520 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-pink)', marginBottom: 8 }}>
          {pillar ?? 'COMING SOON'}
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--text-dim)' }}>
          This Merlin surface is not wired to Stratos yet. The shell and navigation match Merlin; backend and UI
          content will land in a later slice.
        </p>
      </Card>
    </div>
  );
}
