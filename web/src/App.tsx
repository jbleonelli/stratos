import { useSession } from './queries/useSession';
import { Workspace } from './components/Workspace';
import { OnboardingScreen } from './screens/OnboardingScreen';

export default function App({ signOut }: { signOut: () => void }) {
  const { data: session, isLoading } = useSession();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-dim)' }}>
        Loading…
      </div>
    );
  }

  if (!session?.orgId) {
    return <OnboardingScreen signOut={signOut} />;
  }

  return <Workspace signOut={signOut} />;
}
