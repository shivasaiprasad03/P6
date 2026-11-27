import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { LocateFixed, Search } from 'lucide-react';
import { PRESET_CITIES } from '../../shared/constants.js';
import type { CityLocation } from '../../shared/types.js';
import { searchCitiesApi } from '../lib/apiClient.js';

interface LocationSelectorProps {
  selectedCity: CityLocation;
  onSelectCity: (city: CityLocation) => void;
  onLocateMe: () => void;
}

/**
 * City picker: a WAI-ARIA combobox search (`ArrowDown`/`ArrowUp`/`Enter`/`Escape`),
 * a browser-location button, and quick picks for a few reference cities.
 */
export function LocationSelector({
  selectedCity,
  onSelectCity,
  onLocateMe,
}: LocationSelectorProps) {
  const inputId = useId();
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityLocation[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const cities = await searchCitiesApi(trimmed, controller.signal);
        setResults(cities);
        setActiveIndex(cities.length > 0 ? 0 : -1);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setSearchError('City search is unavailable right now. Pick one of the cities below.');
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function commitSelection(city: CityLocation): void {
    onSelectCity(city);
    setQuery('');
    setResults([]);
    setActiveIndex(-1);
    setSearchError(null);
  }

  function handleComboboxKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const chosen = results[activeIndex];
      if (chosen) commitSelection(chosen);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setResults([]);
      setActiveIndex(-1);
    }
  }

  const activeOptionId =
    activeIndex >= 0 && results[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <section className="place-bar" aria-label="Choose a city">
      <div className="place-search">
        <div className="search-field">
          <Search size={17} aria-hidden="true" className="search-icon" />
          <label htmlFor={inputId} className="sr-only">
            Search any city worldwide
          </label>
          <input
            id={inputId}
            type="search"
            role="combobox"
            className="input input-search"
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              if (next.trim().length < 2) {
                setResults([]);
                setActiveIndex(-1);
                setSearchError(null);
              }
            }}
            onKeyDown={handleComboboxKeyDown}
            placeholder="Search a city"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={results.length > 0}
            aria-activedescendant={activeOptionId}
          />
          {results.length > 0 && (
            <ul id={listboxId} className="search-results" role="listbox" aria-label="Matching cities">
              {results.map((city, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={`${city.name}-${city.latitude}-${city.longitude}`}
                    id={`${listboxId}-opt-${idx}`}
                    role="option"
                    aria-selected={isActive}
                    className={`search-result ${isActive ? 'is-active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitSelection(city);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <span>
                      <strong>{city.name}</strong>
                      {city.admin1 ? `, ${city.admin1}` : ''}
                    </span>
                    <span className="search-result-country">{city.country}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="btn"
          onClick={onLocateMe}
          aria-label="Use my current browser location"
        >
          <LocateFixed size={16} aria-hidden="true" />
          <span className="hide-narrow">Use my location</span>
        </button>
      </div>

      {(searching || searchError) && (
        <p className="hint" role="status" aria-live="polite">
          {searching ? 'Searching…' : searchError}
        </p>
      )}

      <div className="city-chips" role="group" aria-label="Quick city picks">
        {PRESET_CITIES.map((city) => {
          const isSelected =
            selectedCity.name === city.name && selectedCity.country === city.country;
          return (
            <button
              key={city.name}
              type="button"
              className="chip"
              aria-pressed={isSelected}
              onClick={() => onSelectCity(city)}
            >
              {city.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
