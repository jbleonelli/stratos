// Chat with Merlin — slide-out panel.
// Talks to the live Claude API via /api/chat (Vercel function), with an
// automatic fallback to canned mockClaude responses on any failure.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { confirmDialog, alertDialog } from './dialogs.jsx';
import { Icon } from './icons.jsx';
import { IconBtn, MerlinAvatar } from './primitives.jsx';
import { FIRST_RUN_THREAD, WAREHOUSE_DEMO_THREAD, HEALTHCARE_DEMO_THREAD } from './data.js';
import { ECOSYSTEM_DEMO_THREAD } from './ecosystem-data.js';
import { chatComplete } from './chatBackend.js';
import { requestHypervisorControl, normalizeMetric, normalizeMode } from './hypervisor-control.js';
import { useAppData } from './simulator.js';
import { useReplayIncidents } from './replay-incidents.js';
import { useT, useLanguage, t as tStatic } from './i18n.js';
import { useMerlinAsks, pushAskFromSuggestion, seedCannedAsks, answerAsk } from './merlin-asks.js';
import { usePendingAsksByLocation } from './agent-runs.js';
import { breadcrumbFor } from './custom-locations.js';
import { useSession, updatePreferences } from './auth.js';
import { useActiveOrg } from './org-data.js';
import { useServicingRollup, useServicingOpenItems } from './servicing-data.js';
import { useServiceLine } from './service-line.js';
import { useContractorAnalytics } from './slas-data.js';
import { METRICS_WIDGET_CATALOG, METRICS_DEFAULT_LAYOUT } from './Dashboard.jsx';
import {
  readLayout as readMetricsLayout,
  addWidget as addMetricsWidget,
  removeWidget as removeMetricsWidget,
} from './metrics-layout-store.js';
import { setSpec as setCustomSpec, removeSpec as removeCustomSpec } from './metrics-spec-store.js';
import { MessageThread, ThinkingBubble } from './ChatMessages.jsx';
import {
  FloatingDragLayer,
  SidebarResizeHandle,
  DockIcon,
  FloatIcon,
  readWindowGeom,
  clampGeom,
  CHAT_WINDOW_KEY,
  CHAT_WIDTH_KEY,
  CHAT_WIDTH_MIN,
  CHAT_WIDTH_MAX,
  CHAT_WIDTH_DEFAULT,
} from './ChatWindowChrome.jsx';
import { InlineDecisions } from './ChatAsks.jsx';
import { buildOwnerContextBlock, buildContractorContextBlock } from './chat-context.js';

// PR #665/666: build a "briefing" seed thread driven by the building's
// actual top pending CTA. Replaces the static DEMO_THREAD ("We're
// inside the 20-minute Hygiene SLA…") with one generated from a real
// agent ask, so the chat panel reflects what's actually happening.
//
// Falls back when there are no pending asks (calm day) or when the
// building isn't a real-estate type. Variant-specific threads take
// precedence — those are story-driven.
//
// One message, no `meta`: the prior 2-message version split the
// content across Chat + Activity tabs (alert-meta routes to
// Activity), so the Chat tab showed only the orphaned follow-up
// question with no context. Combined into a single self-contained
// Chat message that names the floor, the agent, the actual reason,
// and the choice of action surfaces.
function dynamicSeedFor(building, topAsk, totalPending = 0) {
  // Variant-specific threads always win — they're story-driven. (IMF is a
  // live pilot — it falls through to the real-ask briefing / calm greeting.)
  if (building?.variant === 'warehouse') return WAREHOUSE_DEMO_THREAD;
  if (building?.variant === 'healthcare') return HEALTHCARE_DEMO_THREAD;
  // ECOSYSTEM_DEMO_THREAD is First Empire Bank-specific (NY branches /
  // "upstate" cleaning SLA). Gate it to FEB ids so other ecosystems
  // (e.g. Campus PSG `psg`, Meridian) don't inherit FEB's content — they
  // fall through to the real-asks briefing below.
  if (building?.kind === 'ecosystem' && /^feb/.test(building?.id || '')) return ECOSYSTEM_DEMO_THREAD;
  if (building?.custom === true) return FIRST_RUN_THREAD;
  // No top ask → calm intro. Tagged as activity (meta) so it routes
  // to the Activity tab — the Chat tab is reserved for messages the
  // user actually starts. Timestamp populated so it's not blank in
  // the Activity row. PR #738.
  if (!topAsk) {
    return [
      {
        from: 'merlin',
        text: `Nothing needs your decision at **${building?.name || 'this building'}** right now — Merlin's on top of the live activity. Ask me about any sensor, room, or SLA when you need a hand.`,
        time: nowTime(),
        meta: { kind: 'briefing' },
      },
    ];
  }
  // Self-contained briefing — same activity routing.
  const reason = (topAsk.decision_reason || 'an agent ask').trim().replace(/[.;]+\s*$/, '');
  const agent = topAsk.agent_id || 'agent';
  const floor = topAsk.floorName || 'this building';
  const others = totalPending > 1 ? ` (plus ${totalPending - 1} more in your inbox)` : '';
  return [
    {
      from: 'merlin',
      text: `Heads up on **${floor}** — the \`${agent}\` agent's flagging: ${reason}.${others} You can Approve or Hold from the card on My Day, or ask me anything about it here.`,
      time: nowTime(),
      meta: { kind: 'briefing' },
    },
  ];
}

// Human-readable label for the surface the user is currently viewing, so
// Merlin can ground its answer in the right context instead of always
// assuming the Metrics page. Falls back to a neutral workspace label.
const CHAT_SURFACE_LABELS = {
  dashboard: 'the Metrics dashboard',
  briefing: 'the Briefing',
  now: 'the Now briefing',
  agents: 'the AI Agents page',
  'agent-detail': 'an AI agent detail page',
  activity: 'the Activity feed',
  calls: 'the Activity feed (pending calls)',
  hypervisor: 'the Hypervisor (building tree + 3D viewer)',
  devices: 'the Devices page',
  deployments: 'the Deployments page',
  schedules: 'the Schedules page',
  reports: 'the Report Builder',
  insights: 'the Insights · Savings page (ANTICIPATE)',
  'insights-wellbeing': 'the Insights · Wellbeing page (ANTICIPATE)',
  'insights-slas': 'the Insights · SLAs page (ANTICIPATE)',
  innovate: 'the Innovate marketplace',
  'innovate-catalog': 'the Innovate hardware catalog',
  contracts: 'the Contractors · Contracts page',
  proposals: 'the Contractors · Proposals page',
  scorecard: 'the Contractors · Scorecard page',
  'contractor-reports': 'the Contractors · Reports page',
};
function chatSurfaceLabel(view) {
  return CHAT_SURFACE_LABELS[view] || 'the Merlin workspace';
}

export function ChatPanel({
  open,
  onClose,
  seededQuery,
  seededSend = false,
  seededDecisions = false,
  onSeededHandled,
  tone = 'friendly',
  building,
  role,
  view,
  onView,
  onOpenAgent,
  onOpenCalls,
  chatMode = 'floating',
}) {
  const isEcosystem = building?.kind === 'ecosystem';
  const isImf = building?.variant === 'imf';
  // Floating-window state: position + size in CSS pixels. Restored from
  // localStorage; falls back to a bottom-right dock that fits the
  // current viewport.
  const [windowGeom, setWindowGeom] = useState(() => readWindowGeom());
  const [draggingMove, setDraggingMove] = useState(false);
  const [resizing, setResizing] = useState(null); // 'br' | 'bl' | null
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_WINDOW_KEY, JSON.stringify(windowGeom));
    } catch {}
  }, [windowGeom]);
  // Re-clamp on viewport resize so the window doesn't end up off-screen
  // after the browser shrinks.
  useEffect(() => {
    const onResize = () => setWindowGeom((g) => clampGeom(g));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // PR #751: re-validate position every time the chat opens. JB reported
  // on My day specifically: icon highlighted (chatOpen=true) but the
  // panel doesn't show. Either localStorage held a stale geom that
  // passed the size check but rendered off-screen on the current viewport,
  // or the previous close left ChatPanel in a stuck position state.
  // Re-running readWindowGeom on open guarantees a known-good geom each
  // time — drag still persists within a single open session.
  useEffect(() => {
    if (open) {
      setWindowGeom(readWindowGeom());
    }
  }, [open]);

  // Sidebar-mode state: docked rail width + edge-drag. Lives alongside
  // the floating-mode state so flipping the chatMode setting feels
  // instant; only one shell is rendered at a time.
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(CHAT_WIDTH_KEY) || '', 10);
      if (Number.isFinite(v) && v >= CHAT_WIDTH_MIN && v <= CHAT_WIDTH_MAX) return v;
    } catch {}
    return CHAT_WIDTH_DEFAULT;
  });
  const [sidebarDragging, setSidebarDragging] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_WIDTH_KEY, String(sidebarWidth));
    } catch {}
  }, [sidebarWidth]);
  // Track viewport width so the docked rail can shrink to fit a narrow window
  // instead of being pushed off-screen (the rail is flexShrink:0). The stored
  // preference is preserved — only the RENDERED width is clamped.
  const [viewportW, setViewportW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));
  useEffect(() => {
    const onR = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  // Stable message ids. Every message gets one on creation so inline
  // replies can anchor to a specific parent even as the thread grows.
  const nextId = useRef(1);
  const genId = () => `m-${nextId.current++}`;
  const withId = (m) => ({ id: m.id || genId(), ...m });
  // PR #665/666: pull the building's top pending CTA so the seed
  // thread reflects current state instead of static demo text.
  // Returns the most-recent unresolved ask + total count for the
  // building. floorName is resolved from the ask's location_id by
  // walking the locations tree (top-level "feb-32-east" → "Floor 32").
  const session = useSession();
  const pendingByLocation = usePendingAsksByLocation(session?.organizationId, building?.id);
  const { topPendingAsk, totalPending } = React.useMemo(() => {
    let top = null;
    let count = 0;
    for (const inner of pendingByLocation.values()) {
      for (const rows of inner.values()) {
        for (const r of rows) {
          count += 1;
          if (!top || (r.created_at || '') > (top.created_at || '')) top = r;
        }
      }
    }
    // Best-effort floor label: pull from breadcrumb if available,
    // otherwise leave undefined → dynamicSeedFor falls back to
    // "this building".
    if (top && top.location_id) {
      try {
        const crumbs = breadcrumbFor(top.location_id) || [];
        // breadcrumbFor returns [building, floor, room, ...]; the
        // floor is index 1 if it exists.
        const floorCrumb = crumbs[1];
        if (floorCrumb?.name) top = { ...top, floorName: floorCrumb.name };
      } catch {
        /* noop */
      }
    }
    return { topPendingAsk: top, totalPending: count };
  }, [pendingByLocation]);
  const [messages, setMessages] = useState(() => dynamicSeedFor(building, topPendingAsk, totalPending).map(withId));
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  // ── Voice input (mic button) — browser Web Speech API, no backend/cost. ──
  // Click to dictate into the composer; click again (or stop speaking) to end.
  const lang = useLanguage();
  const voiceSupported =
    typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const toggleVoice = () => {
    if (!voiceSupported) return;
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* noop */
      }
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    // Append dictation after whatever's already typed.
    const base = input.trim() ? input.trim() + ' ' : '';
    rec.onresult = (e) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setInput(base + txt);
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };
  // Stop any active recognition when the panel unmounts.
  useEffect(
    () => () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* noop */
      }
    },
    [],
  );
  const [pinnedKeys, setPinnedKeys] = useState(() => new Set());
  // Two-pane split — Chat (user ↔ Merlin conversation) vs Activity
  // (auto-generated messages: proactive pings, resolutions, pending
  // calls for action). Default is Chat so users land on the conversation view.
  // `activityUnread` counts activity items that arrived while the user
  // was on the Chat tab; the badge clears when they switch tabs.
  const [activePane, setActivePane] = useState('chat');
  const [activityUnread, setActivityUnread] = useState(0);
  // Inline reply — when the user clicks "Reply" under a specific
  // Merlin message, the mini input opens directly beneath it. null
  // means no inline reply active; the root input at the bottom handles
  // new-thread messages.
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const asks = useMerlinAsks(building?.id);

  // ── @ mention — insert a reference into the composer. Frontend-only: the
  // inserted "@Name" text grounds Merlin (the chat is already scoped to this
  // building). Sources the live decision items + the building name — the things
  // worth referencing right now (e.g. "tell me about @Restrooms").
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const mentionItems = useMemo(() => {
    const out = [];
    const seen = new Set();
    const push = (label) => {
      const l = (label || '').trim();
      if (l && !seen.has(l) && !/needs approval/i.test(l)) {
        seen.add(l);
        out.push(l);
      }
    };
    if (building?.name) push(building.name);
    for (const a of asks) push(a?._event?.payload?.title || a?._event?.payload?.item || a?.title);
    return out;
  }, [asks, building]);
  const insertMention = (label) => {
    setInput((prev) => (prev.trim() ? prev.trim() + ' ' : '') + '@' + label + ' ');
    setMentionOpen(false);
    setMentionQuery('');
  };

  // ── Attach — an image for Merlin to read (Claude vision). Read as base64; the
  // bubble shows a thumbnail and the image rides with the next message. Images
  // only, capped at 4 MB so the request stays small.
  const fileInputRef = useRef(null);
  const [attachment, setAttachment] = useState(null); // { media_type, data, preview, name }
  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      await alertDialog({ body: t('chat.attach_only_images') });
      return;
    }
    // 3 MB cap: base64 inflates ~33%, keeping the POST under Vercel's ~4.5 MB body limit.
    if (file.size > 3 * 1024 * 1024) {
      await alertDialog({ body: t('chat.attach_too_big') });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      const comma = url.indexOf(',');
      setAttachment({
        media_type: file.type,
        data: comma >= 0 ? url.slice(comma + 1) : '',
        preview: url,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  // Used to scope the smart-picker layout writes to the active user × org.
  const chatSession = useSession();
  // Phase 8.11 — when the active org is contractor-kind, pull portfolio
  // analytics so we can hand the chat endpoint a contractor-flavored
  // persona + a portfolio-context block. Hook returns empty data when
  // orgId is null so it's safe to call unconditionally.
  const activeOrg = useActiveOrg();
  const isContractorOrg = activeOrg?.kind === 'contractor';
  // Current service line (cleaning/security/maintenance/hospitality) — drives
  // a discipline-specific contractor persona on the server.
  const serviceLine = useServiceLine();
  const contractorAnalytics = useContractorAnalytics(isContractorOrg ? chatSession?.organizationId : null);
  // Live service performance (the "État du service" roll-up: per-line adherence
  // + overdue + open, restrooms folded into cleaning) so chat answers
  // "comment va le nettoyage" / "how's security" with real numbers instead of
  // deflecting. viewer:true routes through the viewer-aware RPC → an OWNER sees
  // everything, a CONTRACTOR only its contracted lines. Fired for BOTH (the
  // owner path used to be starved of all servicing grounding).
  const servicingRollup = useServicingRollup(building, chatSession?.organizationId, { viewer: true });
  // The actual open/overdue line items (mig 234 / 264) so chat can NAME specifics
  // on a drill-in ("show the 2 overdue security items") instead of punting. Now
  // returns up to 6 overdue rows PER line, for owners and contractors alike.
  const openItems = useServicingOpenItems(building, chatSession?.organizationId);
  const togglePin = (key) => {
    setPinnedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  // Thread resets lose pins — tied to the current thread session.
  useEffect(() => {
    setPinnedKeys(new Set());
  }, [isEcosystem, isImf]);

  // Seed the one canned ask so the out-of-the-box experience still
  // shows a proposal — but ONLY for demo buildings (custom === false).
  // For custom (user-created) buildings this would optimistically push
  // a Meridian-themed "Reroute Maria's crew → Fl 32 East" ask into the
  // local cache, inflating the Activity badge to "1" for fresh tenants.
  // PRO TEST smoke-test 2026-05-18 (same family as #430-435).
  //
  // Important: require `building.custom === false` (not just !==true) —
  // on first render building can be undefined, and a loose check fires
  // the seed before custom is known. Explicit false-check waits for
  // hydration. Static demo buildings (hq, imf, nybank) have
  // custom: false; user-created ones default to true.
  useEffect(() => {
    if (building?.custom === false) seedCannedAsks();
  }, [building?.id, building?.custom]);
  const scrollRef = useRef(null);
  const live = useAppData(building);
  // Replay-mode orgs source incidents from demo_fixtures.incidents
  // (#446/#448) and silence the simulator's proactive chat suggestions
  // — those are HQ-flavored ticks that don't match the curated replay
  // storyline. Non-replay orgs keep the simulator path untouched.
  const isReplayMode = activeOrg?.replay_mode === true;
  const replayIncidents = useReplayIncidents(isReplayMode ? activeOrg?.id : null);
  const effectiveIncidents = isReplayMode ? replayIncidents : live.incidents;
  const effectiveSuggestions = isReplayMode ? [] : live.chatSuggestions || [];
  const consumedSuggestions = useRef(new Set());
  const t = useT();

  // Reset the thread when the user switches location. Watching the
  // building id directly (not derived booleans like isEcosystem/isImf)
  // means switches between same-kind buildings — e.g. Meridian HQ →
  // Distribution Center East → Health Clinic — also re-seed with the
  // variant-appropriate thread instead of leaking HQ-themed messages
  // into a warehouse or clinic view.
  //
  // PR #665: also re-seed when the building's top pending ask
  // changes from null → something OR identity changes (new ask
  // arrived after the chat was empty / calm). Doesn't re-fire on
  // every new ask (which would wipe the user's typed messages); only
  // when the seed message becomes meaningfully different.
  useEffect(() => {
    setMessages(dynamicSeedFor(building, topPendingAsk, totalPending).map(withId));
    consumedSuggestions.current = new Set();
    setReplyingTo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building?.id, topPendingAsk?.id]);

  // Append proactive Merlin suggestions from the simulator. Alert-kind
  // suggestions also get mirrored into the asks stack so they stay
  // addressable even as new messages arrive below. These are Activity
  // pane messages (they carry `meta`), so bump the unread counter if
  // the user is currently looking at Chat.
  useEffect(() => {
    const fresh = effectiveSuggestions.filter((s) => !consumedSuggestions.current.has(s.id));
    if (fresh.length === 0) return;
    fresh.forEach((s) => consumedSuggestions.current.add(s.id));
    setMessages((m) => [
      ...m,
      ...fresh.map((s) =>
        withId({ from: 'merlin', text: s.text, time: s.time, meta: s.meta || { kind: 'suggestion' } }),
      ),
    ]);
    fresh.forEach((s) => pushAskFromSuggestion(s, effectiveIncidents));
    setActivityUnread((n) => n + fresh.length);
  }, [effectiveSuggestions, effectiveIncidents]);

  const onAnswerAsk = async (askId, actionId) => {
    // Phase 10a-2: tag the audit action with the currently-viewed
    // building so ecosystem rollups can attribute it by subtree.
    const confirmation = await answerAsk(askId, actionId, building?.id || null);
    if (confirmation) {
      setMessages((m) => [
        ...m,
        withId({ from: 'merlin', text: confirmation, time: nowTime(), meta: { kind: 'resolution' } }),
      ]);
      // Resolutions are activity-pane items. Bump unread if the user
      // isn't currently viewing that pane.
      if (activePane !== 'activity') setActivityUnread((n) => n + 1);
    }
  };

  // IMF is a live device pilot — no scripted proactive pings. Merlin only
  // speaks from real signal.

  useEffect(() => {
    if (open && seededQuery) {
      // send:true callers (e.g. a Forecast card) auto-send so the click
      // produces a visible answer; everyone else just prefills the composer.
      if (seededSend) {
        send(seededQuery);
      } else {
        setInput(seededQuery);
      }
      onSeededHandled?.();
    }
  }, [open, seededQuery, seededSend]);

  // Decisions launchpad: clicking the "Decisions" bubble drops an inline,
  // actionable list of the live pending asks into the conversation (Approve /
  // Hold each, right here) rather than asking a text question.
  useEffect(() => {
    if (open && seededDecisions) {
      setActivePane('chat');
      setMessages((m) => [...m, withId({ from: 'merlin', kind: 'decisions', time: nowTime() })]);
      onSeededHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seededDecisions]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  // send() handles both root and inline-reply messages. When a
  // `threadId` is supplied, the user message and Merlin's response
  // both inherit it so the whole exchange stays nested under the
  // parent. Root messages (threadId null) behave as before — new
  // messages at the end of the conversation.
  async function send(text, threadId = null) {
    // An image attachment rides with a ROOT send only (not a thread reply).
    const img = !threadId && attachment ? attachment : null;
    const userText = (text ?? (threadId ? replyText : input)).trim();
    if (!userText && !img) return;
    if (threadId) {
      setReplyText('');
      setReplyingTo(null);
    } else {
      setInput('');
      if (img) setAttachment(null);
    }
    // The API needs non-empty text; for an image-only turn, ask Merlin to read it.
    const effectiveText = userText || t('chat.attach_default_prompt');
    const userMsg = withId({ from: 'user', text: userText, image: img?.preview || null, time: nowTime(), threadId });
    // Snapshot conversation history before mutating state — Claude
    // needs prior turns to remember "30 days vs 90 days" follow-ups.
    // Filter to actual user/merlin text turns (skip pings, asks, and
    // any kind-tagged activity rows). Cap at the last 20 entries so
    // long sessions don't blow the prompt budget.
    const history = projectChatHistory(messages, 20);
    setMessages((m) => [...m, userMsg]);
    setThinking(true);
    // Sending a *root* message implies the user wants to see the
    // reply — snap to Chat if they were on Activity. Inline replies
    // don't switch panes (the thread is wherever the user clicked).
    if (!threadId && activePane !== 'chat') {
      setActivePane('chat');
      setActivityUnread(0);
    }

    // Smooth streaming. Tokens arrive in bursts (often with pauses); rendering
    // them raw looked janky before ("word → pause → dump"). So we DECOUPLE
    // arrival from display: incoming deltas land in a buffer, and a rAF loop
    // reveals them at a steady cadence that rubber-bands faster when the buffer is
    // large — it reads as fluid typing, catches up on bursts, and never dumps.
    // First words now appear when the model's first token lands (~1–3s) instead
    // of after the whole reply (+ any chips call) finishes.
    const merlinMsgId = genId();
    let streamBuf = ''; // received, not yet shown
    let shown = ''; // currently displayed
    let started = false; // live message created?
    let streamDone = false; // upstream finished + reconciled to full text?
    let finalQuickReplies = [];
    let raf = 0;
    const paint = (text, done) =>
      setMessages((m) =>
        m.map((msg) =>
          msg.id === merlinMsgId
            ? { ...msg, text, streaming: !done, ...(done ? { quickReplies: finalQuickReplies } : {}) }
            : msg,
        ),
      );
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener('visibilitychange', onVis);
    };
    const tick = () => {
      // Hidden/background tab: rAF is paused there, and animating invisible text is
      // pointless — SNAP to the full buffer so a backgrounded reply is never stuck
      // mid-reveal. Animate (reveal a few chars/frame) only when visible.
      if (document.hidden) {
        shown += streamBuf;
        streamBuf = '';
      } else if (streamBuf.length > 0) {
        const step = Math.max(3, Math.min(22, Math.ceil(streamBuf.length / 5))); // chars/frame ∝ backlog
        shown += streamBuf.slice(0, step);
        streamBuf = streamBuf.slice(step);
      }
      const done = streamBuf.length === 0 && streamDone;
      paint(shown, done);
      if (done) {
        stop();
        return;
      }
      raf = document.hidden ? 0 : requestAnimationFrame(tick); // when hidden, wait for the next chunk / visibility
    };
    const kick = () => {
      if (document.hidden) tick();
      else if (!raf) raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      if (!document.hidden) kick();
    }; // tab refocused → resume animating the backlog
    const ensureStarted = () => {
      if (started) return;
      started = true;
      setThinking(false); // swap the 3-dot bubble for the live, growing message
      document.addEventListener('visibilitychange', onVis);
      setMessages((m) => [
        ...m,
        withId({ id: merlinMsgId, from: 'merlin', text: '', streaming: true, time: nowTime(), threadId }),
      ]);
    };
    const onChunk = (evt) => {
      if (evt?.type !== 'text' || !evt.delta) return;
      ensureStarted();
      streamBuf += evt.delta;
      kick();
    };
    // Hand the authoritative full reply to the typewriter, then let it drain to the
    // end and stamp streaming:false + chips. Reconciliation covers the mock/one-shot
    // path where the whole reply arrives as a single chunk.
    const finishStreaming = (fullText, quickReplies) => {
      finalQuickReplies = quickReplies;
      if (fullText.startsWith(shown)) streamBuf = fullText.slice(shown.length);
      else {
        shown = '';
        streamBuf = fullText;
      }
      streamDone = true;
      kick();
    };

    try {
      // The widget catalog + layout (and the widget-mutation tools they
      // unlock on the server) are ONLY relevant on the Metrics dashboard.
      // Sending them everywhere made Merlin answer every question as if the
      // user were on the Metrics page. Gate them to view==='dashboard';
      // elsewhere we pass the current surface so Merlin grounds its reply
      // in where the user actually is.
      //
      // Contractors are excluded entirely: their chat is an analytical /
      // portfolio co-worker, and with the chart tools available Merlin would
      // sometimes BUILD a widget in response to an analytical question ("where
      // am I most at risk?") instead of answering it. No tools → it answers.
      const onMetrics = view === 'dashboard' && !isContractorOrg;
      let widgetCatalog;
      let currentLayout;
      let catalogIds; // also consumed by the widget-action handlers below
      if (onMetrics) {
        // Project the local widget catalog to a JSON-safe metadata payload
        // (Component refs, icon names, and i18n keys can't cross the wire).
        widgetCatalog = METRICS_WIDGET_CATALOG.map((w) => ({
          id: w.id,
          label: tStatic(w.labelKey),
          description: tStatic(w.descKey),
          tags: w.tags || [],
        }));
        catalogIds = new Set(widgetCatalog.map((w) => w.id));
        currentLayout = readMetricsLayout(
          chatSession?.userId,
          chatSession?.organizationId,
          METRICS_DEFAULT_LAYOUT,
          catalogIds,
        );
      }

      // Phase 8.11 — contractor-flavored chat. When the active org is
      // a contractor, swap in a portfolio-aware persona on the server
      // and ship a context block with their contracts + proposals +
      // analytics so Merlin can answer "how am I doing on Meridian?"
      // grounded in real numbers.
      const personaKind = isContractorOrg ? 'contractor_manager' : null;
      // Servicing grounding (per-area roll-up + the actual overdue rows) goes to
      // BOTH personas now. Contractors also get their portfolio/contracts block;
      // owners get the building-wide servicing picture so a drill-in ("show the 2
      // overdue security items") names real rows instead of punting.
      const extraContext = isContractorOrg
        ? buildContractorContextBlock(activeOrg, contractorAnalytics, servicingRollup, building, openItems.items)
        : buildOwnerContextBlock(activeOrg, building, servicingRollup, openItems.items);

      const { text: replyText, actions } = await chatComplete({
        text: effectiveText,
        role,
        tone,
        building,
        image: img ? { media_type: img.media_type, data: img.data } : undefined,
        context: extraContext,
        widgetCatalog,
        currentLayout,
        history,
        onChunk,
        personaKind,
        serviceLine: isContractorOrg ? serviceLine : null,
        surface: chatSurfaceLabel(view),
        // Demo/replay orgs bias to Haiku server-side for a snappy live demo
        // (~1s first token, ~2× faster generation). Real tenants keep Sonnet.
        fast: isReplayMode,
        // Reply language — the user's saved preference is authoritative even
        // before i18n has applied it on first load (a French user was getting
        // English replies in that window). chatBackend falls back to the live
        // UI language when this is unset.
        lang: chatSession?.preferences?.language,
      });

      // Execute any returned actions after the stream completes so by
      // the time the user reads "Added the SLA ring", the widget is on
      // the page. Localised confirmation kicks in if Claude went pure
      // tool-use (no streaming text).
      //
      // Critical detail: every layout mutation must mirror to
      // profile.preferences.metricsLayout so the new order survives
      // the next session refresh. The hook reconciles profile vs
      // localStorage on hydrate; without this dispatch the chat-added
      // widget gets clobbered by the stale profile copy.
      const userId = chatSession?.userId;
      const orgId = chatSession?.organizationId;
      const profileLayouts = chatSession?.preferences?.metricsLayout || {};
      const dispatchProfile = (nextArr) => {
        if (!nextArr || !userId || !orgId) return;
        try {
          const all = { ...profileLayouts, [orgId]: nextArr };
          updatePreferences({ metricsLayout: all }).catch(() => {});
        } catch {
          /* ignore */
        }
      };

      let actionsRan = 0;
      // Track WHICH kind of action ran so the tool-only confirmation matches
      // what actually happened — a control_hypervisor action must not report
      // "your Metrics page is updated" (it drove the 3D viewer, not Metrics).
      let ranMetrics = false;
      let ranHypervisor = false;
      let ranScorecard = false;
      for (const action of actions || []) {
        if (action.tool === 'add_metrics_widget') {
          const cid = action?.args?.catalog_id;
          if (!cid) continue;
          const next = addMetricsWidget(userId, orgId, cid, METRICS_DEFAULT_LAYOUT, catalogIds);
          dispatchProfile(next);
          actionsRan += 1;
          ranMetrics = true;
        } else if (action.tool === 'remove_metrics_widget') {
          const cid = action?.args?.catalog_id;
          if (!cid) continue;
          // Custom chart? Drop its spec along with the layout entry.
          if (cid.startsWith('cust:')) {
            removeCustomSpec(userId, orgId, cid);
          }
          const next = removeMetricsWidget(userId, orgId, cid, METRICS_DEFAULT_LAYOUT, catalogIds);
          dispatchProfile(next);
          actionsRan += 1;
          ranMetrics = true;
        } else if (action.tool === 'create_custom_chart') {
          // Server has already validated + assigned an `id`. Persist the
          // spec, then add the id to the layout so the grid renders it.
          const spec = action?.args;
          if (!spec || !spec.id) continue;
          setCustomSpec(userId, orgId, spec);
          const next = addMetricsWidget(userId, orgId, spec.id, METRICS_DEFAULT_LAYOUT, catalogIds);
          dispatchProfile(next);
          actionsRan += 1;
          ranMetrics = true;
        } else if (action.tool === 'control_hypervisor') {
          // Drive the Hypervisor 3D viewer from chat: switch mode, pick a
          // Sensing metric, and/or focus a floor. Navigate to the
          // Hypervisor first if we're elsewhere — the control bus latches
          // the request and the viewer host replays it on mount.
          const a = action?.args || {};
          const mode = normalizeMode(a.mode);
          // Contractors have no SLA data in the Hypervisor's SLAs view (it reads
          // "No SLAs configured"); their live-SLA surface is the Scorecard. So an
          // SLA-intent request from a contractor opens the Scorecard instead of
          // the empty 3D view. Other modes (servicing/sensing/…) have contractor
          // data, so they still drive the Hypervisor.
          if (isContractorOrg && mode === 'slas') {
            // Only claim "opened your scorecard" if we can actually navigate —
            // otherwise Merlin reports success while the page never changes.
            if (onView) {
              onView('contractor-scorecard');
              actionsRan += 1;
              ranScorecard = true;
            }
          } else {
            const req = {};
            if (mode !== undefined) req.mode = mode;
            const metric = normalizeMetric(a.metric);
            if (metric !== undefined) req.metric = metric;
            if (a.floor_id) req.floorId = String(a.floor_id);
            // A metric implies Sensing mode unless an explicit mode was given.
            if (req.metric && req.mode === undefined) req.mode = 'sensing';
            if (Object.keys(req).length > 0) {
              if (view !== 'hypervisor' && onView) onView('hypervisor');
              requestHypervisorControl(req);
              actionsRan += 1;
              ranHypervisor = true;
            }
          }
        }
      }

      // Tappable quick-reply chips: when Merlin offers a choice it calls the
      // suggest_replies tool with 2–4 short options (in the user's language).
      // We attach them to the message so the user can answer with one tap
      // instead of typing "oui". Not an executable action — just rendered.
      const quickReplies = (() => {
        const a = (actions || []).find((x) => x.tool === 'suggest_replies');
        const opts = Array.isArray(a?.args?.options) ? a.args.options : [];
        return opts
          .map((s) => String(s ?? '').trim())
          .filter(Boolean)
          .slice(0, 4);
      })();

      // Finalise. If prose streamed, hand the full reply to the typewriter and
      // let it finish typing + stamp the chips. If nothing streamed (tool-only or
      // truly empty), post a single message at once — action_done when Claude was
      // tool-only, else a neutral line (never "offline" on a successful stream;
      // that's reserved for the catch below, a real transport failure).
      if (started) {
        finishStreaming(replyText, quickReplies);
      } else {
        const finalText = replyText.trim()
          ? replyText
          : ranScorecard
            ? t('chat.action_done_scorecard')
            : ranMetrics
              ? t('chat.action_done')
              : ranHypervisor
                ? t('chat.action_done_hypervisor')
                : actionsRan > 0
                  ? t('chat.action_done_generic')
                  : t('chat.no_answer_fallback');
        setMessages((m) => [
          ...m,
          withId({ from: 'merlin', text: finalText, time: nowTime(), threadId, quickReplies }),
        ]);
      }
    } catch {
      stop();
      if (started) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === merlinMsgId ? { ...msg, text: t('chat.offline_fallback'), streaming: false } : msg,
          ),
        );
      } else {
        setMessages((m) => [
          ...m,
          withId({ from: 'merlin', text: t('chat.offline_fallback'), time: nowTime(), threadId }),
        ]);
      }
    } finally {
      setThinking(false);
    }
  }

  // Tab switcher. Clearing the unread badge on view of the Activity
  // pane is the expected behaviour — users shouldn't keep seeing "N
  // unread" after they've scrolled through them.
  const switchPane = (next) => {
    setActivePane(next);
    if (next === 'activity') setActivityUnread(0);
  };

  // Partition messages into the two panes. Rule: `from: 'user'` and
  // `from: 'merlin'` replies with no `meta` are conversation; anything
  // carrying `meta` is an auto-generated activity item. Reply chains
  // (messages with a `threadId`) live in whichever pane their root is.
  const isActivity = (m) => m.from === 'merlin' && !!m.meta;
  const paneOf = (m) => {
    // Root messages follow their own type.
    if (!m.threadId) return isActivity(m) ? 'activity' : 'chat';
    // Replies inherit their root's pane.
    const root = messages.find((x) => x.id === m.threadId);
    if (!root) return 'chat';
    return isActivity(root) ? 'activity' : 'chat';
  };
  const chatMessages = messages.filter((m) => paneOf(m) === 'chat');
  const activityMessages = messages.filter((m) => paneOf(m) === 'activity');

  // Clear the conversation pane only — the Activity feed (proactive pings,
  // resolutions, pending calls) is left intact. Confirmation-gated since it
  // discards the visible chat history; the empty-state placeholder then
  // invites a fresh conversation. Messages are in-memory (no server thread),
  // so this is a pure local reset.
  // Branded in-app confirm (shared dialogs.jsx host) — a native window.confirm
  // would break the Merlin chrome.
  const clearChat = async () => {
    if (chatMessages.length === 0) return;
    const ok = await confirmDialog({
      title: t('chat.clear_title'),
      body: t('chat.clear_body'),
      confirmLabel: t('chat.clear_cta'),
      danger: true,
    });
    if (!ok) return;
    setMessages((prev) => prev.filter((m) => paneOf(m) !== 'chat'));
    setReplyingTo(null);
    setReplyText('');
  };

  // Group messages into threads — each root message carries its
  // children in order. Flat storage, hierarchical rendering.
  const toThreads = (list) => {
    const roots = list.filter((m) => !m.threadId);
    const byThread = {};
    for (const m of list) {
      if (m.threadId) (byThread[m.threadId] ||= []).push(m);
    }
    return roots.map((root) => ({ root, replies: byThread[root.id] || [] }));
  };
  const chatThreads = toThreads(chatMessages);
  const activityThreads = toThreads(activityMessages);

  // Hide entirely when closed — no flex placeholder, the rest of the
  // layout reclaims the space.
  if (!open) return null;

  // Drag the title bar to move (floating mode only).
  const onHeaderMouseDown = (e) => {
    if (chatMode !== 'floating') return;
    if (e.target.closest('button, input, textarea, [data-no-drag]')) return;
    e.preventDefault();
    setDraggingMove({ startX: e.clientX, startY: e.clientY, startLeft: windowGeom.left, startTop: windowGeom.top });
  };

  // Header anchor buttons: flip the chat between sidebar and floating
  // modes from inside the chat itself. Both mirror to localStorage
  // (window.setMerlinTweaks) and the user's profile (updatePreferences)
  // so the choice sticks across reloads / devices.
  const dockAsSidebar = () => {
    try {
      window.setMerlinTweaks?.({ chatMode: 'sidebar' });
    } catch {}
    try {
      if (chatSession) updatePreferences({ chatMode: 'sidebar' });
    } catch {}
  };
  const floatAsWindow = () => {
    try {
      window.setMerlinTweaks?.({ chatMode: 'floating' });
    } catch {}
    try {
      if (chatSession) updatePreferences({ chatMode: 'floating' });
    } catch {}
  };

  // Pick the shell-level styles based on the user's chosen mode.
  // Floating: position:fixed window with rounded corners, drop shadow,
  // drag-by-header, two corner grips. Sidebar: docked-right rail —
  // styled as a floating rounded card matching the left icon rail
  // (Sidebar.jsx) and Excalibur sidebar (PlatformApp.jsx). User can
  // still flip to floating mode via Settings → Merlin chat → Floating.
  const isFloating = chatMode === 'floating';
  // Rendered rail width: never wider than the viewport minus room for the main
  // content (~420px), so a narrow window shrinks the rail instead of shoving it
  // off-screen. Floored at the min so it never collapses to nothing.
  const railWidth = Math.max(CHAT_WIDTH_MIN, Math.min(sidebarWidth, viewportW - 420));
  const shellStyle = isFloating
    ? {
        position: 'fixed',
        zIndex: 90,
        left: windowGeom.left,
        top: windowGeom.top,
        width: windowGeom.width,
        height: windowGeom.height,
        // Solid surface during drag — backdropFilter recomputes the blurred
        // backdrop on every position change, which on some GPUs paints a
        // visible flicker frame between updates. The translucent + blur
        // look stays for the resting state.
        background:
          draggingMove || resizing ? 'var(--surface)' : 'color-mix(in oklch, var(--surface) 92%, transparent)',
        backdropFilter: draggingMove || resizing ? 'none' : 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: draggingMove || resizing ? 'none' : 'blur(30px) saturate(180%)',
        // Brand-pink border — same in both light and dark themes since
        // var(--accent) is theme-stable (#FF00B2). Adds a soft accent
        // shadow so the pink reads as glow rather than a harsh outline.
        border: '1px solid var(--accent)',
        borderRadius: 16,
        boxShadow:
          '0 24px 60px rgba(0,0,0,0.22), 0 4px 14px rgba(0,0,0,0.10), 0 0 0 2px color-mix(in oklch, var(--accent) 12%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // No CSS animation / transition — left/top jumps are committed
        // every animation frame from the drag handler, and re-applying a
        // mount-fade keyframe each time React re-creates the style object
        // is what was painting the "blink".
        willChange: draggingMove || resizing ? 'left, top, width, height' : 'auto',
      }
    : {
        width: railWidth,
        flexShrink: 0,
        // Floating-card docked chat — top:4 to match the central card's
        // marginTop:4 (PR #669) so the two card tops align. Right/bottom
        // stay 12. Left is 0 because the central content card already
        // carries marginRight:12 — doubling would give a 24px gap.
        margin: '4px 12px 12px 0',
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        // No drop shadow — the border alone defines the panel edge (JB,
        // 2026-07-03; the soft shadow bled into the right-margin gap).
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        transition: sidebarDragging ? 'none' : 'width .22s cubic-bezier(.2, 0, 0, 1)',
      };

  return (
    <div role="dialog" aria-label="Merlin chat" style={shellStyle}>
      {isFloating && (
        <FloatingDragLayer
          draggingMove={draggingMove}
          setDraggingMove={setDraggingMove}
          resizing={resizing}
          setResizing={setResizing}
          setWindowGeom={setWindowGeom}
        />
      )}
      {!isFloating && (
        <SidebarResizeHandle onResize={setSidebarWidth} dragging={sidebarDragging} setDragging={setSidebarDragging} />
      )}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          padding: '12px 14px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: isFloating ? (draggingMove ? 'grabbing' : 'grab') : 'default',
          userSelect: isFloating ? 'none' : 'auto',
          borderBottom: isFloating ? '1px solid color-mix(in oklch, var(--border) 60%, transparent)' : 'none',
        }}
      >
        <MerlinAvatar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* PR #700: green pulsing "Active" dot + label removed
                    per JB. The avatar's slow rotation now carries the
                    "active" signal instead. */}
            <div style={{ fontSize: 13, fontWeight: 700 }}>Merlin</div>
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t('chat.coworker')} ·{' '}
            {breadcrumbFor(building.id)
              .map((c) => c.name)
              .join(' › ')}
          </div>
        </div>
        {activePane === 'chat' && (
          // Always visible on the Chat pane so it's discoverable; dimmed +
          // inert when there's nothing to clear (clearChat no-ops on an
          // empty conversation anyway).
          <span
            data-no-drag
            style={{
              opacity: chatMessages.length > 0 ? 1 : 0.35,
              pointerEvents: chatMessages.length > 0 ? 'auto' : 'none',
            }}
          >
            <IconBtn onClick={clearChat} title={t('chat.clear')}>
              <Icon.reload />
            </IconBtn>
          </span>
        )}
        <span data-no-drag>
          {isFloating ? (
            <IconBtn onClick={dockAsSidebar} title={t('chat.dock_as_sidebar')}>
              <DockIcon />
            </IconBtn>
          ) : (
            <IconBtn onClick={floatAsWindow} title={t('chat.float_as_window')}>
              <FloatIcon />
            </IconBtn>
          )}
        </span>
        <span data-no-drag>
          <IconBtn onClick={onClose} title={t('action.close')}>
            <Icon.close />
          </IconBtn>
        </span>
      </div>

      <PaneTabs
        active={activePane}
        onChange={switchPane}
        // The Activity badge counts the pending decisions (asks) only — the
        // same number the "Decisions" bubble + the "N decisions waiting"
        // header show. Adding activityMessages double-counted the proactive
        // summary turn (showed 21 when there were 20 decisions).
        activityCount={asks.length}
        unreadCount={activityUnread}
      />

      {activePane === 'chat' ? (
        <div
          ref={scrollRef}
          style={{ flex: 1, overflow: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {chatThreads.map((thread) =>
            thread.root.kind === 'decisions' ? (
              <InlineDecisions
                key={thread.root.id}
                asks={asks}
                onAnswer={onAnswerAsk}
                onOpenAgent={onOpenAgent}
                onOpenCalls={onOpenCalls}
              />
            ) : (
              <MessageThread
                key={thread.root.id}
                thread={thread}
                pinnedKeys={pinnedKeys}
                onTogglePin={togglePin}
                replyingTo={replyingTo}
                onStartReply={setReplyingTo}
                onCancelReply={() => {
                  setReplyingTo(null);
                  setReplyText('');
                }}
                replyText={replyText}
                onReplyTextChange={setReplyText}
                onSendReply={(threadId) => send(null, threadId)}
                onQuickReply={(opt) => send(opt)}
                thinking={thinking}
              />
            ),
          )}
          {thinking && !replyingTo && <ThinkingBubble />}
          {chatThreads.length === 0 && !thinking && (
            <div
              style={{
                color: 'var(--text-dim)',
                fontSize: 12.5,
                textAlign: 'center',
                padding: '40px 20px',
                lineHeight: 1.55,
              }}
            >
              {t('chat.empty')}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Calls for action listed inline + actionable (Approve / Hold in
                place), instead of a banner that bounced to OPERATE → Activity.
                Keeps an "Open full queue →" link for the full triage view. */}
            {asks.length > 0 && (
              <InlineDecisions asks={asks} onAnswer={onAnswerAsk} onOpenAgent={onOpenAgent} onOpenCalls={onOpenCalls} />
            )}
            {activityThreads.map((thread) => (
              <MessageThread
                key={thread.root.id}
                thread={thread}
                pinnedKeys={pinnedKeys}
                onTogglePin={togglePin}
                replyingTo={replyingTo}
                onStartReply={setReplyingTo}
                onCancelReply={() => {
                  setReplyingTo(null);
                  setReplyText('');
                }}
                replyText={replyText}
                onReplyTextChange={setReplyText}
                onSendReply={(threadId) => send(null, threadId)}
                thinking={thinking}
              />
            ))}
            {activityThreads.length === 0 && asks.length === 0 && (
              <div
                style={{
                  color: 'var(--text-dim)',
                  fontSize: 12.5,
                  textAlign: 'center',
                  padding: '40px 20px',
                  lineHeight: 1.55,
                }}
              >
                {t('chat.activity_empty')}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: '12px 14px' }}>
        <div
          style={{
            position: 'relative',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            transition: 'border-color .12s',
          }}
        >
          {mentionOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                zIndex: 20,
                padding: 6,
                maxHeight: 240,
                overflow: 'auto',
              }}
            >
              <input
                autoFocus
                value={mentionQuery}
                onChange={(e) => setMentionQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setMentionOpen(false);
                }}
                placeholder={t('chat.mention')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  fontSize: 12.5,
                  fontFamily: 'var(--font)',
                  outline: 'none',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  marginBottom: 4,
                }}
              />
              {mentionItems
                .filter((l) => l.toLowerCase().includes(mentionQuery.toLowerCase()))
                .slice(0, 40)
                .map((l) => (
                  <button
                    key={l}
                    onClick={() => insertMention(l)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--surface-2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      border: 'none',
                      borderRadius: 7,
                      cursor: 'pointer',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: 12.5,
                      fontFamily: 'var(--font)',
                    }}
                  >
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>@</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}</span>
                  </button>
                ))}
              {mentionItems.filter((l) => l.toLowerCase().includes(mentionQuery.toLowerCase())).length === 0 && (
                <div style={{ padding: 8, fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
                  {t('chat.mention_empty')}
                </div>
              )}
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t('chat.placeholder')}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              resize: 'none',
              fontFamily: 'var(--font)',
              fontSize: 13,
              color: 'var(--text)',
              minHeight: 36,
              maxHeight: 120,
              padding: '6px 6px 0',
            }}
          />
          {attachment && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 0' }}>
              <img
                src={attachment.preview}
                alt=""
                style={{
                  width: 40,
                  height: 40,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 11.5,
                  color: 'var(--text-dim)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {attachment.name}
              </span>
              <button
                onClick={() => setAttachment(null)}
                title={t('chat.attach_remove')}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-soft)',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickFile} style={{ display: 'none' }} />
            <IconBtn
              size={28}
              title={t('chat.attach')}
              active={!!attachment}
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon.paper size={14} />
            </IconBtn>
            <IconBtn
              size={28}
              title={t('chat.mention')}
              active={mentionOpen}
              onClick={() => {
                setMentionOpen((v) => !v);
                setMentionQuery('');
              }}
            >
              @
            </IconBtn>
            {voiceSupported && (
              <IconBtn
                size={28}
                title={listening ? t('chat.voice_stop') : t('chat.voice')}
                active={listening}
                onClick={toggleVoice}
                style={listening ? { color: 'var(--accent)' } : undefined}
              >
                <Icon.mic size={14} />
              </IconBtn>
            )}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => send()}
              disabled={(!input.trim() && !attachment) || thinking}
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: (input.trim() || attachment) && !thinking ? 'var(--accent)' : 'var(--surface-3)',
                color: (input.trim() || attachment) && !thinking ? '#fff' : 'var(--text-faint)',
                border: 'none',
                cursor: (input.trim() || attachment) && !thinking ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon.send size={13} />
            </button>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-faint)', textAlign: 'center' }}>
          {t('chat.footer')}
        </div>
      </div>
    </div>
  );
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Project the in-memory message thread to the Anthropic API shape so
// Claude has prior turns when answering a follow-up. Only real
// user / merlin text turns are included — pings, resolutions, asks,
// and other meta.kind activity rows are stripped (they're presented
// to the user but aren't part of the conversation Claude is in).
//
// We deliberately drop tool_use / tool_result framing and send only
// the text the user saw. Tools execute client-side; for context the
// model just needs to remember the natural-language thread.
//
// `messages` is the full Chat.jsx state; `limit` caps how many
// {user,assistant} entries we send (most recent first, then reversed
// back to chronological).
function projectChatHistory(messages, limit) {
  const out = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (out.length >= limit) break;
    const m = messages[i];
    if (!m || (m.from !== 'user' && m.from !== 'merlin')) continue;
    if (m.meta && m.meta.kind) continue; // skip ping / resolution / ask rows
    const text = (m.text || '').trim();
    if (!text) continue;
    out.push({
      role: m.from === 'user' ? 'user' : 'assistant',
      content: text,
    });
  }
  out.reverse();
  // Anthropic requires the messages array to start with a user turn —
  // if the trim left an assistant message at the front (e.g. the
  // initial canned demo greeting), drop entries until we hit a user.
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

// Two-pane tab bar — Chat (user ↔ Merlin) vs Activity (auto-generated
// messages + pending asks). The Activity tab shows a live count; when
// new items arrive while Chat is active, a pulsing unread badge sits
// on top of the count until the user switches tabs.
function PaneTabs({ active, onChange, activityCount, unreadCount }) {
  const t = useT();
  const tabs = [
    { id: 'activity', label: t('chat.tab.activity'), count: activityCount, unread: unreadCount },
    { id: 'chat', label: t('chat.tab.chat') },
  ];
  return (
    <div
      style={{
        display: 'flex',
        padding: '0 14px',
        borderBottom: '1px solid var(--border)',
        gap: 4,
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 12px',
              marginBottom: -1,
              background: 'transparent',
              color: isActive ? 'var(--text)' : 'var(--text-dim)',
              border: 'none',
              borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'color .12s, border-color .12s',
            }}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isActive ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: isActive ? 'var(--accent)' : 'var(--text-soft)',
                  border: `1px solid ${isActive ? 'var(--accent-line)' : 'var(--border)'}`,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {tab.count}
              </span>
            )}
            {tab.unread != null && tab.unread > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 4,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  boxShadow: '0 0 0 2px var(--surface)',
                  animation: 'merlinPulse 1.6s ease-in-out infinite',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
