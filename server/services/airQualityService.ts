/**
 * Server-side air quality access: the shared Open-Meteo client plus bounded caching,
 * request coalescing, OFFLINE_MODE and a labelled sample-data fallback.
 */
import { buildSampleReport } from '../../shared/airQuality/sampleReport.js';
import { fetchLiveReport, geocodeCities } from '../../shared/airQuality/openMeteo.js';
import { PRESET_CITIES } from '../../shared/constants.js';
import type { AirQualityReport, CityLocation } from '../../shared/types.js';
import { CACHE_CONFIG, NETWORK_LIMITS } from '../config/constants.js';
import { getServerConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { TtlLruCache } from './cacheService.js';

export const airQualityCache = new TtlLruCache<AirQualityReport>(
  CACHE_CONFIG.airQuality.maxEntries,
  CACHE_CONFIG.airQuality.ttlMs,
);

export const citySearchCache = new TtlLruCache<CityLocation[]>(
  CACHE_CONFIG.citySearch.maxEntries,
  CACHE_CONFIG.citySearch.ttlMs,
);

const reason = (err: unknown) => (err instanceof Error ? err.message : 'unknown_error');

function matchPresets(query: string): CityLocation[] {
  return PRESET_CITIES.filter(
    (c) => c.name.toLowerCase().includes(query) || c.country.toLowerCase().includes(query),
  );
}

/** City search with caching; falls back to the preset list when offline or on error. */
export async function searchCities(query: string): Promise<CityLocation[]> {
  const normalized = query.trim().toLowerCase();
  const { value } = await citySearchCache.getOrLoad(normalized, async () => {
    if (getServerConfig().offlineMode) return matchPresets(normalized);
    try {
      const remote = await geocodeCities(query.trim(), { timeoutMs: NETWORK_LIMITS.upstreamTimeoutMs });
      return remote.length > 0 ? remote : matchPresets(normalized);
    } catch (err) {
      logger.warn('City search unavailable; using preset matches', { reason: reason(err) });
      return matchPresets(normalized);
    }
  });
  return value;
}

/**
 * Returns the air quality report for a location. Reports are cached per ~1 km grid cell;
 * if Open-Meteo is unreachable a clearly labelled sample report is returned instead.
 */
export async function getAirQualityReport(location: CityLocation): Promise<AirQualityReport> {
  const cacheKey = `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;

  const { value, hit } = await airQualityCache.getOrLoad(cacheKey, async () => {
    if (getServerConfig().offlineMode) return buildSampleReport(location);
    try {
      return await fetchLiveReport(location, { timeoutMs: NETWORK_LIMITS.upstreamTimeoutMs });
    } catch (err) {
      logger.warn('Open-Meteo unavailable; serving sample report', {
        city: location.name,
        reason: reason(err),
      });
      return buildSampleReport(location);
    }
  });

  // The cache key is the grid cell, so keep the caller's own place name on the way out.
  const report = { ...value, location: { ...value.location, name: location.name, country: location.country } };
  return hit && value.source === 'live' ? { ...report, source: 'cached' } : report;
}
