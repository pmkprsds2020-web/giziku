import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseListAssessments,
  supabaseCreateAssessment,
  supabaseGetPatient,
  getServerClient,
  assessmentFromSupabase,
  resolvePatientId,
} from "@/lib/supabase/data-layer";

const CreateSchema = z.object({
  patientId: z.string().min(1),
  must: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().nullable(),
  mustScore: z.number().min(0).max(6).optional().nullable(),
  sga: z.enum(["A", "B", "C"]).optional().nullable(),
  nrs2002: z.enum(["AT_RISK", "NOT_AT_RISK"]).optional().nullable(),
  nrsScore: z.number().min(0).max(7).optional().nullable(),
  mna: z.enum(["NORMAL", "AT_RISK", "MALNOURISHED"]).optional().nullable(),
  mnaScore: z.number().min(0).max(14).optional().nullable(),
  pps: z.string().optional().nullable(),
  ecog: z.enum(["0", "1", "2", "3", "4"]).optional().nullable(),
  barthel: z.number().min(0).max(100).optional().nullable(),
  frailty: z.enum(["ROBUST", "PREFRAIL", "FRAIL"]).optional().nullable(),
  frailtyScore: z.number().min(0).max(5).optional().nullable(),
  fallRisk: z.enum(["LOW", "MODERATE", "HIGH"]).optional().nullable(),
  handGrip: z.number().min(0).max(100).optional().nullable(),
  calfCirc: z.number().min(0).max(80).optional().nullable(),
  activity: z
    .enum(["BED_REST", "VERY_LIGHT", "LIGHT", "MODERATE", "HEAVY"])
    .optional()
    .default("BED_REST"),
  stress: z
    .enum(["NONE", "MILD", "MODERATE", "SEVERE", "VERY_SEVERE"])
    .optional()
    .default("NONE"),
  notes: z.string().optional().default(""),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");

    if (patientId) {
      const resolvedId = await resolvePatientId(patientId);
      const assessments = await supabaseListAssessments(resolvedId);
      return ok(assessments);
    }

    // No patientId — list all (preserve original behavior)
    const { client } = await getServerClient();
    const { data, error } = await client
      .from("nutrition_assessments")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[assessments GET] list all error:", error);
      return ok([]);
    }
    return ok((data || []).map(assessmentFromSupabase));
  } catch (e) {
    return handleZod(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(CreateSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    const resolvedPatientId = await resolvePatientId(d.patientId);

    const patient = await supabaseGetPatient(resolvedPatientId);
    if (!patient) return err("Pasien tidak ditemukan", 404);

    const { data: assessment, error } = await supabaseCreateAssessment({
      patientId: resolvedPatientId,
      must: d.must ?? null,
      mustScore: d.mustScore ?? null,
      sga: d.sga ?? null,
      nrs2002: d.nrs2002 ?? null,
      nrsScore: d.nrsScore ?? null,
      mna: d.mna ?? null,
      mnaScore: d.mnaScore ?? null,
      pps: d.pps ?? null,
      ecog: d.ecog ?? null,
      barthel: d.barthel ?? null,
      frailty: d.frailty ?? null,
      frailtyScore: d.frailtyScore ?? null,
      fallRisk: d.fallRisk ?? null,
      handGrip: d.handGrip ?? null,
      calfCirc: d.calfCirc ?? null,
      activity: d.activity,
      stress: d.stress,
      notes: d.notes,
    });

    if (error) {
      if (error.includes("Authentication required")) return err(error, 401);
      return err(error, 500);
    }

    return ok(assessment, 201);
  } catch (e) {
    return handleZod(e);
  }
}
