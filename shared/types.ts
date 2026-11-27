import type { z } from 'zod';
import type { ActionId } from './actions.js';
import type {
  budgetTierSchema,
  chatTurnSchema,
  cityLocationSchema,
  communityRoleSchema,
  commuteModeSchema,
  cookingFuelSchema,
  homeTypeSchema,
  householdProfileSchema,
  vulnerableGroupSchema,
} from './schemas.js';

// ── Inputs (derived from the Zod schemas so the two can never drift) ────────

export type VulnerableGroup = z.infer<typeof vulnerableGroupSchema>;
export type HomeType = z.infer<typeof homeTypeSchema>;
export type CookingFuel = z.infer<typeof cookingFuelSchema>;
export type CommuteMode = z.infer<typeof commuteModeSchema>;
export type CommunityRole = z.infer<typeof communityRoleSchema>;
export type BudgetTier = z.infer<typeof budgetTierSchema>;
export type HouseholdProfile = z.infer<typeof householdProfileSchema>;
export type CityLocation = z.infer<typeof cityLocationSchema>;
export type ChatTurn = z.infer<typeof chatTurnSchema>;

// ── Air quality ─────────────────────────────────────────────────────────────

export type AqiSeverity =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

export interface HourlyAirPoint {
  /** UTC instant, ISO-8601. */
  time: string;
  /** Hour in the city's local time, e.g. "3 PM". */
  hourLabel: string;
  usAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  ozone: number;
}

export interface SafeOutdoorWindow {
  /** UTC instant of the first hour in the window. */
  startTime: string;
  startLabel: string;
  endLabel: string;
  avgAqi: number;
  avgPm25: number;
  advisory: string;
  ventilationSafe: boolean;
}

export interface InversionRisk {
  level: 'low' | 'moderate' | 'high' | 'severe';
  summary: string;
  peakHours: string;
}

export interface WeatherConditions {
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  uvIndex: number;
  conditionLabel: string;
  conditionIcon: 'haze' | 'fog' | 'cloudy' | 'clear' | 'rain';
}

export interface CurrentAirQuality {
  usAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  ozone: number;
  co: number;
  so2: number;
  severity: AqiSeverity;
  label: string;
  cigaretteEquivalentPerDay: number;
  whoPm25Multiple: number;
}

export interface AirQualityReport {
  location: CityLocation;
  fetchedAt: string;
  /** `sample` means Open-Meteo was unreachable and the values are typical, not measured. */
  source: 'live' | 'cached' | 'sample';
  current: CurrentAirQuality;
  /** Null when the weather service could not be reached. */
  weather: WeatherConditions | null;
  hourlyForecast: HourlyAirPoint[];
  safestWindow: SafeOutdoorWindow;
  inversionRisk: InversionRisk;
}

// ── Actions & impact ────────────────────────────────────────────────────────

export type RecommendationCategory =
  | 'low_emission_routine'
  | 'indoor_air_hack'
  | 'sustainable_alternative'
  | 'community_action';

export type ImpactEffort = 'quick_win' | 'daily_habit' | 'lifestyle_shift';

/** One habit or swap, with the reference figures every impact number is derived from. */
export interface ActionDefinition {
  id: ActionId;
  category: RecommendationCategory;
  title: string;
  description: string;
  whyItWorks: string;
  /** Share of the household's indoor PM2.5 dose removed by this action alone. */
  exposureReductionPct: number;
  monthlyCo2SavedKg: number;
  monthlyPm25AvoidedGrams: number;
  /** Positive = costs money each month, negative = saves money. */
  monthlyCostDeltaUsd: number;
  /** Commute actions scale with distance and do nothing for people who already travel cleanly. */
  scalesWithCommute?: boolean;
}

/** Figures for one action after tailoring to a household. */
export interface ActionFigures {
  exposureReductionPct: number;
  monthlyCo2SavedKg: number;
  monthlyPm25AvoidedGrams: number;
}

export interface ActionRecommendation {
  actionId: ActionId;
  category: RecommendationCategory;
  title: string;
  summary: string;
  steps: string[];
  effort: ImpactEffort;
  estimatedCost: string;
  bestTimeWindow: string;
  figures: ActionFigures;
  personalImpact: string;
  communityImpact: string;
}

export type AdvisorEngine = 'gemini' | 'rules';

export interface ActionPlanResponse {
  generatedAt: string;
  engine: AdvisorEngine;
  modelUsed: string;
  cached: boolean;
  headline: string;
  briefing: string;
  alerts: string[];
  recommendations: ActionRecommendation[];
  communityMessage: string;
  safetyDisclaimer: string;
}

export interface ChatResponse {
  reply: string;
  engine: AdvisorEngine;
  modelUsed: string;
  keyTakeaways: string[];
  impactHighlight: string;
  safetyDisclaimer: string;
}

export interface ImpactSimulationRequest {
  selectedActionIds: ActionId[];
  baselinePm25: number;
  profile: HouseholdProfile;
  communityHouseholds: number;
}

export interface ImpactSimulationResult {
  selectedCount: number;
  combinedExposureReductionPct: number;
  indoorPm25Before: number;
  indoorPm25After: number;
  avoidedCigarettesPerMonth: number;
  householdMonthlyCo2SavedKg: number;
  householdMonthlyPm25AvoidedGrams: number;
  communityHouseholds: number;
  communityMonthlyCo2SavedKg: number;
  communityMonthlyPm25AvoidedKg: number;
  equivalentTrees: number;
  monthlySavingsUsd: number;
}
