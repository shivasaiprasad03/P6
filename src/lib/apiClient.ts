import type {
  ActionPlanResponse,
  AirQualityReport,
  ChatResponse,
  ChatTurn,
  CityLocation,
  HouseholdProfile,
  ImpactSimulationResult,
} from '../../shared/types.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;

/** True in the static build, where everything runs in the browser instead of the API server. */
export const IS_STANDALONE = import.meta.env.VITE_STANDALONE === 'true';

const loadBrowserEngine = () => import('./browserEngine.js');

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  const callerSignal = init?.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.message ?? `Request failed (${response.status})`);
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}

export interface HealthStatus {
  status: string;
  aiMode: 'gemini-genai' | 'local-intelligence';
}

/** Fetches backend health status and active AI engine mode. */
export function fetchHealth(): Promise<HealthStatus> {
  if (IS_STANDALONE) {
    return Promise.resolve({ status: 'ok', aiMode: 'local-intelligence' });
  }
  return requestJson<HealthStatus>('/api/health');
}

/** Searches global cities matching `query` via the geocoding endpoint. */
export function searchCitiesApi(
  query: string,
  signal?: AbortSignal,
): Promise<{ cities: CityLocation[] }> {
  if (IS_STANDALONE) {
    return loadBrowserEngine()
      .then((engine) => engine.searchCitiesLocal(query))
      .then((cities) => ({ cities }));
  }
  const params = new URLSearchParams({ q: query });
  return requestJson<{ cities: CityLocation[] }>(`/api/cities/search?${params.toString()}`, {
    signal,
  });
}

/** Fetches live air quality, weather, nearby stations, and 24-hour forecast for `location`. */
export function fetchAirQualityApi(location: CityLocation): Promise<AirQualityReport> {
  if (IS_STANDALONE) {
    return loadBrowserEngine().then((engine) => engine.fetchAirQualityLocal(location));
  }
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    name: location.name,
    country: location.country,
  });
  return requestJson<AirQualityReport>(`/api/air-quality?${params.toString()}`);
}

/** Generates a daily action plan for the given location and household profile. */
export function generateActionPlanApi(params: {
  location: CityLocation;
  profile: HouseholdProfile;
  focusNote?: string;
}): Promise<ActionPlanResponse> {
  if (IS_STANDALONE) {
    return loadBrowserEngine().then((engine) => engine.generateActionPlanLocal(params));
  }
  return requestJson<ActionPlanResponse>('/api/advisor/plan', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** Sends a question and recent turns to the advisor, grounded in live readings and the household profile. */
export function sendAdvisorChatApi(params: {
  location: CityLocation;
  profile: HouseholdProfile;
  message: string;
  history: ChatTurn[];
}): Promise<ChatResponse> {
  if (IS_STANDALONE) {
    return loadBrowserEngine().then((engine) => engine.sendAdvisorChatLocal(params));
  }
  return requestJson<ChatResponse>('/api/advisor/chat', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** Computes household exposure reduction and neighborhood-scale emissions savings. */
export function simulateImpactApi(params: {
  selectedActionIds: string[];
  baselinePm25: number;
  householdSize: number;
  communityHouseholds: number;
}): Promise<ImpactSimulationResult> {
  if (IS_STANDALONE) {
    return loadBrowserEngine().then((engine) => engine.simulateImpactLocal(params));
  }
  return requestJson<ImpactSimulationResult>('/api/impact/simulate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
