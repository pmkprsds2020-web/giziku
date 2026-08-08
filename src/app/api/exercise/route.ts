import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { MET_TABLE, type DiagnosisType } from "@/lib/clinical/constants";
import { computeCalorieTarget } from "@/lib/clinical/calorie-engine";
import {
  supabaseGetPatient,
  supabaseListExercisePlans,
  supabaseCreateExercisePlan,
  resolvePatientId,
} from "@/lib/supabase/data-layer";

// ---------------------------------------------------------------------
// Exercise Plan Generator
// Considers diagnosis, age, BMI, ECOG, Barthel, frailty, fall risk
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

    // Target calories to burn: ~15-30% of daily target
    // Derive activity & stress from assessment (with clinical fallbacks)
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
    });
    const targetBurned = Math.round(calResult.targetCalorie * 0.2);

    // Adjust exercise selection based on clinical status
    const ecog = assessment?.ecog;
    const barthel = assessment?.barthel ?? 100;
    const frailty = assessment?.frailty;
    const fallRisk = assessment?.fallRisk;

    const isFrail = frailty === "Frail" || frailty === "Prefrail";
    const highFallRisk = fallRisk === "High" || barthel < 60;
    const limitedMobility = ecog === "3" || ecog === "4" || barthel < 40;

    // Calories burned formula: MET * weight(kg) * duration(min) / 60
    const buildItem = (key: string, duration: number) => {
      const m = MET_TABLE[key];
      const met = m?.met ?? 3;
      const burned = (met * patient.weight! * duration) / 60;
      return {
        name: m?.name ?? key,
        type: m?.type ?? "AEROBIC",
        intensity: duration >= 30 ? "MODERATE" : "LOW",
        duration,
        caloriesBurned: Math.round(burned),
        met,
      };
    };

    type Item = ReturnType<typeof buildItem>;

    const items: Item[] = [];
    if (limitedMobility) {
      items.push(buildItem("stretching", 10));
      items.push(buildItem("balance_exercise", 10));
      items.push(buildItem("functional_training", 10));
    } else if (isFrail || highFallRisk) {
      items.push(buildItem("walking", 15));
      items.push(buildItem("balance_exercise", 10));
      items.push(buildItem("resistance_band", 10));
      items.push(buildItem("taichi", 15));
    } else if (bmi >= 27 || diagnoses.includes("DM" as DiagnosisType) || diagnoses.includes("HT" as DiagnosisType)) {
      items.push(buildItem("brisk_walk", 30));
      items.push(buildItem("light_weights", 15));
      items.push(buildItem("stretching", 10));
      if (bmi < 35) items.push(buildItem("cycling", 20));
    } else if (ageYears >= 65) {
      items.push(buildItem("walking", 25));
      items.push(buildItem("resistance_band", 15));
      items.push(buildItem("balance_exercise", 10));
      items.push(buildItem("yoga", 15));
    } else {
      items.push(buildItem("brisk_walk", 30));
      items.push(buildItem("moderate_weights", 20));
      items.push(buildItem("stretching", 10));
      items.push(buildItem("cycling", 20));
    }

    const totalBurned = items.reduce((s, i) => s + i.caloriesBurned, 0);
    const notes = `Berdasarkan BMI ${Math.round(bmi * 10) / 10}, ECOG ${ecog ?? "?"}, Barthel ${barthel}, frailty ${frailty ?? "?"}.`;

    const planData = {
      patientId: resolvedPatientId,
      targetBurned,
      totalBurned,
      notes,
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
            notes,
            items: { create: items as any },
          },
          include: { items: true },
        });
        return ok({
          plan: prismaPlan,
          targetBurned,
          totalBurned,
          savedTo: "Local cache (login required for Supabase)",
        });
      } catch (prismaErr: any) {
        return err(`Gagal menyimpan exercise plan: ${saveError}`, 500);
      }
    }

    return ok({ plan: exercisePlan, targetBurned, totalBurned, savedTo: "Supabase PostgreSQL" });
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
