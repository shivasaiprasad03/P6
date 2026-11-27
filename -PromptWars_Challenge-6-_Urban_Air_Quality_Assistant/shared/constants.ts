import type {
  AqiSeverity,
  CityLocation,
  HouseholdProfile,
  PledgeActionItem,
} from './types.js';

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

/** Scientific & public-health reference constants used across UI and backend math. */
export const AIR_QUALITY_CONSTANTS = {
  /** WHO 2021 24-hour mean PM2.5 guideline (µg/m³). */
  whoPm25Guideline24h: 15,
  /** Berkeley Earth rule-of-thumb: ~22 µg/m³ ambient PM2.5 ≈ 1 cigarette/day. */
  pm25PerCigaretteUgm3: 22,
  /** Typical indoor PM2.5 infiltration ratio during winter smog without filtration. */
  indoorInfiltrationFactor: 0.65,
  /** Conservative ceiling on combined multiplicative exposure reduction (%). */
  maxCombinedExposureReductionPct: 88,
  /** Per-action cap on single-habit fractional exposure reduction. */
  maxSingleActionReductionFraction: 0.75,
  /** Minimum modeled indoor PM2.5 floor (µg/m³). */
  minIndoorPm25Floor: 4,
  /** Average monthly CO₂ absorption of one mature urban tree (kg/month). */
  co2KgPerTreePerMonth: 1.8,
  /** Days per calendar month used for monthly impact projections. */
  daysPerMonth: 30,
} as const;

/**
 * Classifies a numeric US EPA AQI score into its corresponding severity band and guidance metadata.
 */
export function classifyAqi(usAqi: number): AqiBandMeta {
  const clamped = Math.max(0, Math.round(usAqi));
  for (const band of AQI_BANDS) {
    if (clamped >= band.min && clamped <= band.max) {
      return band;
    }
  }
  return AQI_BANDS[AQI_BANDS.length - 1]!;
}

/**
 * Curated urban winter-smog hotspots & global reference cities for instant testing and demos.
 */
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

/**
 * Evidence-based catalog of high-impact household and community actions
 * used by the interactive Impact Simulator.
 * PM2.5 inhalation reductions follow multiplicative independent abatement
 * (capped conservatively so numbers remain scientifically grounded).
 */
export const PLEDGE_ACTIONS: readonly PledgeActionItem[] = [
  {
    id: 'corsi-rosenthal-diy',
    category: 'indoor_air_hack',
    title: 'Build a DIY Corsi-Rosenthal MERV-13 Air Filter',
    description:
      'Tape four MERV-13 furnace filters to a box fan to achieve HEPA-class bedroom particle removal at ~1/4 the cost.',
    pm25ExposureReductionPct: 48,
    monthlyCo2SavedKg: 4,
    monthlyPm25AvoidedGrams: 1.5,
    monthlyCostDeltaUsd: 8,
    whyItWorks:
      'Peer-reviewed indoor air studies show MERV-13 cube filters deliver 400–600 CFM clean air delivery rate (CADR), cutting indoor PM2.5 by 45–65% within 30 minutes.',
  },
  {
    id: 'smart-ventilation-window',
    category: 'indoor_air_hack',
    title: 'Shift Ventilation & School Runs to Mid-Afternoon Window',
    description:
      'Seal doors/windows during morning & night thermal inversions; cross-ventilate only during the lowest-PM2.5 2-hour afternoon window.',
    pm25ExposureReductionPct: 24,
    monthlyCo2SavedKg: 6,
    monthlyPm25AvoidedGrams: 1.2,
    monthlyCostDeltaUsd: 0,
    whyItWorks:
      'Winter temperature inversions trap exhaust near ground level from dusk to 10 AM; afternoon solar mixing often drops ambient PM2.5 by 25–40%.',
  },
  {
    id: 'wet-mop-draft-seal',
    category: 'indoor_air_hack',
    title: 'Wet-Mop Floors + Silicone Door Draft Stoppers',
    description:
      'Replace dry sweeping with damp microfiber mopping and seal perimeter gaps with low-cost weatherstripping.',
    pm25ExposureReductionPct: 18,
    monthlyCo2SavedKg: 12,
    monthlyPm25AvoidedGrams: 2.0,
    monthlyCostDeltaUsd: -5,
    whyItWorks:
      'Dry brooms resuspend settled PM10/PM2.5 dust back into breathing zones, while door gaps account for up to 35% of outdoor smog infiltration.',
  },
  {
    id: 'transit-carpool-swap',
    category: 'low_emission_routine',
    title: 'Replace 3 Solo Car Commutes/Week with Transit or Carpool',
    description:
      'Coordinate a 3-family school/office carpool or metro/bus commute on high-AQI weekdays.',
    pm25ExposureReductionPct: 10,
    monthlyCo2SavedKg: 58,
    monthlyPm25AvoidedGrams: 14.5,
    monthlyCostDeltaUsd: -45,
    whyItWorks:
      'Cutting cold-start urban driving eliminates tailpipe NO₂, black carbon, and brake/tire particulate wear right inside residential corridors.',
  },
  {
    id: 'induction-kitchen-vent',
    category: 'sustainable_alternative',
    title: 'Electric Kettle/Induction + Covered Pan Cooking',
    description:
      'Shift boiling and simmering to electric/induction appliances and run exhaust hoods during high-heat cooking.',
    pm25ExposureReductionPct: 22,
    monthlyCo2SavedKg: 24,
    monthlyPm25AvoidedGrams: 5.8,
    monthlyCostDeltaUsd: -6,
    whyItWorks:
      'Unvented gas burners spike indoor NO₂ above WHO limits and frying generates ultrafine PM2.5 particles trapped inside closed winter homes.',
  },
  {
    id: 'zero-burn-anti-idling',
    category: 'community_action',
    title: 'Neighborhood Anti-Idling & Zero Waste-Burning Pact',
    description:
      'Switch off engines at school gates/signals (>30s) and organize warm blankets/electric heaters for guards to prevent winter bonfire smoke.',
    pm25ExposureReductionPct: 14,
    monthlyCo2SavedKg: 35,
    monthlyPm25AvoidedGrams: 28.0,
    monthlyCostDeltaUsd: -12,
    whyItWorks:
      'Open biomass/trash burning and idling queues release concentrated localized PM2.5 plumes that dominate hyperlocal winter smog spikes.',
  },
  {
    id: 'n95-commute-shield',
    category: 'low_emission_routine',
    title: 'Fit-Checked N95/KF94 Masks for Outdoor Errands',
    description:
      'Keep well-fitted N95/KN95/KF94 respirators by the entry door whenever AQI crosses 150.',
    pm25ExposureReductionPct: 35,
    monthlyCo2SavedKg: 0,
    monthlyPm25AvoidedGrams: 0.5,
    monthlyCostDeltaUsd: 10,
    whyItWorks:
      'Unlike cloth or surgical masks, electrostatically charged N95/KF94 media filters ≥94% of fine PM2.5 particles during outdoor transit.',
  },
  {
    id: 'low-voc-no-incense',
    category: 'sustainable_alternative',
    title: 'Eliminate Incense, Scented Candles & Aerosol Sprays',
    description:
      'Switch to fragrance-free soap, vinegar/baking-soda cleaners, and LED lamps during winter smog months.',
    pm25ExposureReductionPct: 16,
    monthlyCo2SavedKg: 8,
    monthlyPm25AvoidedGrams: 4.2,
    monthlyCostDeltaUsd: -8,
    whyItWorks:
      'A single incense stick or paraffin candle in a sealed room can raise indoor PM2.5 by 50–120 µg/m³ and emit volatile organic compounds (VOCs).',
  },
];

export const SAFETY_DISCLAIMER =
  'BreatheSafe provides educational air-quality and sustainability guidance, not medical diagnosis. Seek immediate medical care for severe shortness of breath, chest tightness, or persistent wheezing.';
