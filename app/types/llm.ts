export const LLM_TYPES = [
  "DEFAULT",
  "SIMPLE",
  "OPENAI",
  "GEMINI",
  "MOCK",
  "PERPLEXITY",
] as const;
export type LlmType = (typeof LLM_TYPES)[number];
export const DEFAULT_LLM_TYPE: LlmType = "DEFAULT";
export const isValidLlmType = (value: unknown): value is LlmType =>
  LLM_TYPES.some((type) => type === value);
