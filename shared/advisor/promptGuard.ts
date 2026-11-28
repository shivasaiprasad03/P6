/**
 * Prompt-injection defense utilities: detects role/instruction override patterns
 * and neutralizes XML/HTML tag delimiters in untrusted user and external fields.
 */
const INJECTION_PATTERNS: readonly RegExp[] = [
  /(ignore|disregard|forget|override|bypass)\s+(all\s+|any\s+|the\s+|your\s+)*(previous|prior|above|earlier|preceding|system)\s+(instructions?|prompts?|rules|directions)/i,
  /disregard\s+(the\s+)?system\s+prompt/i,
  /(reveal|print|show|repeat|output|leak)\s+(me\s+)?(your\s+|the\s+)?(system\s+prompt|hidden\s+instructions|api[_\s-]?key|secrets?)/i,
  /you\s+are\s+now\s+(dan|jailbreak|unrestricted|in\s+developer\s+mode)/i,
  /\b(developer|god|jailbreak)\s+mode\b/i,
  /new\s+(system\s+)?instructions?\s*:/i,
  /<\s*\/?\s*(system|assistant|developer|user_question|user_focus_note|recent_history)\s*>/i,
];

/** Zero-width and bidi control characters that can split keywords to dodge pattern checks. */
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/**
 * Folds look-alike characters (full-width letters, ligatures) to their plain forms and
 * removes invisible characters, so full-width or zero-width-split "ignore" is still matched.
 */
export function normalizeForInspection(text: string): string {
  return text.normalize('NFKC').replace(INVISIBLE_CHARS, '').replace(/\s+/g, ' ');
}

/**
 * Returns true if untrusted text matches known prompt-injection or instruction-override patterns.
 */
export function detectPromptInjection(text: string): boolean {
  const normalized = normalizeForInspection(text);
  return INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Escapes angle brackets so untrusted text cannot close prompt sandbox XML tags.
 */
export function escapePromptTagContent(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
}

/**
 * Sanitizes external or user-provided metadata fields (e.g., city/country names)
 * before embedding them into structured LLM context.
 */
export function sanitizePromptContextField(text: string, fallback = 'Urban Area'): string {
  const escaped = escapePromptTagContent(text);
  if (!escaped || detectPromptInjection(text)) {
    return fallback;
  }
  return escaped;
}

/**
 * Drops conversation turns that look like injection attempts. Chat history is sent by the
 * browser, so a forged "assistant" turn is just as untrusted as the current question.
 */
export function filterSafeHistory<T extends { content: string }>(history: readonly T[]): T[] {
  return history.filter((turn) => !detectPromptInjection(turn.content));
}
