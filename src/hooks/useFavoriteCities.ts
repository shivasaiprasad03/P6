import { useCallback, useState } from 'react';

const FAVORITES_STORAGE_KEY = 'breathesafe:favorite-cities:v1';

function readStoredFavorites(defaultCityName: string): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [defaultCityName];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [defaultCityName];
  } catch {
    return [defaultCityName];
  }
}

/**
 * Manages persisted favorite city names in `localStorage` with graceful fallback
 * when browser storage is restricted.
 */
export function useFavoriteCities(defaultCityName: string) {
  const [favoriteCities, setFavoriteCities] = useState<string[]>(() =>
    readStoredFavorites(defaultCityName),
  );

  const toggleFavoriteCity = useCallback((cityName: string) => {
    setFavoriteCities((prev) => {
      const exists = prev.includes(cityName);
      const next = exists ? prev.filter((name) => name !== cityName) : [...prev, cityName];
      try {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage quota or private browsing restrictions are non-fatal
      }
      return next;
    });
  }, []);

  const isFavoriteCity = useCallback(
    (cityName: string) => favoriteCities.includes(cityName),
    [favoriteCities],
  );

  return { favoriteCities, isFavoriteCity, toggleFavoriteCity };
}
