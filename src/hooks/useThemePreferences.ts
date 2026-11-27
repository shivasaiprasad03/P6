import { useEffect, useState } from 'react';

export type ColorTheme = 'light' | 'dark';

function initialTheme(): ColorTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Manages the light/dark theme (starting from the system preference) and high-contrast mode,
 * syncing both onto the root `<html>` element.
 */
export function useThemePreferences() {
  const [theme, setTheme] = useState<ColorTheme>(initialTheme);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (highContrast) {
      document.documentElement.dataset.contrast = 'high';
    } else {
      delete document.documentElement.dataset.contrast;
    }
  }, [highContrast]);

  return {
    theme,
    highContrast,
    toggleTheme: () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')),
    toggleHighContrast: () => setHighContrast((prev) => !prev),
  };
}
