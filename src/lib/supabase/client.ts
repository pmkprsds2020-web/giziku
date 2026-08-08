"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client — SINGLETON.
 * Creates ONE instance shared across the entire app.
 * Prevents "Multiple GoTrueClient instances detected" warning.
 *
 * NEXT_PUBLIC_* env vars are inlined by Next.js at BUILD TIME.
 * If they're present in .env during build, they'll be baked into the client bundle.
 * The mock fallback only triggers if the build didn't have the env vars
 * (e.g., during SSR prerendering in certain CI environments).
 */

// These get inlined at build time by Next.js
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if env vars are actually present (not undefined/empty)
const HAS_ENV = !!SUPABASE_URL && !!SUPABASE_ANON_KEY && SUPABASE_URL.startsWith("https://");

if (!HAS_ENV) {
  console.error(
    "[supabase/client] CRITICAL: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or invalid.",
    "URL:", SUPABASE_URL ? "present" : "MISSING",
    "KEY:", SUPABASE_ANON_KEY ? "present" : "MISSING"
  );
}

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // If we have valid env vars, create the real client
  if (HAS_ENV) {
    if (!browserClient) {
      browserClient = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    }
    return browserClient;
  }

  // Fallback: mock client (only happens if env vars weren't inlined at build time)
  // This should NOT happen in production if .env is properly configured
  console.error("[supabase/client] Using MOCK client — Supabase operations will fail. Check .env configuration.");
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ error: new Error("Supabase not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env") }),
      signUp: async () => ({ data: null, error: new Error("Supabase not configured") }),
      signOut: async () => ({}),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }) }),
        order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        in: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }),
      }),
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
      delete: () => ({ eq: () => ({}) }),
    }),
  } as any;
}
