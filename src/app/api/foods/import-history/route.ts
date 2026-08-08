import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import {
  supabaseCreateFoodImportHistory,
  supabaseListFoodImportHistory,
} from "@/lib/supabase/data-layer";

const HistorySchema = z.object({
  fileName: z.string().min(1),
  totalRows: z.number(),
  successCount: z.number(),
  updatedCount: z.number(),
  skippedCount: z.number(),
  failedCount: z.number(),
  durationMs: z.number(),
  status: z.enum(["COMPLETED", "PARTIAL", "FAILED"]),
  errorLog: z.array(z.any()).optional(),
});

// POST /api/foods/import-history — record one completed import run
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(HistorySchema, body);
    if (!parsed.success) return handleZod(parsed.error);

    const { data, error } = await supabaseCreateFoodImportHistory(parsed.data);
    if (error) return err(error, 500);
    return ok(data, 201);
  } catch (e) {
    return handleZod(e);
  }
}

// GET /api/foods/import-history — Riwayat Import list
export async function GET() {
  try {
    const history = await supabaseListFoodImportHistory();
    return ok(history);
  } catch (e) {
    return handleZod(e);
  }
}
