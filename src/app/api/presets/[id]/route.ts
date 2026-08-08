import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseGetPreset,
  supabaseUpdatePreset,
  supabaseDeletePreset,
} from "@/lib/supabase/data-layer";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  totalCal: z.number().min(500).max(6000).optional(),
  targetWeight: z.number().optional().nullable(),
  bmr: z.number().optional().nullable(),
  tdee: z.number().optional().nullable(),
  proteinPct: z.number().min(5).max(60).optional(),
  carbPct: z.number().min(10).max(80).optional(),
  fatPct: z.number().min(10).max(60).optional(),
  fiberG: z.number().optional(),
  sodiumMg: z.number().optional(),
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
    .optional(),
  diagnoses: z.string().optional(),
  isFavorite: z.boolean().optional(),
  reason: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const preset = await supabaseGetPreset(id);

    if (!preset || preset.deletedAt) {
      // Prisma fallback
      try {
        const { db } = await import("@/lib/db");
        const prismaPreset = await db.nutritionPreset.findUnique({
          where: { id },
          include: {
            history: { orderBy: { createdAt: "desc" }, take: 20 },
            _count: { select: { mealPlans: true } },
          },
        });
        if (!prismaPreset || prismaPreset.deletedAt) return err("Preset tidak ditemukan", 404);
        return ok(prismaPreset);
      } catch (e) {
        return err("Preset tidak ditemukan", 404);
      }
    }

    return ok(preset);
  } catch (e) {
    return handleZod(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = safeParse(UpdateSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    const { data: updated, error: supaErr } = await supabaseUpdatePreset(id, d);

    if (supaErr || !updated) {
      // Prisma fallback
      console.warn("[presets/[id] PUT] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const KCAL_PER_GRAM = { protein: 4, carb: 4, fat: 9 };
        const existing = await db.nutritionPreset.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return err("Preset tidak ditemukan", 404);

        const newProtein = d.proteinPct ?? existing.proteinPct;
        const newCarb = d.carbPct ?? existing.carbPct;
        const newFat = d.fatPct ?? existing.fatPct;
        const macroSum = newProtein + newCarb + newFat;
        if (Math.abs(macroSum - 100) > 10) {
          return err(
            `Total persentase makronutrien harus ~100% (saat ini ${macroSum}%)`,
            422,
          );
        }

        const newTotalCal = d.totalCal ?? existing.totalCal;
        const proteinG = Math.round(((newTotalCal * newProtein) / 100 / KCAL_PER_GRAM.protein) * 10) / 10;
        const carbG = Math.round(((newTotalCal * newCarb) / 100 / KCAL_PER_GRAM.carb) * 10) / 10;
        const fatG = Math.round(((newTotalCal * newFat) / 100 / KCAL_PER_GRAM.fat) * 10) / 10;

        const prismaUpdated = await db.nutritionPreset.update({
          where: { id },
          data: {
            ...d,
            proteinG,
            carbG,
            fatG,
            version: { increment: 1 },
            updatedBy: "doctor",
          },
        });

        const TRACKED_FIELDS = ["name","description","color","totalCal","proteinPct","carbPct","fatPct","fiberG","sodiumMg","potassiumMg","fluidMl","goal","diagnoses","isFavorite"] as const;
        const changes: Record<string, { from: any; to: any }> = {};
        for (const field of TRACKED_FIELDS) {
          if (d[field] !== undefined && d[field] !== (existing as any)[field]) {
            changes[field] = { from: (existing as any)[field], to: d[field] };
          }
        }

        if (Object.keys(changes).length > 0) {
          await db.nutritionPresetHistory.create({
            data: {
              presetId: id,
              changes: JSON.stringify(changes),
              version: prismaUpdated.version,
              actor: "doctor",
              reason: d.reason || "Preset diperbarui",
            },
          });
        }

        return ok(prismaUpdated);
      } catch (prismaErr: any) {
        return err(`Gagal memperbarui preset: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok(updated);
  } catch (e) {
    return handleZod(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { error: supaErr } = await supabaseDeletePreset(id);

    if (supaErr) {
      // Prisma fallback
      console.warn("[presets/[id] DELETE] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.nutritionPreset.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return err("Preset tidak ditemukan", 404);

        await db.nutritionPreset.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        await db.nutritionPresetHistory.create({
          data: {
            presetId: id,
            changes: JSON.stringify({ action: "DELETE" }),
            version: existing.version,
            actor: "doctor",
            reason: "Preset dihapus (soft delete)",
          },
        });
        return ok({ id, deleted: true });
      } catch (prismaErr: any) {
        return err(`Gagal menghapus preset: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok({ id, deleted: true });
  } catch (e) {
    return handleZod(e);
  }
}
