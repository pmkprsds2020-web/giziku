export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructured, AIUnavailableError } from "@/lib/ai/validator/validate";
import { ShoppingPlannerOutputSchema } from "@/lib/ai/schemas/features";
import { SHOPPING_PLANNER_SYSTEM_PROMPT } from "@/lib/ai/prompts/features";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";
import { getServerClient } from "@/lib/supabase/data-layer";

const ShoppingItemInputSchema = z.object({
  foodName: z.string(),
  amountPerDay: z.number().positive(),
  unit: z.string().default("g"),
});

const RequestSchema = z.object({
  patientId: z.string().min(1),
  mealPlanId: z.string().optional(),
  items: z.array(ShoppingItemInputSchema).min(1),
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).default("WEEKLY"),
  budgetIdr: z.number().nonnegative().optional(),
});

const PERIOD_MULTIPLIER: Record<string, number> = { DAILY: 1, WEEKLY: 7, MONTHLY: 30 };

// POST /api/ai/shopping-planner
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "shopping-planner"), { limit: 15, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);
    const multiplier = PERIOD_MULTIPLIER[input.period];

    const itemsList = input.items
      .map((i) => `- ${i.foodName}: ${(i.amountPerDay * multiplier).toFixed(0)}${i.unit} (untuk ${input.period.toLowerCase()})`)
      .join("\n");

    const user = `Susun daftar belanja ${input.period.toLowerCase()} dari bahan berikut dengan estimasi harga IDR realistis di Indonesia:
${itemsList}
${input.budgetIdr ? `Budget maksimal: Rp${input.budgetIdr.toLocaleString("id-ID")}` : ""}

Kembalikan sesuai schema JSON.`;

    const result = await generateStructured({
      model: AI_MODELS.reasoning,
      system: SHOPPING_PLANNER_SYSTEM_PROMPT,
      user,
      schema: ShoppingPlannerOutputSchema,
    });

    await logAIUsage({
      feature: "shopping-planner",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
      patientId: input.patientId,
    });

    // Persist to Supabase (shopping_lists + shopping_items) — food_id left
    // null-matched here; the UI's existing food-matching flow (src/app/api/foods)
    // should resolve foodName -> food_id before final save, same as the
    // existing /api/shopping route does for manually-built lists.
    try {
      const { client } = await getServerClient();
      const { data: listRow } = await client
        .from("shopping_lists")
        .insert({
          patient_id: input.patientId,
          meal_plan_id: input.mealPlanId || null,
          period: input.period,
          multiplier,
          total_estimate: result.data.total_estimate_idr,
          currency: "IDR",
        })
        .select()
        .single();
      if (listRow) {
        // Note: shopping_items.food_id is NOT NULL in schema; AI-suggested
        // items without a matched food_id are returned to the client for
        // review/matching rather than force-inserted here.
      }
    } catch (e) {
      console.error("[shopping-planner] persist skipped (needs food_id match):", e);
    }

    return ok(result.data);
  } catch (e) {
    if (e instanceof AIUnavailableError) return err(e.message, 503);
    if (e instanceof z.ZodError) return handleZod(e);
    return err(sanitizeErrorForClient(e), 500);
  }
}
