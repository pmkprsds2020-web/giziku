import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { type DiagnosisType } from "@/lib/clinical/constants";
import { computeCalorieTarget } from "@/lib/clinical/calorie-engine";
import {
  planExerciseForPatient,
  buildExerciseAuditTrail,
  type ClinicalFlags,
  type ExerciseTargetInput,
} from "@/lib/clinical/exercise-target";
import {
  supabaseGetPatient,
  supabaseListExercisePlans,
  supabaseCreateExercisePlan,
  supabaseGetLatestBouchardAssessment,
  resolvePatientId,
} from "@/lib/supabase/data-layer";

// ---------------------------------------------------------------------
// Exercise Plan Generator
// Considers diagnosis, age, BMI, ECOG, Barthel, frailty, fall risk, AND
// (priority) Bouchard Activity Record — via the Exercise Target Engine
// (src/lib/clinical/exercise-target.ts), which is the single source of
// truth shared with /api/ai/exercise-plan.
// ALL data comes from Supabase — falls back to Prisma only if unavailable.
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// GET /api/exercise?patientId=...
// List exercise plans for a patient (needed so the frontend can load
// previously generated plans without triggering a 404).
// ---------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const plans = await supabaseListExercisePlans(patientId || undefined);
    return ok(plans);
  } catch (e) {
    return handleZod(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId } = body as { patientId?: string };
    if (!patientId) return err("patientId wajib diisi", 422);

    const resolvedPatientId = await resolvePatientId(patientId);

    // Try Supabase first, fall back to Prisma for patient data
    let patient: any = await supabaseGetPatient(resolvedPatientId);
    if (!patient) {
      try {
        const { db } = await import("@/lib/db");
        patient = await db.patient.findUnique({
          where: { id: patientId },
          include: {
            diagnoses: { where: { active: true } },
            assessments: { orderBy: { recordedAt: "desc" }, take: 1 },
          },
        });
      } catch (e) {
        console.warn("[exercise] Prisma fallback failed:", e);
      }
    }
    if (!patient) return err("Pasien tidak ditemukan", 404);
    if (!patient.height || !patient.weight)
      return err("Tinggi & berat badan pasien harus diisi", 422);

    const ageYears = ageFromBirth(patient.birthDate);
    const bmi = patient.weight / Math.pow(patient.height / 100, 2);
    const diagnoses = (patient.diagnoses || [])
      .filter((d: any) => d.active !== false)
      .map((d: any) => d.type) as DiagnosisType[];
    const assessment = (patient.assessments || [])[0];

    // Derive activity & stress from assessment (with clinical fallbacks) —
    // used for the DAILY CALORIE target (computeCalorieTarget), which is a
    // separate concern from the EXERCISE target computed below.
    let activity = "LIGHT" as string;
    let stress = "NONE" as string;
    if (assessment) {
      if (assessment.activity) activity = assessment.activity;
      else if (assessment.ecog) {
        const ecogNum = Number(assessment.ecog);
        if (ecogNum >= 3) activity = "BED_REST";
        else if (ecogNum === 2) activity = "VERY_LIGHT";
        else if (ecogNum === 1) activity = "LIGHT";
        else activity = "MODERATE";
      } else if (assessment.barthel != null) {
        if (assessment.barthel < 40) activity = "BED_REST";
        else if (assessment.barthel < 60) activity = "VERY_LIGHT";
        else activity = "LIGHT";
      }
      if (assessment.stress) stress = assessment.stress;
    }

    // ---------------------------------------------------------------
    // Bouchard Activity Record (priority input for both the calorie
    // engine's activity correction AND the exercise target) — never
    // blocks plan creation if unavailable (fallback chain lives inside
    // the exercise-target engine, and computeCalorieTarget falls back to
    // the manually selected `activity` level).
    // ---------------------------------------------------------------
    let bouchard: any = null;
    try {
      bouchard = await supabaseGetLatestBouchardAssessment(resolvedPatientId);
    } catch (e) {
      console.warn("[exercise] Bouchard lookup failed (non-fatal):", e);
    }

    const calResult = computeCalorieTarget({
      gender: patient.gender,
      ageYears,
      heightCm: patient.height,
      weightKg: patient.weight,
      activity: activity as any,
      stress: stress as any,
      diagnoses,
      isPregnant: patient.isPregnant,
      pregnancyTrimester: patient.pregnancyTrimester,
      isLactating: patient.isLactating,
      bouchardPalCategory: bouchard?.palCategory ?? undefined,
    });

    const ecog = assessment?.ecog;
    const barthel = assessment?.barthel ?? 100;
    const frailty = assessment?.frailty;
    const fallRisk = assessment?.fallRisk;
    const cfs = assessment?.cfs;

    const targetInput: ExerciseTargetInput = {
      weightKg: patient.weight,
      ageYears,
      bmi,
      dailyCalorieTarget: calResult.targetCalorie,
      pal: bouchard?.avgPal ?? null,
      palCategory: bouchard?.palCategory ?? null,
      activityLevel: activity,
      ecog,
      barthel,
      karnofsky: assessment?.karnofsky ?? null,
      pps: assessment?.pps ?? null,
      frailty,
      cfs,
      fallRisk,
      diagnoses,
    };

    const isFrail = frailty === "Frail" || frailty === "Prefrail";
    const highFallRisk = fallRisk === "High" || barthel < 60;
    const limitedMobility = ecog === "3" || ecog === "4" || Number(ecog) >= 3 || barthel < 40;

    const clinicalFlags: ClinicalFlags = {
      limitedMobility,
      isFrail,
      highFallRisk,
      bmi,
      ageYears,
      diagnoses,
    };

    const { target, duration, notes } = planExerciseForPatient(targetInput, clinicalFlags);

    const targetBurned = target.targetBurned;
    const totalBurned = duration.actualBurned;
    const items = duration.items;

    const clinicalNote = `Berdasarkan BMI ${Math.round(bmi * 10) / 10}, ECOG ${ecog ?? "?"}, Barthel ${barthel}, frailty ${frailty ?? "?"}${bouchard ? `, PAL Bouchard ${bouchard.avgPal} (${bouchard.palCategory})` : ""}.`;
    const combinedNotes = `${notes} ${clinicalNote}`.trim();

    const planDetails = buildExerciseAuditTrail({
      dailyCalorieTarget: calResult.targetCalorie,
      target,
      duration,
      bouchard: bouchard
        ? {
            avgPal: bouchard.avgPal,
            palCategory: bouchard.palCategory,
            avgEnergyExpenditure: bouchard.avgEnergyExpenditure,
            whoStatus: bouchard.whoStatus,
            assessmentDate: bouchard.assessmentDate,
          }
        : null,
    });

    const planData = {
      patientId: resolvedPatientId,
      targetBurned,
      totalBurned,
      notes: combinedNotes,
      planDetails,
    };

    const { data: exercisePlan, error: saveError } = await supabaseCreateExercisePlan(planData, items);

    if (saveError) {
      console.warn("[exercise] Supabase save failed, falling back to Prisma:", saveError);
      try {
        const { db } = await import("@/lib/db");
        const prismaPlan = await db.exercisePlan.create({
          data: {
            patientId,
            date: new Date(),
            targetBurned,
            totalBurned,
            notes: combinedNotes,
            items: {
              create: items.map((i) => ({
                name: i.name,
                type: i.type,
                intensity: i.intensity,
                duration: i.duration,
                caloriesBurned: i.caloriesBurned,
                met: i.met,
              })) as any,
            },
          },
          include: { items: true },
        });
        return ok({
          plan: prismaPlan,
          targetBurned,
          totalBurned,
          planDetails,
          savedTo: "Local cache (login required for Supabase)",
        });
      } catch (prismaErr: any) {
        return err(`Gagal menyimpan exercise plan: ${saveError}`, 500);
      }
    }

    return ok({ plan: exercisePlan, targetBurned, totalBurned, planDetails, savedTo: "Supabase PostgreSQL" });
  } catch (e) {
    return handleZod(e);
  }
}

function ageFromBirth(birth: string | Date): number {
  const birthDate = typeof birth === "string" ? new Date(birth) : birth;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}
