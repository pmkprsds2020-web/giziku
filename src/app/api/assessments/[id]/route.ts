import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { supabaseDeleteAssessment } from "@/lib/supabase/data-layer";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { error: supaErr } = await supabaseDeleteAssessment(id);

    if (supaErr) {
      // Prisma fallback
      console.warn("[assessments/[id] DELETE] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.nutritionAssessment.findUnique({ where: { id } });
        if (!existing) return err("Asesmen tidak ditemukan", 404);
        await db.nutritionAssessment.delete({ where: { id } });
        return ok({ id, deleted: true });
      } catch (prismaErr: any) {
        return err(`Gagal menghapus asesmen: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok({ id, deleted: true });
  } catch (e) {
    return handleZod(e);
  }
}
