import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import {
  supabaseGetMealPlanHistoryDetail,
  supabaseDeleteMealPlanHistory,
} from "@/lib/supabase/data-layer";

// GET /api/meal-plan-history/[id] — "Lihat" full snapshot
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const detail = await supabaseGetMealPlanHistoryDetail(id);
    if (!detail) return err("Riwayat meal plan tidak ditemukan", 404);
    return ok(detail);
  } catch (e) {
    return handleZod(e);
  }
}

// DELETE /api/meal-plan-history/[id] — "Hapus" (only removes the snapshot,
// never touches the live/active meal plan).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { error } = await supabaseDeleteMealPlanHistory(id);
    if (error) return err(error, 500);
    return ok({ deleted: true });
  } catch (e) {
    return handleZod(e);
  }
}
