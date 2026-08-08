import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseGetSavedMenu,
  supabaseUpdateSavedMenu,
  supabaseMarkSavedMenuUsed,
  supabaseDeleteSavedMenu,
} from "@/lib/supabase/data-layer";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        foodId: z.string().min(1),
        amount: z.number().min(0.1).max(5000),
        foodName: z.string(),
        urt: z.string().optional().nullable(),
        cal: z.number(),
        protein: z.number(),
        fat: z.number(),
        carb: z.number(),
        fiber: z.number(),
        sodium: z.number(),
        potassium: z.number(),
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

    const menu = await supabaseGetSavedMenu(id);

    if (!menu || menu.deletedAt) {
      // Prisma fallback
      try {
        const { db } = await import("@/lib/db");
        const prismaMenu = await db.savedMenu.findUnique({
          where: { id },
          include: {
            items: { include: { food: { include: { category: true } } } },
          },
        });
        if (!prismaMenu || prismaMenu.deletedAt) return err("Menu tidak ditemukan", 404);
        return ok(prismaMenu);
      } catch (e) {
        return err("Menu tidak ditemukan", 404);
      }
    }

    return ok(menu);
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

    const { data: updated, error: supaErr } = await supabaseUpdateSavedMenu(id, d);

    if (supaErr || !updated) {
      // Prisma fallback
      console.warn("[saved-menus/[id] PUT] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.savedMenu.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return err("Menu tidak ditemukan", 404);

        if (d.items) {
          await db.savedMenuItem.deleteMany({ where: { savedMenuId: id } });
          await db.savedMenuItem.createMany({
            data: d.items.map((it) => ({
              savedMenuId: id,
              foodId: it.foodId,
              amount: it.amount,
              foodName: it.foodName,
              urt: it.urt || null,
              cal: it.cal,
              protein: it.protein,
              fat: it.fat,
              carb: it.carb,
              fiber: it.fiber,
              sodium: it.sodium,
              potassium: it.potassium,
            })),
          });

          const totals = d.items.reduce(
            (acc, i) => ({
              cal: acc.cal + i.cal,
              protein: acc.protein + i.protein,
              fat: acc.fat + i.fat,
              carb: acc.carb + i.carb,
              fiber: acc.fiber + i.fiber,
              sodium: acc.sodium + i.sodium,
              potassium: acc.potassium + i.potassium,
            }),
            { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0, potassium: 0 },
          );

          await db.savedMenu.update({
            where: { id },
            data: {
              name: d.name,
              notes: d.notes,
              totalCal: Math.round(totals.cal * 10) / 10,
              totalProtein: Math.round(totals.protein * 10) / 10,
              totalFat: Math.round(totals.fat * 10) / 10,
              totalCarb: Math.round(totals.carb * 10) / 10,
              totalFiber: Math.round(totals.fiber * 10) / 10,
              totalSodium: Math.round(totals.sodium),
              totalPotassium: Math.round(totals.potassium),
              version: { increment: 1 },
            },
          });
        } else {
          await db.savedMenu.update({
            where: { id },
            data: { name: d.name, notes: d.notes, version: { increment: 1 } },
          });
        }

        const refreshed = await db.savedMenu.findUnique({
          where: { id },
          include: { items: { include: { food: { include: { category: true } } } } },
        });
        return ok(refreshed);
      } catch (prismaErr: any) {
        return err(`Gagal memperbarui menu: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok(updated);
  } catch (e) {
    return handleZod(e);
  }
}

// Mark as used (increments useCount, updates lastUsedAt)
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { data, error: supaErr } = await supabaseMarkSavedMenuUsed(id);

    if (supaErr || !data) {
      // Prisma fallback
      console.warn("[saved-menus/[id] PATCH] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.savedMenu.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return err("Menu tidak ditemukan", 404);

        const updated = await db.savedMenu.update({
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

    const { error: supaErr } = await supabaseDeleteSavedMenu(id);

    if (supaErr) {
      // Prisma fallback
      console.warn("[saved-menus/[id] DELETE] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.savedMenu.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) return err("Menu tidak ditemukan", 404);

        await db.savedMenu.update({ where: { id }, data: { deletedAt: new Date() } });
        return ok({ id, deleted: true });
      } catch (prismaErr: any) {
        return err(`Gagal menghapus menu: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok({ id, deleted: true });
  } catch (e) {
    return handleZod(e);
  }
}
