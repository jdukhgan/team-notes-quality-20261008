import { useCallback, useEffect, useState } from 'react';
import { Button } from './Button.jsx';
import { Icon } from './Icon.jsx';

const STORAGE_KEY = 'team-notes-theme';

/** Reads/writes <html data-theme>. Index.html resolves the initial value. */
export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    // Follow the OS while the user has not made an explicit choice.
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const follow = (event) => {
      let stored = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {
        /* storage unavailable */
      }
      if (!stored) setTheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable: choice lasts for this page only */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}

export function ThemeToggle({ theme, onToggle }) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button variant="ghost" iconOnly onClick={onToggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
    </Button>
  );
}
