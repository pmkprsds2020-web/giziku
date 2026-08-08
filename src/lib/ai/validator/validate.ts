// =====================================================================
// CareLivia — Schema-Validated AI Generation
//
// Wraps callOpenAI() with:
//   1. JSON extraction (parser/json-parser.ts)
//   2. Zod schema validation
//   3. Automatic regeneration (up to AI_DEFAULTS.maxRetries) if the
//      output is malformed or fails schema validation, feeding the
//      validation error back to the model so it can self-correct.
// =====================================================================

import "server-only";
import { z } from "zod";
import { callOpenAI } from "../client";
import { extractJson, AIJsonParseError } from "../parser/json-parser";
import { AI_DEFAULTS } from "../models";

export interface GenerateStructuredOptions<T> {
  model: string;
  system: string;
  user: string;
  schema: z.ZodSchema<T>;
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface GenerateStructuredResult<T> {
  data: T;
  model: string;
  promptTokens: number;
  completionTokens: number;
  responseTimeMs: number;
  attempts: number;
}

// Default message is intentionally informative rather than a bare "AI
// unavailable" — it tells the clinician what likely went wrong so they know
// whether to just retry or to escalate (e.g. to an admin about the API key).
const DEFAULT_AI_UNAVAILABLE_MESSAGE =
  "Tidak dapat terhubung ke AI Engine.\n\nPenyebab yang mungkin:\n- API Key belum dikonfigurasi di server\n- AI Provider timeout atau sedang sibuk\n- Koneksi internet server terputus\n\nSilakan coba kembali beberapa saat lagi.";

export class AIUnavailableError extends Error {
  /** Best-effort classification of what actually failed, for logging/telemetry. */
  cause_hint?: "config" | "timeout" | "network" | "validation" | "unknown";

  constructor(message = DEFAULT_AI_UNAVAILABLE_MESSAGE, cause_hint: AIUnavailableError["cause_hint"] = "unknown") {
    super(message);
    this.name = "AIUnavailableError";
    this.cause_hint = cause_hint;
  }
}

/** Turns a raw callOpenAI() failure into a clearer, classified message. */
function classifyAIFailure(raw: string): { message: string; hint: AIUnavailableError["cause_hint"] } {
  const lower = raw.toLowerCase();
  if (lower.includes("api key") || lower.includes("apikey") || lower.includes("belum diset")) {
    return {
      message:
        "Tidak dapat terhubung ke AI Engine.\n\nPenyebab: API Key AI belum dikonfigurasi di server.\n\nSilakan hubungi administrator untuk mengatur OPENAI_API_KEY, lalu coba kembali.",
      hint: "config",
    };
  }
  if (lower.includes("abort") || lower.includes("timeout") || lower.includes("timed out")) {
    return {
      message:
        "Tidak dapat terhubung ke AI Engine.\n\nPenyebab: AI Provider tidak merespons dalam waktu yang wajar (timeout).\n\nData pasien Anda tetap aman. Silakan coba kembali beberapa saat lagi.",
      hint: "timeout",
    };
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("busy") || lower.includes("overloaded")) {
    return {
      message:
        "Tidak dapat terhubung ke AI Engine.\n\nPenyebab: Server AI sedang sibuk (rate limit tercapai).\n\nSilakan coba kembali dalam beberapa menit.",
      hint: "network",
    };
  }
  if (lower.includes("network") || lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econnrefused")) {
    return {
      message:
        "Tidak dapat terhubung ke AI Engine.\n\nPenyebab: Tidak ada koneksi internet dari server ke AI Provider.\n\nSilakan coba kembali beberapa saat lagi.",
      hint: "network",
    };
  }
  return { message: DEFAULT_AI_UNAVAILABLE_MESSAGE, hint: "unknown" };
}

export async function generateStructured<T>(
  opts: GenerateStructuredOptions<T>,
): Promise<GenerateStructuredResult<T>> {
  const maxRetries = opts.maxRetries ?? AI_DEFAULTS.maxRetries;
  let lastError: string | null = null;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalResponseTimeMs = 0;
  let usedModel = opts.model;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const userPrompt =
      attempt === 0
        ? opts.user
        : `${opts.user}\n\n---\nPERCOBAAN SEBELUMNYA GAGAL VALIDASI:\n${lastError}\nPerbaiki dan kembalikan HANYA JSON valid sesuai format yang diminta, tanpa teks lain, tanpa markdown code fence.`;

    let result;
    try {
      result = await callOpenAI({
        model: opts.model,
        system: opts.system,
        user: userPrompt,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
        jsonMode: true,
        timeoutMs: opts.timeoutMs,
      });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(
        `[generateStructured] callOpenAI failed (attempt ${attempt + 1}/${maxRetries + 1}, model=${opts.model}):`,
        lastError,
      );
      if (attempt === maxRetries) {
        const { message, hint } = classifyAIFailure(lastError);
        throw new AIUnavailableError(message, hint);
      }
      continue;
    }

    totalPromptTokens += result.promptTokens;
    totalCompletionTokens += result.completionTokens;
    totalResponseTimeMs += result.responseTimeMs;
    usedModel = result.model;

    try {
      const json = extractJson(result.content);
      const parsed = opts.schema.safeParse(json);
      if (parsed.success) {
        return {
          data: parsed.data,
          model: usedModel,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          responseTimeMs: totalResponseTimeMs,
          attempts: attempt + 1,
        };
      }
      lastError = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    } catch (e) {
      lastError = e instanceof AIJsonParseError ? e.message : String(e);
    }
  }

  console.error(
    `[generateStructured] Schema validation failed after ${maxRetries + 1} attempts (model=${opts.model}):`,
    lastError,
  );
  throw new AIUnavailableError(
    `AI mengembalikan hasil yang tidak lengkap/tidak valid setelah ${maxRetries + 1}x percobaan.\n\nPenyebab: ${lastError || "format respons tidak sesuai"}.\n\nSilakan coba kembali.`,
    "validation",
  );
}

export interface GenerateStructuredFromImageOptions<T> {
  model: string;
  system: string;
  user: string;
  images: string[]; // data URLs
  schema: z.ZodSchema<T>;
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
}

// Vision counterpart of generateStructured() — same JSON-extract +
// zod-validate + self-correcting retry loop, but calls callOpenAIVision()
// with the supplied image(s) instead of callOpenAI(). Used only by the
// Laboratorium OCR upload feature.
export async function generateStructuredFromImage<T>(
  opts: GenerateStructuredFromImageOptions<T>,
): Promise<GenerateStructuredResult<T>> {
  const { callOpenAIVision } = await import("../client");
  const maxRetries = opts.maxRetries ?? AI_DEFAULTS.maxRetries;
  let lastError: string | null = null;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalResponseTimeMs = 0;
  let usedModel = opts.model;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const userPrompt =
      attempt === 0
        ? opts.user
        : `${opts.user}\n\n---\nPERCOBAAN SEBELUMNYA GAGAL VALIDASI:\n${lastError}\nPerbaiki dan kembalikan HANYA JSON valid sesuai format yang diminta, tanpa teks lain, tanpa markdown code fence.`;

    let result;
    try {
      result = await callOpenAIVision({
        model: opts.model,
        system: opts.system,
        user: userPrompt,
        images: opts.images,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
      });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(
        `[generateStructuredFromImage] callOpenAIVision failed (attempt ${attempt + 1}/${maxRetries + 1}, model=${opts.model}):`,
        lastError,
      );
      if (attempt === maxRetries) {
        throw new AIUnavailableError();
      }
      continue;
    }

    totalPromptTokens += result.promptTokens;
    totalCompletionTokens += result.completionTokens;
    totalResponseTimeMs += result.responseTimeMs;
    usedModel = result.model;

    try {
      const json = extractJson(result.content);
      const parsed = opts.schema.safeParse(json);
      if (parsed.success) {
        return {
          data: parsed.data,
          model: usedModel,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          responseTimeMs: totalResponseTimeMs,
          attempts: attempt + 1,
        };
      }
      lastError = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    } catch (e) {
      lastError = e instanceof AIJsonParseError ? e.message : String(e);
    }
  }

  console.error(
    `[generateStructuredFromImage] Schema validation failed after ${maxRetries + 1} attempts (model=${opts.model}):`,
    lastError,
  );
  throw new AIUnavailableError(
    `Gagal membaca dokumen laboratorium. Silakan coba lagi atau input manual. (Validasi gagal setelah ${maxRetries + 1}x percobaan)`,
  );
}
