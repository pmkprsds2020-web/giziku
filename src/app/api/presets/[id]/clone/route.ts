import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { z } from "zod";
import { supabaseClonePreset } from "@/lib/supabase/data-layer";

const CloneSchema = z.object({
  newName: z.string().optional(),
  patientId: z.string().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = CloneSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    const { data: clone, error: supaErr } = await supabaseClonePreset(id, {
      newName: d.newName,
      patientId: d.patientId,
    });

    if (supaErr || !clone) {
      // Prisma fallback
      console.warn("[presets/[id]/clone POST] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const source = await db.nutritionPreset.findUnique({ where: { id } });
        if (!source || source.deletedAt) return err("Preset sumber tidak ditemukan", 404);

        const prismaClone = await db.nutritionPreset.create({
          data: {
            patientId: d.patientId !== undefined ? d.patientId : source.patientId,
            name: d.newName || `${source.name} (Salinan)`,
            description: source.description,
            color: source.color,
            icon: source.icon,
            isTemplate: false,
            isFavorite: false,
            totalCal: source.totalCal,
            targetWeight: source.targetWeight,
            bmr: source.bmr,
            tdee: source.tdee,
            proteinPct: source.proteinPct,
            carbPct: source.carbPct,
            fatPct: source.fatPct,
            proteinG: source.proteinG,
            carbG: source.carbG,
            fatG: source.fatG,
            fiberG: source.fiberG,
            sodiumMg: source.sodiumMg,
            potassiumMg: source.potassiumMg,
            fluidMl: source.fluidMl,
            goal: source.goal,
            diagnoses: source.diagnoses,
            version: 1,
            createdBy: "doctor",
            updatedBy: "doctor",
          },
        });

        await db.nutritionPresetHistory.create({
          data: {
            presetId: prismaClone.id,
            changes: JSON.stringify({
              action: "CLONE",
              sourcePresetId: id,
              sourceName: source.name,
            }),
            version: 1,
            actor: "doctor",
            reason: `Duplikat dari "${source.name}"`,
          },
        });

        return ok(prismaClone, 201);
      } catch (prismaErr: any) {
        return err(`Gagal menduplikasi preset: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok(clone, 201);
  } catch (e) {
    return handleZod(e);
  }
}
