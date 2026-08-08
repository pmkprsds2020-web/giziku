import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { supabaseDeleteWeightRecord } from "@/lib/supabase/data-layer";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { error: supaErr } = await supabaseDeleteWeightRecord(id);

    if (supaErr) {
      // Prisma fallback
      console.warn("[weight-records/[id] DELETE] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.weightRecord.findUnique({ where: { id } });
        if (!existing) return err("Record tidak ditemukan", 404);
        await db.weightRecord.delete({ where: { id } });
        return ok({ id, deleted: true });
      } catch (prismaErr: any) {
        return err(`Gagal menghapus record: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok({ id, deleted: true });
  } catch (e) {
    return handleZod(e);
  }
}
