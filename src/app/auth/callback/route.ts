import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Auth callback — handles OAuth/email confirmation redirects
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${requestUrl.origin}/login?error=auth_callback_failed`,
  );
}
