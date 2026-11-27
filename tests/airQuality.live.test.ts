import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapLiveReport } from '../shared/airQuality/openMeteo.js';
import { PRESET_CITIES } from '../shared/constants.js';
import {
  airQualityCache,
  citySearchCache,
  getAirQualityReport,
  searchCities,
} from '../server/services/airQualityService.js';

const HOUR_S = 3600;
const IST_OFFSET_S = 19_800; // UTC+5:30

/** Open-Meteo air-quality payload in `timeformat=unixtime`, starting 3 hours in the past. */
function airPayload(nowMs: number) {
  const firstHour = Math.floor(nowMs / 1000 / HOUR_S) * HOUR_S - 3 * HOUR_S;
  const time = Array.from({ length: 30 }, (_, i) => firstHour + i * HOUR_S);
  const clean = (i: number) => i === 8 || i === 9;
  return {
    timezone: 'Asia/Kolkata',
    utc_offset_seconds: IST_OFFSET_S,
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
      time,
      us_aqi: time.map((_, i) => (clean(i) ? 110 : 185)),
      pm2_5: time.map((_, i) => (clean(i) ? 39 : 98)),
      pm10: time.map((_, i) => (clean(i) ? 58 : 140)),
      nitrogen_dioxide: time.map(() => 55),
      ozone: time.map(() => 36),
    },
  };
}

const weatherPayload = {
  current: { temperature_2m: 21, relative_humidity_2m: 44, wind_speed_10m: 4, weather_code: 45 },
  hourly: { time: [Math.floor(Date.now() / 1000)], uv_index: [1] },
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('Open-Meteo mapping', () => {
  it('starts the forecast at the current hour and labels it in the city’s time zone', () => {
    const nowMs = Date.UTC(2026, 10, 24, 6, 20); // 11:50 AM in New Delhi
    const report = mapLiveReport(PRESET_CITIES[0]!, airPayload(nowMs), weatherPayload, nowMs)!;

    expect(report.hourlyForecast).toHaveLength(24);
    expect(report.hourlyForecast[0]?.time).toBe('2026-11-24T06:00:00.000Z');
    expect(report.hourlyForecast[0]?.hourLabel).toBe('11 AM');
    // Payload indices 8–9 are the clean hours; the forecast starts at index 3.
    expect(report.safestWindow.startTime).toBe(report.hourlyForecast[5]?.time);
    expect(report.safestWindow.avgPm25).toBe(39);
  });

  it('returns null weather instead of invented values when the weather call fails', () => {
    const nowMs = Date.now();
    const report = mapLiveReport(PRESET_CITIES[0]!, airPayload(nowMs), null, nowMs)!;
    expect(report.weather).toBeNull();
    expect(report.source).toBe('live');
  });
});

describe('Air quality service', () => {
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

  it('serves live readings, then cached readings without another network call', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      input.toString().includes('air-quality-api') ? json(airPayload(Date.now())) : json(weatherPayload),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await getAirQualityReport(PRESET_CITIES[0]!);
    expect(first.source).toBe('live');
    expect(first.current.usAqi).toBe(179);
    expect(first.weather?.temperatureC).toBe(21);
    expect(first.current.whoPm25Multiple).toBe(6.3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('timeformat=unixtime');

    const second = await getAirQualityReport(PRESET_CITIES[0]!);
    expect(second.source).toBe('cached');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps live air quality when only weather fails, and falls back to sample data when air quality fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        input.toString().includes('air-quality-api') ? json(airPayload(Date.now())) : json({}, 500),
      ),
    );
    const partial = await getAirQualityReport(PRESET_CITIES[1]!);
    expect(partial.source).toBe('live');
    expect(partial.weather).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => json({}, 503)));
    const sample = await getAirQualityReport(PRESET_CITIES[2]!);
    expect(sample.source).toBe('sample');
    expect(sample.hourlyForecast).toHaveLength(24);
  });

  it('geocodes cities and falls back to preset matches when the network is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          results: [
            { name: 'Mumbai', country: 'India', admin1: 'Maharashtra', latitude: 19.076, longitude: 72.8777, timezone: 'Asia/Kolkata' },
          ],
        }),
      ),
    );
    expect((await searchCities('Mumbai'))[0]?.name).toBe('Mumbai');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network down');
      }),
    );
    expect((await searchCities('London')).some((c) => c.name === 'London')).toBe(true);
  });
});
