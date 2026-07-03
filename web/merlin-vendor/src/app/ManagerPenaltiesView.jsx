// ManagerPenaltiesView — FM side: the client SETS the SLA penalty terms each
// contractor faces if they miss the agreed service level. One row per active
// contract (a service line); the FM edits the adherence floor, the rate (% of
// monthly value per point below the floor), the cap, and the escalation on
// repeat. Writes via set_contract_penalty (mig 237, party-guarded to the
// manager org). Also surfaces the realized track record from the penalty ledger
// (mig 238) — avoided vs. incurred across contractors. real_estate-org surface
// under OPERATE → Contractors. The contractor sees these terms on ANTICIPATE.

import React, { useMemo, useState } from 'react';
import { Pill, Card } from './primitives.jsx';
import { useSession } from './auth.js';
import { useSL } from './servicing-i18n.js';
import { useFormatCurrency } from './locale-format.js';
import { useManagerContracts } from './contractor-programs-data.js';
import { setContractPenalty, useContractorPenaltyLedger } from './slas-data.js';
import { penaltyTermFor, termSummary, hasAuthoredTerms } from './penalty-model.js';
import { canonicalServiceLine } from './service-line.js';

const LINE_LABEL = {
  cleaning: ['Cleaning', 'Nettoyage'],
  security: ['Security', 'Sécurité'],
  maintenance: ['Maintenance', 'Maintenance'],
  hospitality: ['Hospitality', 'Hôtellerie'],
};

export function ManagerPenaltiesView() {
  const sl = useSL();
  const session = useSession();
  const orgId = session?.organizationId;
  const { contracts, loaded, refresh } = useManagerContracts(orgId);
  const { rows: ledger } = useContractorPenaltyLedger(orgId, { viewerKind: 'manager' });
  const fmtCurrency = useFormatCurrency();

  // Realized this-quarter: trailing 3 ledger months per contract.
  const realized = useMemo(() => {
    const counts = {};
    let avoided = 0;
    let incurred = 0;
    let currency = null;
    for (const r of ledger || []) {
      // rows period-desc
      counts[r.contract_id] = (counts[r.contract_id] || 0) + 1;
      if (counts[r.contract_id] <= 3) {
        avoided += Number(r.amount_avoided) || 0;
        incurred += Number(r.amount_incurred) || 0;
        currency = currency || r.currency;
      }
    }
    return { avoided, incurred, currency };
  }, [ledger]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{sl('SLA penalties', 'Pénalités SLA')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
            {sl(
              'Set the penalty each contractor faces if they miss the agreed SLA — the adherence floor, the rate per point below it, the cap, and how it escalates on repeat. Contractors see these terms and work to avoid them.',
              'Définissez la pénalité encourue par chaque prestataire en cas de manquement au SLA convenu — le seuil d’adhérence, le taux par point en dessous, le plafond et l’escalade en cas de récidive. Les prestataires voient ces conditions et s’attachent à les éviter.',
            )}
          </p>
        </div>
        {(realized.avoided > 0 || realized.incurred > 0) && (
          <div style={{ display: 'flex', gap: 10 }}>
            <Stat
              label={sl('Incurred · 3 mo', 'Appliquées · 3 mois')}
              value={fmtCurrency(realized.incurred, realized.currency)}
              tone={realized.incurred > 0 ? 'risk' : 'neutral'}
            />
            <Stat
              label={sl('Avoided · 3 mo', 'Évitées · 3 mois')}
              value={fmtCurrency(realized.avoided, realized.currency)}
              tone="ok"
            />
          </div>
        )}
      </div>

      {!loaded && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
          {sl('Loading…', 'Chargement…')}
        </div>
      )}
      {loaded && contracts.length === 0 && (
        <Card>
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {sl(
              'No active contractor contracts on this portfolio yet.',
              'Aucun contrat prestataire actif sur ce portefeuille pour l’instant.',
            )}
          </div>
        </Card>
      )}

      {contracts.map((c) => (
        <PenaltyRow key={c.id} contract={c} sl={sl} fmtCurrency={fmtCurrency} onSaved={refresh} />
      ))}
    </div>
  );
}

function PenaltyRow({ contract, sl, fmtCurrency, onSaved }) {
  const line = canonicalServiceLine(contract.service_kind);
  const lp = LINE_LABEL[line] || ['Services', 'Services'];
  const term = penaltyTermFor(contract, line);
  const authored = hasAuthoredTerms(contract);

  const [editing, setEditing] = useState(false);
  const [floor, setFloor] = useState(term.floor_pct);
  const [rate, setRate] = useState(term.rate_pct);
  const [cap, setCap] = useState(term.cap_pct);
  const [esc, setEsc] = useState(term.escalation_pct);
  const [saving, setSaving] = useState(false);

  const begin = () => {
    setFloor(term.floor_pct);
    setRate(term.rate_pct);
    setCap(term.cap_pct);
    setEsc(term.escalation_pct);
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await setContractPenalty({
        contractId: contract.id,
        floorPct: Number(floor),
        ratePct: Number(rate),
        capPct: Number(cap),
        escalationPct: Number(esc),
      });
      onSaved?.();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  const clear = async () => {
    setSaving(true);
    try {
      await setContractPenalty({ contractId: contract.id });
      onSaved?.();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div
        style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: editing ? 12 : 6 }}
      >
        <span style={{ fontSize: 14, fontWeight: 800 }}>{contract.contractor}</span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{sl(lp[0], lp[1])}</span>
        {contract.monthly_value != null && (
          <Pill tone="neutral">
            {fmtCurrency(contract.monthly_value, contract.currency)}/{sl('mo', 'mois')}
          </Pill>
        )}
        <Pill tone={authored ? 'accent' : 'neutral'}>
          {authored ? sl('Custom terms', 'Conditions définies') : sl('Default terms', 'Conditions par défaut')}
        </Pill>
        {!editing && (
          <button onClick={begin} style={linkBtn}>
            {authored ? sl('Edit', 'Modifier') : sl('Set penalty', 'Définir la pénalité')}
          </button>
        )}
      </div>

      {!editing ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          {termSummary(term, sl)}
          {term.escalation_pct > 0
            ? sl(`, +${term.escalation_pct}%/mo on repeat`, `, +${term.escalation_pct}%/mois si répété`)
            : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Field label={sl('Floor %', 'Seuil %')} value={floor} onChange={setFloor} min={50} max={100} />
            <Field label={sl('Rate %/pt', 'Taux %/pt')} value={rate} onChange={setRate} min={0} max={20} step={0.1} />
            <Field label={sl('Cap %', 'Plafond %')} value={cap} onChange={setCap} min={0} max={50} />
            <Field label={sl('Escalation %/mo', 'Escalade %/mois')} value={esc} onChange={setEsc} min={0} max={200} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
            {sl(
              `Preview: below ${floor}% adherence, ${rate}% of ${fmtCurrency(contract.monthly_value, contract.currency)} per point, capped at ${cap}%.`,
              `Aperçu : sous ${floor}% d’adhérence, ${rate}% de ${fmtCurrency(contract.monthly_value, contract.currency)} par point, plafonné à ${cap}%.`,
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? sl('Saving…', 'Enregistrement…') : sl('Save penalty', 'Enregistrer')}
            </button>
            {authored && (
              <button onClick={clear} disabled={saving} style={linkBtn}>
                {sl('Reset to default', 'Réinitialiser')}
              </button>
            )}
            <button onClick={() => setEditing(false)} style={linkBtn}>
              {sl('Cancel', 'Annuler')}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Field({ label, value, onChange, min, max, step = 1 }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--text-soft)' }}>
      <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.2 }}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 84,
          padding: '5px 8px',
          fontSize: 13,
          textAlign: 'right',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--surface)',
          color: 'var(--text)',
        }}
      />
    </label>
  );
}

function Stat({ label, value, tone = 'neutral' }) {
  return (
    <div
      style={{
        minWidth: 120,
        padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: tone === 'neutral' ? 'var(--text-soft)' : `var(--${tone})`,
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const linkBtn = {
  background: 'none',
  border: 'none',
  padding: '2px 0',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--accent)',
  cursor: 'pointer',
};
const primaryBtn = {
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
};
