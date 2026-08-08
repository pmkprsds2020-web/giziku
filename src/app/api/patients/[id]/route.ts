import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseGetPatient,
  supabaseUpdatePatient,
  supabaseSoftDeletePatient,
  supabaseListMealPlans,
  supabaseListFoodRecords,
  supabaseListWeightRecords,
  supabaseListAssessments,
  supabaseListExercisePlans,
  resolvePatientId,
  getServerClient,
} from "@/lib/supabase/data-layer";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  religion: z.enum(["ISLAM", "KRISTEN", "KATOLIK", "HINDU", "BUDDHA", "KONGHUCU", "OTHER"]).optional(),
  bloodType: z.enum(["A", "B", "AB", "O", "UNKNOWN"]).optional(),
  allergy: z.string().optional(),
  height: z.number().optional().nullable(),
  weight: z.number().optional().nullable(),
  isPregnant: z.boolean().optional(),
  pregnancyTrimester: z.number().optional(),
  isLactating: z.boolean().optional(),
  lactationMonth: z.number().optional(),
  notes: z.string().optional(),
});

// Fetch a patient's "full profile" — diagnoses, assessments, weight records,
// meal plans, exercise plans, food records, shopping lists — from Supabase.
async function fetchFullPatientProfile(patientUuid: string) {
  const { client } = await getServerClient();

  const [
    mealPlans,
    foodRecords,
    weightRecords,
    assessments,
    exercisePlans,
    shoppingRes,
  ] = await Promise.all([
    supabaseListMealPlans(patientUuid),
    supabaseListFoodRecords(patientUuid),
    supabaseListWeightRecords(patientUuid),
    supabaseListAssessments(patientUuid),
    supabaseListExercisePlans(patientUuid),
    client
      .from("shopping_lists")
      .select("*, shopping_items(*, foods(*, food_categories(*)))")
      .eq("patient_id", patientUuid)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const shoppingLists = (shoppingRes.data || []).map((s: any) => ({
    id: s.id,
    patientId: s.patient_id,
    mealPlanId: s.meal_plan_id,
    period: s.period,
    multiplier: s.multiplier,
    totalEstimate: s.total_estimate,
    currency: s.currency,
    checkedCount: s.checked_count,
    deletedAt: s.deleted_at,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    items: (s.shopping_items || []).map((it: any) => ({
      id: it.id,
      shoppingListId: it.shopping_list_id,
      foodId: it.food_id,
      amount: it.amount,
      unit: it.unit,
      estPrice: it.est_price,
      checked: it.checked,
      food: it.foods ? { id: it.foods.id, name: it.foods.name } : null,
    })),
  }));

  // Take only top N as the original Prisma include did
  return {
    mealPlans: mealPlans.slice(0, 10),
    foodRecords: foodRecords.slice(0, 50),
    weightRecords: weightRecords.slice(-60),
    assessments: assessments.slice(0, 10),
    exercisePlans: exercisePlans.slice(0, 5),
    shoppingLists,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Try Supabase directly first (id may already be a UUID)
    let patient = await supabaseGetPatient(id);

    // If not found, try resolving Prisma cuid → Supabase UUID via MRN
    if (!patient) {
      const resolvedId = await resolvePatientId(id);
      if (resolvedId !== id) {
        patient = await supabaseGetPatient(resolvedId);
      }
    }

    // If still not found, fall back to Prisma with full includes
    if (!patient) {
      try {
        const { db } = await import("@/lib/db");
        const prismaPatient = await db.patient.findUnique({
          where: { id },
          include: {
            diagnoses: { orderBy: { createdAt: "desc" } },
            anthropometry: { orderBy: { recordedAt: "desc" }, take: 20 },
            assessments: { orderBy: { recordedAt: "desc" }, take: 10 },
            weightRecords: { orderBy: { date: "asc" }, take: 60 },
            mealPlans: {
              orderBy: { date: "desc" },
              take: 10,
              include: { items: { include: { food: true } } },
            },
            exercisePlans: { orderBy: { date: "desc" }, take: 5, include: { items: true } },
            foodRecords: { orderBy: { date: "desc" }, take: 50, include: { food: true } },
            shoppingLists: { orderBy: { createdAt: "desc" }, take: 5, include: { items: { include: { food: true } } } },
          },
        });
        if (prismaPatient) return ok(prismaPatient);
      } catch (e) {
        console.warn("[patients/[id] GET] Prisma fallback failed:", e);
      }
      return err("Pasien tidak ditemukan", 404);
    }

    // Fetch full profile (meal plans, records, etc.) from Supabase
    const profile = await fetchFullPatientProfile(patient.id);

    // anthropometry isn't a Supabase table — derive latest from weight_records if needed
    const anthropometry = (profile.weightRecords || []).slice(-20).map((w: any) => ({
      id: `anthro-${w.id}`,
      patientId: w.patientId,
      recordedAt: w.date,
      weight: w.weight,
      height: patient.height,
      bmi: w.bmi,
      bmiCategory: w.bmiCategory,
      weightChange: w.weightChange,
      weightChangePct: w.weightChangePct,
    })).reverse();

    return ok({
      ...patient,
      anthropometry,
      mealPlans: profile.mealPlans,
      foodRecords: profile.foodRecords,
      weightRecords: profile.weightRecords,
      assessments: profile.assessments,
      exercisePlans: profile.exercisePlans,
      shoppingLists: profile.shoppingLists,
    });
  } catch (e) {
    return handleZod(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    // Resolve to Supabase UUID
    const resolvedId = await resolvePatientId(id);

    const { data: updated, error: supaErr } = await supabaseUpdatePatient(resolvedId, d);

    if (supaErr || !updated) {
      // Prisma fallback
      console.warn("[patients/[id] PUT] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const prismaUpdated = await db.patient.update({
          where: { id },
          data: d,
        });

        if (d.weight && d.height) {
          const bmi = d.weight / Math.pow(d.height / 100, 2);
          const cat =
            bmi < 18.5 ? "UNDERWEIGHT" : bmi < 23 ? "NORMAL" : bmi < 25 ? "OVERWEIGHT" : "OBESE";
          await db.anthropometry.create({
            data: {
              patientId: id,
              weight: d.weight,
              height: d.height,
              bmi: Math.round(bmi * 10) / 10,
              bmiCategory: cat,
            },
          });
          await db.weightRecord.create({
            data: { patientId: id, weight: d.weight, date: new Date() },
          });
        }
        return ok(prismaUpdated);
      } catch (prismaErr: any) {
        return err(`Gagal memperbarui pasien: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    // If weight & height provided, also create a weight record + anthropometry snapshot
    if (d.weight && d.height) {
      try {
        const { supabaseCreateWeightRecord } = await import("@/lib/supabase/data-layer");
        const bmi = d.weight / Math.pow(d.height / 100, 2);
        const cat =
          bmi < 18.5 ? "UNDERWEIGHT" : bmi < 23 ? "NORMAL" : bmi < 25 ? "OVERWEIGHT" : "OBESE";
        await supabaseCreateWeightRecord({
          patientId: resolvedId,
          weight: d.weight,
          height: d.height,
          bmi: Math.round(bmi * 10) / 10,
          bmiCategory: cat,
          date: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("[patients/[id] PUT] Weight record insert failed:", e);
      }
    }

    return ok(updated);
  } catch (e) {
    return handleZod(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const resolvedId = await resolvePatientId(id);

    const { error: supaErr } = await supabaseSoftDeletePatient(resolvedId);

    if (supaErr) {
      // Prisma fallback
      console.warn("[patients/[id] DELETE] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        await db.patient.update({ where: { id }, data: { deletedAt: new Date() } });
        return ok({ id, deleted: true });
      } catch (prismaErr: any) {
        return err(`Gagal menghapus pasien: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    return ok({ id, deleted: true });
  } catch (e) {
    return handleZod(e);
  }
}
