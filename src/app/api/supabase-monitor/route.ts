import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { supabaseGetDatabaseInfo, getServerClient } from "@/lib/supabase/data-layer";

// ---------------------------------------------------------------------
// GET /api/supabase-monitor
// Returns Supabase PostgreSQL connection status + database stats
// ---------------------------------------------------------------------
export async function GET() {
  try {
    const info = await supabaseGetDatabaseInfo();

    // Get counts for all key tables
    const { client } = await getServerClient();
    const tableNames = [
      "patients", "foods", "meal_plans", "food_records",
      "weight_records", "nutrition_assessments", "nutrition_presets",
      "recipes", "shopping_lists", "exercise_plans",
      "saved_meal_plans", "audit_logs",
    ];

    const countPromises = tableNames.map(async (t) => {
      try {
        const { count, error } = await client.from(t).select("id", { count: "exact", head: true });
        return { name: t, count: error ? 0 : (count ?? 0) };
      } catch {
        return { name: t, count: 0 };
      }
    });
    const counts = await Promise.all(countPromises);

    const tableLabels: Record<string, string> = {
      patients: "Pasien",
      foods: "Bahan Makanan",
      meal_plans: "Meal Plan",
      food_records: "Catatan Asupan",
      weight_records: "Record Berat Badan",
      nutrition_assessments: "Asesmen Gizi",
      nutrition_presets: "Preset Gizi",
      recipes: "Resep",
      shopping_lists: "Shopping List",
      exercise_plans: "Exercise Plan",
      saved_meal_plans: "Saved Meal Plan",
      audit_logs: "Audit Log",
    };

    const tables = counts.map((c) => ({
      ...c,
      label: tableLabels[c.name] || c.name,
    }));

    const totalRecords = tables.reduce((s, t) => s + t.count, 0);

    // Today's records
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let todayRecords = 0;
    try {
      const { count: todayCount } = await client
        .from("food_records")
        .select("id", { count: "exact", head: true })
        .gte("date", todayStart.toISOString());
      todayRecords = todayCount ?? 0;
    } catch {}

    // This month's records
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    let monthRecords = 0;
    try {
      const { count: monthCount } = await client
        .from("food_records")
        .select("id", { count: "exact", head: true })
        .gte("date", monthStart.toISOString());
      monthRecords = monthCount ?? 0;
    } catch {}

    return ok({
      connection: {
        status: info.isConnected ? "connected" : "disconnected",
        latency: `${info.latency}ms`,
        latencyMs: info.latency,
        timestamp: new Date().toISOString(),
        database: "Supabase PostgreSQL",
        databaseType: "Supabase PostgreSQL",
        supabaseUrl: info.supabaseUrl,
        projectId: info.projectId,
        region: info.region,
        schema: info.schema,
        postgresVersion: info.postgresVersion,
        hasAnonKey: info.anonKeyConfigured,
        error: info.error,
      },
      session: info.session,
      stats: {
        totalRecords,
        todayRecords,
        monthRecords,
        tables,
      },
      health: {
        database: info.isConnected ? "healthy" : "unhealthy",
        auth: info.authConfigured ? "configured" : "not_configured",
        rls: "enabled (authenticated role required for writes)",
        realtime: info.realtimeAvailable ? "available" : "unavailable",
        storage: info.storageConfigured ? "configured" : "not_configured",
      },
      tableCounts: info.tableCounts,
    });
  } catch (e: any) {
    return ok({
      connection: {
        status: "disconnected",
        error: e.message,
        timestamp: new Date().toISOString(),
        database: "Supabase PostgreSQL",
        databaseType: "Supabase PostgreSQL",
      },
      stats: { totalRecords: 0, todayRecords: 0, monthRecords: 0, tables: [] },
      health: {
        database: "unhealthy",
        auth: "unknown",
        rls: "unknown",
        realtime: "unknown",
        storage: "unknown",
      },
    });
  }
}

// ---------------------------------------------------------------------
// POST /api/supabase-monitor — test connection (SELECT NOW())
// ---------------------------------------------------------------------
export async function POST() {
  try {
    const { client, session } = await getServerClient();
    const start = Date.now();

    // Use food_categories as connection test (publicly readable)
    const { error } = await client.from("food_categories").select("id").limit(1);
    const latency = Date.now() - start;

    if (error) {
      return ok({
        status: "disconnected",
        error: error.message,
        latency: `${latency}ms`,
        timestamp: new Date().toISOString(),
        database: "Supabase PostgreSQL",
        authenticated: !!session,
      });
    }

    return ok({
      status: "connected",
      latency: `${latency}ms`,
      latencyMs: latency,
      timestamp: new Date().toISOString(),
      database: "Supabase PostgreSQL",
      projectId: process.env.SUPABASE_PROJECT_ID || "N/A",
      authenticated: !!session,
      sessionUser: session?.user?.email ?? null,
    });
  } catch (e: any) {
    return ok({
      status: "disconnected",
      error: e.message,
      timestamp: new Date().toISOString(),
    });
  }
}
