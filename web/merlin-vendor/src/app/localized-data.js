// Hooks that merge the English source data with the French overlay
// based on the current language. The shape returned matches the
// original — consumer components don't need to change.
import { useMemo } from 'react';
import { useLanguage } from './i18n.js';
import {
  INCIDENTS_FR,
  ECOSYSTEM_INCIDENTS_FR,
  AGENTS_FR,
  SLAS_FR,
  CONVERSATIONS_FR,
  INSIGHTS_HQ_FR,
  INSIGHTS_ECOSYSTEM_FR,
  INSIGHTS_IMF_FR,
  INSIGHT_CATEGORIES_FR,
} from './data-fr.js';

function mergeField(original, override) {
  return override == null ? original : override;
}

function mergeIncident(inc, frDict) {
  const fr = frDict[inc.id];
  if (!fr) return inc;
  return {
    ...inc,
    title: mergeField(inc.title, fr.title),
    sub: mergeField(inc.sub, fr.sub),
    sla: mergeField(inc.sla, fr.sla),
    status: mergeField(inc.status, fr.status),
  };
}

export function useLocalizedIncidents(incidents, building) {
  const lang = useLanguage();
  return useMemo(() => {
    if (lang !== 'fr' || !Array.isArray(incidents)) return incidents;
    const dict = building?.kind === 'ecosystem' ? ECOSYSTEM_INCIDENTS_FR : INCIDENTS_FR;
    return incidents.map((inc) => mergeIncident(inc, dict));
  }, [lang, incidents, building?.kind]);
}

export function useLocalizedIncident(incident, building) {
  const lang = useLanguage();
  return useMemo(() => {
    if (lang !== 'fr' || !incident) return incident;
    const dict = building?.kind === 'ecosystem' ? ECOSYSTEM_INCIDENTS_FR : INCIDENTS_FR;
    return mergeIncident(incident, dict);
  }, [lang, incident, building?.kind]);
}

export function useLocalizedAgents(agents) {
  const lang = useLanguage();
  return useMemo(() => {
    if (lang !== 'fr' || !Array.isArray(agents)) return agents;
    return agents.map((a) => {
      const fr = AGENTS_FR[a.id];
      if (!fr) return a;
      return { ...a, name: mergeField(a.name, fr.name), tag: mergeField(a.tag, fr.tag) };
    });
  }, [lang, agents]);
}

export function useLocalizedSlas(slas) {
  const lang = useLanguage();
  return useMemo(() => {
    if (lang !== 'fr' || !Array.isArray(slas)) return slas;
    return slas.map((s) => {
      const fr = SLAS_FR[s.id];
      if (!fr) return s;
      return { ...s, name: fr };
    });
  }, [lang, slas]);
}

export function useLocalizedConversations(convs) {
  const lang = useLanguage();
  return useMemo(() => {
    if (lang !== 'fr' || !Array.isArray(convs)) return convs;
    return convs.map((c) => {
      const fr = CONVERSATIONS_FR[c.id];
      if (!fr) return c;
      return { ...c, title: mergeField(c.title, fr.title), when: mergeField(c.when, fr.when) };
    });
  }, [lang, convs]);
}

function mergeInsight(insight, frDict) {
  const fr = frDict[insight.id];
  if (!fr) return insight;
  return {
    ...insight,
    title: mergeField(insight.title, fr.title),
    summary: mergeField(insight.summary, fr.summary),
    secondary_impact: mergeField(insight.secondary_impact, fr.secondary_impact),
    reasoning: fr.reasoning || insight.reasoning,
    dataSources: fr.dataSources || insight.dataSources,
    implementation: fr.implementation || insight.implementation,
  };
}

export function useLocalizedInsights(insights, building) {
  const lang = useLanguage();
  return useMemo(() => {
    if (lang !== 'fr' || !Array.isArray(insights)) return insights;
    const dict =
      building?.variant === 'imf'
        ? INSIGHTS_IMF_FR
        : building?.kind === 'ecosystem'
          ? INSIGHTS_ECOSYSTEM_FR
          : INSIGHTS_HQ_FR;
    return insights.map((i) => mergeInsight(i, dict));
  }, [lang, insights, building?.kind, building?.variant]);
}

// For INSIGHT_CATEGORIES — returns the localized label for a category id.
export function useLocalizedCategoryLabel() {
  const lang = useLanguage();
  return (category, fallback) => {
    if (lang === 'fr' && INSIGHT_CATEGORIES_FR[category?.id || category]) {
      return INSIGHT_CATEGORIES_FR[category?.id || category];
    }
    return category?.label ?? fallback ?? category?.id ?? '';
  };
}
