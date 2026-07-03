// Merlin Field — the Ask Merlin (chat) tab, extracted from MobileApp.jsx (G2
// split; the last of the three mobile tabs). Self-contained: worker-grounded
// multilingual chat via chatComplete(), with the Bubble / PendingDots / Composer
// presentational pieces. Receives m / session / lang / workerContext / the
// pending-ask handoff as props.

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { chatComplete } from './chatBackend.js';

// ───────────────────────── Ask Merlin ─────────────────────────
export function AskTab({ m, session, lang, workerContext, pendingAsk, onConsumePending }) {
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      kind: 'greeting',
      text: m('ask.greeting', { name: (session?.name || '').split(/\s+/)[0] || '' }).trim(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef(null);
  const sendRef = useRef(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(raw) {
    const text = (raw ?? '').trim();
    if (!text || sending) return;
    const history = messages
      .filter((msg) => msg.kind !== 'greeting' && msg.text)
      .map((msg) => ({ role: msg.role, content: msg.text }));
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }, { role: 'assistant', text: '', pending: true }]);
    setSending(true);
    let acc = '';
    try {
      await chatComplete({
        text,
        role: session?.role || 'cleaning',
        building: null,
        context: workerContext,
        lang,
        surface: 'My Day',
        history,
        onChunk: (evt) => {
          if (evt.type === 'text' && typeof evt.delta === 'string') {
            acc += evt.delta;
            setMessages((prev) => {
              const copy = prev.slice();
              copy[copy.length - 1] = { role: 'assistant', text: acc, pending: true };
              return copy;
            });
          }
        },
      });
    } catch {
      /* fall through to whatever we accumulated */
    }
    setMessages((prev) => {
      const copy = prev.slice();
      copy[copy.length - 1] = { role: 'assistant', text: acc || m('ask.error'), pending: false };
      return copy;
    });
    setSending(false);
  }
  sendRef.current = send;

  // Hero "what can I do now?" hand-off: auto-send the seeded prompt once.
  // Intentionally keyed on `pendingAsk` only — including the callback would
  // re-fire on every parent render and double-send.
  useEffect(() => {
    if (pendingAsk && sendRef.current) {
      sendRef.current(pendingAsk);
      onConsumePending?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk]);

  const chips = [m('ask.chip_priority'), m('ask.chip_supply')];

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} />
        ))}
        {messages.length <= 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {chips.map((c) => (
              <button key={c} onClick={() => send(c)} disabled={sending} style={chipStyle}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      <Composer m={m} input={input} setInput={setInput} sending={sending} onSend={() => send(input)} />
    </div>
  );
}

const chipStyle = {
  padding: '9px 13px',
  borderRadius: 999,
  fontFamily: 'inherit',
  fontSize: 12.5,
  fontWeight: 600,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text-soft)',
  cursor: 'pointer',
};

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '84%',
          padding: '10px 13px',
          borderRadius: 16,
          fontSize: 14,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: isUser ? 'linear-gradient(135deg, #10b981, #0ea5e9)' : 'var(--surface-2)',
          color: isUser ? '#fff' : 'var(--text)',
          border: isUser ? 'none' : '1px solid var(--border)',
          borderBottomRightRadius: isUser ? 5 : 16,
          borderBottomLeftRadius: isUser ? 16 : 5,
        }}
      >
        {msg.text || (msg.pending ? <PendingDots /> : '')}
      </div>
    </div>
  );
}

function PendingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: 'var(--text-faint)',
            animation: `merlinPulse 1s ${i * 0.15}s infinite ease-in-out`,
          }}
        />
      ))}
      <style>
        {'@keyframes merlinPulse{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}'}
      </style>
    </span>
  );
}

function Composer({ m, input, setInput, sending, onSend }) {
  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '10px 12px',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={m('ask.placeholder')}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          maxHeight: 120,
          padding: '11px 14px',
          borderRadius: 20,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          fontSize: 15,
          fontFamily: 'inherit',
          lineHeight: 1.35,
          outline: 'none',
        }}
      />
      <button
        onClick={onSend}
        disabled={sending || !input.trim()}
        aria-label="Send"
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: 999,
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            input.trim() && !sending
              ? 'linear-gradient(135deg, #10b981, #0ea5e9)'
              : 'var(--surface-3, var(--surface-2))',
          color: input.trim() && !sending ? '#fff' : 'var(--text-faint)',
          cursor: input.trim() && !sending ? 'pointer' : 'default',
        }}
      >
        <Icon.send size={17} />
      </button>
    </div>
  );
}
