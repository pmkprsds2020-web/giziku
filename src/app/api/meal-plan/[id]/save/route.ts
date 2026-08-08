import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import {
  getServerClient,
  supabaseSaveMealPlanDraft,
  supabaseCreateSavedMealPlan,
} from "@/lib/supabase/data-layer";
import { processShoppingList } from "@/app/api/shopping/route";

// ---------------------------------------------------------------------
// POST /api/meal-plan/[id]/save
//
// Single entry point for the "Simpan Meal Plan" button. Everything the
// user changed in the draft (add/edit/delete food, change gram) is sent
// here in one request. Steps:
//   1. Apply the draft to meal_plan_items + write a history snapshot —
//      atomic via the fn_save_meal_plan_draft() Postgres function.
//   2. (best-effort) Add the saved plan to the Saved Meal Library.
//   3. (best-effort) Regenerate the Shopping Planner if one already
//      exists for this meal plan, so it never goes stale.
// Steps 2-3 are best-effort: if they fail, the core save (step 1) is
// NOT rolled back — the meal plan itself is already safely persisted.
// ---------------------------------------------------------------------

const ItemSchema = z.object({
  id: z.string().nullish(),
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
  cal: z.number().optional().default(0),
  protein: z.number().optional().default(0),
  fat: z.number().optional().default(0),
  carb: z.number().optional().default(0),
  fiber: z.number().optional().default(0),
  sodium: z.number().optional().default(0),
});

const SaveSchema = z.object({
  items: z.array(ItemSchema).default([]),
  deletedItemIds: z.array(z.string()).optional().default([]),
  name: z.string().optional().nullable(),
  saveToLibrary: z.boolean().optional().default(true),
  syncShopping: z.boolean().optional().default(true),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = safeParse(SaveSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    if (d.items.length === 0 && d.deletedItemIds.length === 0) {
      return err("Tidak ada perubahan untuk disimpan", 422);
    }

    // STEP 1 — atomic save (items + totals + history snapshot)
    const { data: plan, error: saveError } = await supabaseSaveMealPlanDraft(
      id,
      d.items,
      d.deletedItemIds,
      d.name ?? null,
    );

    if (saveError || !plan) {
      return err(saveError || "Gagal menyimpan meal plan", 500);
    }

    const warnings: string[] = [];

    // STEP 2 — best-effort: Saved Meal Library sync
    let savedLibraryPlan: any = null;
    if (d.saveToLibrary) {
      try {
        const { data: savedPlan, error: libError } = await supabaseCreateSavedMealPlan({
          patientId: plan.patientId,
          name: d.name?.trim() || `Meal Plan ${new Date().toLocaleDateString("id-ID")}`,
          totalCal: plan.totalCal,
          totalProtein: plan.totalProtein,
          totalFat: plan.totalFat,
          totalCarb: plan.totalCarb,
          totalFiber: plan.totalFiber,
          totalSodium: plan.totalSodium,
          notes: `Disimpan otomatis dari Meal Plan Editor (${new Date().toLocaleString("id-ID")})`,
          items: (plan.items || []).map((i: any) => ({
            slot: i.slot,
            foodId: i.foodId,
            amount: i.amount,
            cal: i.cal,
            protein: i.protein,
            fat: i.fat,
            carb: i.carb,
            fiber: i.fiber,
            sodium: i.sodium,
          })),
        });
        if (libError) {
          warnings.push(`Saved Meal Library: ${libError}`);
        } else {
          savedLibraryPlan = savedPlan;
        }
      } catch (e: any) {
        warnings.push(`Saved Meal Library: ${e?.message ?? "gagal sinkron"}`);
      }
    }

    // STEP 3 — best-effort: regenerate Shopping Planner if one exists
    let shoppingSynced = false;
    if (d.syncShopping) {
      try {
        const { client } = await getServerClient();
        const { data: existingList } = await client
          .from("shopping_lists")
          .select("id, period, multiplier")
          .eq("meal_plan_id", id)
          .maybeSingle();

        if (existingList) {
          const { data: itemRows } = await client
            .from("meal_plan_items")
            .select("food_id, amount, foods(id, name, price, protein)")
            .eq("meal_plan_id", id);

          const mappedItems = (itemRows || []).map((item: any) => ({
            foodId: item.food_id,
            amount: item.amount,
            food: item.foods
              ? { id: item.foods.id, name: item.foods.name, price: item.foods.price, protein: item.foods.protein }
              : null,
          }));

          await processShoppingList(
            id,
            plan.patientId,
            mappedItems,
            existingList.multiplier ?? 7,
            existingList.period ?? "WEEKLY",
            client,
          );
          shoppingSynced = true;
        }
      } catch (e: any) {
        warnings.push(`Shopping Planner: ${e?.message ?? "gagal sinkron"}`);
      }
    }

    return ok({
      plan,
      savedLibraryPlan,
      shoppingSynced,
      warnings,
    });
  } catch (e) {
    return handleZod(e);
  }
}
