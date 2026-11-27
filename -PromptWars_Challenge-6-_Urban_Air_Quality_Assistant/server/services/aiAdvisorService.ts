import crypto from 'node:crypto';
import { SAFETY_DISCLAIMER } from '../../shared/constants.js';
import type {
  ActionPlanResponse,
  AirQualityReport,
  ChatResponse,
  ChatTurn,
  HouseholdProfile,
} from '../../shared/types.js';
import { defaultGeminiClient } from '../ai/geminiClient.js';
import type { StructuredLlmClient } from '../ai/llmClient.js';
import { buildLocalChatResponse } from '../ai/localChatEngine.js';
import { buildLocalActionPlan } from '../ai/localPlanEngine.js';
import { detectPromptInjection } from '../ai/promptGuard.js';
import { buildActionPlanPrompt, buildAdvisorChatPrompt } from '../ai/prompts.js';
import { aiChatPayloadSchema, aiPlanPayloadSchema } from '../ai/schemas.js';
import { CACHE_CONFIG } from '../config/constants.js';
import { TtlLruCache } from './cacheService.js';

export { buildLocalActionPlan, buildLocalChatResponse, detectPromptInjection };

/** Bounded LRU+TTL cache keyed by rounded coordinates, AQI band, and household profile hash. */
export const aiPlanCache = new TtlLruCache<ActionPlanResponse>(
  CACHE_CONFIG.aiPlans.maxEntries,
  CACHE_CONFIG.aiPlans.ttlMs,
);

function buildPlanCacheKey(
  report: AirQualityReport,
  profile: HouseholdProfile,
  focusNote?: string,
): string {
  const hash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        lat: report.location.latitude.toFixed(1),
        lon: report.location.longitude.toFixed(1),
        aqiBand: report.current.severity,
        pm25Bucket: Math.round(report.current.pm25 / 15),
        profile,
        focusNote: focusNote?.toLowerCase() ?? '',
      }),
    )
    .digest('hex')
    .slice(0, 16);
  return `plan:${hash}`;
}

/**
 * Generates a personalized winter-smog action plan via the configured structured LLM client,
 * with automatic caching and seamless fallback to the deterministic domain engine.
 */
export async function generatePersonalizedActionPlan(
  params: {
    report: AirQualityReport;
    profile: HouseholdProfile;
    focusNote?: string;
  },
  llmClient: StructuredLlmClient = defaultGeminiClient,
): Promise<ActionPlanResponse> {
  const safeFocusNote =
    params.focusNote && !detectPromptInjection(params.focusNote)
      ? params.focusNote
      : undefined;

  const cacheKey = buildPlanCacheKey(params.report, params.profile, safeFocusNote);

  const { value, hit } = await aiPlanCache.getOrLoad(cacheKey, async () => {
    const prompt = buildActionPlanPrompt({
      report: params.report,
      profile: params.profile,
      safeFocusNote,
    });

    const aiResult = await llmClient.generateStructuredJson({
      ...prompt,
      schema: aiPlanPayloadSchema,
    });

    if (aiResult) {
      return {
        generatedAt: new Date().toISOString(),
        engine: 'gemini-genai',
        modelUsed: aiResult.modelUsed,
        cached: false,
        ...aiResult.data,
        safetyDisclaimer: SAFETY_DISCLAIMER,
      };
    }

    return buildLocalActionPlan(params.report, params.profile, safeFocusNote);
  });

  return hit ? { ...value, cached: true } : value;
}

/**
 * Answers a context-grounded air quality question via the configured structured LLM client,
 * applying prompt-injection screening and deterministic fallback on unavailability.
 */
export async function answerAirQualityQuestion(
  params: {
    report: AirQualityReport;
    profile: HouseholdProfile;
    message: string;
    history: ChatTurn[];
  },
  llmClient: StructuredLlmClient = defaultGeminiClient,
): Promise<ChatResponse> {
  if (detectPromptInjection(params.message)) {
    return buildLocalChatResponse(params.report, params.profile, params.message);
  }

  const prompt = buildAdvisorChatPrompt(params);
  const aiResult = await llmClient.generateStructuredJson({
    ...prompt,
    schema: aiChatPayloadSchema,
  });

  if (aiResult) {
    return {
      ...aiResult.data,
      engine: 'gemini-genai',
      modelUsed: aiResult.modelUsed,
      safetyDisclaimer: SAFETY_DISCLAIMER,
    };
  }

  return buildLocalChatResponse(params.report, params.profile, params.message);
}
