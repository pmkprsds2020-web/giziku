import { NextRequest } from "next/server";
import { ok, handleZod } from "@/lib/api-helpers";
import { supabaseListMealPlanHistory, resolvePatientId } from "@/lib/supabase/data-layer";

// GET /api/meal-plan-history?patientId=...
// Lists snapshots for the "Riwayat Meal Plan" page.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientIdParam = searchParams.get("patientId");
    const patientId = patientIdParam ? await resolvePatientId(patientIdParam) : undefined;
    const history = await supabaseListMealPlanHistory(patientId);
    return ok(history);
  } catch (e) {
    return handleZod(e);
  }
}
