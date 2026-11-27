/**
 * Prompt-injection defense utilities: detects role/instruction override patterns
 * and neutralizes XML/HTML tag delimiters in untrusted user and external fields.
 */
const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(the\s+)?system\s+prompt/i,
  /reveal\s+(your\s+)?(system\s+prompt|api[_\s-]?key|secret)/i,
  /you\s+are\s+now\s+(dan|jailbreak|unrestricted)/i,
  /<\s*\/?\s*(system|assistant|developer)\s*>/i,
];

/**
 * Returns true if untrusted text matches known prompt-injection or instruction-override patterns.
 */
export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
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
  if (!escaped || detectPromptInjection(escaped)) {
    return fallback;
  }
  return escaped;
}
