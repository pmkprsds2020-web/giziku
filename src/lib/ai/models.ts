// =====================================================================
// CareLivia — AI Model Configuration
// Single source of truth for which OpenAI model powers each feature.
// Change models here without touching any route/prompt code.
//
// NOTE (updated): OpenAI retired the GPT-4o / GPT-4.1 family from the API
// around February 2026 in favor of the GPT-5.x line. Defaults below were
// updated to GPT-5.4 accordingly — GPT-5.4 remains multimodal (accepts
// image input) so no code changes were needed, only the model strings.
// If OpenAI ships a newer default-worthy snapshot later, only this file
// needs to change.
// =====================================================================

export const AI_MODELS = {
  // Structured JSON generation (meal plan reasoning, nutrition analysis,
  // exercise plan, shopping planner, alternative food, food record, SOAP,
  // patient summary, nutrigenomic interpretation). Needs strong
  // instruction following + JSON mode.
  reasoning: process.env.OPENAI_MODEL_REASONING || "gpt-5.4",

  // Conversational chat (AI Chat feature) — streaming, lower latency.
  chat: process.env.OPENAI_MODEL_CHAT || "gpt-5.4-mini",

  // Lightweight classification / quick lookups (e.g. food matching).
  fast: process.env.OPENAI_MODEL_FAST || "gpt-5.4-mini",

  // Vision / OCR (Upload Laboratorium, Upload Nutrigenomic — reading lab
  // report photos/PDF page renders). Needs strong document/handwriting
  // reading + JSON mode. GPT-5.4 family is multimodal like GPT-4o was.
  vision: process.env.OPENAI_MODEL_VISION || "gpt-5.4-mini",
} as const;

export type AIFeature = keyof typeof AI_MODELS;

// Per-feature generation defaults.
export const AI_DEFAULTS = {
  temperature: 0.4,
  maxOutputTokens: 3000,
  timeoutMs: 30_000,
  maxRetries: 2,
} as const;

// Approximate USD price per 1K tokens, used only for cost estimation in
// logs/dashboards. Update when OpenAI pricing changes. Not billed from here.
// Source: OpenAI API pricing page, GPT-5.4 family verified ~2026-03.
export const AI_PRICING_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-5.5": { input: 0.005, output: 0.03 },
  "gpt-5.4": { input: 0.0025, output: 0.015 },
  "gpt-5.4-mini": { input: 0.00075, output: 0.0045 },
  "gpt-5.4-nano": { input: 0.0002, output: 0.00125 },
  // Legacy — retired from the API (~Feb 2026), kept only so old log rows
  // with these model names still resolve to a cost estimate instead of $0.
  "gpt-4.1": { input: 0.002, output: 0.008 },
  "gpt-4.1-mini": { input: 0.0004, output: 0.0016 },
  "gpt-4.1-nano": { input: 0.0001, output: 0.0004 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
};

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const price = AI_PRICING_PER_1K[model];
  if (!price) return 0;
  return (promptTokens / 1000) * price.input + (completionTokens / 1000) * price.output;
}
