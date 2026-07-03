import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './tokens.css';
import App from './app/App.jsx';
import { DialogHost } from './app/dialogs.jsx';
import './app/tweaks-bootstrap.js';
import { startSimulator } from './app/simulator.js';
import { initSentry, SentryErrorBoundary } from './app/sentry.js';
import { queryClient } from './app/query-client.ts';

// Init before anything else so module-load errors get captured. No-op
// when VITE_SENTRY_DSN isn't set (local dev / preview).
initSentry();

// PWA: register the (deliberately minimal, network-first) service worker so
// Merlin is installable as a desktop / Chrome app. Production only — a SW
// would fight Vite's dev HMR. See public/sw.js for the no-stale-chunk
// strategy (network always wins; only content-hashed assets are cached).
if (import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* non-fatal */
    });
  });
}

startSimulator();
ReactDOM.createRoot(document.getElementById('root')).render(
  // ErrorBoundary catches React render errors that would otherwise
  // bubble past the app and show a blank page. Fallback is intentionally
  // minimal — we want users to see SOMETHING and a way out, not a polished
  // error page that hides the underlying problem.
  <SentryErrorBoundary
    fallback={({ resetError }) => (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          color: '#0A0B14',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Something broke.</h2>
          <p style={{ marginTop: 10, color: '#555', fontSize: 14, lineHeight: 1.5 }}>
            The error has been logged. Try reloading — if it keeps happening, contact{' '}
            <a href="mailto:support@adaptiv.systems" style={{ color: '#FF00B2' }}>
              support@adaptiv.systems
            </a>
            .
          </p>
          <button
            onClick={() => {
              resetError();
              window.location.reload();
            }}
            style={{
              marginTop: 16,
              padding: '10px 18px',
              background: '#FF00B2',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    )}
  >
    <QueryClientProvider client={queryClient}>
      <App />
      {/* App-wide branded confirm/alert/prompt host (replaces native window.* dialogs). */}
      <DialogHost />
    </QueryClientProvider>
  </SentryErrorBoundary>,
);
