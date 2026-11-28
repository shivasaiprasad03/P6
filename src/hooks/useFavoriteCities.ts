import { useCallback, useState } from 'react';

const FAVORITES_STORAGE_KEY = 'breathesafe:favorite-cities:v1';
/** Storage is user-editable, so the list is bounded and each entry validated on read. */
export const MAX_FAVORITE_CITIES = 20;
const MAX_CITY_NAME_LENGTH = 100;

function isValidCityName(item: unknown): item is string {
  return typeof item === 'string' && item.trim().length > 0 && item.length <= MAX_CITY_NAME_LENGTH;
}

export function readStoredFavorites(defaultCityName: string): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [defaultCityName];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [defaultCityName];
    return Array.from(new Set(parsed.filter(isValidCityName))).slice(0, MAX_FAVORITE_CITIES);
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
      // Newest favourites are kept when the cap is reached.
      const next = exists
        ? prev.filter((name) => name !== cityName)
        : [...prev, cityName].slice(-MAX_FAVORITE_CITIES);
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
