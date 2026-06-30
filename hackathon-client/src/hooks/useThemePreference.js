import { useState } from 'react';

export const AUTH_THEME_STORAGE_KEY = 'hackcore-auth-theme';

export const getStoredTheme = (fallback = 'dark') => {
  try {
    return localStorage.getItem(AUTH_THEME_STORAGE_KEY) || fallback;
  } catch {
    return fallback;
  }
};

export default function useThemePreference(fallback = 'dark') {
  const [theme, setTheme] = useState(() => getStoredTheme(fallback));

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

      try {
        localStorage.setItem(AUTH_THEME_STORAGE_KEY, nextTheme);
      } catch {
        // Keep the UI responsive even when storage is unavailable.
      }

      return nextTheme;
    });
  };

  return {
    theme,
    isDarkTheme: theme === 'dark',
    toggleTheme
  };
}
