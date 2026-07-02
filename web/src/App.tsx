import { Dashboard } from './components/Dashboard';

export default function App({ signOut }: { signOut: () => void }) {
  return <Dashboard signOut={signOut} />;
}
