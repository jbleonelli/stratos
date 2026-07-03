// Chat LLM-grounding context builders — pure functions that turn the live
// org/building/servicing/asks data into the system-context text blocks the chat
// sends to the model. Extracted from Chat.jsx (Phase 3) so ChatPanel keeps just
// its UI + streaming orchestration; these are stateless string builders. Owner
// and contractor variants share appendServicingGrounding (module-internal).

// Shared servicing grounding for the chat context — the live per-line/per-area
// roll-up + the ACTUAL open/overdue rows. Appended to BOTH the owner and the
// contractor context so a drill-in names real areas and items instead of
// punting. Mutates `lines`.
function appendServicingGrounding(lines, servicing, building, openItems) {
  if (servicing?.loaded && servicing.overall?.total > 0) {
    const SVC_LABEL = {
      cleaning: 'Cleaning (incl. restrooms)',
      security: 'Security',
      maintenance: 'Maintenance',
      hospitality: 'Hospitality',
    };
    lines.push(`Live service performance at ${building?.name || 'this building'} (now):`);
    lines.push(
      `  Overall: ${servicing.overall.adh}% SLA adherence · ${servicing.overall.overdue} overdue · ${servicing.overall.open} open request(s)`,
    );
    for (const [k, s] of Object.entries(servicing.byTop || {})) {
      if (!s) continue;
      lines.push(
        `  - ${SVC_LABEL[k] || k}: ${s.adh}% adherence · ${s.overdue} overdue · ${s.open} open · ${s.total} areas`,
      );
    }
    // Per-area breakdown so Merlin can answer about ANY specific area the user
    // names — GROUPED UNDER ITS PARENT LINE so it never mis-attributes an area to
    // the wrong line (e.g. Concierge / Mail / F&B are HOSPITALITY, not cleaning).
    const byLine = {};
    for (const r of servicing.rows || []) {
      if (!r || !r.domain) continue;
      const top = String(r.domain).split('_')[0];
      (byLine[top] ||= []).push(r);
    }
    if (Object.keys(byLine).length > 0) {
      lines.push(
        `  Every serviced area, grouped under its line (the user can ask about any by name; an area belongs ONLY to the line it is listed under):`,
      );
      for (const [top, areaRows] of Object.entries(byLine)) {
        lines.push(`  ${SVC_LABEL[top] || top}:`);
        for (const r of areaRows) {
          const label = (
            String(r.domain).includes('_') ? String(r.domain).split('_').slice(1).join(' ') : String(r.domain)
          ).replace(/\b\w/g, (c) => c.toUpperCase());
          lines.push(
            `    · ${label}: ${Math.round(r.adherence_pct ?? 0)}% adherence · ${r.overdue_now || 0} overdue · ${r.open_now || 0} open · ${r.items_total || 0} items`,
          );
        }
      }
    }
    lines.push('');
  }

  // The ACTUAL open/overdue items right now (mig 234 / 264 — up to 6 per line) so
  // Merlin names specifics on a drill-in instead of "I don't have the line-item
  // detail".
  if (Array.isArray(openItems) && openItems.length > 0) {
    const SVC_LABEL2 = {
      cleaning: 'Cleaning',
      security: 'Security',
      maintenance: 'Maintenance',
      hospitality: 'Hospitality',
    };
    const byLine2 = {};
    for (const it of openItems) (byLine2[it.line] ||= []).push(it);
    lines.push(
      'Open & overdue items right now — these are the ACTUAL rows. Name them specifically when the user drills in. If they ask for more than is listed here, infer the driver from the pattern and commit — never say you lack the detail:',
    );
    for (const [ln, its] of Object.entries(byLine2)) {
      lines.push(`  ${SVC_LABEL2[ln] || ln}:`);
      for (const it of its) {
        const detail =
          it.open_count > 0
            ? `${it.open_count} open request${it.open_count === 1 ? '' : 's'}${it.hours_over != null ? ` · ${it.hours_over}h since service` : ''}`
            : `${it.hours_over}h over SLA`;
        lines.push(`    · ${it.item} — ${detail}`);
      }
    }
    lines.push('');
  }
}

// Owner (Facility Manager) servicing grounding — the building-wide roll-up + the
// actual overdue rows. The owner persona used to get NO servicing context at all
// (only contractors did), so a drill-in ("show the 2 overdue security items")
// had nothing real to name and punted. Returns null when there's no live
// servicing data so the prompt stays lean for non-servicing orgs.
export function buildOwnerContextBlock(activeOrg, building, servicing, openItems) {
  const hasRollup = servicing?.loaded && servicing.overall?.total > 0;
  const hasItems = Array.isArray(openItems) && openItems.length > 0;
  if (!hasRollup && !hasItems) return null;
  const lines = [
    `# Live servicing at ${building?.name || 'this building'} · ${activeOrg?.name || 'this organization'}`,
    '',
  ];
  appendServicingGrounding(lines, servicing, building, openItems);
  return lines.join('\n').trim() || null;
}

// Phase 8.11 — assemble a compact portfolio context for the chat
// endpoint when the active org is a contractor. Plain text so it
// drops into the system prompt's `Additional context for this turn`
// slot. Bounded — top contracts + most recent proposals only — so
// long-tail portfolios don't blow the context budget.
export function buildContractorContextBlock(activeOrg, analytics, servicing, building, openItems) {
  if (!analytics?.loaded) return null;
  const { contracts, proposals, metrics } = analytics;
  const cur = metrics.currency || 'USD';
  const lines = [];
  lines.push(`# Contractor portfolio · ${activeOrg?.name || 'this contractor'}`);
  lines.push('');
  lines.push(`Active contracts: ${metrics.activeContracts}`);
  lines.push(
    `Monthly run rate: ${Math.round(metrics.monthlyRunRate).toLocaleString()} ${cur}/mo (annualized ${Math.round(metrics.monthlyRunRate * 12).toLocaleString()} ${cur})`,
  );
  if (metrics.lifetimeRevenue > 0) {
    lines.push(
      `Lifetime revenue: $${Math.round(metrics.lifetimeRevenue).toLocaleString()} (current monthly_value × months elapsed)`,
    );
  }
  if (metrics.winRate != null) {
    lines.push(
      `Proposal win rate: ${Math.round(metrics.winRate * 100)}% (${metrics.proposalsAccepted} accepted of ${metrics.proposalsTotal} total)`,
    );
  }
  if (metrics.decisionDays != null) {
    lines.push(`Median FM decision time: ${metrics.decisionDays} days submitted → decided`);
  }
  if (metrics.proposalsPending > 0) {
    lines.push(
      `Awaiting decision: ${metrics.proposalsPending} proposal${metrics.proposalsPending === 1 ? '' : 's'} (submitted or countered)`,
    );
  }
  if (metrics.biggestImprovement) {
    const bi = metrics.biggestImprovement;
    lines.push(
      `Biggest pilot improvement (last 90d): ${bi.sla_name} +${bi.delta}pp from "${bi.pilot_title}"${bi.vendor_name ? ` (partner: ${bi.vendor_name})` : ''}`,
    );
  }
  lines.push('');

  // Live service performance (roll-up) + the actual overdue rows. Shared with the
  // owner context so BOTH personas can name specific areas and drill-in items.
  appendServicingGrounding(lines, servicing, building, openItems);

  // Per-contract list (cap at 6 to keep prompt cheap)
  const sortedContracts = [...(contracts || [])]
    .filter((c) => c.status === 'active' || c.status === 'draft')
    .slice(0, 6);
  if (sortedContracts.length > 0) {
    lines.push(`Contracts:`);
    for (const c of sortedContracts) {
      const value = c.monthly_value
        ? `$${Number(c.monthly_value).toLocaleString()}/mo ${c.currency || ''}`.trim()
        : 'no value set';
      const ends = c.end_date ? ` · ends ${c.end_date}` : '';
      lines.push(`  - "${c.name}" [${c.status}] with ${c.manager_org?.name || 'client'} — ${value}${ends}`);
    }
    lines.push('');
  }

  // Recent proposals (cap at 8)
  const recentProposals = [...(proposals || [])]
    .sort((a, b) => (b.submitted_at || b.decided_at || '').localeCompare(a.submitted_at || a.decided_at || ''))
    .slice(0, 8);
  if (recentProposals.length > 0) {
    lines.push(`Recent proposals:`);
    for (const p of recentProposals) {
      const c = (contracts || []).find((cc) => cc.id === p.contract_id);
      const target = c ? `on "${c.name}"` : '';
      const delta = p.monthly_value_delta != null ? ` (+${p.monthly_value_delta}/mo)` : '';
      const when = p.decided_at
        ? `decided ${p.decided_at.slice(0, 10)}`
        : p.submitted_at
          ? `submitted ${p.submitted_at.slice(0, 10)}`
          : 'drafted';
      lines.push(`  - [${p.status}] ${target}${delta} — ${when}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
