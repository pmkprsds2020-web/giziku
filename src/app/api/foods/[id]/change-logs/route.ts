import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { getServerClient, resolveFoodId } from "@/lib/supabase/data-layer";

function mapChangeLog(row: any): any {
  return {
    id: row.id,
    foodId: row.food_id,
    action: row.action,
    changes: row.changes, // JSONB comes back as object already
    actor: row.actor,
    createdAt: row.created_at,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const resolvedId = await resolveFoodId(id);

    const { client } = await getServerClient();
    const { data, error } = await client
      .from("food_change_logs")
      .select("*")
      .eq("food_id", resolvedId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // Prisma fallback
      console.warn("[foods/[id]/change-logs GET] Supabase failed, trying Prisma:", error.message);
      try {
        const { db } = await import("@/lib/db");
        const logs = await db.foodChangeLog.findMany({
          where: { foodId: id },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        return ok(
          logs.map((l) => ({
            ...l,
            changes: l.changes ? JSON.parse(l.changes) : null,
          })),
        );
      } catch (e) {
        return err(`Gagal memuat change log: ${error.message}`, 500);
      }
    }

    return ok((data || []).map(mapChangeLog));
  } catch (e) {
    return handleZod(e);
  }
}
