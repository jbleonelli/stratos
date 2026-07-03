import { ADAPTIV_CATALOG } from '../app/innovate-catalog';
import { Card, PanelHead, Pill } from '../ui/primitives';

export function InnovateCatalogScreen() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-pink)' }}>INNOVATE</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>Adaptiv catalog</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-dim)' }}>
          Hardware and sensors deployable through Stratos edge gateways.
        </p>
      </div>

      <Card style={{ padding: 16 }}>
        <PanelHead title="Deployable SKUs" />
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-faint)' }}>
          Request provisioning from your Adaptiv account team — catalog mirrors Merlin innovate hardware.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ADAPTIV_CATALOG.map((sku) => (
            <div
              key={sku.id}
              style={{
                padding: '14px 0',
                borderBottom: '1px solid var(--border)',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 12,
                alignItems: 'start',
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{sku.name}</div>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.45 }}>{sku.desc}</p>
                {(sku.uplink || sku.power) && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {sku.uplink && <Pill tone="info">Uplink: {sku.uplink}</Pill>}
                    {sku.power && <Pill tone="neutral">Power: {sku.power}</Pill>}
                  </div>
                )}
              </div>
              <Pill tone="neutral">{sku.deployType}</Pill>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
