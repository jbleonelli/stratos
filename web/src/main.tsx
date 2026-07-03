import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { configureAmplify } from './amplify';
import App from './App';
import { Wordmark } from './ui/primitives';
import './tokens.css';
import 'leaflet/dist/leaflet.css';

configureAmplify();

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

// Branded header above the Cognito form on the login screen.
const authComponents = {
  Header() {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Wordmark height={26} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>Stratos</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
          Autonomous operations, supervised by you.
        </div>
      </div>
    );
  },
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Authenticator signUpAttributes={['email']} components={authComponents}>
        {({ signOut }) => <App signOut={signOut ?? (() => undefined)} />}
      </Authenticator>
    </QueryClientProvider>
  </React.StrictMode>,
);
