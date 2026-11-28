/**
 * Orchestrates plan and chat generation: Gemini first (when configured), the rule-based
 * engine otherwise. Gemini output is schema-validated, and its recommendations get their
 * impact figures from the action catalog, so the model can never change the numbers.
 */
import crypto from 'node:crypto';
import type { z } from 'zod';
import { ACTION_CATALOG, resolveActionFigures } from '../../shared/actions.js';
import { buildRulesChatResponse } from '../../shared/advisor/chatEngine.js';
import { buildRulesPlan } from '../../shared/advisor/planEngine.js';
import { detectPromptInjection, filterSafeHistory } from '../../shared/advisor/promptGuard.js';
import { SAFETY_DISCLAIMER } from '../../shared/constants.js';
import { aiChatPayloadSchema, aiPlanPayloadSchema } from '../../shared/schemas.js';
import type {
  ActionPlanResponse,
  ActionRecommendation,
  AirQualityReport,
  ChatResponse,
  ChatTurn,
  HouseholdProfile,
} from '../../shared/types.js';
import { defaultGeminiClient } from '../ai/geminiClient.js';
import type { StructuredLlmClient } from '../ai/llmClient.js';
import { buildActionPlanPrompt, buildAdvisorChatPrompt } from '../ai/prompts.js';
import { CACHE_CONFIG } from '../config/constants.js';
import { TtlLruCache } from './cacheService.js';

type AiPlan = z.infer<typeof aiPlanPayloadSchema>;

export const aiPlanCache = new TtlLruCache<ActionPlanResponse>(
  CACHE_CONFIG.aiPlans.maxEntries,
  CACHE_CONFIG.aiPlans.ttlMs,
);

/** Plans are reused for nearby requests with the same household, AQI band and note. */
function planCacheKey(report: AirQualityReport, profile: HouseholdProfile, focusNote?: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        lat: report.location.latitude.toFixed(1),
        lon: report.location.longitude.toFixed(1),
        band: report.current.severity,
        pm25Bucket: Math.round(report.current.pm25 / 15),
        window: report.safestWindow.startTime,
        profile,
        focusNote: focusNote?.toLowerCase() ?? '',
      }),
    )
    .digest('hex')
    .slice(0, 16);
  return `plan:${digest}`;
}

/** Attaches catalog figures and categories to Gemini's recommendations, dropping duplicates. */
export function withCatalogFigures(
  recommendations: AiPlan['recommendations'],
  profile: HouseholdProfile,
): ActionRecommendation[] {
  const seen = new Set<string>();
  return recommendations.flatMap((rec) => {
    if (seen.has(rec.actionId)) return [];
    seen.add(rec.actionId);
    return [
      {
        ...rec,
        category: ACTION_CATALOG[rec.actionId].category,
        figures: resolveActionFigures(rec.actionId, profile),
      },
    ];
  });
}

function safeNote(note: string | undefined): string | undefined {
  return note && !detectPromptInjection(note) ? note : undefined;
}

export async function generatePersonalizedActionPlan(
  params: { report: AirQualityReport; profile: HouseholdProfile; focusNote?: string },
  llm: StructuredLlmClient = defaultGeminiClient,
): Promise<ActionPlanResponse> {
  const { report, profile } = params;
  const focusNote = safeNote(params.focusNote);

  const { value, hit } = await aiPlanCache.getOrLoad(planCacheKey(report, profile, focusNote), async () => {
    const ai = await llm.generateStructuredJson({
      ...buildActionPlanPrompt({ report, profile, focusNote }),
      schema: aiPlanPayloadSchema,
    });
    if (!ai) return buildRulesPlan(report, profile, focusNote);

    return {
      generatedAt: new Date().toISOString(),
      engine: 'gemini',
      modelUsed: ai.modelUsed,
      cached: false,
      headline: ai.data.headline,
      briefing: ai.data.briefing,
      alerts: ai.data.alerts,
      recommendations: withCatalogFigures(ai.data.recommendations, profile),
      communityMessage: ai.data.communityMessage,
      safetyDisclaimer: SAFETY_DISCLAIMER,
    } satisfies ActionPlanResponse;
  });

  return hit ? { ...value, cached: true } : value;
}

export async function answerAirQualityQuestion(
  params: { report: AirQualityReport; profile: HouseholdProfile; message: string; history: ChatTurn[] },
  llm: StructuredLlmClient = defaultGeminiClient,
): Promise<ChatResponse> {
  const { report, profile, message } = params;
  // Suspected injection never reaches the model; the rules engine politely declines.
  if (detectPromptInjection(message)) return buildRulesChatResponse(report, profile, message);

  // History comes from the browser too, so forged turns carrying injections are dropped.
  const history = filterSafeHistory(params.history);
  const ai = await llm.generateStructuredJson({
    ...buildAdvisorChatPrompt({ ...params, history }),
    schema: aiChatPayloadSchema,
  });
  if (!ai) return buildRulesChatResponse(report, profile, message);

  return { ...ai.data, engine: 'gemini', modelUsed: ai.modelUsed, safetyDisclaimer: SAFETY_DISCLAIMER };
}
