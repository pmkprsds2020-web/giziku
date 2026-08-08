import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { supabaseBulkUpsertFoods } from "@/lib/supabase/data-layer";

const RowSchema = z.object({
  rowIndex: z.number(),
  strategy: z.enum(["CREATE", "UPDATE", "SKIP"]),
  existingId: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().min(1),
  categoryName: z.string().min(1),
  subcategoryName: z.string().nullish(),
  source: z.string().optional(),
  description: z.string().nullish(),
  urt: z.string().nullish(),
  urtGram: z.number().nullish(),
  bdd: z.number().optional(),
  price: z.number().optional(),
  energy: z.number(),
  protein: z.number(),
  fat: z.number(),
  carb: z.number(),
  fiber: z.number().optional(),
  sugar: z.number().optional(),
  sodium: z.number().optional(),
  potassium: z.number().optional(),
  calcium: z.number().optional(),
  magnesium: z.number().optional(),
  iron: z.number().optional(),
  phosphorus: z.number().optional(),
  zinc: z.number().optional(),
  vitA: z.number().optional(),
  vitB1: z.number().optional(),
  vitB2: z.number().optional(),
  vitB3: z.number().optional(),
  vitB6: z.number().optional(),
  vitB12: z.number().optional(),
  folate: z.number().optional(),
  vitC: z.number().optional(),
  vitD: z.number().optional(),
  vitE: z.number().optional(),
  vitK: z.number().optional(),
  cholesterol: z.number().optional(),
  gi: z.number().optional(),
  glycemicLoad: z.number().optional(),
});

const BatchSchema = z.object({
  rows: z.array(RowSchema).min(1).max(500),
});

// POST /api/foods/import/batch
// Imports ONE batch (≤500 rows recommended: 100/batch per the UI).
// Each row is applied in its own DB sub-transaction server-side
// (fn_bulk_upsert_foods) — a bad row is reported as an error without
// aborting the rows around it in the same batch.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(BatchSchema, body);
    if (!parsed.success) return handleZod(parsed.error);

    const { data, error } = await supabaseBulkUpsertFoods(parsed.data.rows);
    if (error || !data) return err(error || "Gagal mengimpor batch", 500);

    return ok(data);
  } catch (e) {
    return handleZod(e);
  }
}
