import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { supabaseTogglePresetFavorite } from "@/lib/supabase/data-layer";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { data, error: supaErr } = await supabaseTogglePresetFavorite(id);

    if (supaErr || !data) {
      // Prisma fallback
      console.warn("[presets/[id]/favorite POST] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.nutritionPreset.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return err("Preset tidak ditemukan", 404);

        const updated = await db.nutritionPreset.update({
          where: { id },
          data: { isFavorite: !existing.isFavorite },
        });

        await db.nutritionPresetHistory.create({
          data: {
            presetId: id,
            changes: JSON.stringify({
              isFavorite: { from: existing.isFavorite, to: updated.isFavorite },
            }),
            version: existing.version,
            actor: "doctor",
            reason: updated.isFavorite ? "Ditandai sebagai favorit" : "Dihapus dari favorit",
          },
        });

        return ok({ id, isFavorite: updated.isFavorite });
      } catch (prismaErr: any) {
        return err(`Gagal toggle favorit: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok(data);
  } catch (e) {
    return handleZod(e);
  }
}
