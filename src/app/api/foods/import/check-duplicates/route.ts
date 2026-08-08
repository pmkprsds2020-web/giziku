import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handleZod, safeParse } from "@/lib/api-helpers";
import { supabaseCheckFoodDuplicates } from "@/lib/supabase/data-layer";

const CheckSchema = z.object({
  items: z.array(
    z.object({
      code: z.string().nullish(),
      name: z.string().min(1),
    }),
  ),
});

// POST /api/foods/import/check-duplicates
// Given the parsed rows from the Excel file, returns which ones already
// exist in `foods` (matched by code OR case-insensitive name), so the
// client can offer Lewati / Update Data Lama / Tambah Sebagai Baru.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(CheckSchema, body);
    if (!parsed.success) return handleZod(parsed.error);

    const matches = await supabaseCheckFoodDuplicates(parsed.data.items);
    return ok({ matches });
  } catch (e) {
    return handleZod(e);
  }
}
