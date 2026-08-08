import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import {
  getServerClient,
  resolvePatientId,
} from "@/lib/supabase/data-layer";

// GET /api/compliance/weekly?patientId=xxx
// Returns 7-day compliance history: for each day, total intake vs latest meal plan target
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    if (!patientId) return err("patientId wajib diisi", 422);

    const resolvedPatientId = await resolvePatientId(patientId);
    const { client } = await getServerClient();

    // Get latest meal plan for target
    const { data: latestPlanRow, error: planErr } = await client
      .from("meal_plans")
      .select("*, nutrition_presets(name)")
      .eq("patient_id", resolvedPatientId)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    let latestPlan: any = latestPlanRow;
    let presetName: string | null = latestPlanRow?.nutrition_presets?.name ?? null;

    if (planErr || !latestPlan) {
      // Prisma fallback
      try {
        const { db } = await import("@/lib/db");
        const prismaPlan = await db.mealPlan.findFirst({
          where: { patientId, deletedAt: null },
          orderBy: { date: "desc" },
          include: { preset: true },
        });
        if (!prismaPlan) return ok({ hasPlan: false, days: [] });
        latestPlan = {
          id: prismaPlan.id,
          date: prismaPlan.date,
          target_cal: prismaPlan.targetCal,
          target_protein: prismaPlan.targetProtein,
          target_fat: prismaPlan.targetFat,
          target_carb: prismaPlan.targetCarb,
          target_fiber: prismaPlan.targetFiber,
          target_sodium: prismaPlan.targetSodium,
        };
        presetName = prismaPlan.preset?.name ?? null;
      } catch (e) {
        return ok({ hasPlan: false, days: [] });
      }
    }

    if (!latestPlan) return ok({ hasPlan: false, days: [] });

    const target = {
      cal: latestPlan.target_cal,
      protein: latestPlan.target_protein,
      fat: latestPlan.target_fat,
      carb: latestPlan.target_carb,
      fiber: latestPlan.target_fiber,
      sodium: latestPlan.target_sodium,
    };

    // Build 7-day window
    const days: any[] = [];
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: dayRecords } = await client
        .from("food_records")
        .select("cal, protein, fat, carb, fiber, sodium")
        .eq("patient_id", resolvedPatientId)
        .gte("date", dayStart.toISOString())
        .lte("date", dayEnd.toISOString());

      let records: any[] = dayRecords || [];

      // If no records found, try Prisma fallback for this day
      if (records.length === 0) {
        try {
          const { db } = await import("@/lib/db");
          const prismaRecords = await db.foodRecord.findMany({
            where: {
              patientId,
              date: { gte: dayStart, lte: dayEnd },
            },
          });
          records = prismaRecords.map((r) => ({
            cal: r.cal,
            protein: r.protein,
            fat: r.fat,
            carb: r.carb,
            fiber: r.fiber,
            sodium: r.sodium,
          }));
        } catch (e) {
          // ignore
        }
      }

      const totals = records.reduce(
        (acc, r) => ({
          cal: acc.cal + (r.cal || 0),
          protein: acc.protein + (r.protein || 0),
          fat: acc.fat + (r.fat || 0),
          carb: acc.carb + (r.carb || 0),
          fiber: acc.fiber + (r.fiber || 0),
          sodium: acc.sodium + (r.sodium || 0),
        }),
        { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0 },
      );

      // Daily compliance
      const ratios = [
        target.cal > 0 ? Math.min(totals.cal, target.cal) / target.cal : 0,
        target.protein > 0 ? Math.min(totals.protein, target.protein) / target.protein : 0,
        target.fat > 0 ? Math.min(totals.fat, target.fat) / target.fat : 0,
        target.carb > 0 ? Math.min(totals.carb, target.carb) / target.carb : 0,
        target.fiber > 0 ? Math.min(totals.fiber, target.fiber) / target.fiber : 0,
        totals.sodium <= target.sodium ? 1 : target.sodium / Math.max(totals.sodium, 1),
      ];
      const compliance = Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100);

      days.push({
        date: dayStart.toISOString(),
        dayLabel: dayStart.toLocaleDateString("id-ID", { weekday: "short" }),
        dateLabel: dayStart.toLocaleDateString("id-ID", { day: "numeric", month: "numeric" }),
        totals,
        compliance,
        recordCount: records.length,
      });
    }

    // Weekly averages
    const weeklyAvgCompliance = Math.round(
      days.reduce((s, d) => s + d.compliance, 0) / days.length,
    );
    const weeklyAvgCal = Math.round(
      days.reduce((s, d) => s + d.totals.cal, 0) / days.length,
    );

    return ok({
      hasPlan: true,
      plan: {
        id: latestPlan.id,
        date: latestPlan.date,
        presetName,
        target,
      },
      days,
      weeklyAvg: {
        compliance: weeklyAvgCompliance,
        cal: weeklyAvgCal,
      },
    });
  } catch (e) {
    return handleZod(e);
  }
}
