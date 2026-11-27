import { AIR_QUALITY_CONSTANTS, classifyAqi, PRESET_CITIES } from '../../shared/constants.js';
import type {
  AirQualityReport,
  CityLocation,
  HourlyAirPoint,
  WeatherConditions,
} from '../../shared/types.js';
import { CACHE_CONFIG, NETWORK_LIMITS, UPSTREAM_ORIGINS } from '../config/constants.js';
import { getServerConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  assessInversionRisk,
  computeSafestOutdoorWindow,
  estimateGlobalRank,
  formatHourLabel,
  mapWeatherCondition,
  pm25ToUsAqi,
} from './airQuality/aqiAnalytics.js';
import {
  buildFallbackAirQualityReport,
  buildFallbackWeather,
  buildNearbyStations,
} from './airQuality/fallbackProvider.js';
import { TtlLruCache } from './cacheService.js';
import { pm25ToCigaretteEquivalentPerDay } from './impactCalculator.js';

export {
  assessInversionRisk,
  buildFallbackAirQualityReport,
  buildNearbyStations,
  computeSafestOutdoorWindow,
  estimateGlobalRank,
  pm25ToUsAqi,
};

/** Bounded cache storing air quality reports keyed by ~1.1 km rounded coordinates. */
export const airQualityCache = new TtlLruCache<AirQualityReport>(
  CACHE_CONFIG.airQuality.maxEntries,
  CACHE_CONFIG.airQuality.ttlMs,
);

/** Bounded cache storing city geocoding results. */
export const citySearchCache = new TtlLruCache<CityLocation[]>(
  CACHE_CONFIG.citySearch.maxEntries,
  CACHE_CONFIG.citySearch.ttlMs,
);

interface OpenMeteoGeoResponse {
  results?: Array<{
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
}

interface OpenMeteoAirResponse {
  timezone?: string;
  current?: {
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    nitrogen_dioxide?: number;
    ozone?: number;
    carbon_monoxide?: number;
    sulphur_dioxide?: number;
  };
  hourly?: {
    time?: string[];
    us_aqi?: Array<number | null>;
    pm2_5?: Array<number | null>;
    pm10?: Array<number | null>;
    nitrogen_dioxide?: Array<number | null>;
    ozone?: Array<number | null>;
  };
}

interface OpenMeteoWeatherResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
  hourly?: {
    uv_index?: Array<number | null>;
  };
}

async function fetchJsonWithTimeout<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_LIMITS.upstreamTimeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Upstream HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function buildOpenMeteoUrls(location: CityLocation): { aqUrl: URL; weatherUrl: URL } {
  const aqUrl = new URL(UPSTREAM_ORIGINS.openMeteoAirQuality);
  aqUrl.searchParams.set('latitude', String(location.latitude));
  aqUrl.searchParams.set('longitude', String(location.longitude));
  aqUrl.searchParams.set(
    'current',
    'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,sulphur_dioxide',
  );
  aqUrl.searchParams.set('hourly', 'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone');
  aqUrl.searchParams.set('forecast_days', '2');
  aqUrl.searchParams.set('timezone', 'auto');

  const weatherUrl = new URL(UPSTREAM_ORIGINS.openMeteoWeather);
  weatherUrl.searchParams.set('latitude', String(location.latitude));
  weatherUrl.searchParams.set('longitude', String(location.longitude));
  weatherUrl.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
  );
  weatherUrl.searchParams.set('hourly', 'uv_index');
  weatherUrl.searchParams.set('forecast_days', '1');
  weatherUrl.searchParams.set('timezone', 'auto');

  return { aqUrl, weatherUrl };
}

function buildHourlyForecast(data: OpenMeteoAirResponse): HourlyAirPoint[] {
  const times = data.hourly?.time ?? [];
  const nowMs = Date.now();
  const foundIdx = times.findIndex((t) => new Date(t).getTime() >= nowMs - 60 * 60 * 1000);
  const startIdx = Math.max(0, foundIdx);
  const sliceEnd = Math.min(times.length, startIdx + 24);
  const hourlyForecast: HourlyAirPoint[] = [];

  for (let i = startIdx; i < sliceEnd; i += 1) {
    const iso = times[i];
    if (!iso) continue;
    const pm25 = Number((data.hourly?.pm2_5?.[i] ?? data.current?.pm2_5 ?? 25).toFixed(1));
    const pm10 = Number((data.hourly?.pm10?.[i] ?? data.current?.pm10 ?? pm25 * 1.4).toFixed(1));
    const usAqi = Math.round(data.hourly?.us_aqi?.[i] ?? pm25ToUsAqi(pm25));

    hourlyForecast.push({
      time: iso,
      hourLabel: formatHourLabel(iso),
      usAqi,
      pm25,
      pm10,
      no2: Number((data.hourly?.nitrogen_dioxide?.[i] ?? 20).toFixed(1)),
      ozone: Number((data.hourly?.ozone?.[i] ?? 30).toFixed(1)),
    });
  }

  return hourlyForecast;
}

function buildLiveWeather(
  location: CityLocation,
  currentAqi: number,
  weatherData: OpenMeteoWeatherResponse | null,
): WeatherConditions {
  const fallback = buildFallbackWeather(location, currentAqi);
  const windSpeedKmh = Math.round(weatherData?.current?.wind_speed_10m ?? fallback.windSpeedKmh);
  const hourNow = new Date().getHours();
  const uvValue = Math.round(weatherData?.hourly?.uv_index?.[hourNow] ?? fallback.uvIndex);
  const cond = mapWeatherCondition(weatherData?.current?.weather_code, currentAqi, windSpeedKmh);

  return {
    temperatureC: Math.round(weatherData?.current?.temperature_2m ?? fallback.temperatureC),
    humidityPct: Math.round(weatherData?.current?.relative_humidity_2m ?? fallback.humidityPct),
    windSpeedKmh,
    uvIndex: Math.max(0, uvValue),
    conditionLabel: cond.conditionLabel,
    conditionIcon: cond.conditionIcon,
  };
}

function mapLiveReport(
  location: CityLocation,
  data: OpenMeteoAirResponse,
  weatherData: OpenMeteoWeatherResponse | null,
  hourlyForecast: HourlyAirPoint[],
): AirQualityReport {
  const currentPm25 = Number((data.current?.pm2_5 ?? hourlyForecast[0]?.pm25 ?? 25).toFixed(1));
  const currentAqi = Math.round(data.current?.us_aqi ?? pm25ToUsAqi(currentPm25));
  const band = classifyAqi(currentAqi);
  const weather = buildLiveWeather(location, currentAqi, weatherData);

  return {
    location: { ...location, timezone: data.timezone ?? location.timezone },
    fetchedAt: new Date().toISOString(),
    source: 'open-meteo-live',
    current: {
      usAqi: currentAqi,
      pm25: currentPm25,
      pm10: Number((data.current?.pm10 ?? currentPm25 * 1.4).toFixed(1)),
      no2: Number((data.current?.nitrogen_dioxide ?? 18).toFixed(1)),
      ozone: Number((data.current?.ozone ?? 35).toFixed(1)),
      co: Math.round(data.current?.carbon_monoxide ?? 350),
      so2: Number((data.current?.sulphur_dioxide ?? 8).toFixed(1)),
      severity: band.severity,
      label: band.label,
      cigaretteEquivalentPerDay: pm25ToCigaretteEquivalentPerDay(currentPm25),
      whoPm25Multiple: Number(
        (currentPm25 / AIR_QUALITY_CONSTANTS.whoPm25Guideline24h).toFixed(1),
      ),
    },
    weather,
    nearbyStations: buildNearbyStations(location.name, currentPm25),
    globalRankEstimate: estimateGlobalRank(location.name, currentAqi, weather.windSpeedKmh),
    hourlyForecast,
    safestWindow: computeSafestOutdoorWindow(hourlyForecast),
    inversionRisk: assessInversionRisk(currentAqi, hourlyForecast),
  };
}

/**
 * Searches matching global cities via Open-Meteo Geocoding with bounded caching
 * and automatic fallback to curated preset hotspots when offline.
 */
export async function searchCities(query: string): Promise<CityLocation[]> {
  const normalized = query.trim().toLowerCase();
  const { value } = await citySearchCache.getOrLoad(normalized, async () => {
    const presetMatches = PRESET_CITIES.filter(
      (c) =>
        c.name.toLowerCase().includes(normalized) ||
        c.country.toLowerCase().includes(normalized),
    );

    if (getServerConfig().offlineMode) {
      return presetMatches;
    }

    try {
      const url = new URL(UPSTREAM_ORIGINS.openMeteoGeo);
      url.searchParams.set('name', query.trim());
      url.searchParams.set('count', '6');
      url.searchParams.set('language', 'en');
      url.searchParams.set('format', 'json');

      const data = await fetchJsonWithTimeout<OpenMeteoGeoResponse>(url);
      const remote: CityLocation[] = (data.results ?? []).map((item) => ({
        name: item.name,
        country: item.country ?? 'Unknown',
        admin1: item.admin1,
        latitude: Number(item.latitude.toFixed(4)),
        longitude: Number(item.longitude.toFixed(4)),
        timezone: item.timezone,
      }));
      return remote.length > 0 ? remote : presetMatches;
    } catch (err) {
      logger.warn('Open-Meteo city search unavailable; using preset matches', {
        reason: err instanceof Error ? err.message : 'unknown_error',
      });
      return presetMatches;
    }
  });

  return value;
}

/**
 * Fetches a comprehensive air quality & winter smog dispersion report for `location`,
 * combining Open-Meteo AQ + Weather APIs with coordinate-grid caching and offline fallback.
 */
export async function getAirQualityReport(location: CityLocation): Promise<AirQualityReport> {
  const cacheKey = `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;

  const { value, hit } = await airQualityCache.getOrLoad(cacheKey, async () => {
    if (getServerConfig().offlineMode) {
      return buildFallbackAirQualityReport(location);
    }

    try {
      const { aqUrl, weatherUrl } = buildOpenMeteoUrls(location);
      const [data, weatherData] = await Promise.all([
        fetchJsonWithTimeout<OpenMeteoAirResponse>(aqUrl),
        fetchJsonWithTimeout<OpenMeteoWeatherResponse>(weatherUrl).catch(() => null),
      ]);

      const hourlyForecast = buildHourlyForecast(data);
      if (!data.current || hourlyForecast.length === 0) {
        return buildFallbackAirQualityReport(location);
      }

      return mapLiveReport(location, data, weatherData, hourlyForecast);
    } catch (err) {
      logger.warn('Open-Meteo air quality fetch failed; serving fallback report', {
        city: location.name,
        reason: err instanceof Error ? err.message : 'unknown_error',
      });
      return buildFallbackAirQualityReport(location);
    }
  });

  return hit && value.source === 'open-meteo-live'
    ? { ...value, source: 'cached-live' }
    : value;
}
