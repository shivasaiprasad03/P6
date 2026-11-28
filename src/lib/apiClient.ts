/**
 * Data access for the UI. Talks to the Express API, or, in the static build
 * (`VITE_STANDALONE=true`), to the in-browser engine, which is loaded lazily so the
 * server build never ships it.
 */
import type {
  ActionPlanResponse,
  AirQualityReport,
  ChatResponse,
  ChatTurn,
  CityLocation,
  HouseholdProfile,
} from '../../shared/types.js';

/** Longer than the server's Gemini timeout, so a slow plan is not cut off by the browser. */
const REQUEST_TIMEOUT_MS = 60_000;

export const IS_STANDALONE = import.meta.env.VITE_STANDALONE === 'true';

const browserEngine = () => import('./browserEngine.js');

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  init.signal?.addEventListener('abort', abortFromCaller, { once: true });
  if (init.signal?.aborted) controller.abort();

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) {
      throw new Error(payload.message ?? `Request failed (${response.status})`);
    }
    return payload as T;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abortFromCaller);
  }
}

function locationQuery(location: CityLocation): string {
  return new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    name: location.name,
    country: location.country,
  }).toString();
}

export function airQualityStreamUrl(location: CityLocation): string {
  return `/api/air-quality/stream?${locationQuery(location)}`;
}

export async function searchCitiesApi(query: string, signal?: AbortSignal): Promise<CityLocation[]> {
  if (IS_STANDALONE) return (await browserEngine()).searchCitiesLocal(query);
  const params = new URLSearchParams({ q: query });
  const data = await requestJson<{ cities: CityLocation[] }>(`/api/cities/search?${params}`, { signal });
  return data.cities;
}

export async function fetchAirQualityApi(location: CityLocation): Promise<AirQualityReport> {
  if (IS_STANDALONE) return (await browserEngine()).fetchAirQualityLocal(location);
  return requestJson<AirQualityReport>(`/api/air-quality?${locationQuery(location)}`);
}

export async function generateActionPlanApi(params: {
  location: CityLocation;
  profile: HouseholdProfile;
  focusNote?: string;
}): Promise<ActionPlanResponse> {
  if (IS_STANDALONE) return (await browserEngine()).generateActionPlanLocal(params);
  return requestJson<ActionPlanResponse>('/api/advisor/plan', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function sendAdvisorChatApi(params: {
  location: CityLocation;
  profile: HouseholdProfile;
  message: string;
  history: ChatTurn[];
}): Promise<ChatResponse> {
  if (IS_STANDALONE) return (await browserEngine()).sendAdvisorChatLocal(params);
  return requestJson<ChatResponse>('/api/advisor/chat', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
