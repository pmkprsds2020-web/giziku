import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { getServerClient } from "@/lib/supabase/data-layer";

// GET /api/presets/compare?ids=id1,id2,id3
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids") || "";
    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length < 2) return err("Pilih minimal 2 preset untuk dibandingkan", 422);

    const { client } = await getServerClient();
    const { data, error } = await client
      .from("nutrition_presets")
      .select("*")
      .in("id", ids)
      .is("deleted_at", null);

    if (error || !data || data.length < 2) {
      // Prisma fallback
      console.warn("[presets/compare GET] Supabase failed, trying Prisma:", error?.message);
      try {
        const { db } = await import("@/lib/db");
        const presets = await db.nutritionPreset.findMany({
          where: { id: { in: ids }, deletedAt: null },
        });

        if (presets.length < 2) return err("Preset tidak ditemukan", 404);

        const rows = buildComparisonRows(presets);
        return ok({ presets, rows });
      } catch (e: any) {
        return err(`Gagal membandingkan preset: ${error?.message ?? e?.message ?? "unknown"}`, 500);
      }
    }

    // Map to camelCase
    const presets = data.map((p: any) => ({
      id: p.id,
      patientId: p.patient_id,
      name: p.name,
      description: p.description,
      color: p.color,
      icon: p.icon,
      isTemplate: p.is_template,
      isFavorite: p.is_favorite,
      totalCal: p.total_cal,
      proteinPct: p.protein_pct,
      carbPct: p.carb_pct,
      fatPct: p.fat_pct,
      proteinG: p.protein_g,
      carbG: p.carb_g,
      fatG: p.fat_g,
      fiberG: p.fiber_g,
      sodiumMg: p.sodium_mg,
      potassiumMg: p.potassium_mg,
      fluidMl: p.fluid_ml,
      goal: p.goal,
      diagnoses: p.diagnoses,
      version: p.version,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    const rows = buildComparisonRows(presets);
    return ok({ presets, rows });
  } catch (e) {
    return handleZod(e);
  }
}

function buildComparisonRows(presets: any[]) {
  return [
    { label: "Kalori (kcal)", key: "totalCal", values: presets.map((p) => p.totalCal) },
    { label: "Protein (%)", key: "proteinPct", values: presets.map((p) => p.proteinPct) },
    { label: "Protein (g)", key: "proteinG", values: presets.map((p) => p.proteinG) },
    { label: "Karbohidrat (%)", key: "carbPct", values: presets.map((p) => p.carbPct) },
    { label: "Karbohidrat (g)", key: "carbG", values: presets.map((p) => p.carbG) },
    { label: "Lemak (%)", key: "fatPct", values: presets.map((p) => p.fatPct) },
    { label: "Lemak (g)", key: "fatG", values: presets.map((p) => p.fatG) },
    { label: "Serat (g)", key: "fiberG", values: presets.map((p) => p.fiberG) },
    { label: "Natrium max (mg)", key: "sodiumMg", values: presets.map((p) => p.sodiumMg) },
    { label: "Kalium (mg)", key: "potassiumMg", values: presets.map((p) => p.potassiumMg ?? "—") },
    { label: "Cairan (ml)", key: "fluidMl", values: presets.map((p) => p.fluidMl ?? "—") },
    { label: "Tujuan", key: "goal", values: presets.map((p) => p.goal) },
  ];
}
