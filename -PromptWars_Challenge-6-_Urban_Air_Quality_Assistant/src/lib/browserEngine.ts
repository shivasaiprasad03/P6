/**
 * Runs the same domain logic as the Express API directly in the browser.
 * Used by the static build (Firebase Hosting), where no Node server is available:
 * Open-Meteo is called straight from the page and plans/answers come from the
 * deterministic local engines.
 */
import type {
  ActionPlanResponse,
  AirQualityReport,
  ChatResponse,
  CityLocation,
  HouseholdProfile,
  ImpactSimulationResult,
} from '../../shared/types.js';
import { buildLocalChatResponse } from '../../server/ai/localChatEngine.js';
import { buildLocalActionPlan } from '../../server/ai/localPlanEngine.js';
import { detectPromptInjection } from '../../server/ai/promptGuard.js';
import { getAirQualityReport, searchCities } from '../../server/services/airQualityService.js';
import { simulatePledgeImpact } from '../../server/services/impactCalculator.js';

export function searchCitiesLocal(query: string): Promise<CityLocation[]> {
  return searchCities(query);
}

export function fetchAirQualityLocal(location: CityLocation): Promise<AirQualityReport> {
  return getAirQualityReport(location);
}

export async function generateActionPlanLocal(params: {
  location: CityLocation;
  profile: HouseholdProfile;
  focusNote?: string;
}): Promise<ActionPlanResponse> {
  const report = await getAirQualityReport(params.location);
  const note =
    params.focusNote && !detectPromptInjection(params.focusNote) ? params.focusNote : undefined;
  return buildLocalActionPlan(report, params.profile, note);
}

export async function sendAdvisorChatLocal(params: {
  location: CityLocation;
  profile: HouseholdProfile;
  message: string;
}): Promise<ChatResponse> {
  const report = await getAirQualityReport(params.location);
  return buildLocalChatResponse(report, params.profile, params.message);
}

export function simulateImpactLocal(params: {
  selectedActionIds: string[];
  baselinePm25: number;
  householdSize: number;
  communityHouseholds: number;
}): ImpactSimulationResult {
  return simulatePledgeImpact(params);
}
