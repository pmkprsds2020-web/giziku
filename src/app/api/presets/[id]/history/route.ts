import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { supabaseFetchPresetHistory } from "@/lib/supabase/data-layer";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let history = await supabaseFetchPresetHistory(id);

    // If empty, try Prisma fallback
    if (history.length === 0) {
      try {
        const { db } = await import("@/lib/db");
        const prismaHistory = await db.nutritionPresetHistory.findMany({
          where: { presetId: id },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        if (prismaHistory.length > 0) {
          history = prismaHistory.map((h) => ({
            ...h,
            changes: h.changes ? JSON.parse(h.changes) : null,
          }));
        }
      } catch (e) {
        console.warn("[presets/[id]/history GET] Prisma fallback failed:", e);
      }
    }

    return ok(history);
  } catch (e) {
    return handleZod(e);
  }
}
