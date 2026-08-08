import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { supabaseTestWrite } from "@/lib/supabase/data-layer";

// ---------------------------------------------------------------------
// POST /api/supabase-test-write
// Tests write capability to Supabase PostgreSQL.
// Inserts a test row into audit_logs, reads it back, returns result.
// Requires authentication (RLS requires authenticated role for writes).
// ---------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const result = await supabaseTestWrite();

    return ok({
      success: result.success,
      table: "audit_logs",
      operation: "INSERT + SELECT",
      insertedRow: result.data,
      error: result.error,
      timestamp: new Date().toISOString(),
      message: result.success
        ? "✅ Write Success — Supabase PostgreSQL is accepting writes."
        : `❌ Write Failed — ${result.error}`,
    });
  } catch (e: any) {
    return err(e.message || "Test write failed", 500);
  }
}
