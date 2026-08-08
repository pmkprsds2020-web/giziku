import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase middleware — refreshes auth session on every request.
 * Resilient: if env vars are missing, skips session refresh gracefully
 * (app still works, just without auth session).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Graceful degradation: if env vars are missing, skip session refresh
  // This prevents the app from crashing on every request
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "[middleware] Supabase env vars missing — skipping session refresh. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env",
    );
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    // Session refresh only — do NOT redirect. The app works with or without auth.
    // Auth is optional: if logged in, data is scoped to user; if not, public data is shown.
    await supabase.auth.getUser();
  } catch (e) {
    // If Supabase is unreachable or errors, continue without session
    console.warn("[middleware] Supabase session refresh failed:", e);
  }

  return supabaseResponse;
}
