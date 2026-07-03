import { useMemo, useState } from 'react';
import { useAsks, useOrgMetrics } from '../queries/useData';
import { useBuilding } from '../context/BuildingContext';
import { Button, TextInput } from '../ui/primitives';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

const STORAGE_KEY = 'stratosMerlinChat';

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedMessages();
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) && parsed.length ? parsed : seedMessages();
  } catch {
    return seedMessages();
  }
}

function seedMessages(): ChatMessage[] {
  return [
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Good morning. I am Merlin — I supervise building operations and surface decisions for your approval.',
      at: new Date().toISOString(),
    },
  ];
}

function saveMessages(msgs: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-40)));
  } catch {
    /* ignore */
  }
}

function replyFor(input: string, ctx: { openAsks: number; incidents: number; site?: string }): string {
  const q = input.toLowerCase();
  if (q.includes('ask') || q.includes('decision') || q.includes('approve')) {
    if (ctx.openAsks === 0) return 'No open asks right now — fleet is within normal bounds.';
    return `You have ${ctx.openAsks} open ask${ctx.openAsks === 1 ? '' : 's'} waiting for approval. Check the Asks tab or Briefing for details.`;
  }
  if (q.includes('incident') || q.includes('alert') || q.includes('warm') || q.includes('temp')) {
    if (ctx.incidents === 0) return 'No active incidents on record.';
    return `${ctx.incidents} incident${ctx.incidents === 1 ? '' : 's'} need attention${ctx.site ? ` at ${ctx.site}` : ''}. Alpha Tower is running warm — consider lowering overnight setpoints.`;
  }
  if (q.includes('sla') || q.includes('contract')) {
    return 'Alpha Tower HVAC contract targets 60m response for critical and 240m for warning severities. Open the SLAs view under Predict for adherence.';
  }
  if (q.includes('wellbeing') || q.includes('comfort') || q.includes('co2')) {
    return 'Comfort signals are driven by thermostat telemetry and air-quality sensors. Wellbeing under Predict summarizes the comfort index for the selected site.';
  }
  if (q.includes('help') || q.includes('what can')) {
    return 'Ask about open decisions, incidents, SLAs, wellbeing, or savings. I route actions to the right pillar — Operate for tickets, Predict for forecasts.';
  }
  return `Noted. ${ctx.openAsks ? `${ctx.openAsks} ask(s) pending.` : 'Operations look steady.'} Use ⌘K to jump to any view, or switch to Asks to respond directly.`;
}

export function MerlinChat() {
  const { data: metrics } = useOrgMetrics();
  const { data: asks = [] } = useAsks();
  const { selectedLocation } = useBuilding();
  const [messages, setMessages] = useState(() => loadMessages());
  const [draft, setDraft] = useState('');

  const openAsks = useMemo(() => asks.filter((a) => a.status === 'open').length, [asks]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text, at: new Date().toISOString() };
    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: replyFor(text, {
        openAsks,
        incidents: metrics?.incidentsOpen ?? 0,
        site: selectedLocation?.name,
      }),
      at: new Date().toISOString(),
    };
    const next = [...messages, userMsg, assistantMsg];
    setMessages(next);
    saveMessages(next);
    setDraft('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 280 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '92%',
              padding: '10px 12px',
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.45,
              background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: 'var(--text)',
              border: `1px solid ${m.role === 'user' ? 'var(--accent-line)' : 'var(--border)'}`,
            }}
          >
            {m.text}
          </div>
        ))}
      </div>
      <form
        style={{ display: 'flex', gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <TextInput value={draft} onChange={setDraft} placeholder="Ask Merlin…" ariaLabel="Message Merlin" />
        <Button type="submit" disabled={!draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
