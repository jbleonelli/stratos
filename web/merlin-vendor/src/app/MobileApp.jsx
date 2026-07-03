// Merlin Mobile — the worker app (Phase-1 spike).
// Plan of record: docs/architecture/mobile-worker-app.md.
//
// A phone-first Merlin for the people DOING the work. Rendered when
// isMobileSurface() is true (mobile.adaptiv.systems, or the sticky `?mobile=1`
// spike flag). Three thumb-reachable tabs:
//
//   Today  — "What can I do now?" hero → the grounded chat, then today's
//            assigned routes/tasks (reuses the WorkerApp assignment queries).
//   Tickets— the worker's tickets + their building's tickets, read-only.
//   Merlin — a thin, worker-GROUNDED chat. The hero interaction (§6): chat is
//            grounded on the worker's assignments instead of a building summary,
//            and answers in the worker's language (§7 — model-native, all five).
//
// Deliberately NOT in this spike (they come with the RLS + push build-out):
// task-completion writes, raise-a-ticket writes, web push, the real subdomain +
// manifest. Writes are stubbed as "coming soon" so the shape stays honest.
//
// Languages: this surface widens the selectable set to EN/FR/DE/ES/PT. The chat
// is fully multilingual day one (the `lang` arg to chatComplete — model-native,
// cheap). UI chrome: the mobile-specific strings below ship in all five; the
// reused desktop `worker.*`/`tab.*` keys are EN/FR/DE and fall back to English
// for ES/PT (the i18n stack fails safe — see §7's decoupling principle).

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { MerlinAvatar, IconBtn } from './primitives.jsx';
import { useSession, logout as doLogout } from './auth.js';
import { useActiveOrg } from './org-data.js';
import { ROLES } from './roles.js';
import { useWorkerToday, TodayTab } from './MobileTodayTab.jsx';
import { TicketsTab } from './MobileTicketsTab.jsx';
import { AskTab } from './MobileAskTab.jsx';
import { alertDialog } from './dialogs.jsx';
import { setLanguage, getLanguage } from './i18n.js';
import { pushSupported, getPushState, enablePush, sendTestPush } from './push.js';

// ───────────────────────── mobile language ─────────────────────────
// The mobile surface widens the selectable set to five. We keep our own key so
// an ES/PT choice (which the desktop i18n's SUPPORTED gate would reject on
// reload) is durable here, without polluting the desktop `merlin-language`.
const MOBILE_LANG_KEY = 'merlin-mobile-lang';
const MOBILE_LANGS = ['en', 'fr', 'de', 'es', 'pt'];
// All five now carry sign-in-chrome DICT coverage (es/pt-translations.js) with an
// English fallback for the rest, so the global UI language tracks the worker's
// choice directly.
const CHROME_LANGS = new Set(['en', 'fr', 'de', 'es', 'pt']);

function loadMobileLang(session) {
  try {
    const s = localStorage.getItem(MOBILE_LANG_KEY);
    if (s && MOBILE_LANGS.includes(s)) return s;
  } catch {
    /* ignore */
  }
  const pref = session?.preferences?.language;
  if (pref && MOBILE_LANGS.includes(pref)) return pref;
  const cur = getLanguage();
  return MOBILE_LANGS.includes(cur) ? cur : 'en';
}

// Mobile-specific chrome strings — full five-language coverage for this small,
// focused set (the §7 "batch-translate the subset" story, delivered inline).
const ML = {
  'header.myday': { en: 'My day', fr: 'Ma journée', de: 'Mein Tag', es: 'Mi día', pt: 'Meu dia' },
  'nav.today': { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy', pt: 'Hoje' },
  'nav.tickets': { en: 'Tickets', fr: 'Tickets', de: 'Tickets', es: 'Tickets', pt: 'Chamados' },
  'nav.ask': { en: 'Merlin', fr: 'Merlin', de: 'Merlin', es: 'Merlin', pt: 'Merlin' },

  'today.eyebrow': { en: 'RIGHT NOW', fr: 'MAINTENANT', de: 'JETZT', es: 'AHORA', pt: 'AGORA' },
  'today.cta': {
    en: 'What can I do now?',
    fr: 'Que puis-je faire maintenant ?',
    de: 'Was kann ich jetzt tun?',
    es: '¿Qué puedo hacer ahora?',
    pt: 'O que posso fazer agora?',
  },
  'today.cta_sub': {
    en: 'Ask Merlin for your next move',
    fr: 'Demandez à Merlin votre prochaine action',
    de: 'Merlin nach dem nächsten Schritt fragen',
    es: 'Pide a Merlin tu siguiente tarea',
    pt: 'Peça ao Merlin sua próxima tarefa',
  },
  'today.shifts': {
    en: 'Today’s work',
    fr: 'Travail du jour',
    de: 'Heutige Arbeit',
    es: 'Trabajo de hoy',
    pt: 'Trabalho de hoje',
  },
  'today.none': {
    en: 'Nothing scheduled today. Enjoy the calm.',
    fr: 'Rien de prévu aujourd’hui. Profitez du calme.',
    de: 'Heute nichts geplant. Genießen Sie die Ruhe.',
    es: 'Nada programado hoy. Disfruta la calma.',
    pt: 'Nada agendado hoje. Aproveite a calma.',
  },
  'today.loading': {
    en: 'Loading your shifts…',
    fr: 'Chargement de vos tournées…',
    de: 'Schichten werden geladen…',
    es: 'Cargando tus turnos…',
    pt: 'Carregando seus turnos…',
  },
  'today.unlinked_t': {
    en: 'You’re not on a route yet',
    fr: 'Pas encore de tournée',
    de: 'Noch keiner Route zugewiesen',
    es: 'Aún no tienes ruta',
    pt: 'Ainda sem rota',
  },
  'today.unlinked_b': {
    en: 'Ask your manager to add you to today’s roster — your tasks will show up here.',
    fr: 'Demandez à votre responsable de vous ajouter au planning — vos tâches apparaîtront ici.',
    de: 'Bitten Sie Ihre Leitung, Sie zum Dienstplan hinzuzufügen — Ihre Aufgaben erscheinen dann hier.',
    es: 'Pide a tu responsable que te añada al turno — tus tareas aparecerán aquí.',
    pt: 'Peça ao seu gestor para te incluir na escala — suas tarefas aparecerão aqui.',
  },
  'today.tasks': { en: 'tasks', fr: 'tâches', de: 'Aufgaben', es: 'tareas', pt: 'tarefas' },
  'today.no_tasks': {
    en: 'No checklist for this route yet.',
    fr: 'Pas encore de liste pour cette tournée.',
    de: 'Noch keine Checkliste für diese Route.',
    es: 'Aún no hay lista para esta ruta.',
    pt: 'Ainda sem lista para esta rota.',
  },
  'today.mark_done': {
    en: 'Mark done',
    fr: 'Marquer comme fait',
    de: 'Als erledigt markieren',
    es: 'Marcar como hecho',
    pt: 'Marcar como concluído',
  },
  'today.done': { en: 'Done', fr: 'Fait', de: 'Erledigt', es: 'Hecho', pt: 'Feito' },
  'today.complete_err': {
    en: 'Couldn’t save that — please try again.',
    fr: 'Enregistrement impossible — réessayez.',
    de: 'Konnte nicht gespeichert werden — bitte erneut versuchen.',
    es: 'No se pudo guardar — inténtalo de nuevo.',
    pt: 'Não foi possível salvar — tente novamente.',
  },

  'tickets.mine': {
    en: 'Assigned to you',
    fr: 'Qui vous sont assignés',
    de: 'Ihnen zugewiesen',
    es: 'Asignados a ti',
    pt: 'Atribuídos a você',
  },
  'tickets.building': {
    en: 'In your building',
    fr: 'Dans votre bâtiment',
    de: 'In Ihrem Gebäude',
    es: 'En tu edificio',
    pt: 'No seu prédio',
  },
  'tickets.none': {
    en: 'No tickets right now.',
    fr: 'Aucun ticket pour l’instant.',
    de: 'Derzeit keine Tickets.',
    es: 'Ningún ticket por ahora.',
    pt: 'Nenhum chamado por enquanto.',
  },
  'tickets.loading': {
    en: 'Loading tickets…',
    fr: 'Chargement des tickets…',
    de: 'Tickets werden geladen…',
    es: 'Cargando tickets…',
    pt: 'Carregando chamados…',
  },
  'tickets.raise': {
    en: 'Raise a ticket',
    fr: 'Créer un ticket',
    de: 'Ticket erstellen',
    es: 'Crear un ticket',
    pt: 'Criar um chamado',
  },
  'tickets.raise_soon': {
    en: 'Photo + flagging coming soon',
    fr: 'Bientôt : photo + signalement',
    de: 'Bald: Foto + Meldung',
    es: 'Pronto: foto + reporte',
    pt: 'Em breve: foto + sinalização',
  },
  'tickets.overdue': { en: 'Overdue', fr: 'En retard', de: 'Überfällig', es: 'Atrasado', pt: 'Atrasado' },
  'tickets.new': { en: 'New ticket', fr: 'Nouveau ticket', de: 'Neues Ticket', es: 'Nuevo ticket', pt: 'Novo chamado' },
  'tickets.title_ph': {
    en: 'What’s the issue?',
    fr: 'Quel est le problème ?',
    de: 'Worum geht es?',
    es: '¿Cuál es el problema?',
    pt: 'Qual é o problema?',
  },
  'tickets.note_ph': {
    en: 'Add detail (optional)',
    fr: 'Ajouter un détail (facultatif)',
    de: 'Details hinzufügen (optional)',
    es: 'Añadir detalle (opcional)',
    pt: 'Adicionar detalhe (opcional)',
  },
  'tickets.priority': { en: 'Priority', fr: 'Priorité', de: 'Priorität', es: 'Prioridad', pt: 'Prioridade' },
  'tickets.sending': { en: 'Sending…', fr: 'Envoi…', de: 'Wird gesendet…', es: 'Enviando…', pt: 'Enviando…' },
  'tickets.err': {
    en: 'Couldn’t send — please try again.',
    fr: 'Envoi impossible — réessayez.',
    de: 'Senden fehlgeschlagen — bitte erneut versuchen.',
    es: 'No se pudo enviar — inténtalo de nuevo.',
    pt: 'Não foi possível enviar — tente novamente.',
  },
  'tickets.comments': { en: 'Comments', fr: 'Commentaires', de: 'Kommentare', es: 'Comentarios', pt: 'Comentários' },
  'tickets.no_comments': {
    en: 'No comments yet.',
    fr: 'Aucun commentaire.',
    de: 'Noch keine Kommentare.',
    es: 'Sin comentarios todavía.',
    pt: 'Sem comentários ainda.',
  },
  'tickets.comment_ph': {
    en: 'Add a comment…',
    fr: 'Ajouter un commentaire…',
    de: 'Kommentar hinzufügen…',
    es: 'Añadir un comentario…',
    pt: 'Adicionar um comentário…',
  },
  'tickets.add_photo': {
    en: 'Add photo',
    fr: 'Ajouter une photo',
    de: 'Foto hinzufügen',
    es: 'Añadir foto',
    pt: 'Adicionar foto',
  },
  'tickets.uploading': {
    en: 'Uploading…',
    fr: 'Téléversement…',
    de: 'Wird hochgeladen…',
    es: 'Subiendo…',
    pt: 'Enviando…',
  },
  'prio.low': { en: 'Low', fr: 'Basse', de: 'Niedrig', es: 'Baja', pt: 'Baixa' },
  'prio.normal': { en: 'Normal', fr: 'Normale', de: 'Normal', es: 'Normal', pt: 'Normal' },
  'prio.high': { en: 'High', fr: 'Haute', de: 'Hoch', es: 'Alta', pt: 'Alta' },
  'prio.urgent': { en: 'Urgent', fr: 'Urgente', de: 'Dringend', es: 'Urgente', pt: 'Urgente' },

  'status.open': { en: 'Open', fr: 'Ouvert', de: 'Offen', es: 'Abierto', pt: 'Aberto' },
  'status.acknowledged': {
    en: 'Acknowledged',
    fr: 'Pris en compte',
    de: 'Bestätigt',
    es: 'Confirmado',
    pt: 'Confirmado',
  },
  'status.in_progress': { en: 'In progress', fr: 'En cours', de: 'In Arbeit', es: 'En curso', pt: 'Em andamento' },
  'status.blocked': { en: 'Blocked', fr: 'Bloqué', de: 'Blockiert', es: 'Bloqueado', pt: 'Bloqueado' },
  'status.done': { en: 'Done', fr: 'Terminé', de: 'Erledigt', es: 'Hecho', pt: 'Concluído' },
  'status.cancelled': { en: 'Cancelled', fr: 'Annulé', de: 'Storniert', es: 'Cancelado', pt: 'Cancelado' },

  'ask.greeting': {
    en: 'Hi {name} — I’m Merlin, your co-worker. Ask me anything about your shift, or tap a suggestion below.',
    fr: 'Bonjour {name} — je suis Merlin, votre co-équipier. Posez-moi une question sur votre service, ou touchez une suggestion ci-dessous.',
    de: 'Hallo {name} — ich bin Merlin, dein Kollege. Frag mich alles zu deiner Schicht oder tippe unten auf einen Vorschlag.',
    es: 'Hola {name} — soy Merlin, tu compañero. Pregúntame lo que sea sobre tu turno, o toca una sugerencia abajo.',
    pt: 'Olá {name} — sou o Merlin, seu colega. Pergunte qualquer coisa sobre seu turno, ou toque numa sugestão abaixo.',
  },
  'ask.placeholder': {
    en: 'Message Merlin…',
    fr: 'Écrire à Merlin…',
    de: 'Nachricht an Merlin…',
    es: 'Mensaje a Merlin…',
    pt: 'Mensagem para o Merlin…',
  },
  'ask.chip_priority': {
    en: 'What’s most urgent right now?',
    fr: 'Qu’est-ce qui est le plus urgent ?',
    de: 'Was ist gerade am dringendsten?',
    es: '¿Qué es lo más urgente ahora?',
    pt: 'O que é mais urgente agora?',
  },
  'ask.chip_supply': {
    en: 'Where’s the nearest supply closet?',
    fr: 'Où est le local de fournitures le plus proche ?',
    de: 'Wo ist der nächste Materialraum?',
    es: '¿Dónde está el almacén más cercano?',
    pt: 'Onde fica o depósito mais próximo?',
  },
  'ask.error': {
    en: 'I’m offline for a moment — try again shortly.',
    fr: 'Je suis hors ligne un instant — réessayez bientôt.',
    de: 'Ich bin kurz offline — bitte gleich nochmal.',
    es: 'Estoy desconectado un momento — inténtalo de nuevo en breve.',
    pt: 'Estou offline por um momento — tente de novo em breve.',
  },

  'lang.title': { en: 'Language', fr: 'Langue', de: 'Sprache', es: 'Idioma', pt: 'Idioma' },
  'menu.signout': { en: 'Sign out', fr: 'Se déconnecter', de: 'Abmelden', es: 'Cerrar sesión', pt: 'Sair' },
  'notif.title': {
    en: 'Notifications',
    fr: 'Notifications',
    de: 'Benachrichtigungen',
    es: 'Notificaciones',
    pt: 'Notificações',
  },
  'notif.enable': {
    en: 'Enable notifications',
    fr: 'Activer les notifications',
    de: 'Benachrichtigungen aktivieren',
    es: 'Activar notificaciones',
    pt: 'Ativar notificações',
  },
  'notif.on': {
    en: 'Notifications on',
    fr: 'Notifications activées',
    de: 'Benachrichtigungen an',
    es: 'Notificaciones activadas',
    pt: 'Notificações ativadas',
  },
  'notif.test': {
    en: 'Send a test',
    fr: 'Envoyer un test',
    de: 'Test senden',
    es: 'Enviar una prueba',
    pt: 'Enviar um teste',
  },
  'notif.soon': {
    en: 'Notifications coming soon',
    fr: 'Notifications bientôt disponibles',
    de: 'Benachrichtigungen folgen bald',
    es: 'Notificaciones muy pronto',
    pt: 'Notificações em breve',
  },
  'notif.unsupported': {
    en: 'Not supported on this browser',
    fr: 'Non pris en charge sur ce navigateur',
    de: 'Auf diesem Browser nicht unterstützt',
    es: 'No compatible con este navegador',
    pt: 'Sem suporte neste navegador',
  },
  'notif.denied': {
    en: 'Notifications are blocked in your browser settings.',
    fr: 'Les notifications sont bloquées dans les réglages du navigateur.',
    de: 'Benachrichtigungen sind in den Browsereinstellungen blockiert.',
    es: 'Las notificaciones están bloqueadas en los ajustes del navegador.',
    pt: 'As notificações estão bloqueadas nas configurações do navegador.',
  },
  'notif.test_sent': {
    en: 'Sent — check your notifications.',
    fr: 'Envoyé — vérifiez vos notifications.',
    de: 'Gesendet — prüfe deine Benachrichtigungen.',
    es: 'Enviado — revisa tus notificaciones.',
    pt: 'Enviado — verifique suas notificações.',
  },
  'notif.err': {
    en: 'Something went wrong — try again.',
    fr: 'Une erreur est survenue — réessayez.',
    de: 'Etwas ist schiefgelaufen — bitte erneut versuchen.',
    es: 'Algo salió mal — inténtalo de nuevo.',
    pt: 'Algo deu errado — tente novamente.',
  },
};

function makeM(lang) {
  return (key, vars) => {
    const entry = ML[key];
    let str = (entry && (entry[lang] || entry.en)) || key;
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
    return str;
  };
}

// ───────────────────────── worker-today data ─────────────────────────

// Build the worker-grounding block fed to /api/chat as `context` (§6). This is
// what re-points the hero from a building summary to the worker's own day.
function buildWorkerContext({ session, org, member, routes }) {
  const now = new Date();
  const hhmm = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  const name = session?.name || member?.name || 'the worker';
  const roleLabel = ROLES[session?.role]?.name || session?.role || 'field';
  const lines = [];
  lines.push(`You are helping ${name}, a ${roleLabel} worker${org?.name ? ` at ${org.name}` : ''}.`);
  lines.push(`Local time is ${hhmm} on ${day}.`);

  if (!routes || routes.length === 0) {
    lines.push('They have no routes assigned for today in the system.');
  } else {
    lines.push(`Their assigned work today, in order (${routes.length} route${routes.length > 1 ? 's' : ''}):`);
    for (const r of routes) {
      const start = r.expected_start_time ? r.expected_start_time.slice(0, 5) : '—';
      const started = r.expected_start_time && r.expected_start_time.slice(0, 5) <= hhmm;
      const bits = [r.service_type];
      if (r.expected_duration_min) bits.push(`~${r.expected_duration_min} min`);
      if (r.sla_threshold_min != null) bits.push(`SLA ${r.sla_threshold_min} min`);
      if (r.myRole && r.myRole !== 'primary') bits.push(r.myRole);
      lines.push(
        `- ${start} — ${r.name} (${bits.filter(Boolean).join('; ')})${started ? ' [start time has passed]' : ''}`,
      );
    }
    lines.push(
      'Per-task completion status is not yet wired, so prioritise by start time and SLA tightness: a route whose start time has passed or whose SLA window is short should come first.',
    );
  }
  lines.push(
    'When they ask "what can I do now?", reply with a short, prioritised, WALKABLE plan: which ONE route/area to do first and why, then the next. Name the specific route. 2–3 sentences, no lists unless they ask.',
  );
  return lines.join('\n');
}

// ───────────────────────── shell ─────────────────────────
export default function MobileApp() {
  const session = useSession();
  const org = useActiveOrg();
  const [lang, setLang] = useState(() => loadMobileLang(session));
  const [tab, setTab] = useState('today');
  const [pendingAsk, setPendingAsk] = useState(null);
  const m = useMemo(() => makeM(lang), [lang]);

  // Apply the chrome language (FR/DE localized; EN/ES/PT → English chrome).
  useEffect(() => {
    setLanguage(CHROME_LANGS.has(lang) ? lang : 'en', { fromUser: true });
  }, [lang]);

  // Re-seed from the saved profile preference once the session hydrates, but
  // only if the user hasn't already picked on this device.
  useEffect(() => {
    try {
      if (localStorage.getItem(MOBILE_LANG_KEY)) return;
    } catch {
      /* ignore */
    }
    const pref = session?.preferences?.language;
    if (pref && MOBILE_LANGS.includes(pref)) setLang(pref);
  }, [session?.preferences?.language]);

  const changeLang = (next) => {
    setLang(next);
    try {
      localStorage.setItem(MOBILE_LANG_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const today = useWorkerToday(session);
  const workerContext = useMemo(
    () => buildWorkerContext({ session, org, member: today.member, routes: today.routes }),
    [session, org, today.member, today.routes],
  );

  const askNow = () => {
    setPendingAsk(m('today.cta'));
    setTab('ask');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        background: 'var(--surface-2)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          boxShadow: '0 0 0 1px var(--border)',
          overflow: 'hidden',
        }}
      >
        <MobileHeader org={org} session={session} m={m} lang={lang} onChangeLang={changeLang} />

        {/* Keep all three tabs mounted so chat history + scroll persist. */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <TabPane active={tab === 'today'}>
            <TodayTab m={m} today={today} onAskNow={askNow} />
          </TabPane>
          <TabPane active={tab === 'tickets'}>
            <TicketsTab m={m} org={org} session={session} />
          </TabPane>
          <TabPane active={tab === 'ask'}>
            <AskTab
              m={m}
              session={session}
              lang={lang}
              workerContext={workerContext}
              pendingAsk={pendingAsk}
              onConsumePending={() => setPendingAsk(null)}
            />
          </TabPane>
        </div>

        <TabBar tab={tab} setTab={setTab} m={m} />
      </div>
    </div>
  );
}

function TabPane({ active, children }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: active ? 'flex' : 'none',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

function MobileHeader({ org, session, m, lang, onChangeLang }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      style={{
        flexShrink: 0,
        paddingTop: 'env(safe-area-inset-top)',
        borderBottom: '1px solid var(--border)',
        background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div style={{ height: 54, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px' }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            flexShrink: 0,
            background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon.check size={15} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {org?.name || 'Merlin'}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--ok)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.18,
            }}
          >
            {m('header.myday')}
          </div>
        </div>
        <LangPicker lang={lang} onChange={onChangeLang} title={m('lang.title')} />
        <IconBtn onClick={() => setMenuOpen((v) => !v)} title={m('menu.signout')} active={menuOpen}>
          {menuOpen ? <Icon.close size={15} /> : <Icon.people size={15} />}
        </IconBtn>
      </div>
      {menuOpen && (
        <div style={{ padding: '0 14px 10px' }}>
          <NotificationsMenu m={m} session={session} />
          <button onClick={() => doLogout()} style={menuItemStyle}>
            {m('menu.signout')}
          </button>
        </div>
      )}
    </div>
  );
}

const notifMutedStyle = {
  padding: '10px 12px',
  borderRadius: 9,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text-faint)',
  fontSize: 12.5,
  marginBottom: 8,
  textAlign: 'center',
};

// Notifications control inside the header menu. Builds the whole web-push
// pipe; degrades gracefully when push is unsupported (browser) or not yet
// configured (VAPID env vars unset on the server).
function NotificationsMenu({ m, session }) {
  const [state, setState] = useState(null); // null = loading
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!pushSupported()) {
      setState({ supported: false, configured: false, subscribed: false });
      return undefined;
    }
    getPushState().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;
  if (!state.supported) return <div style={notifMutedStyle}>{m('notif.unsupported')}</div>;
  if (!state.configured) return <div style={notifMutedStyle}>{m('notif.soon')}</div>;

  async function enable() {
    if (busy) return;
    setBusy(true);
    const r = await enablePush(session);
    setBusy(false);
    if (r.ok) setState((s) => ({ ...s, subscribed: true }));
    else alertDialog({ title: m('notif.title'), body: r.reason === 'denied' ? m('notif.denied') : m('notif.err') });
  }
  async function test() {
    if (busy) return;
    setBusy(true);
    const r = await sendTestPush();
    setBusy(false);
    alertDialog({ title: m('notif.title'), body: r?.ok ? m('notif.test_sent') : m('notif.err') });
  }

  if (state.subscribed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 9,
            background: 'color-mix(in oklch, var(--ok) 10%, var(--surface-2))',
            border: '1px solid color-mix(in oklch, var(--ok) 30%, var(--border))',
            color: 'var(--ok)',
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          <Icon.bell size={15} /> {m('notif.on')}
        </div>
        <button onClick={test} disabled={busy} style={menuItemStyle}>
          {m('notif.test')}
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={enable}
      disabled={busy}
      style={{
        ...menuItemStyle,
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <Icon.bell size={15} /> {m('notif.enable')}
    </button>
  );
}

const menuItemStyle = {
  width: '100%',
  textAlign: 'left',
  padding: '10px 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 9,
  color: 'var(--text)',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

function LangPicker({ lang, onChange, title }) {
  return (
    <label title={title} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={lang}
        onChange={(e) => onChange(e.target.value)}
        aria-label={title}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {MOBILE_LANGS.map((l) => (
          <option key={l} value={l}>
            {l.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}

// ───────────────────────── tab bar ─────────────────────────
function TabBar({ tab, setTab, m }) {
  const tabs = [
    { id: 'today', label: m('nav.today'), icon: 'check' },
    { id: 'tickets', label: m('nav.tickets'), icon: 'bell' },
    { id: 'ask', label: m('nav.ask'), icon: 'chat' },
  ];
  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--border)',
        background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map((t) => {
        const active = tab === t.id;
        const IconCmp = Icon[t.icon];
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '9px 0 8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: active ? 'var(--accent, #10b981)' : 'var(--text-dim)',
            }}
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              {t.id === 'ask' && active ? <MerlinAvatar size={22} glow={false} /> : <IconCmp size={21} />}
            </div>
            <span style={{ fontSize: 11, fontWeight: active ? 800 : 600, letterSpacing: 0.1 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
