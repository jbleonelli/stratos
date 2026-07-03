// Innovate — shop-style marketplace surface.
//
// Layout (top to bottom):
//   1. Hero copy
//   2. Featured carousel (auto-rotating spotlight, mixed Adaptiv + vendor)
//   3. ADAPTIV HARDWARE — horizontal-scroll shelf of first-party devices
//   4. PARTNER ECOSYSTEM
//      - Filter pills (All / Wellbeing / Energy / …)
//      - When 'all': one horizontal-scroll shelf per category
//      - When a category is picked: a single grid of that category
//   5. Become-a-partner CTA + disclaimer
//
// Adaptiv device specs are sourced from devices-data.js → DEVICE_TYPES
// via adaptivDeviceListings() (single-source-of-truth). Vendor data
// lives in innovate-catalog.js → VENDORS. The featured rotation is
// hand-curated in innovate-catalog.js → FEATURED.
//
// Vision: PREDICT will later push a contextual recommendation from
// either pool when an insight maps to a solution. The taxonomy +
// categoryId mapping makes that cross-link mechanical.

import React, { useState, useMemo, useEffect } from 'react';
import { Pill, Card, IconBtn } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import {
  STATUS_TONE,
  STATUS_LABEL_KEY,
  DEPLOY_TYPE_LABEL_KEY,
  vendorsByCategory,
  filterVendors,
  vendorsByVertical,
  REGIONS,
  REGION_META,
  countByRegion,
} from './innovate-catalog.js';
import { useVendors } from './vendors-data.js';
import { useDeviceSkus } from './queries/catalog.ts';

const CATEGORIES = [
  { id: 'wellbeing', icon: 'sparkle', labelKey: 'innovate.cat.wellbeing.label' },
  { id: 'energy', icon: 'bolt', labelKey: 'innovate.cat.energy.label' },
  { id: 'safety', icon: 'shield', labelKey: 'innovate.cat.safety.label' },
  { id: 'compliance', icon: 'sla', labelKey: 'innovate.cat.compliance.label' },
  { id: 'operations', icon: 'gateway', labelKey: 'innovate.cat.operations.label' },
  { id: 'financial', icon: 'panel', labelKey: 'innovate.cat.financial.label' },
];

const CATEGORY_META = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export function InnovatePage({ building, initialTab }) {
  useT();
  // INNOVATE has two top tabs (lifted to the TopBar via pillar-subnav.js):
  // 'partners' = the existing vendor + Adaptiv hero marketplace surface,
  // 'catalog'  = a customer-facing Adaptiv hardware listing. App.jsx
  // drives this via initialTab; the useEffect resyncs when the user
  // clicks between tabs in the TopBar mid-mount.
  const [tab, setTab] = useState(initialTab === 'catalog' ? 'catalog' : 'partners');
  useEffect(() => {
    if (initialTab === 'catalog' && tab !== 'catalog') setTab('catalog');
    else if (initialTab === 'partners' && tab !== 'partners') setTab('partners');
  }, [initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tab === 'catalog') {
    return <AdaptivCatalogTab />;
  }

  return <PartnerEcosystemTab building={building} />;
}

function PartnerEcosystemTab({ building }) {
  const t = useT();
  const [filter, setFilter] = useState('all'); // category filter
  const [regionFilter, setRegionFilter] = useState('all');
  const [openVendor, setOpenVendor] = useState(null); // vendor in detail drawer
  const liveVendors = useVendors();
  const VENDORS = liveVendors || []; // null while loading; treat as empty

  // Vertical-aware shelf: when the active building carries a `variant`
  // (set by migration 105 onwards — 'warehouse' today, 'clinic' next),
  // pull every vendor tagged with that vertical and show them at the
  // top of the page. Hidden when there's no vertical or no matches.
  const activeVertical = building?.variant || null;
  const verticalMatches = useMemo(
    () => (activeVertical ? vendorsByVertical(VENDORS, activeVertical) : []),
    [VENDORS, activeVertical],
  );
  // Region pills only render for regions that have at least one vendor
  // (otherwise the strip is noisy). 'global' always shows since it's
  // the default. 'all' is the filter-clear pill, always shown.
  const visibleRegions = useMemo(
    () => REGIONS.filter((r) => r.id === 'global' || countByRegion(VENDORS, r.id) > 0),
    [VENDORS],
  );

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--pad)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'calc(var(--pad) * 1.25)',
      }}
    >
      {/* Hero */}
      <Card pad={false} style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(700px 320px at 85% 0%, color-mix(in oklch, var(--accent) 22%, transparent), transparent 60%), radial-gradient(500px 260px at 10% 100%, color-mix(in oklch, #20286D 28%, transparent), transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ padding: 'var(--pad)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Icon.sparkle size={11} style={{ color: 'var(--accent)' }} />
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              {t('innovate.eyebrow')}
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: -0.01,
              color: 'var(--text)',
              maxWidth: 720,
            }}
          >
            {t('innovate.title')}
          </h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 720, lineHeight: 1.55 }}>
            {t('innovate.body')}
          </p>
        </div>
      </Card>

      {/* Vertical-recommended shelf — only when the active building has a
          `variant` (warehouse / clinic / …) AND at least one vendor is
          tagged for that vertical. Sits above Adaptiv hardware because
          for a warehouse-day operator, dock + racking sensors are the
          first thing they want to see. */}
      {activeVertical && verticalMatches.length > 0 && (
        <section>
          <ShelfHeader
            eyebrow={t('innovate.section.vertical.eyebrow', { name: building?.name || '' })}
            title={t(`innovate.section.vertical.${activeVertical}.title`)}
            body={t(`innovate.section.vertical.${activeVertical}.body`)}
            count={verticalMatches.length}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--pad)',
            }}
          >
            {verticalMatches.map((v) => (
              <VendorCard key={v.id} vendor={v} t={t} onOpen={() => setOpenVendor(v)} />
            ))}
          </div>
        </section>
      )}

      {/* Adaptiv hardware section removed 2026-06 — redundant with the
          dedicated "Adaptiv Catalog" tab. Partner ecosystem now leads
          straight into the third-party vendor solutions. */}

      {/* Vendor ecosystem */}
      <section>
        <ShelfHeader
          eyebrow={t('innovate.section.vendors.eyebrow')}
          title={t('innovate.section.vendors.title')}
          body={t('innovate.section.vendors.body')}
          count={VENDORS.length}
        />

        {/* Category filter */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <FilterPill
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label={t('innovate.filter.all')}
            count={filterVendors(VENDORS, { regionId: regionFilter }).length}
          />
          {CATEGORIES.map((c) => (
            <FilterPill
              key={c.id}
              active={filter === c.id}
              onClick={() => setFilter(c.id)}
              label={t(c.labelKey)}
              icon={c.icon}
              count={filterVendors(VENDORS, { categoryId: c.id, regionId: regionFilter }).length}
            />
          ))}
        </div>

        {/* Region filter — second row, smaller scale, with flags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--pad)', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginRight: 4 }}>
            {t('innovate.region.eyebrow')}
          </span>
          <FilterPill
            active={regionFilter === 'all'}
            onClick={() => setRegionFilter('all')}
            label={t('innovate.filter.all')}
            count={filterVendors(VENDORS, { categoryId: filter }).length}
            small
          />
          {visibleRegions.map((r) => (
            <FilterPill
              key={r.id}
              active={regionFilter === r.id}
              onClick={() => setRegionFilter(r.id)}
              flag={r.flag}
              label={t(r.labelKey)}
              count={filterVendors(VENDORS, { categoryId: filter, regionId: r.id }).length}
              small
            />
          ))}
        </div>

        {filter === 'all' && regionFilter === 'all' ? (
          // No filter active — one WRAPPING GRID per category. (Was a
          // horizontal-scroll shelf, which clipped cards at the right edge
          // and hid most of each category — JB flagged it. A grid shows
          // every vendor at a glance and never cuts a card off.)
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--pad) * 1.25)' }}>
            {CATEGORIES.map((c) => {
              const items = vendorsByCategory(VENDORS, c.id);
              if (items.length === 0) return null;
              return (
                <div key={c.id}>
                  <CategoryRowHeader category={c} count={items.length} t={t} onSeeAll={() => setFilter(c.id)} />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: 'var(--pad)',
                    }}
                  >
                    {items.map((v) => (
                      <VendorCard key={v.id} vendor={v} t={t} onOpen={() => setOpenVendor(v)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          (() => {
            // At least one filter active — show a single grid of the
            // intersection so the result reads as a focused list.
            const matched = filterVendors(VENDORS, { categoryId: filter, regionId: regionFilter });
            if (matched.length === 0) {
              return (
                <Card>
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                    {t('innovate.region.empty')}
                  </div>
                </Card>
              );
            }
            return (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 'var(--pad)',
                }}
              >
                {matched.map((v) => (
                  <VendorCard key={v.id} vendor={v} t={t} onOpen={() => setOpenVendor(v)} />
                ))}
              </div>
            );
          })()
        )}
      </section>

      {/* Become a partner footer */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              flexShrink: 0,
            }}
          >
            <Icon.sparkle size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{t('innovate.empty.title')}</div>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.5 }}>
              {t('innovate.empty.body')}
            </p>
          </div>
          <a
            href="mailto:hello@adaptiv.systems?subject=Innovate%20marketplace%20partner%20interest"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              flexShrink: 0,
              boxShadow: '0 6px 18px color-mix(in oklch, var(--accent) 30%, transparent)',
            }}
          >
            {t('innovate.cta')} <Icon.chevR size={11} />
          </a>
        </div>
      </Card>

      <div
        style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic', textAlign: 'center', paddingTop: 4 }}
      >
        {t('innovate.disclaimer')}
      </div>

      {openVendor && <VendorDetailDrawer vendor={openVendor} onClose={() => setOpenVendor(null)} t={t} />}
    </main>
  );
}

// ─────────── Section + row headers ───────────

function ShelfHeader({ eyebrow, title, body, count }) {
  return (
    <div style={{ marginBottom: 'var(--pad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 11,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--accent)',
            fontWeight: 700,
          }}
        >
          {eyebrow}
        </span>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            fontWeight: 700,
            color: 'var(--text-faint)',
            padding: '1px 7px',
            borderRadius: 999,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          {count}
        </span>
      </div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
      {body && (
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.5, maxWidth: 720 }}>
          {body}
        </p>
      )}
    </div>
  );
}

function CategoryRowHeader({ category, count, t, onSeeAll }) {
  const IconC = Icon[category.icon] || Icon.sparkle;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconC size={14} style={{ color: 'var(--accent)' }} />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t(category.labelKey)}</h3>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            fontWeight: 700,
            color: 'var(--text-faint)',
            padding: '1px 7px',
            borderRadius: 999,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          {count}
        </span>
      </div>
      <button
        onClick={onSeeAll}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--accent)',
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {t('innovate.row.see_all')} <Icon.chevR size={9} />
      </button>
    </div>
  );
}

// ─────────── Cards ───────────

function FilterPill({ active, onClick, label, icon, flag, count, small }) {
  const IconC = icon ? Icon[icon] || null : null;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: small ? 5 : 6,
        padding: small ? '4px 10px' : '6px 12px',
        fontSize: small ? 11.5 : 12,
        fontWeight: 600,
        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: active ? 'var(--accent)' : 'var(--text-soft)',
        border: '1px solid ' + (active ? 'var(--accent-line)' : 'var(--border)'),
        borderRadius: 999,
        cursor: 'pointer',
      }}
    >
      {flag && (
        <span aria-hidden style={{ fontSize: small ? 12 : 13, lineHeight: 1 }}>
          {flag}
        </span>
      )}
      {IconC && <IconC size={small ? 10 : 11} />}
      {label}
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: small ? 10 : 10.5,
          fontWeight: 700,
          color: active ? 'var(--accent)' : 'var(--text-faint)',
        }}
      >
        {count}
      </span>
    </button>
  );
}

function VendorCard({ vendor, t, onOpen }) {
  const cat = CATEGORY_META[vendor.categoryId];
  const CatIcon = cat ? Icon[cat.icon] || Icon.sparkle : Icon.sparkle;
  const region = REGION_META[vendor.region || 'global'];
  return (
    <Card style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              flexShrink: 0,
            }}
          >
            <CatIcon size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)',
                lineHeight: 1.2,
              }}
            >
              <span>{vendor.name}</span>
              {region && (
                <span
                  title={t(region.labelKey)}
                  aria-label={t(region.labelKey)}
                  style={{ fontSize: 13, lineHeight: 1 }}
                >
                  {region.flag}
                </span>
              )}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 11,
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <span>{cat ? t(cat.labelKey) : ''}</span>
              <span style={{ color: 'var(--text-faint)' }}>·</span>
              <span>{t(DEPLOY_TYPE_LABEL_KEY[vendor.deployType] || '')}</span>
            </div>
          </div>
          <Pill tone={STATUS_TONE[vendor.status] || 'off'}>
            {t(STATUS_LABEL_KEY[vendor.status] || 'innovate.status.coming_soon')}
          </Pill>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', lineHeight: 1.35 }}>
          {vendor.tagline}
        </div>

        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55, flex: 1 }}>{vendor.desc}</p>

        <div style={{ paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={onOpen}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--accent)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {t('innovate.vendor.learn_more')} <Icon.chevR size={9} />
          </button>
        </div>
      </div>
    </Card>
  );
}

// ─────────── Vendor detail drawer ───────────
//
// Slides in from the right, mirrors the DeviceDetailDrawer pattern
// (backdrop + 480px panel + close button). Renders whatever optional
// detail fields the vendor carries (longDesc, keyFeatures, products,
// integration, pricing) — gracefully degrades when missing.

function VendorDetailDrawer({ vendor, onClose, t }) {
  const cat = CATEGORY_META[vendor.categoryId];
  const CatIcon = cat ? Icon[cat.icon] || Icon.sparkle : Icon.sparkle;
  const region = REGION_META[vendor.region || 'global'];

  // Close on Esc — keyboard parity with the IconBtn close.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 40,
          animation: 'merlinFadeIn .12s ease-out',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(560px, 92vw)',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 30px rgba(0,0,0,0.10)',
          zIndex: 41,
          display: 'flex',
          flexDirection: 'column',
          animation: 'merlinSlideIn .18s ease-out',
          fontFamily: 'var(--font)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'color-mix(in oklch, var(--accent) 6%, var(--surface))',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              flexShrink: 0,
            }}
          >
            <CatIcon size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--text)',
                lineHeight: 1.2,
              }}
            >
              <span>{vendor.name}</span>
              {region && (
                <span
                  title={t(region.labelKey)}
                  aria-label={t(region.labelKey)}
                  style={{ fontSize: 14, lineHeight: 1 }}
                >
                  {region.flag}
                </span>
              )}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <span>{cat ? t(cat.labelKey) : ''}</span>
              <span style={{ color: 'var(--text-faint)' }}>·</span>
              <span>{t(DEPLOY_TYPE_LABEL_KEY[vendor.deployType] || '')}</span>
              <span style={{ color: 'var(--text-faint)' }}>·</span>
              <span>{region ? t(region.labelKey) : ''}</span>
            </div>
          </div>
          <IconBtn onClick={onClose} title={t('action.close')}>
            <Icon.close size={13} />
          </IconBtn>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Pill tone={STATUS_TONE[vendor.status] || 'off'}>
              {t(STATUS_LABEL_KEY[vendor.status] || 'innovate.status.coming_soon')}
            </Pill>
            {vendor.pricing && <Pill tone="info">{vendor.pricing}</Pill>}
          </div>

          {/* Tagline */}
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35 }}>{vendor.tagline}</div>

          {/* Long description (falls back to short desc) */}
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6 }}>
            {vendor.longDesc || vendor.desc}
          </p>

          {/* Key features */}
          {vendor.keyFeatures?.length > 0 && (
            <DrawerSection title={t('innovate.detail.key_features')}>
              <ul
                style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                {vendor.keyFeatures.map((f, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontSize: 13,
                      color: 'var(--text-soft)',
                      lineHeight: 1.5,
                    }}
                  >
                    <Icon.check size={11} style={{ color: 'var(--accent)', marginTop: 4, flexShrink: 0 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </DrawerSection>
          )}

          {/* Products */}
          {vendor.products?.length > 0 && (
            <DrawerSection title={t('innovate.detail.products')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {vendor.products.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>
                      {p.desc}
                    </p>
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}

          {/* Integration */}
          {vendor.integration && (
            <DrawerSection title={t('innovate.detail.integration')}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-line)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <Icon.sparkle size={13} style={{ color: 'var(--accent)', marginTop: 3, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55 }}>
                  {vendor.integration}
                </p>
              </div>
            </DrawerSection>
          )}

          {/* External website link — small inline at the bottom */}
          {vendor.url && (
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <a
                href={vendor.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  textDecoration: 'none',
                }}
              >
                {t('innovate.detail.visit_site')} <Icon.chevR size={9} />
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DrawerSection({ title, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

// Adaptiv Catalog tab — customer-facing hardware listing reading
// device_skus (active rows). Platform admins edit the same table at
// /platform/catalog (lifted under MARKETING 2026-05-16), so this view
// + the operational/billing master are now a single source of truth.
// RLS allows authenticated SELECT on active=true rows (existing
// device_skus_select_active policy), no migration needed.
//
// Cards mirror the spec shape Partner Ecosystem uses (icon + name +
// tagline + desc + family/manufacturer chips). icon is derived from
// `kind` via a small client-side map since device_skus doesn't carry
// a display-icon column.
function AdaptivCatalogTab() {
  const t = useT();
  // Active Adaptiv SKUs, shaped into catalog cards by the query hook.
  const { data: products = [] } = useDeviceSkus();
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
      <Card pad={false} style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--accent-pink) 18%, transparent), transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ padding: 'var(--pad)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Icon.cart size={12} style={{ color: 'var(--accent-pink)' }} />
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              {t('innovate.catalog.eyebrow')}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
            {t('innovate.catalog.title')}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 640 }}>
            {t('innovate.catalog.subtitle', { n: products.length })}
          </p>
        </div>
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        {products.map((p) => {
          const IconC = Icon[p.icon] || Icon.sparkle;
          return (
            <Card key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'color-mix(in oklch, var(--accent-pink) 14%, var(--surface-2))',
                    color: 'var(--accent-pink)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconC size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                    {p.sku}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.5 }}>{p.desc}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
                {p.family && <Pill>{p.family}</Pill>}
                {p.kind && <Pill>{p.kind}</Pill>}
                <Pill>{p.manufacturer}</Pill>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
