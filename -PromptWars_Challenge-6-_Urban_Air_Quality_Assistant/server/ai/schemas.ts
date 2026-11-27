/**
 * Strict runtime schemas validating all structured JSON outputs returned by LLM providers
 * before any AI-generated payload is cached or served to clients.
 */
export {
  aiChatPayloadSchema,
  aiPlanPayloadSchema,
  aiRecommendationSchema,
} from '../../shared/schemas.js';
