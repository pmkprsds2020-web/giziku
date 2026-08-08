import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import {
  supabaseGetSavedMealPlan,
  supabaseMarkSavedMealPlanUsed,
  supabaseDeleteSavedMealPlan,
} from "@/lib/supabase/data-layer";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const plan = await supabaseGetSavedMealPlan(id);

    if (!plan || plan.deletedAt) {
      // Prisma fallback
      try {
        const { db } = await import("@/lib/db");
        const prismaPlan = await db.savedMealPlan.findUnique({
          where: { id },
          include: {
            items: { include: { food: { include: { category: true } } } },
          },
        });
        if (!prismaPlan || prismaPlan.deletedAt) return err("Meal plan tidak ditemukan", 404);
        return ok(prismaPlan);
      } catch (e) {
        return err("Meal plan tidak ditemukan", 404);
      }
    }

    return ok(plan);
  } catch (e) {
    return handleZod(e);
  }
}

// Mark as used
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { data, error: supaErr } = await supabaseMarkSavedMealPlanUsed(id);

    if (supaErr || !data) {
      // Prisma fallback
      console.warn("[saved-meal-plans/[id] PATCH] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.savedMealPlan.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return err("Meal plan tidak ditemukan", 404);

        const updated = await db.savedMealPlan.update({
          where: { id },
          data: {
            useCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });
        return ok(updated);
      } catch (prismaErr: any) {
        return err(`Gagal menandai sebagai digunakan: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok(data);
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

    const { error: supaErr } = await supabaseDeleteSavedMealPlan(id);

    if (supaErr) {
      // Prisma fallback
      console.warn("[saved-meal-plans/[id] DELETE] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.savedMealPlan.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return err("Meal plan tidak ditemukan", 404);

        await db.savedMealPlan.update({ where: { id }, data: { deletedAt: new Date() } });
        return ok({ id, deleted: true });
      } catch (prismaErr: any) {
        return err(`Gagal menghapus meal plan: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok({ id, deleted: true });
  } catch (e) {
    return handleZod(e);
  }
}
