import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseListPresets,
  supabaseCreatePreset,
  getServerClient,
} from "@/lib/supabase/data-layer";
import { db } from "@/lib/db";

const KCAL_PER_GRAM = { protein: 4, carb: 4, fat: 9 };

// Compute grams from percentages + total calories
function computeGrams(totalCal: number, proteinPct: number, carbPct: number, fatPct: number) {
  const sum = proteinPct + carbPct + fatPct;
  if (Math.abs(sum - 100) > 5) {
    // normalize if off
  }
  const proteinKcal = (totalCal * proteinPct) / 100;
  const carbKcal = (totalCal * carbPct) / 100;
  const fatKcal = (totalCal * fatPct) / 100;
  return {
    proteinG: Math.round((proteinKcal / KCAL_PER_GRAM.protein) * 10) / 10,
    carbG: Math.round((carbKcal / KCAL_PER_GRAM.carb) * 10) / 10,
    fatG: Math.round((fatKcal / KCAL_PER_GRAM.fat) * 10) / 10,
  };
}

const CreateSchema = z.object({
  patientId: z.string().optional().nullable(),
  name: z.string().min(1, "Nama preset wajib diisi"),
  description: z.string().optional().default(""),
  color: z.string().optional().default("#10b981"),
  icon: z.string().optional().default("utensils"),
  totalCal: z.number().min(500).max(6000),
  targetWeight: z.number().optional().nullable(),
  bmr: z.number().optional().nullable(),
  tdee: z.number().optional().nullable(),
  proteinPct: z.number().min(5).max(60),
  carbPct: z.number().min(10).max(80),
  fatPct: z.number().min(10).max(60),
  fiberG: z.number().optional().default(25),
  sodiumMg: z.number().optional().default(2300),
  potassiumMg: z.number().optional().nullable(),
  fluidMl: z.number().optional().nullable(),
  goal: z
    .enum([
      "WEIGHT_LOSS",
      "WEIGHT_MAINTAIN",
      "WEIGHT_GAIN",
      "HIGH_PROTEIN",
      "LOW_CARB",
      "LOW_FAT",
      "CKD_DIET",
      "DIABETES_DIET",
      "HYPERTENSION_DIET",
      "GENERAL",
    ])
    .optional()
    .default("GENERAL"),
  diagnoses: z.string().optional().default(""),
  isFavorite: z.boolean().optional().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId") || undefined;
    const includeTemplates = searchParams.get("templates") === "1";

    let presets = await supabaseListPresets(patientId);

    // Fall back to Prisma if Supabase is empty
    if (presets.length === 0) {
      presets = await db.nutritionPreset.findMany({
        where: {
          deletedAt: null,
          ...(patientId
            ? { OR: [{ patientId }, { isTemplate: true }] }
            : {}),
        },
        orderBy: [{ isFavorite: "desc" }, { createdAt: "asc" }],
      }) as any;
    }

    // Preserve original behavior: when no patientId and templates flag not set,
    // only return non-template presets
    let filtered = presets;
    if (!patientId && !includeTemplates) {
      filtered = filtered.filter((p: any) => !p.isTemplate);
    }

    return ok(filtered);
  } catch (e) {
    return handleZod(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(CreateSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    // Validate macro sum
    const macroSum = d.proteinPct + d.carbPct + d.fatPct;
    if (Math.abs(macroSum - 100) > 10) {
      return err(
        `Total persentase makronutrien harus ~100% (saat ini ${macroSum}%)`,
        422,
      );
    }

    const grams = computeGrams(d.totalCal, d.proteinPct, d.carbPct, d.fatPct);

    const { data: preset, error } = await supabaseCreatePreset({
      patientId: d.patientId || null,
      name: d.name,
      description: d.description,
      color: d.color,
      icon: d.icon,
      totalCal: d.totalCal,
      targetWeight: d.targetWeight ?? null,
      bmr: d.bmr ?? null,
      tdee: d.tdee ?? null,
      proteinPct: d.proteinPct,
      carbPct: d.carbPct,
      fatPct: d.fatPct,
      proteinG: grams.proteinG,
      carbG: grams.carbG,
      fatG: grams.fatG,
      fiberG: d.fiberG,
      sodiumMg: d.sodiumMg,
      potassiumMg: d.potassiumMg ?? null,
      fluidMl: d.fluidMl ?? null,
      goal: d.goal,
      diagnoses: d.diagnoses,
      isFavorite: d.isFavorite,
      isTemplate: !d.patientId, // Presets without patient become templates
    });

    if (error) {
      if (error.includes("Authentication required")) return err(error, 401);
      return err(error, 500);
    }

    // Log creation in history
    const { client } = await getServerClient();
    const { error: histError } = await client.from("nutrition_preset_history").insert({
      preset_id: preset.id,
      changes: { action: "CREATE", preset },
      version: 1,
      actor: "doctor",
      reason: "Preset dibuat",
    });
    if (histError) {
      console.error("[presets POST] Failed to log preset history:", histError);
    }

    return ok(preset, 201);
  } catch (e) {
    return handleZod(e);
  }
}
