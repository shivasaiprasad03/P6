/**
 * The app's back end, run inside the browser for the static build (no API server).
 * Calls Open-Meteo directly and uses the shared rule-based advisor. Gemini is never used
 * here, because an API key must not be shipped to the browser.
 */
import { buildRulesChatResponse } from '../../shared/advisor/chatEngine.js';
import { buildRulesPlan } from '../../shared/advisor/planEngine.js';
import { detectPromptInjection } from '../../shared/advisor/promptGuard.js';
import { fetchLiveReport, geocodeCities } from '../../shared/airQuality/openMeteo.js';
import { buildSampleReport } from '../../shared/airQuality/sampleReport.js';
import { PRESET_CITIES } from '../../shared/constants.js';
import type {
  ActionPlanResponse,
  AirQualityReport,
  ChatResponse,
  CityLocation,
  HouseholdProfile,
} from '../../shared/types.js';

export async function searchCitiesLocal(query: string): Promise<CityLocation[]> {
  try {
    return await geocodeCities(query);
  } catch {
    const q = query.toLowerCase();
    return PRESET_CITIES.filter((c) => c.name.toLowerCase().includes(q));
  }
}

export async function fetchAirQualityLocal(location: CityLocation): Promise<AirQualityReport> {
  try {
    return await fetchLiveReport(location);
  } catch {
    return buildSampleReport(location);
  }
}

export async function generateActionPlanLocal(params: {
  location: CityLocation;
  profile: HouseholdProfile;
  focusNote?: string;
}): Promise<ActionPlanResponse> {
  const report = await fetchAirQualityLocal(params.location);
  const note = params.focusNote && !detectPromptInjection(params.focusNote) ? params.focusNote : undefined;
  return buildRulesPlan(report, params.profile, note);
}

export async function sendAdvisorChatLocal(params: {
  location: CityLocation;
  profile: HouseholdProfile;
  message: string;
}): Promise<ChatResponse> {
  const report = await fetchAirQualityLocal(params.location);
  return buildRulesChatResponse(report, params.profile, params.message);
}
