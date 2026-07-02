import { useState } from 'react';
import { useAnswerAsk, useAsks, useRaiseAsk } from '../queries/useData';
import type { Ask } from '../api/types';
import { timeAgo } from './format';

function AskRow({ ask }: { ask: Ask }) {
  const answer = useAnswerAsk();
  const [text, setText] = useState('');
  const open = ask.status === 'open';

  return (
    <li className="ask">
      <div className="ask-head">
        <span className={`pill pill-${ask.status}`}>{ask.status}</span>
        <span className="muted">{timeAgo(ask.createdAt)}</span>
      </div>
      <p className="ask-q">{ask.question}</p>
      {ask.answer && <p className="ask-a">{ask.answer}</p>}
      {open && (
        <form
          className="ask-answer"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            answer.mutate({ askId: ask.id, answer: text.trim() });
            setText('');
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Answer…"
            aria-label="Answer"
          />
          <button className="btn" disabled={answer.isPending}>
            {answer.isPending ? '…' : 'Answer'}
          </button>
        </form>
      )}
    </li>
  );
}

export function AsksPanel() {
  const { data: asks = [], isLoading, isError } = useAsks();
  const raise = useRaiseAsk();
  const [question, setQuestion] = useState('');

  const open = asks.filter((a) => a.status === 'open');
  const resolved = asks.filter((a) => a.status !== 'open');

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Asks</h2>
        <span className="count">{open.length} open</span>
      </div>

      <form
        className="raise"
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim()) return;
          raise.mutate({ question: question.trim() });
          setQuestion('');
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Raise an ask for the team…"
          aria-label="Raise an ask"
        />
        <button className="btn" disabled={raise.isPending}>
          {raise.isPending ? '…' : 'Raise'}
        </button>
      </form>

      {isLoading && <p className="muted">Loading…</p>}
      {isError && <p className="error">Couldn’t load asks.</p>}

      <ul className="list">
        {open.map((a) => (
          <AskRow key={a.id} ask={a} />
        ))}
        {resolved.map((a) => (
          <AskRow key={a.id} ask={a} />
        ))}
        {!isLoading && asks.length === 0 && <li className="empty">No asks yet.</li>}
      </ul>
    </section>
  );
}
