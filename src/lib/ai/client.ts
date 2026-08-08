// =====================================================================
// CareLivia — OpenAI Server Client
//
// SECURITY: This file MUST only ever be imported from:
//   - app/api/**/route.ts  (Route Handlers)
//   - other files under src/lib/ai/** or src/lib/server/**
// It reads OPENAI_API_KEY from process.env, which is only available on
// the server. Never import this file from a "use client" component —
// Next.js will fail the build if the key would leak to the browser
// bundle, but keep the boundary explicit regardless.
// =====================================================================

import "server-only";
import OpenAI from "openai";
import { AI_DEFAULTS } from "./models";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY belum diset. Tambahkan di Environment Variables Vercel atau .env.local.",
    );
  }

  _client = new OpenAI({
    apiKey,
    timeout: AI_DEFAULTS.timeoutMs,
    maxRetries: 0, // we handle retries ourselves in validator.ts (schema-aware retry)
  });

  return _client;
}

export interface AICallOptions {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
  // Per-call override of AI_DEFAULTS.timeoutMs. Heavier features (e.g. the
  // full Clinical Assessment / CDSS, which reasons over every module and
  // returns a large structured payload) need more headroom than the
  // 30s default used by lightweight features, or the request aborts and
  // surfaces as a false "AI unavailable" to the clinician.
  timeoutMs?: number;
}

export interface AICallResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  responseTimeMs: number;
}

/**
 * Single non-streaming chat completion call. Server-side only.
 * Throws on timeout/API error — callers (validator.ts) decide on retry.
 */
export async function callOpenAI(opts: AICallOptions): Promise<AICallResult> {
  const client = getOpenAIClient();
  const start = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? AI_DEFAULTS.timeoutMs);

  try {
    const completion = await client.chat.completions.create(
      {
        model: opts.model,
        temperature: opts.temperature ?? AI_DEFAULTS.temperature,
        // GPT-5.x (and other newer/reasoning-capable) models reject the
        // legacy `max_tokens` param — OpenAI requires `max_completion_tokens`
        // now. Kept as one named field so this only needs updating here.
        max_completion_tokens: opts.maxOutputTokens ?? AI_DEFAULTS.maxOutputTokens,
        response_format: opts.jsonMode ? { type: "json_object" } : undefined,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      },
      { signal: controller.signal },
    );

    const content = completion.choices[0]?.message?.content ?? "";

    return {
      content,
      model: completion.model,
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      responseTimeMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Streaming chat completion — used only by the AI Chat feature.
 * Returns an async iterator of text deltas; caller pipes into a
 * ReadableStream for the Route Handler response.
 */
export async function* streamOpenAI(opts: {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  temperature?: number;
  maxOutputTokens?: number;
}): AsyncGenerator<string, { promptTokens: number; completionTokens: number }, unknown> {
  const client = getOpenAIClient();

  const stream = await client.chat.completions.create({
    model: opts.model,
    temperature: opts.temperature ?? AI_DEFAULTS.temperature,
    // See callOpenAI() above — GPT-5.x rejects the legacy `max_tokens` param.
    max_completion_tokens: opts.maxOutputTokens ?? AI_DEFAULTS.maxOutputTokens,
    stream: true,
    stream_options: { include_usage: true },
    messages: [{ role: "system", content: opts.system }, ...opts.messages],
  });

  let promptTokens = 0;
  let completionTokens = 0;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
    if (chunk.usage) {
      promptTokens = chunk.usage.prompt_tokens ?? 0;
      completionTokens = chunk.usage.completion_tokens ?? 0;
    }
  }

  return { promptTokens, completionTokens };
}

export interface AIVisionCallOptions {
  model: string;
  system: string;
  user: string;
  // Data URLs (data:image/png;base64,... or data:image/jpeg;base64,...).
  // Multiple images = multiple pages of the same lab report, sent as one
  // request so the model can cross-reference (e.g. a header on page 1).
  images: string[];
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Vision-capable chat completion — used only by the Laboratorium OCR
 * upload feature (reads a photo/scan of a lab report and returns raw text
 * content, expected to be JSON per the calling prompt's instructions).
 * Server-side only, same timeout/no-retry contract as callOpenAI().
 */
export async function callOpenAIVision(opts: AIVisionCallOptions): Promise<AICallResult> {
  const client = getOpenAIClient();
  const start = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_DEFAULTS.timeoutMs);

  try {
    const completion = await client.chat.completions.create(
      {
        model: opts.model,
        temperature: opts.temperature ?? AI_DEFAULTS.temperature,
        // See callOpenAI() above — GPT-5.x rejects the legacy `max_tokens` param.
        max_completion_tokens: opts.maxOutputTokens ?? AI_DEFAULTS.maxOutputTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: opts.system },
          {
            role: "user",
            content: [
              { type: "text", text: opts.user },
              ...opts.images.map((url) => ({
                type: "image_url" as const,
                image_url: { url, detail: "high" as const },
              })),
            ],
          },
        ],
      },
      { signal: controller.signal },
    );

    const content = completion.choices[0]?.message?.content ?? "";

    return {
      content,
      model: completion.model,
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      responseTimeMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}
