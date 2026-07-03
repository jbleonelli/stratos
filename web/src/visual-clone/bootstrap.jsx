/**
 * Visual clone entry — mounts Merlin App.jsx (snapshot 659d224) inside Stratos web.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '@merlin/tokens.css';
import '@merlin/app/tweaks-bootstrap.js';
import { startSimulator } from '@merlin/app/simulator.js';
import { queryClient } from '@merlin/app/query-client.ts';
import App from '@merlin/app/App.jsx';
import { DialogHost } from '@merlin/app/dialogs.jsx';
import { DEMO_SESSION } from '@merlin/app/demo-data.js';

try {
  localStorage.setItem('merlin-session', JSON.stringify(DEMO_SESSION));
  localStorage.setItem('merlinChatOpen', '1');
  localStorage.setItem('merlinView', 'briefing');
  localStorage.setItem('merlin-tweaks', JSON.stringify({ building: 'hq', role: 'facility', theme: 'light', accent: 'pink', density: 'comfortable', sidebar: 'collapsed', variant: 'conservative' }));
  sessionStorage.setItem('merlin-landed', '1');
} catch {
  /* ignore */
}

startSimulator();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <DialogHost />
    </QueryClientProvider>
  </React.StrictMode>,
);
