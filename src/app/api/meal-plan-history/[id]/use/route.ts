import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { supabaseApplyMealPlanHistory } from "@/lib/supabase/data-layer";

const UseSchema = z.object({
  mealPlanId: z.string().min(1),
});

// POST /api/meal-plan-history/[id]/use
// "Gunakan Meal Plan" — replaces meal_plan_current's items with this
// snapshot's items, atomically, via fn_apply_meal_plan_history().
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = safeParse(UseSchema, body);
    if (!parsed.success) return handleZod(parsed.error);

    const { data: plan, error } = await supabaseApplyMealPlanHistory(parsed.data.mealPlanId, id);
    if (error || !plan) return err(error || "Gagal menerapkan riwayat meal plan", 500);
    return ok({ plan });
  } catch (e) {
    return handleZod(e);
  }
}
