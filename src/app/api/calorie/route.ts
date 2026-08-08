import { NextRequest } from "next/server";
import { ok, handleZod, safeParse } from "@/lib/api-helpers";
import { computeCalorieTarget } from "@/lib/clinical/calorie-engine";
import { z } from "zod";

const CalorieSchema = z.object({
  gender: z.enum(["MALE", "FEMALE"]),
  ageYears: z.number().min(0).max(120),
  heightCm: z.number().min(30).max(250),
  weightKg: z.number().min(2).max(400),
  activity: z.enum(["BED_REST", "VERY_LIGHT", "LIGHT", "MODERATE", "HEAVY"]),
  stress: z.enum(["NONE", "MILD", "MODERATE", "SEVERE", "VERY_SEVERE"]),
  diagnoses: z.array(z.string()).default([]),
  isPregnant: z.boolean().optional().default(false),
  pregnancyTrimester: z.number().optional().default(0),
  isLactating: z.boolean().optional().default(false),
  bouchardPalCategory: z.enum(["Sedentary", "Low Active", "Active", "Very Active"]).optional(),
  weightGoal: z.enum(["MAINTENANCE", "WEIGHT_LOSS", "WEIGHT_GAIN"]).optional(),
  energyDeficitKcal: z.number().min(0).max(750).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(CalorieSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const result = computeCalorieTarget({
      ...parsed.data,
      diagnoses: parsed.data.diagnoses as never[],
    });
    return ok(result);
  } catch (e) {
    return handleZod(e);
  }
}
