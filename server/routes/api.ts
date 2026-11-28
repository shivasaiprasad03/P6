import { Router } from 'express';
import { RATE_LIMIT_DEFAULTS } from '../config/constants.js';
import { advisorChatHandler, generatePlanHandler } from '../controllers/advisorController.js';
import {
  getAirQualityHandler,
  getPresetCities,
  searchCitiesHandler,
  streamAirQualityHandler,
} from '../controllers/airQualityController.js';
import { getHealth } from '../controllers/healthController.js';
import { simulateImpactHandler } from '../controllers/impactController.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

export interface ApiRouterOptions {
  aiRateLimitMax?: number;
  generalRateLimitMax?: number;
}

/**
 * Creates the declarative Express API router wiring per-tier rate limiters
 * to controller handlers across health, air quality, GenAI advisor, and impact endpoints.
 */
export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  const generalLimiter = createRateLimiter({
    windowMs: RATE_LIMIT_DEFAULTS.windowMs,
    maxRequests: options.generalRateLimitMax ?? RATE_LIMIT_DEFAULTS.generalMaxRequests,
  });

  const aiLimiter = createRateLimiter({
    windowMs: RATE_LIMIT_DEFAULTS.windowMs,
    maxRequests: options.aiRateLimitMax ?? RATE_LIMIT_DEFAULTS.aiMaxRequests,
    message:
      'AI advisor rate limit reached. Please wait a few seconds before sending another request.',
  });

  router.get('/health', generalLimiter, getHealth);
  router.get('/cities/presets', generalLimiter, getPresetCities);
  router.get('/cities/search', generalLimiter, searchCitiesHandler);
  router.get('/air-quality', generalLimiter, getAirQualityHandler);
  router.get('/air-quality/stream', generalLimiter, streamAirQualityHandler);
  router.post('/advisor/plan', aiLimiter, generatePlanHandler);
  router.post('/advisor/chat', aiLimiter, advisorChatHandler);
  router.post('/impact/simulate', generalLimiter, simulateImpactHandler);

  return router;
}
