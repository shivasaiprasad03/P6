import { z } from 'zod';
import {
  DEFAULT_ALLOWED_ORIGINS,
  DEFAULT_GEMINI_MODEL,
  SAFE_GEMINI_MODEL_PATTERN,
} from './constants.js';

const rawEnvSchema = z.object({
  PORT: z.string().optional(),
  NODE_ENV: z.string().optional(),
  VITEST: z.string().optional(),
  VERCEL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  OFFLINE_MODE: z.string().optional(),
});

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  isTest: boolean;
  isVercel: boolean;
  offlineMode: boolean;
  geminiApiKey: string | undefined;
  geminiModel: string;
  geminiEnabled: boolean;
  allowedOrigins: string[];
}

function parsePort(rawPort: string | undefined): number {
  const num = Number(rawPort ?? 3001);
  return Number.isInteger(num) && num > 0 && num < 65_536 ? num : 3001;
}

function parseOrigins(env: z.infer<typeof rawEnvSchema>): string[] {
  const origins = (env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const vercelHost of [
    env.VERCEL_URL,
    env.VERCEL_BRANCH_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (vercelHost) {
      origins.push(`https://${vercelHost.replace(/^https?:\/\//, '')}`);
    }
  }

  return Array.from(new Set(origins));
}

/**
 * Reads and validates runtime server configuration from environment variables.
 * Evaluates dynamically so test suites can safely override env flags per test.
 */
export function getServerConfig(source: NodeJS.ProcessEnv = process.env): ServerConfig {
  const env = rawEnvSchema.parse(source);
  const nodeEnv = env.NODE_ENV ?? 'development';
  const offlineMode = env.OFFLINE_MODE === 'true';
  const geminiApiKey = env.GEMINI_API_KEY?.trim() || undefined;
  const rawModel = (env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL).trim();
  const geminiModel = SAFE_GEMINI_MODEL_PATTERN.test(rawModel) ? rawModel : DEFAULT_GEMINI_MODEL;

  return {
    port: parsePort(env.PORT),
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test' || env.VITEST === 'true',
    isVercel: env.VERCEL === '1',
    offlineMode,
    geminiApiKey,
    geminiModel,
    geminiEnabled: Boolean(geminiApiKey && !offlineMode),
    allowedOrigins: parseOrigins(env),
  };
}
