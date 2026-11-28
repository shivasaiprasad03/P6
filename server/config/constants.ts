/** Server operating limits: upstream URLs, timeouts, cache sizes, rate limits and SSE timing. */

/**
 * Fixed HTTPS base for Gemini. Open-Meteo endpoints live in shared/airQuality/openMeteo.ts.
 * No outbound URL is ever built from user input (prevents SSRF).
 */
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Network timeout & retry limits. */
export const NETWORK_LIMITS = {
  upstreamTimeoutMs: 4_500,
  geminiTimeoutMs: 40_000,
  geminiMaxRetries: 1,
  geminiRetryBaseMs: 350,
  jsonBodyLimit: '16kb',
  shutdownGraceMs: 5_000,
} as const;

/** Bounded LRU+TTL cache configurations. */
export const CACHE_CONFIG = {
  airQuality: { maxEntries: 120, ttlMs: 2 * 60 * 1000 },
  citySearch: { maxEntries: 150, ttlMs: 30 * 60 * 1000 },
  aiPlans: { maxEntries: 80, ttlMs: 15 * 60 * 1000 },
} as const;

/** Sliding-window rate limiter defaults. */
export const RATE_LIMIT_DEFAULTS = {
  windowMs: 60_000,
  generalMaxRequests: 90,
  aiMaxRequests: 20,
  maxTrackedClients: 2_000,
} as const;

/** Server-Sent Events cadence & retry constants. */
export const SSE_CONFIG = {
  refreshIntervalMs: 45_000,
  heartbeatIntervalMs: 20_000,
  serverlessRetryMs: 45_000,
  /** Open streams allowed per client IP, and in total, so idle tabs cannot exhaust sockets. */
  maxStreamsPerClient: 4,
  maxStreamsTotal: 500,
} as const;

/** Default allowed development origins when ALLOWED_ORIGINS is not set. */
export const DEFAULT_ALLOWED_ORIGINS =
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001';

/** Safe regex allowlisting Gemini model identifiers (blocks path traversal). */
export const SAFE_GEMINI_MODEL_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/;
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';
