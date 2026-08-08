import { NextRequest } from "next/server";
import { ok, err, handleZod, ageFromBirth } from "@/lib/api-helpers";
import { computeCalorieTarget } from "@/lib/clinical/calorie-engine";
import { buildPlanViewFromStoredItems } from "@/lib/ai/meal-generator";
import {
  supabaseGetActiveMealPlan,
  supabaseGetPatient,
  resolvePatientId,
} from "@/lib/supabase/data-layer";

// ---------------------------------------------------------------------
// GET /api/meal-plan/active-view?patientId=...
//
// Single endpoint the "AI Meal Plan" page loads on mount / refresh /
// navigation-back. Returns the patient's Meal Plan Aktif reshaped into
// the exact same { plan, calorieResult, aiReasoning, patient, targets }
// structure the generate-preview endpoint returns — so the page can
// render Daftar Menu Lengkap, Isi Piringku visualization, and Validasi
// Gizi straight from the database, with NO AI call and NO new food
// selection (deterministic recompute only — "Hitung ulang nutrisi").
//
// Returns { data: null } (200 OK) if the patient has no active plan
// yet — the frontend uses that to show "Belum ada Meal Plan", not an
// error.
// ---------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientIdParam = searchParams.get("patientId");
    if (!patientIdParam) return err("patientId wajib diisi", 422);

    const patientId = await resolvePatientId(patientIdParam);

    const mealPlan = await supabaseGetActiveMealPlan(patientId);
    if (!mealPlan || !mealPlan.items || mealPlan.items.length === 0) {
      return ok(null);
    }

    // Load full patient record (assessments included) — same source of
    // truth POST /api/meal-plan uses when it first generated this plan.
    const patient = await supabaseGetPatient(patientId);
    if (!patient) return ok(null);

    const ageYears = ageFromBirth(patient.birthDate);
    const latestAssessment = patient.assessments?.[0];
    const activeDiagnoses = (patient.diagnoses || []).filter((d: any) => d.active);

    let activity = "LIGHT" as string;
    let stress = "NONE" as string;
    if (latestAssessment) {
      if (latestAssessment.activity) {
        activity = latestAssessment.activity;
      } else if (latestAssessment.ecog) {
        const ecogNum = Number(latestAssessment.ecog);
        if (ecogNum >= 3) activity = "BED_REST";
        else if (ecogNum === 2) activity = "VERY_LIGHT";
        else if (ecogNum === 1) activity = "LIGHT";
        else activity = "MODERATE";
      } else if (latestAssessment.barthel != null) {
        if (latestAssessment.barthel < 40) activity = "BED_REST";
        else if (latestAssessment.barthel < 60) activity = "VERY_LIGHT";
        else activity = "LIGHT";
      }
      if (latestAssessment.stress) stress = latestAssessment.stress;
    }

    // If a preset was applied at generation time the persisted target_*
    // columns are authoritative; computeCalorieTarget here is only used
    // to recover clinical context (BMI, warnings, primary diagnosis
    // label) for display — guarded in case height/weight were later
    // cleared from the patient record.
    let calResult: any;
    if (patient.height && patient.weight) {
      calResult = computeCalorieTarget({
        gender: patient.gender,
        ageYears,
        heightCm: patient.height,
        weightKg: patient.weight,
        activity: activity as any,
        stress: stress as any,
        diagnoses: activeDiagnoses.map((d: any) => d.type),
        isPregnant: patient.isPregnant,
        pregnancyTrimester: patient.pregnancyTrimester,
        isLactating: patient.isLactating,
      });
    } else {
      calResult = {
        bmi: 0,
        bmiLabel: "-",
        macros: { proteinG: 0, fatG: 0, carbG: 0, proteinKcal: 0, fatKcal: 0, carbKcal: 0, proteinPct: 0, fatPct: 0, carbPct: 0 },
        targetCalorie: mealPlan.targetCal ?? 0,
        fiberTarget: mealPlan.targetFiber ?? 0,
        sodiumMax: mealPlan.targetSodium ?? 0,
        primaryDiagnosis: undefined,
        warnings: ["Data tinggi/berat pasien tidak lengkap — BMI tidak dapat dihitung ulang."],
      };
    }
    calResult.targetCalorie = mealPlan.targetCal ?? calResult.targetCalorie;
    calResult.macros = {
      ...calResult.macros,
      proteinG: mealPlan.targetProtein ?? calResult.macros.proteinG,
      fatG: mealPlan.targetFat ?? calResult.macros.fatG,
      carbG: mealPlan.targetCarb ?? calResult.macros.carbG,
    };
    calResult.fiberTarget = mealPlan.targetFiber ?? calResult.fiberTarget;
    calResult.sodiumMax = mealPlan.targetSodium ?? calResult.sodiumMax;

    // Enrich each stored item with its food category (for plate group
    // classification) — mealPlan.items already come from
    // supabaseGetActiveMealPlan's join on foods(*, food_categories(*)).
    const storedItems = mealPlan.items.map((i: any) => ({
      slot: i.slot,
      foodId: i.foodId,
      foodName: i.food?.name || "Makanan",
      amount: i.amount,
      cal: i.cal,
      protein: i.protein,
      fat: i.fat,
      carb: i.carb,
      fiber: i.fiber,
      sodium: i.sodium,
      categorySlug: i.food?.category?.slug || null,
      urt: i.food?.urt || null,
    }));

    const plan = buildPlanViewFromStoredItems(
      storedItems,
      calResult,
      activeDiagnoses.map((d: any) => d.type),
    );

    return ok({
      plan,
      mealPlan,
      calorieResult: calResult,
      preset: mealPlan.preset || null,
      aiReasoning: mealPlan.aiReasoning || null,
      compliance: mealPlan.compliance,
      patient: {
        id: patient.id,
        name: patient.name,
        mrn: patient.mrn,
        diagnoses: activeDiagnoses.map((d: any) => d.type),
      },
      targets: {
        targetCal: mealPlan.targetCal,
        targetProtein: mealPlan.targetProtein,
        targetFat: mealPlan.targetFat,
        targetCarb: mealPlan.targetCarb,
        targetFiber: mealPlan.targetFiber,
        targetSodium: mealPlan.targetSodium,
      },
      loadedFrom: "database",
    });
  } catch (e) {
    return handleZod(e);
  }
}
