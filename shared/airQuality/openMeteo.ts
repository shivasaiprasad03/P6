/**
 * Open-Meteo client shared by the API server and the static (browser-only) build.
 * Fetches air quality, weather and geocoding, and maps them to an `AirQualityReport`.
 *
 * Times are requested as Unix timestamps together with the city's UTC offset, so the
 * forecast starts at the right hour and is labelled in the city's local time no matter
 * which time zone the server or the viewer is in.
 */
import {
  assessInversionRisk,
  computeSafestOutdoorWindow,
  formatHourLabel,
  mapWeatherCondition,
  pm25ToCigarettesPerDay,
  pm25ToUsAqi,
  whoGuidelineMultiple,
} from '../aqi.js';
import { classifyAqi } from '../constants.js';
import type { AirQualityReport, CityLocation, HourlyAirPoint, WeatherConditions } from '../types.js';

/** Fixed HTTPS endpoints. Only coordinates and a city name are ever sent. */
export const OPEN_METEO_ENDPOINTS = {
  geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
  airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
  weather: 'https://api.open-meteo.com/v1/forecast',
} as const;

const DEFAULT_TIMEOUT_MS = 4_500;
const FORECAST_HOURS = 24;
const HOUR_MS = 3_600_000;

type Series = Array<number | null> | undefined;

interface AirResponse {
  timezone?: string;
  utc_offset_seconds?: number;
  current?: Partial<
    Record<
      'us_aqi' | 'pm2_5' | 'pm10' | 'nitrogen_dioxide' | 'ozone' | 'carbon_monoxide' | 'sulphur_dioxide',
      number | null
    >
  >;
  hourly?: {
    time?: number[];
    us_aqi?: Series;
    pm2_5?: Series;
    pm10?: Series;
    nitrogen_dioxide?: Series;
    ozone?: Series;
  };
}

interface WeatherResponse {
  current?: Partial<
    Record<'temperature_2m' | 'relative_humidity_2m' | 'wind_speed_10m' | 'weather_code', number | null>
  >;
  hourly?: { time?: number[]; uv_index?: Series };
}

interface GeocodingResponse {
  results?: Array<{
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
}

export interface FetchOptions {
  timeoutMs?: number;
  now?: () => number;
}

async function fetchJson<T>(url: URL, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo responded with HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function at(series: Series, index: number): number | undefined {
  const value = series?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function airQualityUrl(location: CityLocation): URL {
  const url = new URL(OPEN_METEO_ENDPOINTS.airQuality);
  url.search = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,sulphur_dioxide',
    hourly: 'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone',
    forecast_days: '2',
    timezone: 'auto',
    timeformat: 'unixtime',
  }).toString();
  return url;
}

function weatherUrl(location: CityLocation): URL {
  const url = new URL(OPEN_METEO_ENDPOINTS.weather);
  url.search = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
    hourly: 'uv_index',
    forecast_days: '2',
    timezone: 'auto',
    timeformat: 'unixtime',
  }).toString();
  return url;
}

/** Next 24 hours starting with the hour that contains `nowMs`. */
export function mapHourlyForecast(data: AirResponse, nowMs: number): HourlyAirPoint[] {
  const times = data.hourly?.time ?? [];
  const offset = data.utc_offset_seconds ?? 0;
  const firstIndex = times.findIndex((t) => t * 1000 + HOUR_MS > nowMs);
  if (firstIndex < 0) return [];

  const points: HourlyAirPoint[] = [];
  for (let i = firstIndex; i < Math.min(times.length, firstIndex + FORECAST_HOURS); i += 1) {
    const epochMs = (times[i] ?? 0) * 1000;
    const pm25 = at(data.hourly?.pm2_5, i);
    if (pm25 === undefined) continue;
    points.push({
      time: new Date(epochMs).toISOString(),
      hourLabel: formatHourLabel(epochMs, offset),
      usAqi: Math.round(at(data.hourly?.us_aqi, i) ?? pm25ToUsAqi(pm25)),
      pm25: round(pm25),
      pm10: round(at(data.hourly?.pm10, i) ?? 0),
      no2: round(at(data.hourly?.nitrogen_dioxide, i) ?? 0),
      ozone: round(at(data.hourly?.ozone, i) ?? 0),
    });
  }
  return points;
}

function nearestIndex(times: number[] | undefined, nowMs: number): number {
  if (!times || times.length === 0) return -1;
  let best = 0;
  times.forEach((t, i) => {
    if (Math.abs(t * 1000 - nowMs) < Math.abs((times[best] ?? 0) * 1000 - nowMs)) best = i;
  });
  return best;
}

/** Returns null rather than invented values when the weather call failed. */
function mapWeather(
  data: WeatherResponse | null,
  currentAqi: number,
  nowMs: number,
): WeatherConditions | null {
  const current = data?.current;
  if (!current || typeof current.temperature_2m !== 'number') return null;
  const wind = Math.round(current.wind_speed_10m ?? 0);
  const uv = at(data.hourly?.uv_index, nearestIndex(data.hourly?.time, nowMs)) ?? 0;
  return {
    temperatureC: Math.round(current.temperature_2m),
    humidityPct: Math.round(current.relative_humidity_2m ?? 0),
    windSpeedKmh: wind,
    uvIndex: Math.max(0, Math.round(uv)),
    ...mapWeatherCondition(current.weather_code ?? undefined, currentAqi, wind),
  };
}

/** Builds a report from raw Open-Meteo payloads. Exported for testing. */
export function mapLiveReport(
  location: CityLocation,
  air: AirResponse,
  weather: WeatherResponse | null,
  nowMs: number,
): AirQualityReport | null {
  const hourlyForecast = mapHourlyForecast(air, nowMs);
  const first = hourlyForecast[0];
  if (!first) return null;

  const pm25 = round(air.current?.pm2_5 ?? first.pm25);
  const usAqi = Math.round(air.current?.us_aqi ?? pm25ToUsAqi(pm25));
  const band = classifyAqi(usAqi);

  return {
    location: { ...location, timezone: air.timezone ?? location.timezone },
    fetchedAt: new Date(nowMs).toISOString(),
    source: 'live',
    current: {
      usAqi,
      pm25,
      pm10: round(air.current?.pm10 ?? first.pm10),
      no2: round(air.current?.nitrogen_dioxide ?? first.no2),
      ozone: round(air.current?.ozone ?? first.ozone),
      co: Math.round(air.current?.carbon_monoxide ?? 0),
      so2: round(air.current?.sulphur_dioxide ?? 0),
      severity: band.severity,
      label: band.label,
      cigaretteEquivalentPerDay: pm25ToCigarettesPerDay(pm25),
      whoPm25Multiple: whoGuidelineMultiple(pm25),
    },
    weather: mapWeather(weather, usAqi, nowMs),
    hourlyForecast,
    safestWindow: computeSafestOutdoorWindow(hourlyForecast),
    inversionRisk: assessInversionRisk(usAqi, hourlyForecast),
  };
}

/**
 * Fetches a live report. Weather is optional (a failed weather call still yields a
 * report); a failed or empty air-quality call throws so the caller can decide how to fall back.
 */
export async function fetchLiveReport(
  location: CityLocation,
  { timeoutMs = DEFAULT_TIMEOUT_MS, now = Date.now }: FetchOptions = {},
): Promise<AirQualityReport> {
  const [air, weather] = await Promise.all([
    fetchJson<AirResponse>(airQualityUrl(location), timeoutMs),
    fetchJson<WeatherResponse>(weatherUrl(location), timeoutMs).catch(() => null),
  ]);
  const report = mapLiveReport(location, air, weather, now());
  if (!report) {
    throw new Error('Open-Meteo returned no forecast hours for this location');
  }
  return report;
}

/** Looks up cities by name with the Open-Meteo geocoding API. */
export async function geocodeCities(
  query: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOptions = {},
): Promise<CityLocation[]> {
  const url = new URL(OPEN_METEO_ENDPOINTS.geocoding);
  url.search = new URLSearchParams({ name: query, count: '6', language: 'en', format: 'json' }).toString();
  const data = await fetchJson<GeocodingResponse>(url, timeoutMs);
  return (data.results ?? []).map((item) => ({
    name: item.name,
    country: item.country ?? 'Unknown',
    admin1: item.admin1,
    latitude: round(item.latitude, 4),
    longitude: round(item.longitude, 4),
    timezone: item.timezone,
  }));
}
