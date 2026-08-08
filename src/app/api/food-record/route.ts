import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import { computeFoodNutrition } from "@/lib/clinical/calorie-engine";
import {
  supabaseListFoodRecords,
  supabaseCreateFoodRecord,
  supabaseDeleteFoodRecord,
  supabaseGetFood,
  resolvePatientId,
  resolveFoodId,
} from "@/lib/supabase/data-layer";

const RecordSchema = z.object({
  patientId: z.string(),
  foodId: z.string(),
  slot: z.enum([
    "BREAKFAST",
    "MORNING_SNACK",
    "LUNCH",
    "AFTERNOON_SNACK",
    "DINNER",
    "EVENING_SNACK",
  ]),
  amount: z.number().min(1).max(1000),
  consumed: z.number().min(0).max(100).optional().default(100),
  date: z.string().optional(),
  notes: z.string().optional().default(""),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const dateStr = searchParams.get("date");

    if (!patientId) return err("patientId wajib diisi", 422);

    const resolvedId = await resolvePatientId(patientId);
    const records = await supabaseListFoodRecords(resolvedId, dateStr || undefined);
    return ok(records);
  } catch (e) {
    return handleZod(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(RecordSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    const resolvedPatientId = await resolvePatientId(d.patientId);
    const resolvedFoodId = await resolveFoodId(d.foodId);

    const food = await supabaseGetFood(resolvedFoodId);
    if (!food) return err("Makanan tidak ditemukan", 404);

    const nut = computeFoodNutrition(food, d.amount);
    const consumedRatio = d.consumed / 100;

    const { data: record, error } = await supabaseCreateFoodRecord({
      patientId: resolvedPatientId,
      foodId: resolvedFoodId,
      slot: d.slot,
      amount: d.amount,
      consumed: d.consumed,
      date: d.date ?? new Date().toISOString(),
      cal: nut.cal * consumedRatio,
      protein: nut.protein * consumedRatio,
      fat: nut.fat * consumedRatio,
      carb: nut.carb * consumedRatio,
      fiber: nut.fiber * consumedRatio,
      sodium: nut.sodium * consumedRatio,
      notes: d.notes,
    });

    if (error) {
      if (error.includes("Authentication required")) return err(error, 401);
      return err(error, 500);
    }

    return ok(record, 201);
  } catch (e) {
    return handleZod(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return err("id wajib diisi", 422);

    const { error } = await supabaseDeleteFoodRecord(id);
    if (error) {
      if (error.includes("Authentication required")) return err(error, 401);
      return err(error, 500);
    }
    return ok({ id, deleted: true });
  } catch (e) {
    return handleZod(e);
  }
}
