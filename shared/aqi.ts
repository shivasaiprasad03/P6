/**
 * Pure air-quality maths: AQI conversion, the cleanest outdoor window, inversion risk
 * and weather labelling. No I/O, so it runs identically on the server and in the browser.
 */
import { AIR_QUALITY_CONSTANTS } from './constants.js';
import type {
  HourlyAirPoint,
  InversionRisk,
  SafeOutdoorWindow,
  WeatherConditions,
} from './types.js';

/** US EPA PM2.5 breakpoints (2024 revision): [C_low, C_high, I_low, I_high]. */
const PM25_AQI_BREAKPOINTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.0, 9.0, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 400],
  [325.5, 500.4, 401, 500],
];

/** Converts a PM2.5 concentration (µg/m³) to the US EPA AQI by linear interpolation. */
export function pm25ToUsAqi(pm25: number): number {
  const c = Math.max(0, Math.floor(pm25 * 10) / 10);
  for (const [cLow, cHigh, iLow, iHigh] of PM25_AQI_BREAKPOINTS) {
    if (c <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (c - cLow) + iLow);
    }
  }
  return 500;
}

/** Berkeley Earth rule of thumb: breathing ~22 µg/m³ of PM2.5 for a day ≈ one cigarette. */
export function pm25ToCigarettesPerDay(pm25: number): number {
  return Number((Math.max(0, pm25) / AIR_QUALITY_CONSTANTS.pm25PerCigaretteUgm3).toFixed(1));
}

/** How many times over the WHO 24-hour PM2.5 guideline a concentration is. */
export function whoGuidelineMultiple(pm25: number): number {
  return Number((Math.max(0, pm25) / AIR_QUALITY_CONSTANTS.whoPm25Guideline24h).toFixed(1));
}

/** Local hour (0–23) of a UTC instant in a place `utcOffsetSeconds` from UTC. */
export function localHour(epochMs: number, utcOffsetSeconds: number): number {
  return new Date(epochMs + utcOffsetSeconds * 1000).getUTCHours();
}

/** Formats a UTC instant as a 12-hour label ("3 PM") in the city's local time. */
export function formatHourLabel(epochMs: number, utcOffsetSeconds: number): string {
  const hour = localHour(epochMs, utcOffsetSeconds);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`;
}

const WINDOW_HOURS = 2;

function windowAdvisory(avgAqi: number, startLabel: string, endLabel: string): string {
  if (avgAqi <= 75) return 'Good window for 20–30 minutes of airing out and outdoor play.';
  if (avgAqi <= 115) {
    return 'A short 10–15 minute airing-out is fine; run filtration again afterwards.';
  }
  if (avgAqi <= 175) {
    return `Keep windows shut. If you must go out, go between ${startLabel} and ${endLabel} with a fitted N95.`;
  }
  return 'Heavy smog all day: keep windows sealed and run indoor filtration continuously.';
}

/**
 * Finds the two consecutive hours with the lowest pollution in the forecast, for errands,
 * outdoor play or airing out the home. PM2.5 is weighted above the overall AQI because it
 * is the pollutant that dominates winter smog.
 */
export function computeSafestOutdoorWindow(hourly: readonly HourlyAirPoint[]): SafeOutdoorWindow {
  const first = hourly[0];
  if (!first) {
    throw new Error('computeSafestOutdoorWindow needs at least one forecast hour');
  }

  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  // Leave room for the hour after the window so its end label always exists.
  const lastStart = Math.max(0, hourly.length - WINDOW_HOURS - 1);
  for (let i = 0; i <= lastStart; i += 1) {
    const slice = hourly.slice(i, i + WINDOW_HOURS);
    const score = slice.reduce((sum, h) => sum + h.pm25 * 1.4 + h.usAqi * 0.6, 0) / slice.length;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const slice = hourly.slice(bestIndex, bestIndex + WINDOW_HOURS);
  const start = slice[0] ?? first;
  const endLabel = (hourly[bestIndex + WINDOW_HOURS] ?? hourly[hourly.length - 1] ?? start).hourLabel;
  const avgAqi = Math.round(slice.reduce((s, h) => s + h.usAqi, 0) / slice.length);
  const avgPm25 = Number((slice.reduce((s, h) => s + h.pm25, 0) / slice.length).toFixed(1));

  return {
    startTime: start.time,
    startLabel: start.hourLabel,
    endLabel,
    avgAqi,
    avgPm25,
    advisory: windowAdvisory(avgAqi, start.hourLabel, endLabel),
    ventilationSafe: avgAqi <= 115,
  };
}

/**
 * Estimates how strongly a winter temperature inversion is trapping pollution, from the
 * current AQI and the gap between the forecast's dirtiest and cleanest hours.
 */
export function assessInversionRisk(
  currentAqi: number,
  hourly: readonly HourlyAirPoint[],
): InversionRisk {
  const peak = hourly.reduce<HourlyAirPoint | undefined>(
    (max, h) => (!max || h.pm25 > max.pm25 ? h : max),
    undefined,
  );
  const trough = hourly.reduce<HourlyAirPoint | undefined>(
    (min, h) => (!min || h.pm25 < min.pm25 ? h : min),
    undefined,
  );
  const peakPm = peak?.pm25 ?? 0;
  const swing = trough && trough.pm25 > 0 ? peakPm / trough.pm25 : 1;
  const peakHours = peak ? `around ${peak.hourLabel}` : 'late evening to mid-morning';

  if (currentAqi >= 200 || peakPm >= 130) {
    return {
      level: 'severe',
      summary:
        'A strong inversion is trapping traffic and heating smoke near the ground, with little wind to clear it.',
      peakHours,
    };
  }
  if (currentAqi >= 130 || (swing >= 1.55 && peakPm >= 55)) {
    return {
      level: 'high',
      summary:
        'Pollution will build up overnight and through the morning commute; the afternoon sun clears some of it.',
      peakHours,
    };
  }
  if (currentAqi >= 75) {
    return {
      level: 'moderate',
      summary: 'Some haze builds up at rush hour. Save exercise and airing out for the midday dip.',
      peakHours,
    };
  }
  return {
    level: 'low',
    summary: 'The air is mixing well and pollution is staying low. A good time to air out the home.',
    peakHours,
  };
}

/** Maps a WMO weather code plus the current AQI and wind to a short condition label. */
export function mapWeatherCondition(
  weatherCode: number | undefined,
  currentAqi: number,
  windSpeedKmh: number,
): Pick<WeatherConditions, 'conditionLabel' | 'conditionIcon'> {
  if (currentAqi >= 151 && windSpeedKmh <= 10) {
    return { conditionLabel: 'Smoky haze', conditionIcon: 'haze' };
  }
  if (weatherCode !== undefined) {
    if (weatherCode >= 51 && weatherCode <= 99) {
      return { conditionLabel: 'Rain', conditionIcon: 'rain' };
    }
    if (weatherCode === 45 || weatherCode === 48) {
      return { conditionLabel: 'Fog', conditionIcon: 'fog' };
    }
    if (weatherCode >= 1 && weatherCode <= 3) {
      return currentAqi >= 101
        ? { conditionLabel: 'Hazy and overcast', conditionIcon: 'haze' }
        : { conditionLabel: 'Partly cloudy', conditionIcon: 'cloudy' };
    }
  }
  return currentAqi >= 101
    ? { conditionLabel: 'Hazy', conditionIcon: 'haze' }
    : { conditionLabel: 'Clear', conditionIcon: 'clear' };
}
