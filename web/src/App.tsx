import { Workspace } from './components/Workspace';

export default function App({ signOut }: { signOut: () => void }) {
  return <Workspace signOut={signOut} />;
}
