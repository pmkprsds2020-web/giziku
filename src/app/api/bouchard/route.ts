import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import {
  computeAssessmentResult,
  BOUCHARD_BOXES_PER_DAY,
  type BouchardDayCodes,
} from "@/lib/clinical/bouchard";
import {
  supabaseListBouchardAssessments,
  supabaseGetBouchardAssessment,
  supabaseCreateBouchardAssessment,
  supabaseDeleteBouchardAssessment,
  resolvePatientId,
} from "@/lib/supabase/data-layer";

// ---------------------------------------------------------------------
// Bouchard Activity Record (BAR)
// GET    /api/bouchard?patientId=...   -> list (history) for a patient
// GET    /api/bouchard?id=...          -> single assessment
// POST   /api/bouchard                 -> compute + save a new assessment
// DELETE /api/bouchard?id=...          -> soft delete
// ---------------------------------------------------------------------

const dayCodesSchema = z
  .array(z.union([z.number().int().min(1).max(9), z.null()]))
  .max(BOUCHARD_BOXES_PER_DAY);

const RequestSchema = z.object({
  patientId: z.string().min(1),
  weightKg: z.number().positive(),
  assessmentDate: z.string().optional(),
  day1Date: z.string().optional(),
  day1Codes: dayCodesSchema,
  day2Date: z.string().optional(),
  day2Codes: dayCodesSchema,
  day3Date: z.string().optional(),
  day3Codes: dayCodesSchema,
  notes: z.string().max(2000).optional(),
});

function padDay(codes: (number | null)[]): BouchardDayCodes {
  const padded = [...codes] as BouchardDayCodes;
  while (padded.length < BOUCHARD_BOXES_PER_DAY) padded.push(null);
  return padded.slice(0, BOUCHARD_BOXES_PER_DAY);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (id) {
      const assessment = await supabaseGetBouchardAssessment(id);
      if (!assessment) return err("Assessment tidak ditemukan", 404);
      return ok(assessment);
    }
    const patientId = searchParams.get("patientId") || undefined;
    const list = await supabaseListBouchardAssessments(patientId);
    return ok(list);
  } catch (e) {
    return handleZod(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = RequestSchema.parse(body);
    const resolvedPatientId = await resolvePatientId(input.patientId);

    const day1 = padDay(input.day1Codes);
    const day2 = padDay(input.day2Codes);
    const day3 = padDay(input.day3Codes);

    if (day1.every((c) => c === null) && day2.every((c) => c === null) && day3.every((c) => c === null)) {
      return err("Isi minimal satu hari sebelum menyimpan assessment", 422);
    }

    const result = computeAssessmentResult([day1, day2, day3], input.weightKg);

    const { data, error } = await supabaseCreateBouchardAssessment({
      patientId: resolvedPatientId,
      assessmentDate: input.assessmentDate ?? new Date().toISOString().slice(0, 10),
      weightKg: input.weightKg,
      day1Date: input.day1Date ?? null,
      day1Codes: day1,
      day2Date: input.day2Date ?? null,
      day2Codes: day2,
      day3Date: input.day3Date ?? null,
      day3Codes: day3,
      dayResults: result.days,
      avgEnergyExpenditure: result.avgEnergyExpenditure,
      avgMet: result.avgMet,
      avgPal: result.avgPal,
      palCategory: result.palCategory,
      minutesByBucket: result.minutesByBucketAvg,
      whoStatus: result.whoStatus,
      notes: input.notes ?? null,
    });

    if (error) return err(`Gagal menyimpan Bouchard Activity Record: ${error}`, 500);

    return ok({ assessment: data, result });
  } catch (e) {
    return handleZod(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return err("id wajib diisi", 422);
    const { error } = await supabaseDeleteBouchardAssessment(id);
    if (error) return err(error, 500);
    return ok({ deleted: true });
  } catch (e) {
    return handleZod(e);
  }
}
