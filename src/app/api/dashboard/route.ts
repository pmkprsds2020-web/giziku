import { NextRequest } from "next/server";
import { ok, handleZod, ageFromBirth } from "@/lib/api-helpers";
import {
  getServerClient,
  resolvePatientId,
} from "@/lib/supabase/data-layer";

// ---------------------------------------------------------------------
// GET /api/dashboard?patientId=xxx
// Aggregated dashboard: patient KPIs, recent meal plans, diagnosis distribution,
// today's food records, weight trends. Supabase primary, Prisma fallback.
// ---------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId") || undefined;

    const { client } = await getServerClient();

    // Try Supabase first
    const result = await fetchFromSupabase(client, patientId).catch(async (e) => {
      console.warn("[dashboard GET] Supabase failed, falling back to Prisma:", e);
      return fetchFromPrisma(patientId);
    });

    if (!result) {
      return ok(await fetchFromPrisma(patientId));
    }
    return ok(result);
  } catch (e) {
    return handleZod(e);
  }
}

async function fetchFromSupabase(client: any, patientIdFilter?: string): Promise<any | null> {
  // List patients with diagnoses
  let patientQuery = client
    .from("patients")
    .select("*, diagnoses(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (patientIdFilter) {
    const resolvedId = await resolvePatientId(patientIdFilter);
    patientQuery = patientQuery.eq("id", resolvedId);
  }

  const { data: patientsRaw, error: pErr } = await patientQuery;
  if (pErr) throw pErr;

  const patients = patientsRaw || [];

  // Get meal plans for these patients + diagnosis distribution
  const patientIds = patients.map((p: any) => p.id);

  const [mealPlansRes, recentPlansRes, todayFoodRecordsRes, diagnosisDist] = await Promise.all([
    patientIds.length > 0
      ? client
          .from("meal_plans")
          .select("id, patient_id, compliance, status, total_cal, target_cal, date, deleted_at")
          .in("patient_id", patientIds)
          .is("deleted_at", null)
          .order("date", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
    client
      .from("meal_plans")
      .select("id, patient_id, target_cal, total_cal, compliance, status, date, patients(name)")
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(8),
    client
      .from("food_records")
      .select("id, cal, consumed, patient_id, foods(name), patients(name)")
      .gte("date", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    computeDiagnosisDistribution(patients),
  ]);

  // Count final-status meal plans
  const mealPlans = mealPlansRes.data || [];
  const activeMealPlans = mealPlans.filter((m: any) => m.status === "FINAL").length;

  // Today calories total (cal * consumed / 100)
  const todayRecords = todayFoodRecordsRes.data || [];
  const todayCalTotal = todayRecords.reduce(
    (s: number, r: any) => s + (r.cal || 0) * ((r.consumed ?? 100) / 100),
    0,
  );

  // Count foods
  const { count: totalFoods } = await client
    .from("foods")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  // Build patient summaries with weight trend
  const patientSummaries: any[] = [];
  for (const p of patients) {
    // Latest meal plan for this patient
    const patientMealPlans = mealPlans.filter((m: any) => m.patient_id === p.id);
    const latestPlan = patientMealPlans[0];

    // Weight records — fetch latest 7
    const { data: weightRecs } = await client
      .from("weight_records")
      .select("date, weight")
      .eq("patient_id", p.id)
      .order("date", { ascending: true })
      .limit(30);

    const bmi =
      p.height && p.weight && p.height > 0
        ? p.weight / Math.pow(p.height / 100, 2)
        : null;

    patientSummaries.push({
      id: p.id,
      name: p.name,
      mrn: p.mrn,
      ageYears: ageFromBirth(p.birth_date),
      gender: p.gender,
      bmi: bmi ? Math.round(bmi * 10) / 10 : null,
      weight: p.weight,
      diagnoses: (p.diagnoses || []).filter((d: any) => d.active).map((d: any) => d.type),
      latestCompliance: latestPlan?.compliance ?? null,
      weightTrend: (weightRecs || []).slice(-7).map((w: any) => ({
        date: w.date,
        weight: w.weight,
      })),
    });
  }

  // Recent plans (top 8 across all patients)
  const recentPlansRaw = recentPlansRes.data || [];

  return {
    totalPatients: patients.length,
    activeMealPlans,
    totalFoods: totalFoods ?? 0,
    todayCalTotal: Math.round(todayCalTotal),
    todayRecords: todayRecords.length,
    recentPlans: recentPlansRaw.map((mp: any) => ({
      id: mp.id,
      patientName: mp.patients?.name ?? "—",
      date: mp.date,
      targetCal: mp.target_cal,
      totalCal: mp.total_cal,
      compliance: mp.compliance,
      status: mp.status,
    })),
    diagnosisDistribution: diagnosisDist,
    patientSummaries,
  };
}

async function computeDiagnosisDistribution(patients: any[]): Promise<Record<string, number>> {
  const diagCounts: Record<string, number> = {};
  for (const p of patients) {
    for (const d of p.diagnoses || []) {
      if (d.active) {
        diagCounts[d.type] = (diagCounts[d.type] || 0) + 1;
      }
    }
  }
  return diagCounts;
}

async function fetchFromPrisma(patientId?: string): Promise<any> {
  const { db } = await import("@/lib/db");
  const patients = await db.patient.findMany({
    where: { deletedAt: null, ...(patientId ? { id: patientId } : {}) },
    include: {
      diagnoses: { where: { active: true } },
      mealPlans: { orderBy: { date: "desc" }, take: 1, include: { items: true } },
      foodRecords: { orderBy: { date: "desc" }, take: 7 },
      weightRecords: { orderBy: { date: "asc" }, take: 30 },
    },
  });

  const totalPatients = patients.length;
  const activeMealPlans = await db.mealPlan.count({
    where: { deletedAt: null, status: "FINAL" },
  });
  const totalFoods = await db.food.count({ where: { deletedAt: null } });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaysRecords = await db.foodRecord.findMany({
    where: { date: { gte: todayStart } },
    include: { food: true, patient: true },
  });

  const todayCalTotal = todaysRecords.reduce(
    (s, r) => s + r.cal * (r.consumed / 100),
    0,
  );

  const recentPlans = await db.mealPlan.findMany({
    orderBy: { date: "desc" },
    take: 8,
    include: { patient: true, items: true },
  });

  const allDiagnoses = await db.diagnosis.findMany({ where: { active: true } });
  const diagCounts: Record<string, number> = {};
  allDiagnoses.forEach((d) => {
    diagCounts[d.type] = (diagCounts[d.type] || 0) + 1;
  });

  const patientSummaries = patients.map((p) => {
    const bmi =
      p.height && p.weight && p.height > 0
        ? p.weight / Math.pow(p.height / 100, 2)
        : null;
    const latestPlan = p.mealPlans[0];
    return {
      id: p.id,
      name: p.name,
      mrn: p.mrn,
      ageYears: ageFromBirth(p.birthDate),
      gender: p.gender,
      bmi: bmi ? Math.round(bmi * 10) / 10 : null,
      weight: p.weight,
      diagnoses: p.diagnoses.map((d) => d.type),
      latestCompliance: latestPlan?.compliance ?? null,
      weightTrend: p.weightRecords.slice(-7).map((w) => ({
        date: w.date.toISOString(),
        weight: w.weight,
      })),
    };
  });

  return {
    totalPatients,
    activeMealPlans,
    totalFoods,
    todayCalTotal: Math.round(todayCalTotal),
    todayRecords: todaysRecords.length,
    recentPlans: recentPlans.map((mp) => ({
      id: mp.id,
      patientName: mp.patient.name,
      date: mp.date.toISOString(),
      targetCal: mp.targetCal,
      totalCal: mp.totalCal,
      compliance: mp.compliance,
      status: mp.status,
    })),
    diagnosisDistribution: diagCounts,
    patientSummaries,
  };
}
