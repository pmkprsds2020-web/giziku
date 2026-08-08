import { ok, handleZod } from "@/lib/api-helpers";
import { supabaseExportAllFoods } from "@/lib/supabase/data-layer";

// GET /api/foods/export
// Returns every food row flattened to the same column shape as the
// import template, so the client can build the export .xlsx with
// SheetJS (client-side — no server-side file generation needed).
export async function GET() {
  try {
    const rows = await supabaseExportAllFoods();
    return ok(rows);
  } catch (e) {
    return handleZod(e);
  }
}
