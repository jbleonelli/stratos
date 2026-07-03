import { useState } from 'react';
import { useAnswerAsk, useAsks, useRaiseAsk } from '../queries/useData';
import type { Ask, AskStatus } from '../api/types';
import { timeAgo } from './format';
import { Button, Card, DataError, PanelHead, Pill, TextInput } from '../ui/primitives';

const statusTone = (s: AskStatus) =>
  s === 'answered' ? 'ok' : s === 'open' ? 'warn' : 'risk';

function AskRow({ ask }: { ask: Ask }) {
  const answer = useAnswerAsk();
  const [text, setText] = useState('');
  const open = ask.status === 'open';

  return (
    <li
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: 12,
        animation: 'ds-fade-in .2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <Pill tone={statusTone(ask.status)}>{ask.status}</Pill>
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{timeAgo(ask.createdAt)}</span>
      </div>
      <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--text)', lineHeight: 1.45 }}>{ask.question}</p>
      {ask.answer && <p style={{ margin: '4px 0 8px', fontSize: 13.5, color: 'var(--ok)' }}>{ask.answer}</p>}
      {open && (
        <form
          style={{ display: 'flex', gap: 8, marginTop: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            answer.mutate({ askId: ask.id, answer: text.trim() });
            setText('');
          }}
        >
          <TextInput value={text} onChange={setText} placeholder="Answer…" ariaLabel="Answer" />
          <Button type="submit" disabled={answer.isPending}>
            {answer.isPending ? '…' : 'Answer'}
          </Button>
        </form>
      )}
    </li>
  );
}

export function AsksPanel() {
  const { data: asks = [], isLoading, isError, refetch } = useAsks();
  const raise = useRaiseAsk();
  const [question, setQuestion] = useState('');

  const open = asks.filter((a) => a.status === 'open');
  const resolved = asks.filter((a) => a.status !== 'open');

  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <PanelHead
        title="Asks"
        right={<Pill tone={open.length ? 'warn' : 'neutral'}>{open.length} open</Pill>}
      />

      <form
        style={{ display: 'flex', gap: 8, marginBottom: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim()) return;
          raise.mutate({ question: question.trim() });
          setQuestion('');
        }}
      >
        <TextInput value={question} onChange={setQuestion} placeholder="Raise an ask for the team…" ariaLabel="Raise an ask" />
        <Button type="submit" disabled={raise.isPending}>
          {raise.isPending ? '…' : 'Raise'}
        </Button>
      </form>

      {isError ? (
        <DataError message="Couldn’t load asks." onRetry={() => refetch()} compact />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {open.map((a) => (
            <AskRow key={a.id} ask={a} />
          ))}
          {resolved.map((a) => (
            <AskRow key={a.id} ask={a} />
          ))}
          {isLoading && <li style={{ color: 'var(--text-dim)', fontSize: 13, padding: '6px 2px' }}>Loading…</li>}
          {!isLoading && asks.length === 0 && (
            <li style={{ color: 'var(--text-faint)', textAlign: 'center', padding: 20, fontSize: 13 }}>No asks yet.</li>
          )}
        </ul>
      )}
    </Card>
  );
}
