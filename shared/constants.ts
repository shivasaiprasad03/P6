import type { AqiSeverity, CityLocation, HouseholdProfile } from './types.js';

export interface AqiBandMeta {
  severity: AqiSeverity;
  label: string;
  shortLabel: string;
  range: string;
  min: number;
  max: number;
  guidance: string;
}

export const AQI_BANDS: readonly AqiBandMeta[] = [
  {
    severity: 'good',
    label: 'Good',
    shortLabel: 'Good',
    range: '0–50',
    min: 0,
    max: 50,
    guidance: 'Air quality is satisfactory. Ideal window for cross-ventilation and outdoor play.',
  },
  {
    severity: 'moderate',
    label: 'Moderate',
    shortLabel: 'Moderate',
    range: '51–100',
    min: 51,
    max: 100,
    guidance: 'Acceptable overall; unusually sensitive individuals should pace prolonged outdoor exertion.',
  },
  {
    severity: 'sensitive',
    label: 'Unhealthy for Sensitive Groups',
    shortLabel: 'Sensitive Alert',
    range: '101–150',
    min: 101,
    max: 150,
    guidance: 'Children, elderly, and people with asthma should limit vigorous outdoor activity and filter indoor air.',
  },
  {
    severity: 'unhealthy',
    label: 'Unhealthy',
    shortLabel: 'Unhealthy',
    range: '151–200',
    min: 151,
    max: 200,
    guidance: 'Everyone begins experiencing health effects. Wear N95/KN95 outdoors and keep windows sealed during peak smog.',
  },
  {
    severity: 'very_unhealthy',
    label: 'Very Unhealthy',
    shortLabel: 'Very Unhealthy',
    range: '201–300',
    min: 201,
    max: 300,
    guidance: 'Health alert: winter smog episode. Move exercise indoors, run HEPA/DIY filtration, and cut local emissions.',
  },
  {
    severity: 'hazardous',
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    range: '301+',
    min: 301,
    max: 1000,
    guidance: 'Emergency air conditions. Stay indoors in a clean-air room, seal drafts, and avoid all non-essential vehicle trips.',
  },
] as const;

/** Public-health reference values used by the readings, plans and impact maths. */
export const AIR_QUALITY_CONSTANTS = {
  /** WHO 2021 24-hour mean PM2.5 guideline (µg/m³). */
  whoPm25Guideline24h: 15,
  /** Berkeley Earth rule-of-thumb: ~22 µg/m³ ambient PM2.5 ≈ 1 cigarette/day. */
  pm25PerCigaretteUgm3: 22,
  /** Typical indoor PM2.5 infiltration ratio during winter smog without filtration. */
  indoorInfiltrationFactor: 0.65,
  /** Conservative ceiling on the combined exposure reduction of several actions (%). */
  maxCombinedExposureReductionPct: 85,
  /** Minimum modeled indoor PM2.5 floor (µg/m³). */
  minIndoorPm25Floor: 4,
  /** Average monthly CO₂ absorption of one mature urban tree (kg/month). */
  co2KgPerTreePerMonth: 1.8,
  /** Days per calendar month used for monthly impact projections. */
  daysPerMonth: 30,
} as const;

/** Returns the US EPA AQI band (label, colour key, guidance) for an AQI value. */
export function classifyAqi(usAqi: number): AqiBandMeta {
  const value = Math.max(0, Math.round(usAqi));
  return AQI_BANDS.find((band) => value <= band.max) ?? AQI_BANDS[AQI_BANDS.length - 1]!;
}

/** Quick-pick cities: well-known winter smog hotspots plus a few reference cities. */
export const PRESET_CITIES: readonly CityLocation[] = [
  {
    name: 'New Delhi',
    country: 'India',
    admin1: 'Delhi',
    latitude: 28.6139,
    longitude: 77.209,
    timezone: 'Asia/Kolkata',
  },
  {
    name: 'Lahore',
    country: 'Pakistan',
    admin1: 'Punjab',
    latitude: 31.5204,
    longitude: 74.3587,
    timezone: 'Asia/Karachi',
  },
  {
    name: 'Beijing',
    country: 'China',
    admin1: 'Beijing',
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 'Asia/Shanghai',
  },
  {
    name: 'Salt Lake City',
    country: 'United States',
    admin1: 'Utah',
    latitude: 40.7608,
    longitude: -111.891,
    timezone: 'America/Denver',
  },
  {
    name: 'Krakow',
    country: 'Poland',
    admin1: 'Lesser Poland',
    latitude: 50.0647,
    longitude: 19.945,
    timezone: 'Europe/Warsaw',
  },
  {
    name: 'Mexico City',
    country: 'Mexico',
    admin1: 'CDMX',
    latitude: 19.4326,
    longitude: -99.1332,
    timezone: 'America/Mexico_City',
  },
  {
    name: 'London',
    country: 'United Kingdom',
    admin1: 'England',
    latitude: 51.5072,
    longitude: -0.1276,
    timezone: 'Europe/London',
  },
];

export const DEFAULT_HOUSEHOLD_PROFILE: HouseholdProfile = {
  householdSize: 4,
  vulnerableGroups: ['children', 'elderly'],
  homeType: 'apartment',
  hasHepaPurifier: false,
  cookingFuel: 'gas',
  commuteMode: 'car_petrol_diesel',
  dailyCommuteKm: 24,
  communityRole: 'family',
  budgetTier: 'low_cost',
};

export const SAFETY_DISCLAIMER =
  'BreatheSafe provides educational air-quality and sustainability guidance, not medical diagnosis. Seek immediate medical care for severe shortness of breath, chest tightness, or persistent wheezing.';
