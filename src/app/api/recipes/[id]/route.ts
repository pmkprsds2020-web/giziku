import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseGetRecipe,
  supabaseUpdateRecipe,
  supabaseDeleteRecipe,
} from "@/lib/supabase/data-layer";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  servings: z.number().min(1).max(50).optional(),
  method: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        foodId: z.string().min(1),
        amount: z.number().min(0.1).max(5000),
      }),
    )
    .optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const recipe = await supabaseGetRecipe(id);

    if (!recipe || recipe.deletedAt) {
      // Prisma fallback
      try {
        const { db } = await import("@/lib/db");
        const prismaRecipe = await db.recipe.findUnique({
          where: { id },
          include: {
            items: { include: { food: { include: { category: true } } } },
          },
        });
        if (!prismaRecipe || prismaRecipe.deletedAt) return err("Resep tidak ditemukan", 404);
        return ok(prismaRecipe);
      } catch (e) {
        return err("Resep tidak ditemukan", 404);
      }
    }

    return ok(recipe);
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

    const { data: updated, error: supaErr } = await supabaseUpdateRecipe(id, d);

    if (supaErr || !updated) {
      // Prisma fallback
      console.warn("[recipes/[id] PUT] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.recipe.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return err("Resep tidak ditemukan", 404);

        if (d.items) {
          await db.recipeItem.deleteMany({ where: { recipeId: id } });
          await db.recipeItem.createMany({
            data: d.items.map((it) => ({
              recipeId: id,
              foodId: it.foodId,
              amount: it.amount,
            })),
          });
        }

        const { items: _items, ...rest } = d;
        const prismaUpdated = await db.recipe.update({
          where: { id },
          data: rest,
          include: {
            items: { include: { food: { include: { category: true } } } },
          },
        });
        return ok(prismaUpdated);
      } catch (prismaErr: any) {
        return err(`Gagal memperbarui resep: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
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

    const { error: supaErr } = await supabaseDeleteRecipe(id);

    if (supaErr) {
      // Prisma fallback
      console.warn("[recipes/[id] DELETE] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.recipe.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return err("Resep tidak ditemukan", 404);

        await db.recipe.update({ where: { id }, data: { deletedAt: new Date() } });
        return ok({ id, deleted: true });
      } catch (prismaErr: any) {
        return err(`Gagal menghapus resep: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok({ id, deleted: true });
  } catch (e) {
    return handleZod(e);
  }
}
