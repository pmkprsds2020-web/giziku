// =====================================================================
// CareLivia — AI Usage Logging
// Persists every AI call's cost/latency/token metrics to Supabase
// (table: ai_usage_logs — see supabase/migrations/019_ai_infrastructure.sql)
// Never throws — logging failures must not break the user-facing request.
// =====================================================================

import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { estimateCostUsd } from "./models";

export interface AIUsageLogEntry {
  feature: string; // e.g. "meal-plan", "chat", "nutrition-analysis"
  model: string;
  promptTokens: number;
  completionTokens: number;
  responseTimeMs: number;
  success: boolean;
  cacheHit?: boolean;
  errorMessage?: string;
  patientId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAIUsage(entry: AIUsageLogEntry): Promise<void> {
  try {
    const client = getServiceClient() as any;
    await client.from("ai_usage_logs").insert({
      feature: entry.feature,
      model: entry.model,
      prompt_tokens: entry.promptTokens,
      completion_tokens: entry.completionTokens,
      total_tokens: entry.promptTokens + entry.completionTokens,
      estimated_cost_usd: estimateCostUsd(entry.model, entry.promptTokens, entry.completionTokens),
      response_time_ms: entry.responseTimeMs,
      success: entry.success,
      cache_hit: entry.cacheHit ?? false,
      error_message: entry.errorMessage ?? null,
      patient_id: entry.patientId ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (e) {
    // Logging must never break the request path.
    console.error("[ai/logging] failed to write ai_usage_logs:", e);
  }
}
