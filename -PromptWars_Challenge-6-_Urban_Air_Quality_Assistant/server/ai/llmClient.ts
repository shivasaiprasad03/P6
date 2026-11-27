/**
 * Provider-agnostic interface for structured JSON generation from an LLM.
 * Decouples business logic from concrete model vendors and enables deterministic testing.
 */
export interface SchemaParser<T> {
  safeParse: (data: unknown) => { success: true; data: T } | { success: false };
}

export interface StructuredJsonRequest<T> {
  systemInstruction: string;
  userPrompt: string;
  schema: SchemaParser<T>;
}

export interface StructuredJsonResult<T> {
  data: T;
  modelUsed: string;
}

export interface StructuredLlmClient {
  generateStructuredJson<T>(
    request: StructuredJsonRequest<T>,
  ): Promise<StructuredJsonResult<T> | null>;
}
