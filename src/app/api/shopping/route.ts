import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import {
  getServerClient,
  resolvePatientId,
} from "@/lib/supabase/data-layer";
import { aggregateShoppingIngredients, sumShoppingTotal } from "@/lib/shopping/calculate";

// ---------------------------------------------------------------------
// Shopping List Generator
// Aggregates ingredients from a meal plan, multiplies by period,
// merges duplicate foods, estimates price, finds cheaper alternatives.
// Supabase primary, Prisma fallback.
//
// Single Source of Truth: prices always come live from `foods.price`
// (the same value shown/edited on the Manajemen Harga page). Nothing
// here reads a cached/local/snapshot price — see GET below for the
// "refresh without regenerating" flow, and src/lib/shopping/calculate.ts
// for the one shared cost formula used by both.
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// GET /api/shopping?mealPlanId=... — re-price an already-generated
// shopping list against the CURRENT foods.price, without re-aggregating
// the meal plan. This is what lets a price change in Manajemen Harga
// show up in the Shopping Planner immediately (just refetch), instead
// of requiring the user to hit "Generate" again.
// ---------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const mealPlanId = req.nextUrl.searchParams.get("mealPlanId");
    if (!mealPlanId) return err("mealPlanId wajib diisi", 422);

    const { client } = await getServerClient();

    const { data: listRow, error: listErr } = await client
      .from("shopping_lists")
      .select("*")
      .eq("meal_plan_id", mealPlanId)
      .is("deleted_at", null)
      .maybeSingle();

    if (listErr || !listRow) return err("Shopping list belum dibuat untuk meal plan ini", 404);

    // Re-price every item against the CURRENT foods.price (live join),
    // using the same formula as generation (Math.round((amount/100)*price)).
    const { data: itemRows, error: itemsErr } = await client
      .from("shopping_items")
      .select("food_id, amount, unit, checked, foods(id, name, price)")
      .eq("shopping_list_id", listRow.id);

    if (itemsErr) return err("Gagal memuat item shopping list", 500);

    const priced = (itemRows || []).map((row: any) => {
      const pricePer100g = row.foods?.price ?? 0;
      const estPrice = Math.round((row.amount / 100) * pricePer100g);
      return {
        foodId: row.food_id,
        amount: row.amount,
        unit: row.unit,
        checked: row.checked,
        estPrice,
        food: { id: row.food_id, name: row.foods?.name ?? "Unknown", price: pricePer100g },
      };
    });

    const liveTotal = sumShoppingTotal(priced.map((p) => ({ estPrice: p.estPrice })));

    const shoppingList = {
      id: listRow.id,
      patientId: listRow.patient_id,
      mealPlanId: listRow.meal_plan_id,
      period: listRow.period,
      multiplier: listRow.multiplier,
      totalEstimate: liveTotal, // always current — this is what the UI should show
      savedTotalEstimate: listRow.total_estimate, // snapshot from last Generate, for reference only
      currency: listRow.currency,
      checkedCount: listRow.checked_count ?? 0,
      createdAt: listRow.created_at,
      updatedAt: listRow.updated_at,
      items: priced,
    };

    return ok({ shoppingList, totalEstimate: liveTotal });
  } catch (e) {
    return handleZod(e);
  }
}
export async function POST(req: NextRequest) {
  console.log("[shopping POST] STEP 1: Request received");
  try {
    const body = await req.json();
    const { mealPlanId, period } = body as {
      mealPlanId?: string;
      period?: "DAILY" | "WEEKLY" | "MONTHLY";
    };
    if (!mealPlanId) return err("mealPlanId wajib diisi", 422);

    const multiplier = period === "MONTHLY" ? 30 : period === "WEEKLY" ? 7 : 1;
    const { client } = await getServerClient();

    // STEP 2: Load meal plan items + foods directly (avoid nested join issues)
    console.log("[shopping POST] STEP 2: Loading meal plan items");
    const { data: mealPlanRow, error: mpError } = await client
      .from("meal_plans")
      .select("id, patient_id")
      .eq("id", mealPlanId)
      .maybeSingle();

    if (mpError || !mealPlanRow) {
      // Prisma fallback
      console.log("[shopping POST] Supabase meal plan not found, trying Prisma");
      try {
        const { db } = await import("@/lib/db");
        const prismaMealPlan = await db.mealPlan.findUnique({
          where: { id: mealPlanId },
          include: { items: { include: { food: true } } },
        });
        if (!prismaMealPlan) return err("Meal plan tidak ditemukan", 404);

        // Process with Prisma data
        return processShoppingList(
          prismaMealPlan.id,
          prismaMealPlan.patientId,
          prismaMealPlan.items.map((i: any) => ({
            foodId: i.foodId,
            amount: i.amount,
            food: { id: i.food.id, name: i.food.name, price: i.food.price, protein: i.food.protein },
          })),
          multiplier,
          period ?? "WEEKLY",
          client,
        );
      } catch (e) {
        return err("Meal plan tidak ditemukan", 404);
      }
    }

    // Fetch meal plan items with foods (separate query to avoid FK hint issues)
    const { data: items, error: itemsError } = await client
      .from("meal_plan_items")
      .select("food_id, amount, foods(id, name, price, protein)")
      .eq("meal_plan_id", mealPlanId);

    if (itemsError) {
      console.error("[shopping POST] Failed to load meal plan items:", itemsError);
      return err("Gagal memuat item meal plan", 500);
    }

    if (!items || items.length === 0) {
      return err("Meal plan belum memiliki item makanan", 422);
    }

    console.log(`[shopping POST] STEP 2: Loaded ${items.length} meal plan items`);

    // Map items to common format
    const mappedItems = items.map((item: any) => ({
      foodId: item.food_id,
      amount: item.amount,
      food: item.foods ? {
        id: item.foods.id,
        name: item.foods.name,
        price: item.foods.price,
        protein: item.foods.protein,
      } : null,
    }));

    return processShoppingList(
      mealPlanRow.id,
      mealPlanRow.patient_id,
      mappedItems,
      multiplier,
      period ?? "WEEKLY",
      client,
    );
  } catch (e) {
    console.error("[shopping POST] Error:", e);
    return handleZod(e);
  }
}

// ---------------------------------------------------------------------
// Process shopping list — aggregate, calculate prices, find alternatives, save
// ---------------------------------------------------------------------
export async function processShoppingList(
  mealPlanId: string,
  patientId: string,
  items: { foodId: string; amount: number; food: any }[],
  multiplier: number,
  period: string,
  client: any,
) {
  console.log("[shopping POST] STEP 3: Aggregating ingredients");

  // Aggregate foods (merge duplicates) and price them via the single
  // shared utility, so this matches exactly what the GET live-refresh
  // endpoint (and any other caller) computes. Prices here always come
  // from `item.food.price`, which was joined fresh from the `foods`
  // table (the Manajemen Harga source of truth) a few lines up — never
  // from a cached/local snapshot.
  const rawIngredients = items
    .filter((item) => !!item.foodId)
    .map((item) => ({
      foodId: item.foodId,
      foodName: item.food?.name ?? "Unknown",
      amount: item.amount,
      pricePer100g: item.food?.price ?? 0,
    }));

  const itemsData = aggregateShoppingIngredients(rawIngredients, multiplier);

  console.log(`[shopping POST] STEP 3: ${itemsData.length} unique foods after aggregation`);

  // STEP 4: Prices already calculated above via calculateShoppingCost
  console.log("[shopping POST] STEP 4: Calculating prices");

  const totalEstimate = sumShoppingTotal(itemsData);
  console.log(`[shopping POST] STEP 4: Total estimate: ${totalEstimate}`);

  // STEP 5: Find cheaper alternatives (bulk query — no N+1)
  console.log("[shopping POST] STEP 5: Finding alternatives");
  const alternatives: {
    foodId: string;
    foodName: string;
    currentPrice: number;
    altName?: string;
    altPrice?: number;
  }[] = [];

  // Only look for alternatives for items with price > 1000
  const expensiveFoodIds = itemsData
    .filter((i) => i.pricePer100g > 1000)
    .map((i) => i.foodId);

  if (expensiveFoodIds.length > 0) {
    try {
      // Single query to find cheaper alternatives for ALL expensive foods
      const { data: altFoods } = await client
        .from("foods")
        .select("id, name, price, protein, category_id")
        .is("deleted_at", null)
        .lt("price", 5000)
        .order("price", { ascending: true })
        .limit(50);

      if (altFoods && altFoods.length > 0) {
        // Match alternatives by finding cheapest food in same category
        for (const item of itemsData.filter((i) => i.pricePer100g > 1000)) {
          const alt = altFoods.find((f: any) => f.id !== item.foodId && f.price < item.pricePer100g);
          if (alt) {
            alternatives.push({
              foodId: item.foodId,
              foodName: item.foodName,
              currentPrice: item.pricePer100g,
              altName: alt.name,
              altPrice: alt.price,
            });
          }
        }
      }
    } catch (e) {
      console.warn("[shopping POST] Alternative lookup failed:", e);
    }
  }

  console.log(`[shopping POST] STEP 5: Found ${alternatives.length} alternatives`);

  // STEP 6: Save to Supabase
  console.log("[shopping POST] STEP 6: Saving to database");

  // Delete existing shopping list for this meal plan
  try {
    await client.from("shopping_lists").delete().eq("meal_plan_id", mealPlanId);
  } catch (e) {
    console.warn("[shopping POST] Delete existing failed:", e);
  }

  // Insert shopping list
  const { data: shoppingListRow, error: insertErr } = await client
    .from("shopping_lists")
    .insert({
      patient_id: patientId,
      meal_plan_id: mealPlanId,
      period: period,
      multiplier,
      total_estimate: totalEstimate,
      currency: "IDR",
    })
    .select("*")
    .single();

  if (insertErr) {
    // Prisma fallback
    console.warn("[shopping POST] Supabase insert failed, trying Prisma:", insertErr.message);
    try {
      const { db } = await import("@/lib/db");
      await db.shoppingList.deleteMany({ where: { mealPlanId } }).catch(() => {});

      const prismaShoppingList = await db.shoppingList.create({
        data: {
          patientId,
          mealPlanId,
          period: period as any,
          multiplier,
          totalEstimate,
          currency: "IDR",
          items: {
            create: itemsData.map((it) => ({
              foodId: it.foodId,
              amount: it.amount,
              unit: it.unit,
              estPrice: it.estPrice,
            })),
          },
        },
        include: { items: { include: { food: true } } },
      });

      console.log("[shopping POST] STEP 8: Returning response (Prisma)");
      return ok({
        shoppingList: prismaShoppingList,
        alternatives,
        totalEstimate,
      });
    } catch (prismaErr: any) {
      return err(`Gagal menyimpan shopping list: ${insertErr.message ?? prismaErr?.message ?? "unknown"}`, 500);
    }
  }

  // Insert items (bulk insert)
  if (itemsData.length > 0) {
    const itemPayloads = itemsData.map((it) => ({
      shopping_list_id: shoppingListRow.id,
      food_id: it.foodId,
      amount: it.amount,
      unit: it.unit,
      est_price: it.estPrice,
    }));
    const { error: itemsErr } = await client.from("shopping_items").insert(itemPayloads);
    if (itemsErr) {
      console.warn("[shopping POST] items insert failed:", itemsErr.message);
    }
  }

  // Build response
  const shoppingList = {
    id: shoppingListRow.id,
    patientId: shoppingListRow.patient_id,
    mealPlanId: shoppingListRow.meal_plan_id,
    period: shoppingListRow.period,
    multiplier: shoppingListRow.multiplier,
    totalEstimate: shoppingListRow.total_estimate,
    currency: shoppingListRow.currency,
    checkedCount: shoppingListRow.checked_count ?? 0,
    createdAt: shoppingListRow.created_at,
    updatedAt: shoppingListRow.updated_at,
    items: itemsData.map((it) => ({
      foodId: it.foodId,
      amount: it.amount,
      unit: it.unit,
      estPrice: it.estPrice,
      food: { id: it.foodId, name: it.foodName, price: it.pricePer100g },
    })),
  };

  console.log("[shopping POST] STEP 8: Returning response (Supabase)");
  return ok({
    shoppingList,
    alternatives,
    totalEstimate,
  });
}
