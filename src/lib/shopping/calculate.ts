// ---------------------------------------------------------------------
// CareLivia — Shopping Cost Calculation
//
// Single utility used by every module that estimates shopping cost
// (Shopping Planner generation, Shopping Planner live refresh, meal
// plan cost summaries, etc). This guarantees the same formula is used
// everywhere so Manajemen Harga and Shopping Planner can never drift
// apart because of two different calculations.
//
// Convention: `foods.price` is stored as price per 100g (see
// price-management-view.tsx label "Harga/100g" and the food_price_history
// table). All cost math must go through this file.
// ---------------------------------------------------------------------

export interface ShoppingIngredient {
  foodId: string;
  foodName: string;
  amountGrams: number;
  /** foods.price — price per 100g, from the Manajemen Harga source of truth */
  pricePer100g: number;
}

export interface ShoppingCostItem {
  foodId: string;
  foodName: string;
  amount: number; // grams, rounded
  unit: "g";
  estPrice: number; // IDR, rounded
  pricePer100g: number;
}

/**
 * Cost for a single ingredient amount, given the current price-per-100g
 * from the Database Bahan Makanan / Manajemen Harga source of truth.
 */
export function calculateShoppingCost(amountGrams: number, pricePer100g: number): number {
  if (!amountGrams || !pricePer100g) return 0;
  return Math.round((amountGrams / 100) * pricePer100g);
}

/**
 * Merge duplicate foods (e.g. "Ayam" appearing in breakfast, lunch and
 * dinner) into a single aggregated line, then price each line using the
 * live price-per-100g supplied by the caller (always read fresh from
 * `foods.price`, never from a cached/local snapshot).
 */
export function aggregateShoppingIngredients(
  raw: { foodId: string; foodName: string; amount: number; pricePer100g: number }[],
  multiplier: number,
): ShoppingCostItem[] {
  const agg = new Map<string, { foodName: string; amountGrams: number; pricePer100g: number }>();

  for (const item of raw) {
    if (!item.foodId) continue;
    const existing = agg.get(item.foodId);
    if (existing) {
      existing.amountGrams += item.amount * multiplier;
      // Always trust the latest price seen for this food (they should be
      // identical since they come from the same source-of-truth join).
      existing.pricePer100g = item.pricePer100g;
    } else {
      agg.set(item.foodId, {
        foodName: item.foodName,
        amountGrams: item.amount * multiplier,
        pricePer100g: item.pricePer100g,
      });
    }
  }

  return Array.from(agg.entries()).map(([foodId, v]) => ({
    foodId,
    foodName: v.foodName,
    amount: Math.round(v.amountGrams),
    unit: "g" as const,
    estPrice: calculateShoppingCost(v.amountGrams, v.pricePer100g),
    pricePer100g: v.pricePer100g,
  }));
}

export function sumShoppingTotal(items: { estPrice: number }[]): number {
  return items.reduce((s, i) => s + i.estPrice, 0);
}
