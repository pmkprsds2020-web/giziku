import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { computeFoodNutrition, computeCompliance } from "@/lib/clinical/calorie-engine";
import { z } from "zod";
import {
  resolveFoodId,
  getServerClient,
  supabaseGetFood,
  supabaseGetMealPlan,
  supabaseListMealItems,
  supabaseAddMealItem,
  supabaseUpdateMealPlanTotals,
} from "@/lib/supabase/data-layer";

const AddItemSchema = z.object({
  slot: z.enum([
    "BREAKFAST",
    "MORNING_SNACK",
    "LUNCH",
    "AFTERNOON_SNACK",
    "DINNER",
    "EVENING_SNACK",
  ]),
  foodId: z.string().min(1),
  amount: z.number().min(1).max(1000),
});

// Recalculate meal plan totals + compliance from items (Supabase)
// Uses lightweight direct query instead of supabaseGetMealPlan (avoids nested joins)
async function recalcPlanSupabase(mealPlanId: string) {
  const items = await supabaseListMealItems(mealPlanId);
  const totals = items.reduce(
    (acc: any, i: any) => ({
      cal: acc.cal + Number(i.cal) || 0,
      protein: acc.protein + Number(i.protein) || 0,
      fat: acc.fat + Number(i.fat) || 0,
      carb: acc.carb + Number(i.carb) || 0,
      fiber: acc.fiber + Number(i.fiber) || 0,
      sodium: acc.sodium + Number(i.sodium) || 0,
    }),
    { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0 },
  );

  // Fetch only the target fields (lightweight, no joins)
  const { client } = await getServerClient();
  const { data: plan } = await client
    .from("meal_plans")
    .select("target_cal, target_protein, target_fat, target_carb, target_fiber, target_sodium")
    .eq("id", mealPlanId)
    .maybeSingle();

  let compliance = 0;
  if (plan) {
    compliance = computeCompliance(
      {
        cal: totals.cal,
        protein: totals.protein,
        fat: totals.fat,
        carb: totals.carb,
        fiber: totals.fiber,
        sodium: totals.sodium,
      },
      {
        cal: plan.target_cal,
        protein: plan.target_protein,
        fat: plan.target_fat,
        carb: plan.target_carb,
        fiber: plan.target_fiber,
        sodiumMax: plan.target_sodium,
      },
    );
  }

  await supabaseUpdateMealPlanTotals(mealPlanId, { ...totals, compliance });
  return { totals, compliance };
}

// Recalculate via Prisma fallback
async function recalcPlanPrisma(mealPlanId: string) {
  const { db } = await import("@/lib/db");
  const items = await db.mealPlanItem.findMany({
    where: { mealPlanId },
    include: { food: true },
  });
  const totals = items.reduce(
    (acc, i) => ({
      cal: acc.cal + i.cal,
      protein: acc.protein + i.protein,
      fat: acc.fat + i.fat,
      carb: acc.carb + i.carb,
      fiber: acc.fiber + i.fiber,
      sodium: acc.sodium + i.sodium,
    }),
    { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0 },
  );

  const plan = await db.mealPlan.findUnique({ where: { id: mealPlanId } });
  let compliance = 0;
  if (plan) {
    compliance = computeCompliance(
      {
        cal: totals.cal,
        protein: totals.protein,
        fat: totals.fat,
        carb: totals.carb,
        fiber: totals.fiber,
        sodium: totals.sodium,
      },
      {
        cal: plan.targetCal,
        protein: plan.targetProtein,
        fat: plan.targetFat,
        carb: plan.targetCarb,
        fiber: plan.targetFiber,
        sodiumMax: plan.targetSodium,
      },
    );
  }

  await db.mealPlan.update({
    where: { id: mealPlanId },
    data: {
      totalCal: Math.round(totals.cal),
      totalProtein: Math.round(totals.protein),
      totalFat: Math.round(totals.fat),
      totalCarb: Math.round(totals.carb),
      totalFiber: Math.round(totals.fiber),
      totalSodium: Math.round(totals.sodium),
      compliance,
    },
  });
  return { totals, compliance };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = safeParse(AddItemSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    const resolvedFoodId = await resolveFoodId(d.foodId);

    // Verify meal plan exists in Supabase
    let plan = await supabaseGetMealPlan(id);

    if (!plan) {
      // Prisma fallback
      try {
        const { db } = await import("@/lib/db");
        const prismaPlan = await db.mealPlan.findUnique({ where: { id } });
        if (!prismaPlan) return err("Meal plan tidak ditemukan", 404);

        const food = await db.food.findUnique({ where: { id: resolvedFoodId } });
        if (!food) return err("Bahan makanan tidak ditemukan", 404);

        const nut = computeFoodNutrition(food, d.amount);

        const item = await db.mealPlanItem.create({
          data: {
            mealPlanId: id,
            slot: d.slot,
            foodId: resolvedFoodId,
            amount: d.amount,
            cal: nut.cal,
            protein: nut.protein,
            fat: nut.fat,
            carb: nut.carb,
            fiber: nut.fiber,
            sodium: nut.sodium,
          },
          include: { food: true },
        });

        const { totals, compliance } = await recalcPlanPrisma(id);

        return ok({ item, totals: { ...totals, compliance } }, 201);
      } catch (prismaErr: any) {
        return err(`Gagal menambahkan item: ${prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    // Fetch food from Supabase
    const food = await supabaseGetFood(resolvedFoodId);
    if (!food) return err("Bahan makanan tidak ditemukan", 404);

    const nut = computeFoodNutrition(food, d.amount);

    const { data: item, error: supaErr } = await supabaseAddMealItem(id, {
      slot: d.slot,
      foodId: resolvedFoodId,
      amount: d.amount,
      cal: nut.cal,
      protein: nut.protein,
      fat: nut.fat,
      carb: nut.carb,
      fiber: nut.fiber,
      sodium: nut.sodium,
    });

    if (supaErr || !item) {
      // Prisma fallback
      console.warn("[meal-plan/[id]/items POST] Supabase add failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const prismaItem = await db.mealPlanItem.create({
          data: {
            mealPlanId: id,
            slot: d.slot,
            foodId: resolvedFoodId,
            amount: d.amount,
            cal: nut.cal,
            protein: nut.protein,
            fat: nut.fat,
            carb: nut.carb,
            fiber: nut.fiber,
            sodium: nut.sodium,
          },
          include: { food: true },
        });

        const { totals, compliance } = await recalcPlanPrisma(id);
        return ok({ item: prismaItem, totals: { ...totals, compliance } }, 201);
      } catch (prismaErr: any) {
        return err(`Gagal menambahkan item: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    const { totals, compliance } = await recalcPlanSupabase(id);
    return ok({ item, totals: { ...totals, compliance } }, 201);
  } catch (e) {
    return handleZod(e);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const items = await supabaseListMealItems(id);

    // If empty, try Prisma fallback
    if (items.length === 0) {
      try {
        const { db } = await import("@/lib/db");
        const prismaItems = await db.mealPlanItem.findMany({
          where: { mealPlanId: id },
          include: { food: true },
          orderBy: { createdAt: "asc" },
        });
        return ok(prismaItems);
      } catch (e) {
        console.warn("[meal-plan/[id]/items GET] Prisma fallback failed:", e);
      }
    }

    return ok(items);
  } catch (e) {
    return handleZod(e);
  }
}
