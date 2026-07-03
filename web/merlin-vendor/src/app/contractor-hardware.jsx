// Hardware commerce — contractor-side device store (PR B).
// Extracted from ContractorApp.jsx (2026-06-05) to break up a 4.5k-line
// god-file. Self-contained: browse catalog -> cart -> place order ->
// simulate fulfillment -> inventory -> install. ContractorApp re-imports
// ContractorHardware for the Operations "Hardware" tab; behaviour unchanged.

import React, { useState, useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import {
  useDeviceCatalog,
  useDeviceOrders,
  useOrgInventory,
  useInstallableLocations,
  placeOrder,
  createCheckoutSession,
  simulateFulfill,
  installInventoryDevice,
  formatCents,
} from './hardware-store.js';

// ──── Hardware tab (PR B — hardware commerce MVP) ────
// Three sub-views: Browse (catalog), Cart, Orders. Cart state lives in
// component state; "Place order" writes the order + items in a single
// transaction via placeOrder(). The catalog comes from the existing
// device_skus + device_profiles tables (migration 074), already RLS-
// readable by any authenticated user for active rows. Order history
// + delivered inventory are scoped to current_user_org.
function ContractorHardware({ session }) {
  const t = useT();
  const { skus, profiles, profile_items, loaded: catalogLoaded } = useDeviceCatalog();
  const [view, setView] = useState('browse'); // 'browse' | 'cart' | 'orders' | 'inventory'
  const [cart, setCart] = useState([]); // [{ kind: 'sku'|'profile', id, qty, snapshot }]
  const [orderRefresh, setOrderRefresh] = useState(0);
  const { orders, itemsByOrder, loaded: ordersLoaded } = useDeviceOrders(orderRefresh);
  const { devices: inventory, loaded: invLoaded } = useOrgInventory(orderRefresh);

  const cartTotal = useMemo(() => cart.reduce((sum, l) => sum + (l.snapshot.list_price_cents || 0) * l.qty, 0), [cart]);
  const cartCount = cart.reduce((n, l) => n + l.qty, 0);

  const profileItemsByProfile = useMemo(() => {
    const map = {};
    for (const it of profile_items) {
      if (!map[it.profile_id]) map[it.profile_id] = [];
      map[it.profile_id].push(it);
    }
    return map;
  }, [profile_items]);

  const skuById = useMemo(() => Object.fromEntries(skus.map((s) => [s.id, s])), [skus]);

  function addToCart(kind, snapshot, qty = 1) {
    setCart((prev) => {
      const existing = prev.find((l) => l.kind === kind && l.id === snapshot.id);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, qty: l.qty + qty } : l));
      }
      return [...prev, { kind, id: snapshot.id, qty, snapshot }];
    });
  }
  function removeFromCart(kind, id) {
    setCart((prev) => prev.filter((l) => !(l.kind === kind && l.id === id)));
  }
  function setQty(kind, id, qty) {
    if (qty <= 0) return removeFromCart(kind, id);
    setCart((prev) => prev.map((l) => (l.kind === kind && l.id === id ? { ...l, qty } : l)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
            {t('contractor.hardware.title')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {t('contractor.hardware.subtitle')}
          </div>
        </div>
        <HardwareSubTabs
          view={view}
          setView={setView}
          cartCount={cartCount}
          ordersCount={orders.length}
          inventoryCount={inventory.filter((d) => d.state === 'delivered').length}
          t={t}
        />
      </div>

      {/* Body */}
      {view === 'browse' && (
        <HardwareCatalog
          skus={skus}
          profiles={profiles}
          profileItemsByProfile={profileItemsByProfile}
          skuById={skuById}
          loaded={catalogLoaded}
          onAdd={addToCart}
          t={t}
        />
      )}
      {view === 'cart' && (
        <HardwareCart
          cart={cart}
          cartTotal={cartTotal}
          onSetQty={setQty}
          onRemove={removeFromCart}
          onPlaced={() => {
            setCart([]);
            setOrderRefresh((n) => n + 1);
            setView('orders');
          }}
          onContinueShopping={() => setView('browse')}
          session={session}
          t={t}
        />
      )}
      {view === 'orders' && (
        <HardwareOrders
          orders={orders}
          itemsByOrder={itemsByOrder}
          loaded={ordersLoaded}
          inventory={inventory}
          invLoaded={invLoaded}
          skuById={skuById}
          profiles={profiles}
          onSimulated={() => setOrderRefresh((n) => n + 1)}
          onGoInventory={() => setView('inventory')}
          t={t}
        />
      )}
      {view === 'inventory' && (
        <HardwareInventory
          inventory={inventory}
          loaded={invLoaded}
          skuById={skuById}
          onInstalled={() => setOrderRefresh((n) => n + 1)}
          t={t}
        />
      )}
    </div>
  );
}

function HardwareSubTabs({ view, setView, cartCount, ordersCount, inventoryCount, t }) {
  const tabs = [
    { id: 'browse', label: t('contractor.hardware.tab_browse'), count: null },
    { id: 'cart', label: t('contractor.hardware.tab_cart'), count: cartCount },
    { id: 'orders', label: t('contractor.hardware.tab_orders'), count: ordersCount },
    { id: 'inventory', label: t('contractor.hardware.tab_inventory'), count: inventoryCount },
  ];
  return (
    <div
      style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', padding: 3, borderRadius: 8, flexShrink: 0 }}
    >
      {tabs.map((tab) => {
        const active = view === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-soft)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: active ? 'var(--shadow-1)' : 'none',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                style={{
                  minWidth: 18,
                  padding: '0 5px',
                  fontSize: 10,
                  fontWeight: 700,
                  background: active ? 'var(--accent-soft)' : 'var(--surface-3)',
                  color: active ? 'var(--accent)' : 'var(--text-soft)',
                  borderRadius: 999,
                  textAlign: 'center',
                  lineHeight: '16px',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function HardwareCatalog({ skus, profiles, profileItemsByProfile, skuById, loaded, onAdd, t }) {
  if (!loaded) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)', fontSize: 13 }}>
        {t('contractor.hardware.loading_catalog')}
      </div>
    );
  }
  const recommendedProfiles = profiles.filter((p) => p.recommended);
  const otherProfiles = profiles.filter((p) => !p.recommended);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      {/* Recommended kits */}
      {recommendedProfiles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CatalogSectionHeader
            label={t('contractor.hardware.section_kits_recommended')}
            count={recommendedProfiles.length}
            accent
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {recommendedProfiles.map((p) => (
              <KitCard
                key={p.id}
                profile={p}
                bom={profileItemsByProfile[p.id] || []}
                skuById={skuById}
                onAdd={() => onAdd('profile', p)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other kits */}
      {otherProfiles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CatalogSectionHeader label={t('contractor.hardware.section_kits_other')} count={otherProfiles.length} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {otherProfiles.map((p) => (
              <KitCard
                key={p.id}
                profile={p}
                bom={profileItemsByProfile[p.id] || []}
                skuById={skuById}
                onAdd={() => onAdd('profile', p)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Individual SKUs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CatalogSectionHeader label={t('contractor.hardware.section_skus')} count={skus.length} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {skus.map((s) => (
            <SkuCard key={s.id} sku={s} onAdd={() => onAdd('sku', s)} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CatalogSectionHeader({ label, count, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.2,
          textTransform: 'uppercase',
          color: accent ? 'var(--accent)' : 'var(--text-soft)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{count}</span>
    </div>
  );
}

function KitCard({ profile, bom, skuById, onAdd, t }) {
  return (
    <div
      style={{
        padding: 14,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon.supply size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{profile.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
            {profile.description || t('contractor.hardware.kit_for_use', { use: profile.use_case })}
          </div>
        </div>
      </div>
      {bom.length > 0 && (
        <div style={{ fontSize: 10.5, color: 'var(--text-soft)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {bom.map((it) => {
            const sku = skuById[it.sku_id];
            return (
              <span
                key={it.sku_id}
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}
              >
                {it.qty}× {sku?.name || it.sku_id}
              </span>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto' }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          {formatCents(profile.list_price_cents, profile.currency || 'USD')}
        </div>
        {profile.estimated_install_minutes && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            · {t('contractor.hardware.install_min', { n: profile.estimated_install_minutes })}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onAdd} style={addCartButtonStyles}>
          <Icon.plus size={11} /> {t('contractor.hardware.add')}
        </button>
      </div>
    </div>
  );
}

function SkuCard({ sku, onAdd, t }) {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: 'var(--surface-2)',
            color: 'var(--text-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon.gateway size={13} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{sku.name}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'var(--mono)' }}>
            {sku.id}
          </div>
        </div>
      </div>
      {sku.short_description && (
        <div style={{ fontSize: 10.5, color: 'var(--text-soft)', lineHeight: 1.45 }}>{sku.short_description}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{formatCents(sku.list_price_cents, sku.currency || 'USD')}</div>
        <div style={{ flex: 1 }} />
        <button onClick={onAdd} style={addCartButtonStyles}>
          <Icon.plus size={10} /> {t('contractor.hardware.add')}
        </button>
      </div>
    </div>
  );
}

function HardwareCart({ cart, cartTotal, onSetQty, onRemove, onPlaced, onContinueShopping, session, t }) {
  const [shipName, setShipName] = useState(session?.name || '');
  const [shipAddr, setShipAddr] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipRegion, setShipRegion] = useState('');
  const [shipPostal, setShipPostal] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    if (cart.length === 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const lines = cart.map((l) =>
        l.kind === 'sku' ? { sku: l.snapshot, qty: l.qty } : { profile: l.snapshot, qty: l.qty },
      );
      const orderId = await placeOrder({
        lines,
        shipTo: {
          name: shipName,
          address: shipAddr,
          city: shipCity,
          region: shipRegion,
          postal_code: shipPostal,
          country: 'US',
        },
        notes,
      });
      // Hand off to Stripe Checkout. If the server returns mode='demo'
      // (no STRIPE_SECRET_KEY in the deploy), drop into the demo flow:
      // platform admin can fulfill from the Orders tab, contractors
      // see the "Order placed, awaiting fulfillment" state.
      const handoff = await createCheckoutSession(orderId);
      if (handoff?.mode === 'stripe' && handoff.url) {
        window.location.href = handoff.url;
        return;
      }
      // Demo fallback — keep the existing UX where the order lands
      // back in the Orders tab and the user can simulate fulfillment
      // (gated to platform admin server-side by migration 097).
      onPlaced(orderId);
    } catch (e) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  if (cart.length === 0) {
    return (
      <Card style={{ padding: 40, textAlign: 'center', maxWidth: 520, margin: '20px auto' }}>
        <Icon.cart size={20} style={{ opacity: 0.6 }} />
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>{t('contractor.hardware.cart_empty_title')}</div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('contractor.hardware.cart_empty_body')}
        </div>
        <button
          onClick={onContinueShopping}
          style={{
            marginTop: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Icon.chevR size={11} style={{ transform: 'rotate(180deg)' }} />
          {t('contractor.hardware.browse_catalog')}
        </button>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: 'var(--pad)' }}>
      {/* Line items */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Icon.cart size={13} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>
            {t('contractor.hardware.cart_title', { n: cart.length })}
          </div>
        </div>
        <div>
          {cart.map((line, i) => (
            <div
              key={`${line.kind}-${line.id}`}
              style={{
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{line.snapshot.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2, display: 'flex', gap: 6 }}>
                  <Pill tone={line.kind === 'profile' ? 'accent' : 'neutral'}>
                    {line.kind === 'profile' ? t('contractor.hardware.kit') : t('contractor.hardware.sku')}
                  </Pill>
                  <span style={{ fontFamily: 'var(--mono)' }}>{line.snapshot.id}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => onSetQty(line.kind, line.id, line.qty - 1)} style={qtyButtonStyles}>
                  −
                </button>
                <span style={{ minWidth: 28, textAlign: 'center', fontSize: 12.5, fontWeight: 700 }}>{line.qty}</span>
                <button onClick={() => onSetQty(line.kind, line.id, line.qty + 1)} style={qtyButtonStyles}>
                  +
                </button>
              </div>
              <div style={{ minWidth: 72, textAlign: 'right', fontSize: 12.5, fontWeight: 700 }}>
                {formatCents((line.snapshot.list_price_cents || 0) * line.qty)}
              </div>
              <button
                onClick={() => onRemove(line.kind, line.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  padding: 4,
                }}
              >
                <Icon.close size={12} />
              </button>
            </div>
          ))}
        </div>
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--surface-2)',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{t('contractor.hardware.subtotal')}</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 16, fontWeight: 800 }}>{formatCents(cartTotal)}</div>
        </div>
      </Card>

      {/* Checkout panel */}
      <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('contractor.hardware.checkout')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('contractor.hardware.checkout_hint')}
        </div>
        <CheckoutField
          label={t('contractor.hardware.ship_name')}
          value={shipName}
          onChange={setShipName}
          disabled={busy}
        />
        <CheckoutField
          label={t('contractor.hardware.ship_address')}
          value={shipAddr}
          onChange={setShipAddr}
          disabled={busy}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <CheckoutField
            label={t('contractor.hardware.ship_city')}
            value={shipCity}
            onChange={setShipCity}
            disabled={busy}
          />
          <CheckoutField
            label={t('contractor.hardware.ship_region')}
            value={shipRegion}
            onChange={setShipRegion}
            disabled={busy}
          />
          <CheckoutField
            label={t('contractor.hardware.ship_postal')}
            value={shipPostal}
            onChange={setShipPostal}
            disabled={busy}
          />
        </div>
        <CheckoutField
          label={t('contractor.hardware.notes')}
          value={notes}
          onChange={setNotes}
          disabled={busy}
          optional
        />
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            fontSize: 11,
            background: 'color-mix(in oklch, var(--accent) 8%, transparent)',
            border: '1px solid color-mix(in oklch, var(--accent) 25%, transparent)',
            color: 'var(--text-soft)',
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: 'var(--accent)' }}>{t('contractor.hardware.demo_payment_title')}</strong>{' '}
          {t('contractor.hardware.demo_payment_body')}
        </div>
        {err && (
          <div
            style={{
              padding: 10,
              borderRadius: 6,
              fontSize: 11,
              background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
              color: 'var(--risk)',
              fontFamily: 'var(--mono)',
            }}
          >
            {err}
          </div>
        )}
        <button
          onClick={submit}
          disabled={busy || !shipName.trim() || !shipAddr.trim()}
          style={{
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 700,
            background: busy || !shipName.trim() || !shipAddr.trim() ? 'var(--surface-3)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: busy || !shipName.trim() || !shipAddr.trim() ? 'default' : 'pointer',
            fontFamily: 'inherit',
            opacity: busy || !shipName.trim() || !shipAddr.trim() ? 0.6 : 1,
          }}
        >
          {busy
            ? t('contractor.hardware.placing')
            : t('contractor.hardware.place_order', { total: formatCents(cartTotal) })}
        </button>
      </Card>
    </div>
  );
}

function CheckoutField({ label, value, onChange, disabled, optional }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600 }}>
        {label}
        {optional ? '' : ' *'}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          padding: '7px 9px',
          fontSize: 12,
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontFamily: 'inherit',
        }}
      />
    </label>
  );
}

function HardwareOrders({
  orders,
  itemsByOrder,
  loaded,
  inventory,
  invLoaded,
  skuById,
  profiles,
  onSimulated,
  onGoInventory,
  t,
}) {
  if (!loaded) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)', fontSize: 13 }}>
        {t('contractor.hardware.loading_orders')}
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <Card style={{ padding: 40, textAlign: 'center', maxWidth: 520, margin: '20px auto' }}>
        <Icon.cart size={20} style={{ opacity: 0.6 }} />
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>
          {t('contractor.hardware.orders_empty_title')}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('contractor.hardware.orders_empty_body')}
        </div>
      </Card>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orders.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            items={itemsByOrder[o.id] || []}
            skuById={skuById}
            profiles={profiles}
            onSimulated={onSimulated}
            t={t}
          />
        ))}
      </div>
      {/* Delivered inventory roll-up */}
      <InventoryStrip inventory={inventory} loaded={invLoaded} skuById={skuById} onGoInventory={onGoInventory} t={t} />
    </div>
  );
}

function OrderCard({ order, items, skuById, profiles, onSimulated, t }) {
  const session = useSession();
  const isPlatformAdmin = !!session?.isPlatformAdmin;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function doSim() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await simulateFulfill(order.id);
      onSimulated();
    } catch (e) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }
  async function doResume() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const handoff = await createCheckoutSession(order.id);
      if (handoff?.mode === 'stripe' && handoff.url) {
        window.location.href = handoff.url;
        return;
      }
      // Demo fallback — no Stripe configured server-side. Surface
      // a helpful note rather than silently doing nothing.
      setErr('Stripe not configured; ask a platform admin to fulfill.');
      setBusy(false);
    } catch (e) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const statusTone = ORDER_STATUS_TONE[order.status] || 'neutral';
  const hasPaymentError = !!order.last_payment_error;
  const cancelReason = order.cancellation_reason;
  // A "placed" order without paid_at and without a stripe_session_id is
  // a pre-Stripe (or demo) order — show the simulate fulfill button to
  // platform admin only. With a session_id but no paid_at it's a
  // Stripe order waiting on the webhook or one that hit a failure;
  // show Retry checkout. paid_at + status='placed' is the rare race
  // where the webhook stamped paid_at but fulfill_paid_order failed —
  // show simulate fulfill as the rescue path (platform admin only).
  const showResumeCheckout = order.status === 'placed' && !order.paid_at && !!order.stripe_session_id;
  const showSimulateFulfill =
    isPlatformAdmin && order.status === 'placed' && (!order.stripe_session_id || !!order.paid_at);
  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-soft)' }}>
              #{order.id.slice(0, 8)}
            </span>
            <Pill tone={statusTone}>{t(`contractor.hardware.status.${order.status}`)}</Pill>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {new Date(order.created_at).toLocaleDateString()}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 6, lineHeight: 1.5 }}>
            {order.ship_to_name && `${order.ship_to_name} · `}
            {[order.ship_to_address, order.ship_to_city, order.ship_to_region, order.ship_to_postal_code]
              .filter(Boolean)
              .join(', ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{formatCents(order.total_cents, order.currency)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            {items.length} {t('contractor.hardware.line_items')}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it) => {
          const label = it.sku_id
            ? skuById[it.sku_id]?.name || it.sku_id
            : profileById[it.profile_id]?.name || it.profile_id;
          return (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
              <Pill tone={it.profile_id ? 'accent' : 'neutral'}>
                {it.profile_id ? t('contractor.hardware.kit') : t('contractor.hardware.sku')}
              </Pill>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <span style={{ color: 'var(--text-dim)' }}>× {it.qty}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-soft)' }}>
                {formatCents(it.line_total_cents)}
              </span>
            </div>
          );
        })}
      </div>
      {hasPaymentError && <PaymentFailureBanner error={order.last_payment_error} />}
      {order.status === 'cancelled' && cancelReason && (
        <CancellationBanner reason={cancelReason} cancelledAt={order.cancelled_at} />
      )}
      {order.refunded_at && (
        <RefundBanner
          amountCents={order.refunded_amount_cents}
          totalCents={order.total_cents}
          currency={order.currency}
          reason={order.refund_reason}
          refundedAt={order.refunded_at}
        />
      )}
      {err && (
        <div
          style={{
            padding: 8,
            borderRadius: 6,
            fontSize: 11,
            fontFamily: 'var(--mono)',
            background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
            color: 'var(--risk)',
          }}
        >
          {err}
        </div>
      )}
      {(showResumeCheckout || showSimulateFulfill) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {showResumeCheckout && (
            <button
              onClick={doResume}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 11.5,
                fontWeight: 700,
                background: hasPaymentError ? 'var(--risk)' : 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: busy ? 'default' : 'pointer',
                fontFamily: 'inherit',
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Icon.cart size={11} />
              {busy ? 'Opening Stripe…' : hasPaymentError ? 'Retry payment' : 'Resume checkout'}
            </button>
          )}
          {showSimulateFulfill && (
            <button
              onClick={doSim}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 11.5,
                fontWeight: 700,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-line)',
                borderRadius: 6,
                cursor: busy ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Icon.bolt size={11} />
              {busy ? t('contractor.hardware.simulating') : t('contractor.hardware.simulate_fulfill')}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

// Banner for orders that took a Stripe payment failure. Stripe keeps
// the PaymentIntent around so a retry is possible — surface the
// decline reason + a clear path back to Checkout via the Retry
// payment button above.
function PaymentFailureBanner({ error }) {
  const msg = error?.message || 'Your payment was declined.';
  const declineCode = error?.decline_code;
  const code = error?.code;
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 6,
        fontSize: 11.5,
        background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
        border: '1px solid color-mix(in oklch, var(--risk) 25%, transparent)',
        color: 'var(--text)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      <Icon.warn size={12} style={{ color: 'var(--risk)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            color: 'var(--risk)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.15,
          }}
        >
          Payment failed
        </div>
        <div style={{ marginTop: 2, color: 'var(--text-soft)', lineHeight: 1.45 }}>{msg}</div>
        {(declineCode || code) && (
          <div style={{ marginTop: 3, fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
            {[declineCode, code].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}

// Banner for orders that received a refund (full or partial). Surfaces
// the amount + the admin's reason note so the customer knows why the
// credit hit their card. Full refund + full status='refunded' shows
// alongside the status pill; partial refund leaves status='delivered'
// and this banner is the only signal that money came back.
function RefundBanner({ amountCents, totalCents, currency, reason, refundedAt }) {
  const isFull = (amountCents || 0) >= (totalCents || 0);
  const fmt = (cents) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: 0,
      }).format((cents || 0) / 100);
    } catch {
      return `$${Math.round((cents || 0) / 100).toLocaleString()}`;
    }
  };
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 6,
        fontSize: 11.5,
        background: 'color-mix(in oklch, var(--warn) 8%, transparent)',
        border: '1px solid color-mix(in oklch, var(--warn) 25%, transparent)',
        color: 'var(--text)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      <Icon.shield size={12} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            color: 'var(--warn)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.15,
          }}
        >
          {isFull ? `Refunded · ${fmt(amountCents)}` : `Partial refund · ${fmt(amountCents)} of ${fmt(totalCents)}`}
        </div>
        {reason && <div style={{ marginTop: 3, color: 'var(--text-soft)', lineHeight: 1.45 }}>{reason}</div>}
        {refundedAt && (
          <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--text-faint)' }}>
            {new Date(refundedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

// Banner for orders cancelled by Stripe-session expiry. Customers can
// place a fresh order from the cart — we don't try to revive cancelled
// rows because their stripe_session_id is dead.
function CancellationBanner({ reason, cancelledAt }) {
  const HUMAN = {
    checkout_session_expired: 'Your Stripe Checkout session expired before payment.',
  };
  const msg = HUMAN[reason] || `Order cancelled (${reason}).`;
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 6,
        fontSize: 11.5,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        color: 'var(--text-soft)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      <Icon.warn size={12} style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div>{msg}</div>
        {cancelledAt && (
          <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--text-faint)' }}>
            {new Date(cancelledAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

function InventoryStrip({ inventory, loaded, skuById, onGoInventory, t }) {
  if (!loaded) return null;
  if (inventory.length === 0) return null;
  // Group by SKU + state
  const groups = {};
  for (const d of inventory) {
    const key = `${d.sku_id}|${d.state}`;
    if (!groups[key]) groups[key] = { sku_id: d.sku_id, state: d.state, count: 0 };
    groups[key].count += 1;
  }
  const deliveredCount = inventory.filter((d) => d.state === 'delivered').length;
  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon.gateway size={13} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('contractor.hardware.inventory_title')}</div>
        <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
          {inventory.length}
        </span>
        <div style={{ flex: 1 }} />
        {onGoInventory && deliveredCount > 0 && (
          <button
            onClick={onGoInventory}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 700,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('contractor.hardware.install_cta', { n: deliveredCount })}
            <Icon.chevR size={10} />
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {t('contractor.hardware.inventory_hint')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {Object.values(groups).map((g) => (
          <span
            key={`${g.sku_id}-${g.state}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 9px',
              borderRadius: 6,
              fontSize: 11,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <strong style={{ fontWeight: 700 }}>{g.count}×</strong>
            <span style={{ color: 'var(--text-soft)' }}>{skuById[g.sku_id]?.name || g.sku_id}</span>
            <Pill tone={g.state === 'installed' ? 'accent' : 'neutral'}>
              {t(`contractor.hardware.inventory_state.${g.state}`)}
            </Pill>
          </span>
        ))}
      </div>
    </Card>
  );
}

// PR (post-PR-B) — Inventory tab. Per-unit list with an Install
// button on every 'delivered' row. Installed/service units render
// read-only with their location breadcrumb so the contractor can
// see which devices are already live and where.
//
// Multi-select + BulkInstallModal lands the bulk-install worksheet
// (PR #215). Selecting multiple delivered rows enables the "Install N
// selected" action which opens a worksheet — one row per device with
// independent location + name fields, plus apply-to-all helpers for
// repetitive deployments (50 displays across 50 rooms).
function HardwareInventory({ inventory, loaded, skuById, onInstalled, t }) {
  const [picking, setPicking] = useState(null); // single-install: one inv row
  const [bulkPicking, setBulkPicking] = useState(null); // bulk-install: array of inv rows
  const [selected, setSelected] = useState(() => new Set()); // inventory_id Set
  // PR #229: spatial install view. List is the default (no UX regression
  // for the standard one-at-a-time flow). Plan view renders rooms as
  // drop targets so deployments feel like "drag this thermostat onto
  // that conference room" instead of dropdown picking.
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'plan'

  if (!loaded) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)', fontSize: 13 }}>
        {t('contractor.hardware.loading_inventory')}
      </div>
    );
  }
  if (inventory.length === 0) {
    return (
      <Card style={{ padding: 40, textAlign: 'center', maxWidth: 520, margin: '20px auto' }}>
        <Icon.gateway size={20} style={{ opacity: 0.6 }} />
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>
          {t('contractor.hardware.inventory_empty_title')}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('contractor.hardware.inventory_empty_body')}
        </div>
      </Card>
    );
  }

  // Sort: delivered first (installable), then installed, then service.
  const sortOrder = { delivered: 0, installed: 1, service: 2 };
  const sorted = [...inventory].sort((a, b) => {
    const sa = sortOrder[a.state] ?? 9;
    const sb = sortOrder[b.state] ?? 9;
    if (sa !== sb) return sa - sb;
    return (a.delivered_at || '').localeCompare(b.delivered_at || '');
  });

  const installable = sorted.filter((d) => d.state === 'delivered');
  const installableIds = new Set(installable.map((d) => d.id));
  // Drop any stale selection ids (e.g. after an install completes and
  // the row leaves the delivered bucket) so the action bar count stays
  // accurate without manual bookkeeping at every call site.
  const visibleSelected = [...selected].filter((id) => installableIds.has(id));
  const allInstallableSelected = installable.length > 0 && visibleSelected.length === installable.length;

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (allInstallableSelected) return new Set();
      const next = new Set(prev);
      for (const d of installable) next.add(d.id);
      return next;
    });
  }
  function openBulk() {
    if (visibleSelected.length === 0) return;
    const rows = installable.filter((d) => visibleSelected.includes(d.id));
    setBulkPicking(rows);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {installable.length > 0 && (
            <input
              type="checkbox"
              checked={allInstallableSelected}
              onChange={toggleAll}
              aria-label={t('contractor.hardware.select_all')}
              style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
          )}
          <Icon.gateway size={13} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('contractor.hardware.inventory_list_title')}</div>
          <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
            {inventory.length}
          </span>
          <div style={{ flex: 1 }} />
          {/* View toggle: list (existing) vs plan (drag-and-drop onto
              a per-floor room grid). Always rendered when there's any
              installable so the affordance is discoverable. */}
          {installable.length > 0 && (
            <div
              style={{
                display: 'inline-flex',
                gap: 2,
                background: 'var(--surface-2)',
                padding: 2,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              {[
                { id: 'list', label: t('contractor.hardware.view_list'), icon: 'grid' },
                { id: 'plan', label: t('contractor.hardware.view_plan'), icon: 'floor' },
              ].map((m) => {
                const IconC = Icon[m.icon] || Icon.grid;
                const active = viewMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setViewMode(m.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 9px',
                      fontSize: 11,
                      fontWeight: 700,
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-soft)',
                      border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <IconC size={10} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}
          {visibleSelected.length > 0 && viewMode === 'list' && (
            <button
              onClick={openBulk}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Icon.gateway size={11} />
              {t('contractor.hardware.bulk_install_cta', { n: visibleSelected.length })}
            </button>
          )}
        </div>
        {viewMode === 'plan' ? (
          <InstallPlanView installable={installable} skuById={skuById} onInstalled={onInstalled} t={t} />
        ) : (
          <div>
            {sorted.map((d, i) => {
              const sku = skuById[d.sku_id];
              const isInstallable = d.state === 'delivered';
              const isChecked = selected.has(d.id);
              return (
                <div
                  key={d.id}
                  style={{
                    padding: '10px 16px',
                    display: 'grid',
                    gridTemplateColumns: 'auto minmax(0, 1fr) auto auto auto',
                    alignItems: 'center',
                    gap: 12,
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    background: isChecked ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : 'transparent',
                  }}
                >
                  {isInstallable ? (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(d.id)}
                      aria-label={t('contractor.hardware.select_row')}
                      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent)' }}
                    />
                  ) : (
                    <span style={{ width: 14, height: 14 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{sku?.name || d.sku_id}</div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: 'var(--text-dim)',
                        marginTop: 2,
                        fontFamily: 'var(--mono)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {d.serial}
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                    {d.delivered_at ? new Date(d.delivered_at).toLocaleDateString() : '—'}
                  </div>
                  <Pill tone={d.state === 'installed' ? 'accent' : d.state === 'service' ? 'warn' : 'neutral'}>
                    {t(`contractor.hardware.inventory_state.${d.state}`)}
                  </Pill>
                  {isInstallable ? (
                    <button
                      onClick={() => setPicking(d)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 12px',
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {t('contractor.hardware.install')}
                      <Icon.chevR size={10} />
                    </button>
                  ) : (
                    <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {picking && (
        <InstallModal
          inv={picking}
          sku={skuById[picking.sku_id]}
          onClose={() => setPicking(null)}
          onDone={() => {
            setPicking(null);
            onInstalled();
          }}
          t={t}
        />
      )}
      {bulkPicking && (
        <BulkInstallModal
          rows={bulkPicking}
          skuById={skuById}
          onClose={() => setBulkPicking(null)}
          onDone={(installedIds) => {
            // Drop only successfully installed rows from the selection
            // so the user can fix any errors without re-checking the rest.
            setSelected((prev) => {
              const next = new Set(prev);
              for (const id of installedIds) next.delete(id);
              return next;
            });
            if (installedIds.length === bulkPicking.length) setBulkPicking(null);
            onInstalled();
          }}
          t={t}
        />
      )}
    </div>
  );
}

// Install modal: dropdown of installable locations (RLS-filtered)
// grouped by building, optional device name, submits the
// install_inventory_device RPC.
// InstallPlanView — drag-and-drop install on a per-floor room grid.
//
// Two-column layout:
//   Left: pending inventory (delivered, not yet installed). Each card
//         is HTML5-draggable; dataTransfer carries the inventory_id.
//   Right: building → floor picker on top, then a grid of room cards
//          for the selected floor. Each room is a drop target.
//
// On drop: install_inventory_device(inventory, location, sku-name) →
// the just-installed item disappears from the sidebar + the room card
// shows a "+1 installed" pulse. Refreshes via the parent's onInstalled
// callback (same as the single + bulk install paths) so the inventory
// list re-renders with the new state.
//
// Not literally a floor plan with x/y room coordinates — that would
// need per-floor SVG layouts we don't have for every building. This
// IS spatial in the sense that rooms render as discrete tiles on a
// per-floor page; the drag-target model is the same as the floor-plan
// fantasy. Adding a real spatial layout is a follow-up that swaps the
// CSS grid for an SVG canvas backed by FloorPlan.jsx coords.
function InstallPlanView({ installable, skuById, onInstalled, t }) {
  const { byBuilding, loaded } = useInstallableLocations();
  // Each room shows its parent floor. Build a few derived maps once.
  const buildings = React.useMemo(() => {
    if (!loaded) return [];
    // byBuilding is keyed by the location-id prefix (e.g. 'hq', 'feb2').
    // Each value is an array of non-building/-ecosystem rows. We want a
    // pickable label per prefix; pull from the rooms' shared root.
    const out = [];
    for (const [rootId, rows] of Object.entries(byBuilding)) {
      // The building row itself is NOT in `locations` (the hook filters
      // it out), so fall back to the prefix for display.
      const name =
        rootId === 'hq'
          ? 'Meridian HQ'
          : rootId === 'feb2'
            ? 'First Empire Bank'
            : rows[0]?.id?.split('-')[0] || rootId;
      out.push({ id: rootId, name, rowCount: rows.length });
    }
    return out.sort((a, b) => b.rowCount - a.rowCount);
  }, [byBuilding, loaded]);
  const [buildingId, setBuildingId] = useState(null);
  React.useEffect(() => {
    if (!buildingId && buildings.length > 0) setBuildingId(buildings[0].id);
  }, [buildings, buildingId]);

  const floors = React.useMemo(() => {
    if (!buildingId) return [];
    const rows = byBuilding[buildingId] || [];
    return rows
      .filter((l) => l.kind === 'floor')
      .sort((a, b) => {
        // Natural sort by trailing number so Floor 2 sits before Floor 18.
        const na = Number((a.name.match(/(\d+)/) || [])[1] || 0);
        const nb = Number((b.name.match(/(\d+)/) || [])[1] || 0);
        return na - nb;
      });
  }, [buildingId, byBuilding]);
  const [floorId, setFloorId] = useState(null);
  React.useEffect(() => {
    if (floors.length > 0 && (!floorId || !floors.find((f) => f.id === floorId))) {
      setFloorId(floors[0].id);
    }
  }, [floors, floorId]);

  // Rooms on the selected floor = children of the floor (parent_id =
  // floorId). Skip the floor itself + zones/positions (we only render
  // installable terminal rooms; zones are operational, not physical).
  const rooms = React.useMemo(() => {
    if (!floorId) return [];
    const rows = byBuilding[buildingId] || [];
    return rows.filter((l) => l.parent_id === floorId).sort((a, b) => a.name.localeCompare(b.name));
  }, [byBuilding, buildingId, floorId]);

  // Live drop-state per-room — keyed by room id. {busy, error, justInstalled, count}.
  const [roomState, setRoomState] = useState({});
  const [dragging, setDragging] = useState(null); // inventory_id being dragged

  function setRoom(id, patch) {
    setRoomState((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }

  async function handleDrop(roomId, invId) {
    const inv = installable.find((i) => i.id === invId);
    if (!inv) return;
    setRoom(roomId, { busy: true, error: null });
    try {
      const name = skuById[inv.sku_id]?.name || inv.sku_id;
      await installInventoryDevice({ inventoryId: invId, locationId: roomId, name });
      setRoom(roomId, {
        busy: false,
        justInstalled: true,
        count: (roomState[roomId]?.count || 0) + 1,
      });
      // Drop the just-installed pulse after a moment so a rapid second
      // drop still animates.
      setTimeout(() => setRoom(roomId, { justInstalled: false }), 1200);
      onInstalled();
    } catch (e) {
      setRoom(roomId, { busy: false, error: e?.message || String(e) });
    }
  }

  if (!loaded) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12.5 }}>
        {t('contractor.hardware.plan_loading')}
      </div>
    );
  }

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', gap: 0, minHeight: 360 }}
    >
      {/* Inventory sidebar */}
      <div
        style={{
          borderRight: '1px solid var(--border)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: 'color-mix(in oklch, var(--surface-2) 50%, transparent)',
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: 0.15,
          }}
        >
          {t('contractor.hardware.plan_pending_title', { n: installable.length })}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', lineHeight: 1.4 }}>
          {t('contractor.hardware.plan_pending_hint')}
        </div>
        {installable.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontStyle: 'italic', padding: '8px 0' }}>
            {t('contractor.hardware.plan_pending_empty')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {installable.map((inv) => {
              const sku = skuById[inv.sku_id];
              const isDragging = dragging === inv.id;
              return (
                <div
                  key={inv.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', inv.id);
                    setDragging(inv.id);
                  }}
                  onDragEnd={() => setDragging(null)}
                  style={{
                    padding: '8px 10px',
                    background: isDragging ? 'var(--accent-soft)' : 'var(--surface)',
                    border: `1px solid ${isDragging ? 'var(--accent-line)' : 'var(--border)'}`,
                    borderRadius: 7,
                    cursor: 'grab',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    userSelect: 'none',
                    opacity: isDragging ? 0.6 : 1,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{sku?.name || inv.sku_id}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-faint)',
                      fontFamily: 'var(--mono)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {inv.serial}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floor canvas */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.15,
            }}
          >
            {t('contractor.hardware.plan_building_label')}
          </label>
          <select value={buildingId || ''} onChange={(e) => setBuildingId(e.target.value)} style={pickerStyle()}>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <label
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.15,
            }}
          >
            {t('contractor.hardware.plan_floor_label')}
          </label>
          <select
            value={floorId || ''}
            onChange={(e) => setFloorId(e.target.value)}
            disabled={floors.length === 0}
            style={pickerStyle()}
          >
            {floors.length === 0 && <option value="">{t('contractor.hardware.plan_no_floors')}</option>}
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {t('contractor.hardware.plan_rooms_count', { n: rooms.length })}
          </span>
        </div>
        {rooms.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--text-faint)',
              fontSize: 12.5,
              fontStyle: 'italic',
            }}
          >
            {t('contractor.hardware.plan_rooms_empty')}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 8,
            }}
          >
            {rooms.map((r) => (
              <RoomDropTile
                key={r.id}
                room={r}
                state={roomState[r.id]}
                onDrop={(invId) => handleDrop(r.id, invId)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Per-room drop target. dragOver toggles a highlight + onDrop fires the
// install. justInstalled flash + cumulative count chip keep the
// feedback loop crisp for batch deployments ("I just installed 3
// devices on this floor").
function RoomDropTile({ room, state, onDrop, t }) {
  const [hover, setHover] = useState(false);
  const busy = !!state?.busy;
  const justInstalled = !!state?.justInstalled;
  const count = state?.count || 0;
  const err = state?.error;

  // Color hint by kind so the operator can visually scan the floor.
  // Falls back to neutral for unknown kinds.
  const kindAccent =
    {
      restroom: 'color-mix(in oklch, var(--accent) 12%, transparent)',
      meeting_room: 'color-mix(in oklch, var(--ok) 12%, transparent)',
      conference_room: 'color-mix(in oklch, var(--ok) 12%, transparent)',
      boardroom: 'color-mix(in oklch, var(--ok) 14%, transparent)',
      lounge: 'color-mix(in oklch, var(--warn) 10%, transparent)',
      cafeteria: 'color-mix(in oklch, var(--warn) 12%, transparent)',
      server_room: 'color-mix(in oklch, var(--risk) 10%, transparent)',
      mailroom: 'color-mix(in oklch, var(--accent) 8%, transparent)',
      lobby: 'var(--surface-2)',
    }[room.kind] || 'var(--surface-2)';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!hover) setHover(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const invId = e.dataTransfer.getData('text/plain');
        if (invId) onDrop(invId);
      }}
      style={{
        position: 'relative',
        padding: '10px 12px',
        minHeight: 64,
        background: hover
          ? 'var(--accent-soft)'
          : justInstalled
            ? 'color-mix(in oklch, var(--ok) 14%, transparent)'
            : kindAccent,
        border: `1px solid ${hover ? 'var(--accent)' : justInstalled ? 'var(--ok)' : 'var(--border)'}`,
        borderRadius: 7,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        transition: 'background .15s, border-color .15s',
        opacity: busy ? 0.65 : 1,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{room.name}</div>
      <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.15 }}>
        {room.kind}
      </div>
      {count > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            padding: '2px 7px',
            fontSize: 10,
            fontWeight: 800,
            background: 'var(--ok)',
            color: '#fff',
            borderRadius: 999,
          }}
        >
          +{count}
        </div>
      )}
      {busy && (
        <div style={{ fontSize: 10, color: 'var(--text-soft)', fontStyle: 'italic' }}>
          {t('contractor.hardware.plan_installing')}
        </div>
      )}
      {err && (
        <div style={{ fontSize: 10, color: 'var(--risk)', fontFamily: 'var(--mono)', wordBreak: 'break-word' }}>
          {err}
        </div>
      )}
    </div>
  );
}

function pickerStyle() {
  return {
    padding: '5px 8px',
    fontSize: 12,
    fontWeight: 600,
    background: 'var(--surface-2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontFamily: 'inherit',
    minWidth: 120,
  };
}

function InstallModal({ inv, sku, onClose, onDone, t }) {
  const { locations, byBuilding, loaded } = useInstallableLocations();
  const [locId, setLocId] = useState('');
  const [name, setName] = useState(sku?.name || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const buildingNames = useMemo(() => {
    // Build display labels for each building group from the locations
    // we already have. If a locations row's id IS a building (no '-'),
    // use its name; otherwise just use the prefix.
    const map = {};
    for (const loc of locations) {
      const prefix = (loc.id || '').split('-')[0];
      if (!map[prefix]) {
        // Look for an exact match of the prefix as a location id (the
        // building row itself), else fall back to capitalized prefix.
        const buildingRow = locations.find((l) => l.id === prefix);
        map[prefix] = buildingRow?.name || prefix.toUpperCase();
      }
    }
    return map;
  }, [locations]);

  async function submit() {
    if (!locId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await installInventoryDevice({ inventoryId: inv.id, locationId: locId, name });
      onDone();
    } catch (e) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,16,32,0.45)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(540px, 100%)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.gateway size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
            {t('contractor.hardware.install_title', { name: sku?.name || inv.sku_id })}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}
          >
            <Icon.close size={14} />
          </button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.55 }}>
            {t('contractor.hardware.install_body')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600 }}>
              {t('contractor.hardware.install_serial')}
            </span>
            <div
              style={{
                padding: '7px 10px',
                fontSize: 12,
                fontFamily: 'var(--mono)',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-soft)',
                wordBreak: 'break-all',
              }}
            >
              {inv.serial}
            </div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600 }}>
              {t('contractor.hardware.install_location_label')} *
            </span>
            <select
              value={locId}
              onChange={(e) => setLocId(e.target.value)}
              disabled={busy || !loaded}
              style={{
                padding: '7px 9px',
                fontSize: 12,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'inherit',
              }}
            >
              <option value="">
                {loaded
                  ? t('contractor.hardware.install_pick_location')
                  : t('contractor.hardware.install_loading_locations')}
              </option>
              {Object.entries(byBuilding).map(([root, list]) => (
                <optgroup key={root} label={buildingNames[root] || root}>
                  {list.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} · {loc.kind} · {loc.id}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600 }}>
              {t('contractor.hardware.install_name_label')}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              placeholder={t('contractor.hardware.install_name_placeholder')}
              style={{
                padding: '7px 9px',
                fontSize: 12,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'inherit',
              }}
            />
          </label>
          {err && (
            <div
              style={{
                padding: 10,
                borderRadius: 6,
                fontSize: 11,
                background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
                color: 'var(--risk)',
                fontFamily: 'var(--mono)',
              }}
            >
              {err}
            </div>
          )}
        </div>
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('contractor.hardware.install_cancel')}
          </button>
          <button
            onClick={submit}
            disabled={busy || !locId}
            style={{
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 700,
              background: busy || !locId ? 'var(--surface-3)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: busy || !locId ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy || !locId ? 0.6 : 1,
            }}
          >
            {busy ? t('contractor.hardware.installing') : t('contractor.hardware.install_submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

// BulkInstallModal — worksheet for installing many devices in one pass.
//
// Surface anatomy:
//   - One row per selected inventory_device (sku + serial readonly +
//     location picker + name input + per-row error slot)
//   - Bulk-apply header: a single location picker that fills every row
//     when "Apply to all" is clicked, plus an auto-name button that
//     suggests "<location-name> <sku-name>" for any rows missing a name
//   - Submit loops install_inventory_device sequentially (the RPC is
//     atomic but we don't want a partial transaction surfacing as a
//     single failure for the whole worksheet — sequential gives us
//     per-row error reporting)
//   - Per-row errors are kept inline; successful rows visually disable
//     so the user can fix the remaining failures + resubmit
function BulkInstallModal({ rows, skuById, onClose, onDone, t }) {
  const { locations, byBuilding, loaded } = useInstallableLocations();
  // Per-row state keyed by inventory_device.id. Initial values: empty
  // location, name defaulted to the SKU's display name (the same
  // default the single-install modal uses).
  const [worksheet, setWorksheet] = useState(() => {
    const init = {};
    for (const r of rows) {
      init[r.id] = {
        locId: '',
        name: skuById[r.sku_id]?.name || '',
        status: 'pending', // 'pending' | 'installing' | 'done' | 'error'
        error: null,
      };
    }
    return init;
  });
  const [bulkLocId, setBulkLocId] = useState('');
  const [busy, setBusy] = useState(false);

  // Same buildingNames trick as InstallModal so the picker reads
  // "Meridian HQ > Floor 12 > Restroom" rather than raw IDs. The
  // helper is identical; we'd extract to a shared util if we needed
  // it in a third site.
  const buildingNames = useMemo(() => {
    const map = {};
    for (const loc of locations) {
      const prefix = (loc.id || '').split('-')[0];
      if (!map[prefix]) {
        const buildingRow = locations.find((l) => l.id === prefix);
        map[prefix] = buildingRow?.name || prefix.toUpperCase();
      }
    }
    return map;
  }, [locations]);

  // Memoize the rendered <option> list so we don't rebuild it for
  // every row's select. With 50 rows × 200 locations that's the
  // difference between snappy and chuggy on a typical install batch.
  const optionGroups = useMemo(
    () => (
      <>
        <option value="">
          {loaded ? t('contractor.hardware.install_pick_location') : t('contractor.hardware.install_loading_locations')}
        </option>
        {Object.entries(byBuilding).map(([root, list]) => (
          <optgroup key={root} label={buildingNames[root] || root}>
            {list.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} · {loc.kind}
              </option>
            ))}
          </optgroup>
        ))}
      </>
    ),
    [byBuilding, buildingNames, loaded, t],
  );

  function setRow(id, patch) {
    setWorksheet((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }
  function applyLocationToAll() {
    if (!bulkLocId) return;
    setWorksheet((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        // Skip rows already installed; they're locked.
        if (next[r.id].status === 'done') continue;
        next[r.id] = { ...next[r.id], locId: bulkLocId };
      }
      return next;
    });
  }
  // Auto-name pattern: "<location-name> <sku-name>" for any blank /
  // default-SKU-named row. Picks up the location name from the
  // already-selected locId per row.
  function autoNameAll() {
    const locById = Object.fromEntries(locations.map((l) => [l.id, l]));
    setWorksheet((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        const w = next[r.id];
        if (w.status === 'done') continue;
        const loc = locById[w.locId];
        if (!loc) continue;
        const skuName = skuById[r.sku_id]?.name || r.sku_id;
        next[r.id] = { ...w, name: `${loc.name} ${skuName}` };
      }
      return next;
    });
  }

  async function submit() {
    if (busy) return;
    // Validate: every not-yet-done row needs a location. Highlight bad
    // rows with an inline error instead of refusing the whole submit.
    let missingLoc = false;
    setWorksheet((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        const w = next[r.id];
        if (w.status === 'done') continue;
        if (!w.locId) {
          missingLoc = true;
          next[r.id] = { ...w, status: 'error', error: t('contractor.hardware.bulk_err_missing_location') };
        } else if (w.status === 'error') {
          // Clear stale errors so retries report fresh state.
          next[r.id] = { ...w, status: 'pending', error: null };
        }
      }
      return next;
    });
    if (missingLoc) return;

    setBusy(true);
    const installed = [];
    // Sequential install: per-row error visibility > parallel speed.
    // Each install_inventory_device call is a small write transaction
    // so 50 rows ≈ a few seconds at worst.
    for (const r of rows) {
      const w = worksheet[r.id];
      if (w.status === 'done') continue;
      setRow(r.id, { status: 'installing', error: null });
      try {
        await installInventoryDevice({ inventoryId: r.id, locationId: w.locId, name: w.name });
        setRow(r.id, { status: 'done', error: null });
        installed.push(r.id);
      } catch (e) {
        setRow(r.id, { status: 'error', error: e?.message || String(e) });
      }
    }
    setBusy(false);
    onDone(installed);
  }

  const doneCount = Object.values(worksheet).filter((w) => w.status === 'done').length;
  const errorCount = Object.values(worksheet).filter((w) => w.status === 'error').length;
  const allDone = doneCount === rows.length;

  return (
    <div
      onClick={busy ? undefined : onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,16,32,0.45)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(960px, 100%)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.gateway size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
            {t('contractor.hardware.bulk_title', { n: rows.length })}
          </div>
          {(doneCount > 0 || errorCount > 0) && (
            <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>
              {doneCount > 0 && (
                <span style={{ color: 'var(--ok)', fontWeight: 700 }}>
                  {t('contractor.hardware.bulk_done_count', { n: doneCount })}
                </span>
              )}
              {doneCount > 0 && errorCount > 0 && ' · '}
              {errorCount > 0 && (
                <span style={{ color: 'var(--risk)', fontWeight: 700 }}>
                  {t('contractor.hardware.bulk_error_count', { n: errorCount })}
                </span>
              )}
            </span>
          )}
          <button
            onClick={busy ? undefined : onClose}
            disabled={busy}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: busy ? 'default' : 'pointer',
              color: 'var(--text-dim)',
              opacity: busy ? 0.5 : 1,
            }}
          >
            <Icon.close size={14} />
          </button>
        </div>

        {/* Bulk-apply header: shared location picker + helper actions */}
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>
            {t('contractor.hardware.bulk_apply_label')}
          </span>
          <select
            value={bulkLocId}
            onChange={(e) => setBulkLocId(e.target.value)}
            disabled={busy || !loaded}
            style={{
              padding: '6px 8px',
              fontSize: 12,
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontFamily: 'inherit',
              flex: 1,
              minWidth: 220,
            }}
          >
            {optionGroups}
          </select>
          <button
            onClick={applyLocationToAll}
            disabled={busy || !bulkLocId}
            style={{
              padding: '6px 10px',
              fontSize: 11.5,
              fontWeight: 700,
              background: bulkLocId ? 'var(--accent-soft)' : 'var(--surface-3)',
              color: bulkLocId ? 'var(--accent)' : 'var(--text-faint)',
              border: '1px solid var(--accent-line)',
              borderRadius: 6,
              cursor: busy || !bulkLocId ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('contractor.hardware.bulk_apply_all')}
          </button>
          <button
            onClick={autoNameAll}
            disabled={busy}
            style={{
              padding: '6px 10px',
              fontSize: 11.5,
              fontWeight: 700,
              background: 'var(--surface)',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('contractor.hardware.bulk_auto_name')}
          </button>
        </div>

        {/* Worksheet table */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={thStyle}>{t('contractor.hardware.bulk_col_device')}</th>
                <th style={thStyle}>{t('contractor.hardware.bulk_col_location')}</th>
                <th style={thStyle}>{t('contractor.hardware.bulk_col_name')}</th>
                <th style={{ ...thStyle, width: 80 }}>{t('contractor.hardware.bulk_col_status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const w = worksheet[r.id];
                const sku = skuById[r.sku_id];
                const isDone = w.status === 'done';
                const isInstalling = w.status === 'installing';
                const isError = w.status === 'error';
                return (
                  <tr
                    key={r.id}
                    style={{
                      borderTop: '1px solid var(--border)',
                      opacity: isDone ? 0.55 : 1,
                      background: isError ? 'color-mix(in oklch, var(--risk) 5%, transparent)' : 'transparent',
                    }}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{sku?.name || r.sku_id}</div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: 'var(--text-dim)',
                          fontFamily: 'var(--mono)',
                          marginTop: 2,
                          wordBreak: 'break-all',
                        }}
                      >
                        {r.serial}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <select
                        value={w.locId}
                        onChange={(e) => setRow(r.id, { locId: e.target.value })}
                        disabled={busy || isDone || !loaded}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          fontSize: 12,
                          background: isDone ? 'var(--surface-2)' : 'var(--surface)',
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          fontFamily: 'inherit',
                        }}
                      >
                        {optionGroups}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={w.name}
                        onChange={(e) => setRow(r.id, { name: e.target.value })}
                        disabled={busy || isDone}
                        placeholder={t('contractor.hardware.install_name_placeholder')}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          fontSize: 12,
                          background: isDone ? 'var(--surface-2)' : 'var(--surface)',
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          fontFamily: 'inherit',
                        }}
                      />
                      {isError && w.error && (
                        <div
                          style={{
                            marginTop: 4,
                            padding: '4px 6px',
                            fontSize: 10.5,
                            background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
                            color: 'var(--risk)',
                            fontFamily: 'var(--mono)',
                            borderRadius: 4,
                            wordBreak: 'break-word',
                          }}
                        >
                          {w.error}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {isDone && <Pill tone="accent">{t('contractor.hardware.bulk_status_done')}</Pill>}
                      {isInstalling && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>…</span>}
                      {isError && <Pill tone="risk">{t('contractor.hardware.bulk_status_error')}</Pill>}
                      {w.status === 'pending' && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ flex: 1, fontSize: 11, color: 'var(--text-soft)' }}>
            {t('contractor.hardware.bulk_footer_hint')}
          </div>
          <button
            onClick={busy ? undefined : onClose}
            disabled={busy}
            style={{
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy ? 0.5 : 1,
            }}
          >
            {allDone ? t('contractor.hardware.bulk_close') : t('contractor.hardware.install_cancel')}
          </button>
          {!allDone && (
            <button
              onClick={submit}
              disabled={busy}
              style={{
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 700,
                background: busy ? 'var(--surface-3)' : 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: busy ? 'default' : 'pointer',
                fontFamily: 'inherit',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy
                ? t('contractor.hardware.bulk_installing_now')
                : t('contractor.hardware.bulk_install_remaining', { n: rows.length - doneCount })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 10.5,
  fontWeight: 700,
  color: 'var(--text-dim)',
  letterSpacing: 0.15,
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)',
};
const tdStyle = {
  padding: '10px 12px',
  verticalAlign: 'top',
};

const addCartButtonStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 10px',
  fontSize: 11.5,
  fontWeight: 700,
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  border: '1px solid var(--accent-line)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const qtyButtonStyles = {
  width: 22,
  height: 22,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 700,
  background: 'var(--surface-2)',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
  lineHeight: 1,
};

const ORDER_STATUS_TONE = {
  cart: 'neutral',
  placed: 'info',
  confirmed: 'info',
  shipped: 'accent',
  delivered: 'ok',
  cancelled: 'risk',
  refunded: 'warn',
};

export { ContractorHardware };
