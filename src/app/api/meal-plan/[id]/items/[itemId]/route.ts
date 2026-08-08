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
  supabaseUpdateMealItem,
  supabaseDeleteMealItem,
  supabaseUpdateMealPlanTotals,
} from "@/lib/supabase/data-layer";

const UpdateItemSchema = z.object({
  foodId: z.string().min(1).optional(),
  amount: z.number().min(1).max(1000).optional(),
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { id, itemId } = await params;
    const body = await req.json();
    const parsed = safeParse(UpdateItemSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    // Find existing item via Supabase
    const { client } = await getServerClient();
    const { data: existing, error: fetchErr } = await client
      .from("meal_plan_items")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();

    if (fetchErr || !existing || existing.meal_plan_id !== id) {
      // Prisma fallback
      try {
        const { db } = await import("@/lib/db");
        const prismaExisting = await db.mealPlanItem.findUnique({ where: { id: itemId } });
        if (!prismaExisting || prismaExisting.mealPlanId !== id) {
          return err("Item tidak ditemukan dalam meal plan ini", 404);
        }

        const foodId = d.foodId ?? prismaExisting.foodId;
        const amount = d.amount ?? prismaExisting.amount;

        const food = await db.food.findUnique({ where: { id: foodId } });
        if (!food) return err("Bahan makanan tidak ditemukan", 404);

        const nut = computeFoodNutrition(food, amount);
        const updated = await db.mealPlanItem.update({
          where: { id: itemId },
          data: {
            foodId,
            amount,
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
        return ok({ item: updated, totals: { ...totals, compliance } });
      } catch (prismaErr: any) {
        return err(`Gagal memperbarui item: ${prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    const foodId = d.foodId ? await resolveFoodId(d.foodId) : existing.food_id;
    const amount = d.amount ?? existing.amount;

    // Fetch food from Supabase to compute nutrition
    const food = await supabaseGetFood(foodId);
    if (!food) return err("Bahan makanan tidak ditemukan", 404);

    const nut = computeFoodNutrition(food, amount);

    const { data: updated, error: updateErr } = await supabaseUpdateMealItem(itemId, {
      foodId,
      amount,
      cal: nut.cal,
      protein: nut.protein,
      fat: nut.fat,
      carb: nut.carb,
      fiber: nut.fiber,
      sodium: nut.sodium,
    });

    if (updateErr || !updated) {
      // Prisma fallback
      console.warn("[meal-plan/[id]/items/[itemId] PUT] Supabase update failed, trying Prisma:", updateErr);
      try {
        const { db } = await import("@/lib/db");
        const prismaUpdated = await db.mealPlanItem.update({
          where: { id: itemId },
          data: {
            foodId,
            amount,
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
        return ok({ item: prismaUpdated, totals: { ...totals, compliance } });
      } catch (prismaErr: any) {
        return err(`Gagal memperbarui item: ${updateErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    const { totals, compliance } = await recalcPlanSupabase(id);
    return ok({ item: updated, totals: { ...totals, compliance } });
  } catch (e) {
    return handleZod(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { id, itemId } = await params;

    // Verify item exists & belongs to plan via Supabase
    const { client } = await getServerClient();
    const { data: existing } = await client
      .from("meal_plan_items")
      .select("id, meal_plan_id")
      .eq("id", itemId)
      .maybeSingle();

    if (!existing || existing.meal_plan_id !== id) {
      // Prisma fallback
      try {
        const { db } = await import("@/lib/db");
        const prismaExisting = await db.mealPlanItem.findUnique({ where: { id: itemId } });
        if (!prismaExisting || prismaExisting.mealPlanId !== id) {
          return err("Item tidak ditemukan", 404);
        }

        await db.mealPlanItem.delete({ where: { id: itemId } });
        const { totals, compliance } = await recalcPlanPrisma(id);
        return ok({ deleted: true, totals: { ...totals, compliance } });
      } catch (prismaErr: any) {
        return err(`Gagal menghapus item: ${prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    const { error: deleteErr } = await supabaseDeleteMealItem(itemId);

    if (deleteErr) {
      // Prisma fallback
      console.warn("[meal-plan/[id]/items/[itemId] DELETE] Supabase delete failed, trying Prisma:", deleteErr);
      try {
        const { db } = await import("@/lib/db");
        await db.mealPlanItem.delete({ where: { id: itemId } });
        const { totals, compliance } = await recalcPlanPrisma(id);
        return ok({ deleted: true, totals: { ...totals, compliance } });
      } catch (prismaErr: any) {
        return err(`Gagal menghapus item: ${deleteErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    const { totals, compliance } = await recalcPlanSupabase(id);
    return ok({ deleted: true, totals: { ...totals, compliance } });
  } catch (e) {
    return handleZod(e);
  }
}
