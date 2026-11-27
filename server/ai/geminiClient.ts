import { GEMINI_API_BASE, NETWORK_LIMITS } from '../config/constants.js';
import { getServerConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type {
  StructuredJsonRequest,
  StructuredJsonResult,
  StructuredLlmClient,
} from './llmClient.js';

const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503, 504]);

interface GeminiApiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export interface GeminiClientOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJsonPayload(rawText: string): unknown {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as unknown;
}

/**
 * Google Gemini REST implementation of `StructuredLlmClient`.
 * Enforces strict timeout, bounded retry with backoff on transient 429/5xx failures,
 * server-side API key header auth, and Zod schema verification before returning data.
 */
export class GeminiStructuredClient implements StructuredLlmClient {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  constructor(options: GeminiClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? NETWORK_LIMITS.geminiTimeoutMs;
    this.maxRetries = options.maxRetries ?? NETWORK_LIMITS.geminiMaxRetries;
    this.retryBaseMs = options.retryBaseMs ?? NETWORK_LIMITS.geminiRetryBaseMs;
  }

  async generateStructuredJson<T>(
    request: StructuredJsonRequest<T>,
  ): Promise<StructuredJsonResult<T> | null> {
    const config = getServerConfig();
    if (!config.geminiEnabled || !config.geminiApiKey) {
      return null;
    }

    const endpoint = `${GEMINI_API_BASE}/${config.geminiModel}:generateContent`;
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: request.systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
      generationConfig: {
        temperature: 0.35,
        // Gemini 2.5 counts thinking tokens against this limit; leave room so JSON is not truncated.
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    const rawText = await this.fetchWithBoundedRetry(endpoint, config.geminiApiKey, body);
    if (!rawText) {
      return null;
    }

    return this.parseAndValidate(rawText, request.schema, config.geminiModel);
  }

  private async fetchWithBoundedRetry(
    endpoint: string,
    apiKey: string,
    body: string,
  ): Promise<string | null> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const result = await this.executeSingleAttempt(endpoint, apiKey, body);
      if (result.kind === 'ok') {
        return result.text;
      }
      if (!result.retryable || attempt >= this.maxRetries) {
        return null;
      }
      await sleep(this.retryBaseMs * (attempt + 1));
    }
    return null;
  }

  private async executeSingleAttempt(
    endpoint: string,
    apiKey: string,
    body: string,
  ): Promise<{ kind: 'ok'; text: string } | { kind: 'fail'; retryable: boolean }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: controller.signal,
        body,
      });

      if (!response.ok) {
        logger.warn('Gemini API returned non-OK status', { status: response.status });
        return { kind: 'fail', retryable: RETRYABLE_HTTP_STATUSES.has(response.status) };
      }

      const payload = (await response.json()) as GeminiApiResponse;
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? { kind: 'ok', text } : { kind: 'fail', retryable: false };
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      logger.warn('Gemini request error; evaluating fallback', {
        reason: err instanceof Error ? err.message : 'unknown_error',
        timedOut: isAbort,
      });
      return { kind: 'fail', retryable: !isAbort };
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseAndValidate<T>(
    rawText: string,
    schema: StructuredJsonRequest<T>['schema'],
    modelUsed: string,
  ): StructuredJsonResult<T> | null {
    try {
      const parsed = extractJsonPayload(rawText);
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        logger.warn('Gemini JSON failed schema validation; using fallback engine', { modelUsed });
        return null;
      }
      return { data: validated.data, modelUsed };
    } catch (err) {
      logger.warn('Gemini returned malformed JSON; using fallback engine', {
        modelUsed,
        reason: err instanceof Error ? err.message : 'parse_error',
      });
      return null;
    }
  }
}

export const defaultGeminiClient = new GeminiStructuredClient();
