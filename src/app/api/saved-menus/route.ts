import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseListSavedMenus,
  supabaseCreateSavedMenu,
} from "@/lib/supabase/data-layer";

const ItemSchema = z.object({
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
});

const CreateSchema = z.object({
  patientId: z.string().optional().nullable(),
  name: z.string().min(1, "Nama menu wajib diisi"),
  category: z.enum([
    "BREAKFAST",
    "MORNING_SNACK",
    "LUNCH",
    "AFTERNOON_SNACK",
    "DINNER",
    "EVENING_SNACK",
  ]),
  notes: z.string().optional().default(""),
  items: z.array(ItemSchema).min(1, "Minimal 1 bahan"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId") || undefined;
    const category = searchParams.get("category") || undefined;
    const q = searchParams.get("q") || undefined;

    const menus = await supabaseListSavedMenus({ patientId, category, q });

    // If empty, fall back to Prisma
    if (menus.length === 0) {
      try {
        const { db } = await import("@/lib/db");
        const where: {
          deletedAt: null;
          patientId?: string | null;
          category?: string;
          OR?: { name: { contains: string } }[];
        } = { deletedAt: null };
        if (patientId) where.patientId = patientId;
        if (category) where.category = category;
        if (q) where.OR = [{ name: { contains: q } }];

        const prismaMenus = await db.savedMenu.findMany({
          where,
          orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
          include: {
            items: { include: { food: { include: { category: true } } } },
          },
        });

        return ok(prismaMenus);
      } catch (e) {
        console.warn("[saved-menus GET] Prisma fallback failed:", e);
      }
    }

    return ok(menus);
  } catch (e) {
    return handleZod(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(CreateSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    const { data: menu, error: supaErr } = await supabaseCreateSavedMenu(d);

    if (supaErr || !menu) {
      // Prisma fallback
      console.warn("[saved-menus POST] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
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

        const prismaMenu = await db.savedMenu.create({
          data: {
            patientId: d.patientId || null,
            name: d.name,
            category: d.category,
            notes: d.notes,
            totalCal: Math.round(totals.cal * 10) / 10,
            totalProtein: Math.round(totals.protein * 10) / 10,
            totalFat: Math.round(totals.fat * 10) / 10,
            totalCarb: Math.round(totals.carb * 10) / 10,
            totalFiber: Math.round(totals.fiber * 10) / 10,
            totalSodium: Math.round(totals.sodium),
            totalPotassium: Math.round(totals.potassium),
            items: {
              create: d.items.map((it) => ({
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
            },
          },
          include: {
            items: { include: { food: { include: { category: true } } } },
          },
        });

        return ok(prismaMenu, 201);
      } catch (prismaErr: any) {
        return err(`Gagal menyimpan menu: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok(menu, 201);
  } catch (e) {
    return handleZod(e);
  }
}
