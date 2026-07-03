// Admin — Device Import section: bulk-provision devices into a building from an
// uploaded spreadsheet. Extracted from Admin.jsx (G2 split). Parses the sheet with
// XLSX (which also stays in Admin.jsx — the Setup doc-upload uses it). Exports
// ImportSection.

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { btnPrimary, btnGhost, thStyle, tdStyle } from './admin-ui.tsx';
import { useT } from './i18n.js';
import { useBuildingsForActiveOrg, addDevicesToLocation, flattenTreeForPicker } from './custom-locations.js';

// ─────────────────────────── Device Import ───────────────────────────

export function ImportSection() {
  const t = useT();
  const buildings = useBuildingsForActiveOrg();
  const [locationId, setLocationId] = useState(Object.keys(buildings)[0] || '');
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [err, setErr] = useState('');
  const [committed, setCommitted] = useState(0);
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErr('');
    setCommitted(0);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      // Use the first sheet unless empty
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
      if (!json.length) {
        setErr(t('admin.import.no_rows'));
        setRows([]);
        return;
      }
      setRows(json);
    } catch (ex) {
      setErr(ex.message || t('admin.import.read_failed'));
      setRows([]);
    }
  };

  const commit = async () => {
    try {
      await addDevicesToLocation(locationId, rows);
      setCommitted(rows.length);
      setRows([]);
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (ex) {
      setErr(ex.message || t('admin.import.import_failed'));
    }
  };

  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.ship size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.section.import')}</div>
        <div style={{ flex: 1 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 600 }}>
            {t('admin.import.target_location')}
          </span>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            style={{
              padding: '9px 12px',
              fontSize: 12.5,
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              fontFamily: 'inherit',
            }}
          >
            {flattenTreeForPicker(buildings, { kind: 'building' }).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 600 }}>
            {t('admin.import.spreadsheet')}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            style={{
              padding: '9px 12px',
              fontSize: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              fontFamily: 'inherit',
            }}
          />
        </label>
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.55 }}>
        {t('admin.import.expected_columns', { cols: 'type, serial, imei, iccid, building, floor, room' })}
      </div>

      {err && <div style={{ color: 'var(--risk)', fontSize: 12, marginBottom: 10 }}>{err}</div>}
      {committed > 0 && (
        <div style={{ color: 'var(--ok)', fontSize: 12, marginBottom: 10 }}>
          {t(committed === 1 ? 'admin.import.imported_one' : 'admin.import.imported_many', { n: committed })}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
            {t('admin.import.preview', { n: rows.length, file: fileName })}
          </div>
          <div
            style={{
              maxHeight: 320,
              overflow: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 11.5,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)' }}>
                <tr>
                  {columns.map((c) => (
                    <th key={c} style={thStyle}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c} style={tdStyle}>
                        {String(r[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <div style={{ padding: 8, textAlign: 'center', color: 'var(--text-dim)' }}>
                {t('admin.import.and_more', { n: rows.length - 50 })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setRows([]);
                setFileName('');
                if (fileRef.current) fileRef.current.value = '';
              }}
              style={btnGhost}
            >
              {t('admin.import.cancel')}
            </button>
            <button onClick={commit} style={btnPrimary}>
              {t(rows.length === 1 ? 'admin.import.commit_one' : 'admin.import.commit_many', { n: rows.length })}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
