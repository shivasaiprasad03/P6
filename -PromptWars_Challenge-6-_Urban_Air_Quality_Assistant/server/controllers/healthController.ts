import type { Request, Response } from 'express';
import { getServerConfig } from '../config/env.js';
import { aiPlanCache } from '../services/aiAdvisorService.js';
import { airQualityCache, citySearchCache } from '../services/airQualityService.js';

/**
 * Handles `GET /api/health`, returning service readiness, active AI engine mode,
 * and bounded cache telemetry without exposing any credentials.
 */
export function getHealth(_req: Request, res: Response): void {
  const config = getServerConfig();
  res.json({
    status: 'ok',
    service: 'breathesafe',
    timestamp: new Date().toISOString(),
    aiMode: config.geminiEnabled ? 'gemini-genai' : 'local-intelligence',
    caches: {
      airQuality: airQualityCache.stats(),
      citySearch: citySearchCache.stats(),
      aiPlans: aiPlanCache.stats(),
    },
  });
}
