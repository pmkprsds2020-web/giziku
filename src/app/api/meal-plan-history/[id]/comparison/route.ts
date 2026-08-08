import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { supabaseGetMealPlanHistoryComparison } from "@/lib/supabase/data-layer";

// GET /api/meal-plan-history/[id]/comparison
// Full "View" detail: meal plan snapshot + that day's Food Record +
// Meal Plan vs Food Record comparison table + AI Evaluation narrative.
// Used by the expanded Meal History detail view (section A-F of the
// GiziKu CareLivia meal history spec).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const detail = await supabaseGetMealPlanHistoryComparison(id);
    if (!detail) return err("Riwayat meal plan tidak ditemukan", 404);
    return ok(detail);
  } catch (e) {
    return handleZod(e);
  }
}
