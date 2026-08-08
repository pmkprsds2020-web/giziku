import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import {
  resolvePatientId,
  resolveFoodId,
  supabaseCreateSavedMealPlan,
  supabaseListSavedMealPlans,
} from "@/lib/supabase/data-layer";

const ItemSchema = z.object({
  slot: z.enum([
    "BREAKFAST",
    "MORNING_SNACK",
    "LUNCH",
    "AFTERNOON_SNACK",
    "DINNER",
    "EVENING_SNACK",
  ]),
  foodId: z.string().min(1),
  amount: z.number().min(0.1).max(5000),
  foodName: z.string().optional().default(""),
  urt: z.string().optional().nullable(),
  cal: z.number().optional().default(0),
  protein: z.number().optional().default(0),
  fat: z.number().optional().default(0),
  carb: z.number().optional().default(0),
  fiber: z.number().optional().default(0),
  sodium: z.number().optional().default(0),
  potassium: z.number().optional().default(0),
});

const CreateSchema = z.object({
  patientId: z.string().optional().nullable(),
  name: z.string().min(1, "Nama meal plan wajib diisi"),
  description: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  items: z.array(ItemSchema).min(1, "Minimal 1 bahan"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const q = searchParams.get("q");

    // Try Supabase first
    let plans: any[] = [];
    try {
      const resolvedId = patientId ? await resolvePatientId(patientId) : undefined;
      plans = await supabaseListSavedMealPlans(resolvedId);
    } catch (e) {
      console.warn("[saved-meal-plans GET] Supabase failed, trying Prisma:", e);
    }

    // Fall back to Prisma if Supabase returns nothing
    if (plans.length === 0) {
      const where: {
        deletedAt: null;
        patientId?: string;
        OR?: { name: { contains: string } }[];
      } = { deletedAt: null };
      if (patientId) where.patientId = patientId;
      if (q) where.OR = [{ name: { contains: q } }];

      plans = await db.savedMealPlan.findMany({
        where,
        orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
        include: {
          items: { include: { food: { include: { category: true } } } },
          _count: { select: { items: true } },
        },
      });
    }

    return ok(plans);
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

    // Resolve Prisma cuid → Supabase UUID for patientId and all foodIds in items
    const resolvedPatientId = d.patientId ? await resolvePatientId(d.patientId) : null;
    const resolvedItems = await Promise.all(
      d.items.map(async (it) => ({
        ...it,
        foodId: await resolveFoodId(it.foodId),
      })),
    );

    // Compute daily totals
    const totals = resolvedItems.reduce(
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

    // Use Supabase data layer instead of Prisma (avoids FK constraint issues)
    const { data: plan, error: planError } = await supabaseCreateSavedMealPlan({
      patientId: resolvedPatientId,
      name: d.name,
      totalCal: Math.round(totals.cal * 10) / 10,
      totalProtein: Math.round(totals.protein * 10) / 10,
      totalFat: Math.round(totals.fat * 10) / 10,
      totalCarb: Math.round(totals.carb * 10) / 10,
      totalFiber: Math.round(totals.fiber),
      totalSodium: Math.round(totals.sodium),
      compliance: 0,
      notes: d.notes || d.description || "",
      items: resolvedItems.map((it) => ({
        slot: it.slot,
        foodId: it.foodId,
        amount: it.amount,
        cal: it.cal,
        protein: it.protein,
        fat: it.fat,
        carb: it.carb,
        fiber: it.fiber,
        sodium: it.sodium,
      })),
    });

    if (planError) {
      if (planError.includes("Authentication required")) return err(planError, 401);
      return err(planError, 500);
    }

    return ok(plan, 201);
  } catch (e) {
    return handleZod(e);
  }
}
