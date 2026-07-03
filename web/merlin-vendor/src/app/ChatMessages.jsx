// Chat message rendering — extracted from Chat.jsx.
//
// The message-bubble layer: MessageThread (a root Merlin/user message plus
// any nested replies + the thinking indicator), the individual Message
// bubble, the InlineReplyInput, the ThinkingBubble dots, and the tiny
// markdown formatter. ChatPanel composes MessageThread + ThinkingBubble;
// everything else here is private to this module.

import React, { useEffect, useRef } from 'react';
import { Icon } from './icons.jsx';
import { MerlinAvatar } from './primitives.jsx';
import { useT } from './i18n.js';

// Not exported — only used by Chat.jsx itself (multiple call sites).
// PR #700: gradient ring rotates slowly (signals "Merlin is active"),
// inner white disc stays fixed so it doesn't visually swirl. Achieved
// by layering two stacked absolutely-positioned circles inside a
// fixed-size relative container: outer gets the animated rotate,
// inner sits on top untouched.
function Message({ m, pinned, onTogglePin, onStartReply, onQuickReply, showAvatar = true }) {
  const t = useT();
  const chips = Array.isArray(m.quickReplies) ? m.quickReplies : [];
  // Merlin's chat replies are produced by /api/chat ALREADY in the user's
  // language (the server's output-language directive). They must NOT be
  // re-translated — feeding a French reply back through the on-read translator
  // was flipping it to English ("answered in French, then translated to
  // English"). Render Merlin's prose as-is. (Structured asks/events still use
  // useTranslatedText below — those are written in a fixed write-time language.)
  if (m.from === 'user') {
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '100%', animation: 'merlinFadeIn .3s ease' }}>
        {m.image && (
          <img
            src={m.image}
            alt=""
            style={{
              display: 'block',
              marginLeft: 'auto',
              maxWidth: 220,
              maxHeight: 220,
              borderRadius: 12,
              marginBottom: m.text ? 6 : 0,
              border: '1px solid var(--border)',
            }}
          />
        )}
        {m.text && (
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: '14px 14px 4px 14px',
              fontSize: 13,
              lineHeight: 1.45,
              fontWeight: 500,
            }}
          >
            {m.text}
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'right', marginTop: 3 }}>{m.time}</div>
      </div>
    );
  }
  return (
    <div
      className="merlin-message"
      style={{ display: 'flex', gap: 8, maxWidth: '100%', animation: 'merlinFadeIn .3s ease' }}
    >
      {showAvatar ? <MerlinAvatar size={22} /> : <div style={{ width: 22, flexShrink: 0 }} />}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            padding: '8px 12px',
            background: pinned ? 'color-mix(in oklch, var(--accent) 8%, var(--surface-2))' : 'var(--surface-2)',
            color: 'var(--text)',
            border: `1px solid ${pinned ? 'var(--accent-line)' : 'var(--border)'}`,
            borderLeft: pinned ? '3px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: '14px 14px 14px 4px',
            fontSize: 13,
            lineHeight: 1.5,
          }}
          dangerouslySetInnerHTML={{ __html: formatMarkdown(m.text) }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{m.time}</span>
          {pinned && (
            <span
              style={{
                fontSize: 9.5,
                color: 'var(--accent)',
                fontWeight: 700,
                letterSpacing: 0.1,
                textTransform: 'uppercase',
              }}
            >
              · {t('chat.msg.pinned_tag')}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {onStartReply && (
            <button
              onClick={onStartReply}
              title={t('chat.msg.reply_tooltip')}
              className="merlin-reply"
              style={{
                padding: '2px 8px',
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--text-dim)',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 4,
                cursor: 'pointer',
                opacity: 0.6,
                transition: 'opacity .12s, color .12s, border-color .12s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = 1;
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent-line)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = 0.6;
                e.currentTarget.style.color = 'var(--text-dim)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              ↩ {t('chat.msg.reply_btn')}
            </button>
          )}
          {onTogglePin && (
            <button
              onClick={onTogglePin}
              title={pinned ? t('chat.msg.unpin') : t('chat.msg.pin')}
              className="merlin-pin"
              style={{
                width: 20,
                height: 20,
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                color: pinned ? 'var(--accent)' : 'var(--text-dim)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                opacity: pinned ? 1 : 0.5,
                transition: 'opacity .12s, color .12s',
              }}
            >
              <Icon.pin size={12} />
            </button>
          )}
        </div>
        {chips.length > 0 && onQuickReply && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {chips.map((opt, i) => (
              <button
                key={`${i}-${opt}`}
                onClick={() => onQuickReply(opt)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-line)',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background .12s, color .12s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent-soft)';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// MessageThread — renders a root Merlin message with any nested
// replies below it, connected by a thin accent line. Inline reply
// input sits at the bottom of the thread when it's the active target.
export function MessageThread({
  thread,
  pinnedKeys,
  onTogglePin,
  replyingTo,
  onStartReply,
  onCancelReply,
  replyText,
  onReplyTextChange,
  onSendReply,
  onQuickReply,
  thinking,
}) {
  const { root, replies } = thread;
  const rootKey = root.id;
  const isReplyingHere = replyingTo === root.id;
  const hasNested = replies.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Message
        m={root}
        pinned={pinnedKeys.has(rootKey)}
        onTogglePin={root.from === 'merlin' ? () => onTogglePin(rootKey) : null}
        onStartReply={root.from === 'merlin' ? () => onStartReply(root.id) : null}
        onQuickReply={onQuickReply}
      />
      {(hasNested || isReplyingHere) && (
        <div
          style={{
            marginLeft: 30,
            paddingLeft: 12,
            borderLeft: '2px solid var(--border-strong)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {replies.map((m) => (
            <Message
              key={m.id}
              m={m}
              pinned={pinnedKeys.has(m.id)}
              onTogglePin={m.from === 'merlin' ? () => onTogglePin(m.id) : null}
              showAvatar={m.from !== 'user'}
              onQuickReply={onQuickReply}
              // Reply on any Merlin message in the thread continues
              // that same thread — stays one-level nested. Hide the
              // button when an inline input is already open here.
              onStartReply={m.from === 'merlin' && !isReplyingHere ? () => onStartReply(root.id) : null}
            />
          ))}
          {thinking && isReplyingHere && <ThinkingBubble />}
          {isReplyingHere && (
            <InlineReplyInput
              value={replyText}
              onChange={onReplyTextChange}
              onSend={() => onSendReply(root.id)}
              onCancel={onCancelReply}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Compact input that opens inline beneath a Merlin message. Enter
// submits, Escape cancels, and clicking outside doesn't close it —
// the user has to explicitly cancel so a stray click doesn't lose the
// typed text.
function InlineReplyInput({ value, onChange, onSend, onCancel }) {
  const t = useT();
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--accent-line)',
        borderRadius: 10,
        padding: 6,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6,
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={t('chat.reply.placeholder')}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          resize: 'none',
          fontFamily: 'var(--font)',
          fontSize: 12.5,
          color: 'var(--text)',
          minHeight: 28,
          maxHeight: 100,
          padding: '4px 6px',
          lineHeight: 1.4,
        }}
      />
      <button
        onClick={onCancel}
        title={t('chat.reply.cancel_tooltip')}
        style={{
          padding: '4px 8px',
          fontSize: 10.5,
          fontWeight: 600,
          background: 'transparent',
          color: 'var(--text-dim)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {t('chat.reply.cancel')}
      </button>
      <button
        onClick={onSend}
        disabled={!value.trim()}
        style={{
          padding: '4px 10px',
          fontSize: 10.5,
          fontWeight: 700,
          background: value.trim() ? 'var(--accent)' : 'var(--surface-3)',
          color: value.trim() ? '#fff' : 'var(--text-faint)',
          border: 'none',
          borderRadius: 6,
          cursor: value.trim() ? 'pointer' : 'default',
          fontFamily: 'inherit',
        }}
      >
        {t('chat.reply.send')} ↵
      </button>
    </div>
  );
}

function formatMarkdown(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(
      /`([^`]+)`/g,
      '<code style="font-family:var(--mono);background:var(--surface-3);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>',
    )
    .replace(/\n/g, '<br>');
}

export function ThinkingBubble() {
  return (
    <div style={{ display: 'flex', gap: 8, animation: 'merlinFadeIn .3s ease' }}>
      <MerlinAvatar size={22} />
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: '14px 14px 14px 4px',
        }}
      >
        <div className="merlin-thinking">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
