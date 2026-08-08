import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import { getServerClient, supabaseGetPatient, resolvePatientId } from "@/lib/supabase/data-layer";

const RunComparisonSchema = z.object({
  patientId: z.string().min(1),
  date: z.string(), // ISO date for food records
  mealPlanId: z.string().optional(),
  savedMenuId: z.string().optional(),
  savedMealPlanId: z.string().optional(),
});

// Compute food-level comparison: matched, replaced, removed, added
function compareFoods(
  planItems: { foodId: string; foodName: string; amount: number }[],
  recordItems: { foodId: string; foodName: string; amount: number }[],
) {
  const planMap = new Map(planItems.map((i) => [i.foodId, i]));
  const recordMap = new Map(recordItems.map((i) => [i.foodId, i]));

  const matched: { foodName: string; planAmount: number; recordAmount: number }[] = [];
  const replaced: { planFood: string; recordFood: string }[] = [];
  const removed: { foodName: string; amount: number }[] = [];
  const added: { foodName: string; amount: number }[] = [];

  for (const [foodId, planItem] of planMap) {
    if (recordMap.has(foodId)) {
      const recordItem = recordMap.get(foodId)!;
      matched.push({
        foodName: planItem.foodName,
        planAmount: planItem.amount,
        recordAmount: recordItem.amount,
      });
    } else {
      removed.push({ foodName: planItem.foodName, amount: planItem.amount });
    }
  }

  for (const [foodId, recordItem] of recordMap) {
    if (!planMap.has(foodId)) {
      added.push({ foodName: recordItem.foodName, amount: recordItem.amount });
    }
  }

  if (removed.length > 0 && added.length > 0) {
    const minLen = Math.min(removed.length, added.length);
    for (let i = 0; i < minLen; i++) {
      replaced.push({
        planFood: removed[i].foodName,
        recordFood: added[i].foodName,
      });
    }
    removed.splice(0, minLen);
    added.splice(0, minLen);
  }

  return { matched, replaced, removed, added };
}

// Generate AI insight via z-ai-web-dev-sdk
async function generateAIInsight(
  nutrientComparison: { label: string; target: number; actual: number; pct: number; diff: number }[],
  foodComparison: { matched: any[]; replaced: any[]; removed: any[]; added: any[] },
  complianceScore: number,
  patientName: string,
): Promise<string> {
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const nutrientSummary = nutrientComparison
      .map((n) => `${n.label}: target ${Math.round(n.target)}, aktual ${Math.round(n.actual)} (${n.pct}%, selisih ${n.diff > 0 ? "+" : ""}${Math.round(n.diff)})`)
      .join("; ");

    const foodSummary = `Cocok: ${foodComparison.matched.length}, Diganti: ${foodComparison.replaced.length}, Dihapus: ${foodComparison.removed.length}, Tambahan: ${foodComparison.added.length}`;

    const replacedDetail = foodComparison.replaced
      .map((r) => `${r.planFood} → ${r.recordFood}`)
      .join(", ");

    const prompt = `Anda adalah ahli gizi klinis. Berikan analisis singkat (maks 150 kata) dalam Bahasa Indonesia tentang perbandingan meal plan vs food record pasien ${patientName}.

Compliance: ${complianceScore}%
Nutrisi: ${nutrientSummary}
Makanan: ${foodSummary}
${replacedDetail ? `Penggantian: ${replacedDetail}` : ""}

Format: 3-5 bullet point insight singkat tentang kesesuaian, kekurangan, kelebihan, dan rekomendasi.`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content:
            "Anda ahli gizi klinis CareLivia. Berikan analisis perbandingan meal plan vs food record dengan ringkas, profesional, dan actionable.",
        },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });

    return (
      completion.choices[0]?.message?.content ||
      `Compliance ${complianceScore}%. Analisis AI tidak tersedia.`
    );
  } catch (e) {
    console.error("[AI Insight] error:", e);
    const gaps = nutrientComparison.filter((n) => n.pct < 85 && n.label !== "Natrium");
    const excess = nutrientComparison.filter((n) => n.pct > 110 && n.label !== "Natrium");
    const sodiumExcess = nutrientComparison.find((n) => n.label === "Natrium" && n.pct > 100);

    const insights: string[] = [`Kepatuhan terhadap Meal Plan mencapai ${complianceScore}%.`];
    if (gaps.length > 0) {
      insights.push(`${gaps.map((g) => `${g.label} kurang ${Math.abs(Math.round(g.diff))}`).join(", ")}.`);
    }
    if (excess.length > 0) {
      insights.push(`${excess.map((e) => `${e.label} berlebih ${Math.round(e.diff)}`).join(", ")}.`);
    }
    if (sodiumExcess) {
      insights.push(`Natrium melebihi target sebesar ${Math.round(sodiumExcess.diff)} mg.`);
    }
    if (foodComparison.replaced.length > 0) {
      insights.push(`Terdapat ${foodComparison.replaced.length} penggantian makanan.`);
    }
    return insights.join(" ");
  }
}

// ---------------------------------------------------------------------
// GET /api/comparisons?patientId=...
// Reads comparison history from Supabase.
// ---------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    if (!patientId) return err("patientId wajib diisi", 422);

    const resolvedPatientId = await resolvePatientId(patientId);
    const { client } = await getServerClient();
    const { data, error } = await client
      .from("comparison_history")
      .select("*")
      .eq("patient_id", resolvedPatientId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.warn("[comparisons] Supabase list failed, falling back to Prisma:", error.message);
      try {
        const { db } = await import("@/lib/db");
        const history = await db.comparisonHistory.findMany({
          where: { patientId },
          orderBy: { createdAt: "desc" },
          take: 20,
        });
        return ok(history.map((h) => ({ ...h, results: h.results ? JSON.parse(h.results) : null })));
      } catch {
        return ok([]);
      }
    }

    return ok(
      (data || []).map((h: any) => ({
        id: h.id,
        patientId: h.patient_id,
        mealPlanId: h.meal_plan_id,
        savedMenuName: h.saved_menu_name,
        foodRecordDate: h.food_record_date,
        complianceScore: h.compliance_score,
        results: h.results ?? null,
        aiInsight: h.ai_insight,
        createdAt: h.created_at,
      })),
    );
  } catch (e) {
    return handleZod(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(RunComparisonSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    const resolvedPatientId = await resolvePatientId(d.patientId);
    const { client } = await getServerClient();

    let patient: any = await supabaseGetPatient(resolvedPatientId);
    if (!patient) {
      try {
        const { db } = await import("@/lib/db");
        patient = await db.patient.findUnique({ where: { id: d.patientId } });
      } catch (e) {
        console.warn("[comparisons] Prisma patient fallback failed:", e);
      }
    }
    if (!patient) return err("Pasien tidak ditemukan", 404);

    let planItems: {
      foodId: string;
      foodName: string;
      amount: number;
      cal: number;
      protein: number;
      fat: number;
      carb: number;
      fiber: number;
      sodium: number;
      potassium: number;
    }[] = [];
    let planName = "";
    let planTargets = { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0, potassium: 0 };

    if (d.mealPlanId) {
      const { data: plan } = await client
        .from("meal_plans")
        .select("*, meal_plan_items(*, foods(*)), nutrition_presets(name)")
        .eq("id", d.mealPlanId)
        .single();
      if (!plan) return err("Meal plan tidak ditemukan", 404);
      planName = plan.nutrition_presets?.name || `Meal Plan ${new Date(plan.date).toLocaleDateString("id-ID")}`;
      planTargets = {
        cal: plan.target_cal,
        protein: plan.target_protein,
        fat: plan.target_fat,
        carb: plan.target_carb,
        fiber: plan.target_fiber,
        sodium: plan.target_sodium,
        potassium: 0,
      };
      planItems = (plan.meal_plan_items || []).map((i: any) => ({
        foodId: i.food_id,
        foodName: i.foods?.name ?? "",
        amount: i.amount,
        cal: i.cal,
        protein: i.protein,
        fat: i.fat,
        carb: i.carb,
        fiber: i.fiber,
        sodium: i.sodium,
        potassium: (i.foods?.potassium ?? 0) * (i.amount / 100),
      }));
    } else if (d.savedMealPlanId) {
      const { data: savedPlan } = await client
        .from("saved_meal_plans")
        .select("*, saved_meal_plan_items(*)")
        .eq("id", d.savedMealPlanId)
        .single();
      if (!savedPlan) return err("Saved meal plan tidak ditemukan", 404);
      planName = savedPlan.name;
      planTargets = {
        cal: savedPlan.total_cal,
        protein: savedPlan.total_protein,
        fat: savedPlan.total_fat,
        carb: savedPlan.total_carb,
        fiber: savedPlan.total_fiber,
        sodium: savedPlan.total_sodium,
        potassium: savedPlan.total_potassium,
      };
      planItems = (savedPlan.saved_meal_plan_items || []).map((i: any) => ({
        foodId: i.food_id,
        foodName: i.food_name,
        amount: i.amount,
        cal: i.cal,
        protein: i.protein,
        fat: i.fat,
        carb: i.carb,
        fiber: i.fiber,
        sodium: i.sodium,
        potassium: i.potassium,
      }));
    } else if (d.savedMenuId) {
      const { data: menu } = await client
        .from("saved_menus")
        .select("*, saved_menu_items(*)")
        .eq("id", d.savedMenuId)
        .single();
      if (!menu) return err("Saved menu tidak ditemukan", 404);
      planName = menu.name;
      planTargets = {
        cal: menu.total_cal,
        protein: menu.total_protein,
        fat: menu.total_fat,
        carb: menu.total_carb,
        fiber: menu.total_fiber,
        sodium: menu.total_sodium,
        potassium: menu.total_potassium,
      };
      planItems = (menu.saved_menu_items || []).map((i: any) => ({
        foodId: i.food_id,
        foodName: i.food_name,
        amount: i.amount,
        cal: i.cal,
        protein: i.protein,
        fat: i.fat,
        carb: i.carb,
        fiber: i.fiber,
        sodium: i.sodium,
        potassium: i.potassium,
      }));
    } else {
      return err("mealPlanId, savedMenuId, atau savedMealPlanId wajib diisi", 422);
    }

    // Get food records for the date
    const recordDate = new Date(d.date);
    const dayStart = new Date(recordDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(recordDate);
    dayEnd.setHours(23, 59, 59, 999);

    const { data: records } = await client
      .from("food_records")
      .select("*, foods(*)")
      .eq("patient_id", resolvedPatientId)
      .gte("date", dayStart.toISOString())
      .lte("date", dayEnd.toISOString());

    const recordItems = (records || []).map((r: any) => ({
      foodId: r.food_id,
      foodName: r.foods?.name ?? "",
      amount: r.amount,
      cal: r.cal,
      protein: r.protein,
      fat: r.fat,
      carb: r.carb,
      fiber: r.fiber,
      sodium: r.sodium,
      potassium: (r.foods?.potassium ?? 0) * (r.amount / 100),
    }));

    const actualTotals = recordItems.reduce(
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

    const nutrientComparison = [
      { label: "Energi", target: planTargets.cal, actual: actualTotals.cal, unit: "kcal" },
      { label: "Protein", target: planTargets.protein, actual: actualTotals.protein, unit: "g" },
      { label: "Lemak", target: planTargets.fat, actual: actualTotals.fat, unit: "g" },
      { label: "Karbohidrat", target: planTargets.carb, actual: actualTotals.carb, unit: "g" },
      { label: "Serat", target: planTargets.fiber, actual: actualTotals.fiber, unit: "g" },
      { label: "Natrium", target: planTargets.sodium, actual: actualTotals.sodium, unit: "mg" },
    ].map((n) => ({
      ...n,
      pct: n.target > 0 ? Math.round((n.actual / n.target) * 100) : 0,
      diff: Math.round((n.actual - n.target) * 10) / 10,
    }));

    const complianceScore = Math.round(
      (nutrientComparison.reduce((sum, n) => {
        if (n.label === "Natrium") {
          return sum + (n.actual <= n.target ? 1 : n.target / Math.max(n.actual, 1));
        }
        return sum + Math.min(n.actual, n.target) / Math.max(n.target, 1);
      }, 0) / nutrientComparison.length) * 100,
    );

    const foodComparison = compareFoods(
      planItems.map((i) => ({ foodId: i.foodId, foodName: i.foodName, amount: i.amount })),
      recordItems.map((i) => ({ foodId: i.foodId, foodName: i.foodName, amount: i.amount })),
    );

    const aiInsight = await generateAIInsight(
      nutrientComparison,
      foodComparison,
      complianceScore,
      patient.name,
    );

    const results = {
      planName,
      planTargets,
      actualTotals: {
        cal: Math.round(actualTotals.cal),
        protein: Math.round(actualTotals.protein),
        fat: Math.round(actualTotals.fat),
        carb: Math.round(actualTotals.carb),
        fiber: Math.round(actualTotals.fiber),
        sodium: Math.round(actualTotals.sodium),
        potassium: Math.round(actualTotals.potassium),
      },
      nutrientComparison,
      foodComparison,
      recordCount: recordItems.length,
      planItemCount: planItems.length,
    };

    const { data: history, error: historyError } = await client
      .from("comparison_history")
      .insert({
        patient_id: resolvedPatientId,
        meal_plan_id: d.mealPlanId || null,
        saved_menu_name: d.savedMenuId ? planName : d.savedMealPlanId ? planName : null,
        food_record_date: recordDate.toISOString(),
        compliance_score: complianceScore,
        results,
        ai_insight: aiInsight,
      })
      .select()
      .single();

    if (historyError) {
      console.warn("[comparisons] Failed to save history to Supabase:", historyError.message);
    }

    return ok({
      historyId: history?.id ?? null,
      complianceScore,
      nutrientComparison,
      foodComparison,
      aiInsight,
      results,
    });
  } catch (e) {
    return handleZod(e);
  }
}
