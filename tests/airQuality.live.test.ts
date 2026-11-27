import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESET_CITIES } from '../shared/constants.js';
import {
  airQualityCache,
  citySearchCache,
  getAirQualityReport,
  searchCities,
} from '../server/services/airQualityService.js';

function makeMockOpenMeteoAirPayload() {
  const base = Date.now();
  const times = Array.from({ length: 24 }, (_, idx) => {
    const dt = new Date(base + idx * 60 * 60 * 1000);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
      dt.getDate(),
    ).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}:00`;
  });

  return {
    timezone: 'Asia/Kolkata',
    current: {
      us_aqi: 179,
      pm2_5: 95,
      pm10: 133,
      nitrogen_dioxide: 62,
      ozone: 41,
      carbon_monoxide: 540,
      sulphur_dioxide: 14,
    },
    hourly: {
      time: times,
      us_aqi: times.map((_, i) => (i === 5 || i === 6 ? 110 : 185)),
      pm2_5: times.map((_, i) => (i === 5 || i === 6 ? 39 : 98)),
      pm10: times.map((_, i) => (i === 5 || i === 6 ? 58 : 140)),
      nitrogen_dioxide: times.map(() => 55),
      ozone: times.map(() => 36),
    },
  };
}

describe('AirQualityService Live Open-Meteo Paths & Fallbacks', () => {
  const prevOffline = process.env.OFFLINE_MODE;

  beforeEach(() => {
    process.env.OFFLINE_MODE = 'false';
    airQualityCache.clear();
    citySearchCache.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevOffline === undefined) delete process.env.OFFLINE_MODE;
    else process.env.OFFLINE_MODE = prevOffline;
  });

  it('fetches live AQ + weather, transitions to cached-live on repeat, and computes WHO parity', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('air-quality-api.open-meteo.com')) {
        return new Response(JSON.stringify(makeMockOpenMeteoAirPayload()), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          current: {
            temperature_2m: 21,
            relative_humidity_2m: 44,
            wind_speed_10m: 4,
            weather_code: 45,
          },
          hourly: { uv_index: Array.from({ length: 24 }, () => 1) },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getAirQualityReport(PRESET_CITIES[0]!);
    expect(first.source).toBe('open-meteo-live');
    expect(first.current.usAqi).toBe(179);
    expect(first.weather.temperatureC).toBe(21);
    expect(first.weather.windSpeedKmh).toBe(4);
    expect(first.current.whoPm25Multiple).toBe(6.3);

    const second = await getAirQualityReport(PRESET_CITIES[0]!);
    expect(second.source).toBe('cached-live');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('degrades gracefully when weather API fails or AQ API returns HTTP 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('air-quality-api.open-meteo.com')) {
          return new Response(JSON.stringify(makeMockOpenMeteoAirPayload()), { status: 200 });
        }
        return new Response('Upstream error', { status: 500 });
      }),
    );

    const partial = await getAirQualityReport(PRESET_CITIES[1]!);
    expect(partial.source).toBe('open-meteo-live');
    expect(partial.weather.humidityPct).toBeGreaterThan(0);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Unavailable', { status: 503 })),
    );

    const fallback = await getAirQualityReport(PRESET_CITIES[2]!);
    expect(fallback.source).toBe('winter-smog-fallback');
    expect(fallback.hourlyForecast.length).toBe(24);
  });

  it('fetches live geocoding results and falls back to preset matches on upstream error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                name: 'Mumbai',
                country: 'India',
                admin1: 'Maharashtra',
                latitude: 19.076,
                longitude: 72.8777,
                timezone: 'Asia/Kolkata',
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const liveCities = await searchCities('Mumbai');
    expect(liveCities[0]?.name).toBe('Mumbai');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network down');
      }),
    );
    const fallbackCities = await searchCities('London');
    expect(fallbackCities.some((c) => c.name === 'London')).toBe(true);
  });
});
