import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'stratos-theme';

function initial(): Theme {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
}

// Toggles the `dark` class on <body>, which flips the tokens.css theme block.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage blocked — non-fatal */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
