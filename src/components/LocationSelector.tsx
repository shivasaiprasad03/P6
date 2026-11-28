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
/** Text for the always-present status region, so result changes are announced. */
export function searchStatusText(
  searching: boolean,
  error: string | null,
  resultCount: number,
  resultsAreCurrent: boolean,
): string {
  if (searching) return 'Searching…';
  if (error) return error;
  if (!resultsAreCurrent) return '';
  if (resultCount === 0) return 'No matching cities.';
  return `${resultCount} ${resultCount === 1 ? 'city' : 'cities'} found.`;
}

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
  /** The query the current `results` belong to, so stale counts are never announced. */
  const [resultsQuery, setResultsQuery] = useState('');

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
        setResultsQuery(trimmed);
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
            aria-controls={results.length > 0 ? listboxId : undefined}
            aria-expanded={results.length > 0}
            aria-describedby={`${inputId}-help`}
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

      <p id={`${inputId}-help`} className="sr-only">
        Type at least 2 letters, then use the up and down arrow keys to pick a city and Enter to choose it.
      </p>
      <p className={searching || searchError ? 'hint' : 'sr-only'} role="status">
        {searchStatusText(
          searching,
          searchError,
          results.length,
          query.trim().length >= 2 && resultsQuery === query.trim(),
        )}
      </p>

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
