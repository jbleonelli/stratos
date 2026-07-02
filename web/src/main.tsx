import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { configureAmplify } from './amplify';
import App from './App';
import './styles.css';

configureAmplify();

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Authenticator signUpAttributes={['email']}>
        {({ signOut }) => <App signOut={signOut ?? (() => undefined)} />}
      </Authenticator>
    </QueryClientProvider>
  </React.StrictMode>,
);
