export type AqiSeverity =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

export type VulnerableGroup =
  | 'infants'
  | 'children'
  | 'elderly'
  | 'asthma'
  | 'pregnant'
  | 'outdoor_workers';

export type HomeType = 'apartment' | 'independent_house' | 'shared_housing';

export type CookingFuel = 'gas' | 'induction_electric' | 'biomass_solid';

export type CommuteMode =
  | 'car_petrol_diesel'
  | 'car_ev_hybrid'
  | 'public_transit'
  | 'two_wheeler'
  | 'walk_cycle'
  | 'remote';

export type CommunityRole = 'family' | 'school_pta' | 'neighborhood_rwa';

export type BudgetTier = 'low_cost' | 'moderate' | 'flexible';

export interface HouseholdProfile {
  householdSize: number;
  vulnerableGroups: VulnerableGroup[];
  homeType: HomeType;
  hasHepaPurifier: boolean;
  cookingFuel: CookingFuel;
  commuteMode: CommuteMode;
  dailyCommuteKm: number;
  communityRole: CommunityRole;
  budgetTier: BudgetTier;
}

export interface CityLocation {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface HourlyAirPoint {
  time: string;
  hourLabel: string;
  usAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  ozone: number;
}

export interface SafeOutdoorWindow {
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

export interface NearbyStationReading {
  id: string;
  name: string;
  zoneType: 'residential' | 'traffic' | 'park' | 'industrial' | 'school_zone';
  usAqi: number;
  pm25: number;
  severity: AqiSeverity;
  distanceKm: number;
  /** Relative map coordinates (0..100) for pure-SVG interactive station map */
  mapX: number;
  mapY: number;
}

export interface AirQualityReport {
  location: CityLocation;
  fetchedAt: string;
  source: 'open-meteo-live' | 'cached-live' | 'winter-smog-fallback';
  current: {
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
  };
  weather: WeatherConditions;
  nearbyStations: NearbyStationReading[];
  globalRankEstimate: {
    rank: number;
    percentileNote: string;
  };
  hourlyForecast: HourlyAirPoint[];
  safestWindow: SafeOutdoorWindow;
  inversionRisk: InversionRisk;
}

export type RecommendationCategory =
  | 'low_emission_routine'
  | 'indoor_air_hack'
  | 'sustainable_alternative'
  | 'community_action';

export type ImpactEffort = 'quick_win' | 'daily_habit' | 'lifestyle_shift';

export interface ActionImpact {
  pm25ExposureReductionPct: number;
  weeklyCo2SavedKg: number;
  weeklyPm25AvoidedGrams: number;
  personalHealthExplanation: string;
  communityScaleExplanation: string;
}

export interface ActionRecommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  summary: string;
  steps: string[];
  effort: ImpactEffort;
  estimatedCost: string;
  bestTimeWindow: string;
  impact: ActionImpact;
}

export interface ActionPlanResponse {
  generatedAt: string;
  engine: 'gemini-genai' | 'local-intelligence';
  modelUsed: string;
  cached: boolean;
  headline: string;
  winterSmogBriefing: string;
  urgentAlerts: string[];
  recommendations: ActionRecommendation[];
  communityMessageTemplate: string;
  safetyDisclaimer: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  engine: 'gemini-genai' | 'local-intelligence';
  modelUsed: string;
  keyTakeaways: string[];
  impactHighlight: string;
  safetyDisclaimer: string;
}

export interface PledgeActionItem {
  id: string;
  category: RecommendationCategory;
  title: string;
  description: string;
  pm25ExposureReductionPct: number;
  monthlyCo2SavedKg: number;
  monthlyPm25AvoidedGrams: number;
  monthlyCostDeltaUsd: number;
  whyItWorks: string;
}

export interface ImpactSimulationResult {
  selectedCount: number;
  combinedPm25ExposureReductionPct: number;
  estimatedIndoorPm25After: number;
  avoidedCigarettesPerMonth: number;
  householdMonthlyCo2SavedKg: number;
  householdMonthlyPm25AvoidedGrams: number;
  communityHouseholds: number;
  communityMonthlyCo2SavedKg: number;
  communityMonthlyPm25AvoidedKg: number;
  equivalentTreesPlanted: number;
  estimatedMonthlySavingsUsd: number;
}
