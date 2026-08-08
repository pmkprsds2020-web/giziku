// =====================================================================
// CareLivia — AI Response Cache
// If a feature is called again with byte-identical input (same patient,
// same targets, same preferences), reuse the previous AI output instead
// of calling OpenAI again. Table: ai_cache. TTL defaults to 7 days.
// =====================================================================

import "server-only";
import { createHash } from "crypto";
import { getServiceClient } from "@/lib/supabase/service";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function buildCacheKey(feature: string, input: unknown): string {
  const json = JSON.stringify(input, Object.keys(input as object).sort?.() ?? undefined);
  const hash = createHash("sha256").update(`${feature}:${json}`).digest("hex");
  return hash;
}

export async function getCached<T>(cacheKey: string): Promise<T | null> {
  try {
    const client = getServiceClient() as any;
    const { data } = await client
      .from("ai_cache")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
    return data.payload as T;
  } catch (e) {
    console.error("[ai/cache] read failed:", e);
    return null;
  }
}

export async function setCached(
  cacheKey: string,
  feature: string,
  payload: unknown,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  try {
    const client = getServiceClient() as any;
    await client.from("ai_cache").upsert(
      {
        cache_key: cacheKey,
        feature,
        payload,
        expires_at: new Date(Date.now() + ttlMs).toISOString(),
      },
      { onConflict: "cache_key" },
    );
  } catch (e) {
    console.error("[ai/cache] write failed:", e);
  }
}
