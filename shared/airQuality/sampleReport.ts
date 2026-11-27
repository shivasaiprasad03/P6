/**
 * Typical-winter sample report, used only when Open-Meteo cannot be reached (or in
 * OFFLINE_MODE for demos and tests). The UI labels it clearly as sample data. It invents
 * no weather or monitoring stations: only a plausible PM2.5 curve for the city.
 */
import {
  assessInversionRisk,
  computeSafestOutdoorWindow,
  formatHourLabel,
  localHour,
  pm25ToCigarettesPerDay,
  pm25ToUsAqi,
  whoGuidelineMultiple,
} from '../aqi.js';
import { classifyAqi } from '../constants.js';
import type { AirQualityReport, CityLocation, HourlyAirPoint } from '../types.js';

interface Baseline {
  pm25: number;
  no2: number;
  ozone: number;
}

/** Rough winter-average levels for well-known smog hotspots. */
const CITY_BASELINES: ReadonlyArray<{ keywords: readonly string[]; baseline: Baseline }> = [
  { keywords: ['delhi', 'noida', 'gurgaon', 'gurugram'], baseline: { pm25: 112, no2: 74, ozone: 48 } },
  { keywords: ['lahore', 'karachi'], baseline: { pm25: 165, no2: 68, ozone: 42 } },
  { keywords: ['beijing', 'xian'], baseline: { pm25: 96, no2: 58, ozone: 44 } },
  { keywords: ['krakow', 'warsaw'], baseline: { pm25: 84, no2: 46, ozone: 32 } },
  { keywords: ['salt lake', 'mexico'], baseline: { pm25: 74, no2: 52, ozone: 54 } },
  { keywords: ['london', 'paris'], baseline: { pm25: 24, no2: 34, ozone: 45 } },
];
const DEFAULT_BASELINE: Baseline = { pm25: 68, no2: 42, ozone: 36 };

/** PM2.5 multiplier by local hour: trapped overnight and in the morning, cleanest at 2–4 PM. */
const WINTER_DIURNAL_CURVE: readonly number[] = [
  1.18, 1.22, 1.24, 1.2, 1.15, 1.12, 1.18, 1.26, 1.22, 1.08, 0.94, 0.82,
  0.72, 0.66, 0.64, 0.68, 0.78, 0.92, 1.06, 1.16, 1.22, 1.25, 1.23, 1.2,
];

const HOUR_MS = 3_600_000;

function baselineFor(cityName: string): Baseline {
  const name = cityName.toLowerCase();
  return CITY_BASELINES.find((e) => e.keywords.some((k) => name.includes(k)))?.baseline ?? DEFAULT_BASELINE;
}

/** Without a network we do not know the exact time zone, so approximate it from longitude. */
function approximateUtcOffsetSeconds(longitude: number): number {
  return Math.round(longitude / 15) * 3600;
}

export function buildSampleReport(location: CityLocation, nowMs: number = Date.now()): AirQualityReport {
  const baseline = baselineFor(location.name);
  const offset = approximateUtcOffsetSeconds(location.longitude);
  const startMs = Math.floor(nowMs / HOUR_MS) * HOUR_MS;

  const hourlyForecast: HourlyAirPoint[] = Array.from({ length: 24 }, (_, i) => {
    const epochMs = startMs + i * HOUR_MS;
    const mult = WINTER_DIURNAL_CURVE[localHour(epochMs, offset)] ?? 1;
    const pm25 = Number((baseline.pm25 * mult).toFixed(1));
    return {
      time: new Date(epochMs).toISOString(),
      hourLabel: formatHourLabel(epochMs, offset),
      usAqi: pm25ToUsAqi(pm25),
      pm25,
      pm10: Number((pm25 * 1.42).toFixed(1)),
      no2: Number((baseline.no2 * mult).toFixed(1)),
      ozone: Number((baseline.ozone * (1.4 - mult * 0.4)).toFixed(1)),
    };
  });

  const now = hourlyForecast[0]!;
  const band = classifyAqi(now.usAqi);
  const mult = WINTER_DIURNAL_CURVE[localHour(nowMs, offset)] ?? 1;

  return {
    location,
    fetchedAt: new Date(nowMs).toISOString(),
    source: 'sample',
    current: {
      usAqi: now.usAqi,
      pm25: now.pm25,
      pm10: now.pm10,
      no2: now.no2,
      ozone: now.ozone,
      co: Math.round(620 * mult),
      so2: Number((16 * mult).toFixed(1)),
      severity: band.severity,
      label: band.label,
      cigaretteEquivalentPerDay: pm25ToCigarettesPerDay(now.pm25),
      whoPm25Multiple: whoGuidelineMultiple(now.pm25),
    },
    weather: null,
    hourlyForecast,
    safestWindow: computeSafestOutdoorWindow(hourlyForecast),
    inversionRisk: assessInversionRisk(now.usAqi, hourlyForecast),
  };
}
