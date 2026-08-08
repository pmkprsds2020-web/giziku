import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — SERVER ONLY, bypasses RLS.
 * Use for AI logging/cache only. NEVER use for patient data.
 * Gracefully returns null if env vars missing (AI features degrade gracefully).
 */
let _serviceClient: ReturnType<typeof createSupabaseClient> | null = null;

export function getServiceClient() {
  if (_serviceClient) return _serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn("[supabase/service] SUPABASE_SERVICE_ROLE_KEY not set — AI logging/cache disabled");
    return null;
  }

  _serviceClient = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _serviceClient;
}
