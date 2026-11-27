import { classifyAqi } from '../../../shared/constants.js';
import type {
  AirQualityReport,
  CityLocation,
  HourlyAirPoint,
  NearbyStationReading,
  WeatherConditions,
} from '../../../shared/types.js';
import { pm25ToCigaretteEquivalentPerDay } from '../impactCalculator.js';
import {
  assessInversionRisk,
  computeSafestOutdoorWindow,
  estimateGlobalRank,
  formatHourLabel,
  mapWeatherCondition,
  pm25ToUsAqi,
} from './aqiAnalytics.js';

interface BaselineProfile {
  pm25: number;
  no2: number;
  ozone: number;
}

const CITY_BASELINE_MAP: ReadonlyArray<{ keywords: readonly string[]; baseline: BaselineProfile }> = [
  { keywords: ['delhi', 'noida', 'gurgaon'], baseline: { pm25: 112, no2: 74, ozone: 48 } },
  { keywords: ['lahore', 'karachi'], baseline: { pm25: 165, no2: 68, ozone: 42 } },
  { keywords: ['beijing', 'xian'], baseline: { pm25: 96, no2: 58, ozone: 44 } },
  { keywords: ['krakow', 'warsaw'], baseline: { pm25: 84, no2: 46, ozone: 32 } },
  { keywords: ['salt lake', 'mexico'], baseline: { pm25: 74, no2: 52, ozone: 54 } },
  { keywords: ['london', 'paris'], baseline: { pm25: 24, no2: 34, ozone: 45 } },
];

// Diurnal winter-smog curve: elevated overnight/morning inversion, dispersion dip 2–4 PM
const DIURNAL_SMOG_CURVE: readonly number[] = [
  1.18, 1.22, 1.24, 1.2, 1.15, 1.12, 1.18, 1.26, 1.22, 1.08, 0.94, 0.82,
  0.72, 0.66, 0.64, 0.68, 0.78, 0.92, 1.06, 1.16, 1.22, 1.25, 1.23, 1.2,
];

interface StationTemplate {
  id: string;
  labelSuffix?: string;
  name?: string;
  zoneType: NearbyStationReading['zoneType'];
  factor: number;
  distanceKm: number;
  mapX: number;
  mapY: number;
}

const STATION_TEMPLATES: readonly StationTemplate[] = [
  { id: 'central', labelSuffix: 'Central', zoneType: 'residential', factor: 1.0, distanceKm: 0.6, mapX: 52, mapY: 50 },
  { id: 'highway', name: 'Ring Road Arterial', zoneType: 'traffic', factor: 1.24, distanceKm: 2.4, mapX: 74, mapY: 32 },
  { id: 'industrial', name: 'East Industrial Belt', zoneType: 'industrial', factor: 1.32, distanceKm: 4.8, mapX: 84, mapY: 58 },
  { id: 'school', name: 'North School Corridor', zoneType: 'school_zone', factor: 1.08, distanceKm: 1.9, mapX: 38, mapY: 24 },
  { id: 'park', name: 'Green Botanical Park', zoneType: 'park', factor: 0.74, distanceKm: 3.1, mapX: 22, mapY: 66 },
  { id: 'west-res', name: 'West Residential Sector', zoneType: 'residential', factor: 0.92, distanceKm: 2.8, mapX: 24, mapY: 36 },
  { id: 'south-hub', name: 'South Transit Hub', zoneType: 'traffic', factor: 1.15, distanceKm: 3.5, mapX: 58, mapY: 78 },
  { id: 'riverfront', name: 'Waterfront Greenway', zoneType: 'park', factor: 0.81, distanceKm: 4.2, mapX: 72, mapY: 82 },
];

/**
 * Generates hyperlocal neighborhood station readings anchored to the city's live PM2.5,
 * modeling micro-environment variance across parks, school zones, traffic corridors, and industrial belts.
 */
export function buildNearbyStations(
  cityName: string,
  basePm25: number,
): NearbyStationReading[] {
  const seed = Array.from(cityName).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  return STATION_TEMPLATES.map((tpl, idx) => {
    const jitter = (((seed + idx * 17) % 9) - 4) * 0.015;
    const pm25 = Number(Math.max(4, basePm25 * (tpl.factor + jitter)).toFixed(1));
    const usAqi = Math.min(500, Math.round(pm25ToUsAqi(pm25)));
    const band = classifyAqi(usAqi);

    return {
      id: tpl.id,
      name: tpl.name ?? `${cityName} ${tpl.labelSuffix ?? 'Center'}`,
      zoneType: tpl.zoneType,
      usAqi,
      pm25,
      severity: band.severity,
      distanceKm: tpl.distanceKm,
      mapX: tpl.mapX,
      mapY: tpl.mapY,
    };
  });
}

/**
 * Generates deterministic winter weather conditions anchored to city climate and AQI.
 */
export function buildFallbackWeather(
  location: CityLocation,
  currentAqi: number,
): WeatherConditions {
  const key = location.name.toLowerCase();
  const temp =
    key.includes('krakow') || key.includes('beijing') || key.includes('salt lake')
      ? 5
      : key.includes('london')
        ? 9
        : key.includes('mexico')
          ? 17
          : 21;
  const humidity = currentAqi >= 150 ? 48 : 56;
  const wind = currentAqi >= 180 ? 4 : currentAqi >= 120 ? 7 : 14;
  const hour = new Date().getHours();
  const uv = hour >= 10 && hour <= 15 ? 3 : 0;
  const { conditionLabel, conditionIcon } = mapWeatherCondition(undefined, currentAqi, wind);

  return {
    temperatureC: temp,
    humidityPct: humidity,
    windSpeedKmh: wind,
    uvIndex: uv,
    conditionLabel,
    conditionIcon,
  };
}

function resolveBaselineProfile(cityName: string): BaselineProfile {
  const lower = cityName.toLowerCase();
  const matched = CITY_BASELINE_MAP.find((entry) =>
    entry.keywords.some((kw) => lower.includes(kw)),
  );
  return matched?.baseline ?? { pm25: 68, no2: 42, ozone: 36 };
}

/**
 * Deterministic winter-smog fallback report used in offline mode, CI tests,
 * or when upstream Open-Meteo endpoints are temporarily unavailable.
 */
export function buildFallbackAirQualityReport(location: CityLocation): AirQualityReport {
  const baseline = resolveBaselineProfile(location.name);
  const now = new Date();
  const currentHour = now.getHours();
  const hourlyForecast: HourlyAirPoint[] = [];

  for (let offset = 0; offset < 24; offset += 1) {
    const dt = new Date(now.getTime() + offset * 60 * 60 * 1000);
    const hr = dt.getHours();
    const mult = DIURNAL_SMOG_CURVE[hr] ?? 1;
    const pm25 = Number((baseline.pm25 * mult).toFixed(1));
    const pm10 = Number((pm25 * 1.42).toFixed(1));
    const usAqi = Math.min(480, Math.round(pm25ToUsAqi(pm25)));
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
      dt.getDate(),
    ).padStart(2, '0')}T${String(hr).padStart(2, '0')}:00`;

    hourlyForecast.push({
      time: iso,
      hourLabel: formatHourLabel(iso),
      usAqi,
      pm25,
      pm10,
      no2: Number((baseline.no2 * mult).toFixed(1)),
      ozone: Number((baseline.ozone * (1.4 - mult * 0.4)).toFixed(1)),
    });
  }

  const currentPoint = hourlyForecast[0] ?? {
    time: now.toISOString(),
    hourLabel: 'Now',
    usAqi: pm25ToUsAqi(baseline.pm25),
    pm25: baseline.pm25,
    pm10: Number((baseline.pm25 * 1.42).toFixed(1)),
    no2: baseline.no2,
    ozone: baseline.ozone,
  };
  const band = classifyAqi(currentPoint.usAqi);
  const currentMult = DIURNAL_SMOG_CURVE[currentHour] ?? 1;
  const weather = buildFallbackWeather(location, currentPoint.usAqi);

  return {
    location,
    fetchedAt: now.toISOString(),
    source: 'winter-smog-fallback',
    current: {
      usAqi: currentPoint.usAqi,
      pm25: currentPoint.pm25,
      pm10: currentPoint.pm10,
      no2: currentPoint.no2,
      ozone: currentPoint.ozone,
      co: Math.round(620 * currentMult),
      so2: Number((16 * currentMult).toFixed(1)),
      severity: band.severity,
      label: band.label,
      cigaretteEquivalentPerDay: pm25ToCigaretteEquivalentPerDay(currentPoint.pm25),
      whoPm25Multiple: Number((currentPoint.pm25 / 15).toFixed(1)),
    },
    weather,
    nearbyStations: buildNearbyStations(location.name, currentPoint.pm25),
    globalRankEstimate: estimateGlobalRank(
      location.name,
      currentPoint.usAqi,
      weather.windSpeedKmh,
    ),
    hourlyForecast,
    safestWindow: computeSafestOutdoorWindow(hourlyForecast),
    inversionRisk: assessInversionRisk(currentPoint.usAqi, hourlyForecast),
  };
}
