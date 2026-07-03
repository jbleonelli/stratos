/**
 * Stratos entry — visual clone mode mounts Merlin UI (snapshot 659d224).
 * Set VITE_STRATOS_NATIVE=1 to use the Stratos GraphQL shell instead.
 */
const useNative = import.meta.env.VITE_STRATOS_NATIVE === '1';

if (useNative) {
  void import('./main-stratos');
} else {
  // Merlin visual-clone bootstrap (JSX, excluded from tsc)
  // @ts-expect-error vendored Merlin entry
  void import('./visual-clone/bootstrap.jsx');
}
