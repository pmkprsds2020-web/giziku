import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse, ageFromBirth } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseListPatients,
  supabaseCreatePatient,
  supabaseCreateWeightRecord,
  getServerClient,
} from "@/lib/supabase/data-layer";
import { db } from "@/lib/db";

const PatientCreateSchema = z.object({
  mrn: z.string().min(1, "MRN wajib diisi"),
  name: z.string().min(1, "Nama wajib diisi"),
  gender: z.enum(["MALE", "FEMALE"]),
  birthDate: z.string(),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  religion: z
    .enum(["ISLAM", "KRISTEN", "KATOLIK", "HINDU", "BUDDHA", "KONGHUCU", "OTHER"])
    .optional()
    .default("ISLAM"),
  bloodType: z.enum(["A", "B", "AB", "O", "UNKNOWN"]).optional().default("UNKNOWN"),
  allergy: z.string().optional().default(""),
  height: z.number().optional().nullable(),
  weight: z.number().optional().nullable(),
  isPregnant: z.boolean().optional().default(false),
  pregnancyTrimester: z.number().optional().default(0),
  isLactating: z.boolean().optional().default(false),
  lactationMonth: z.number().optional().default(0),
  notes: z.string().optional().default(""),
  diagnoses: z.array(z.string()).optional().default([]),
});

export async function GET() {
  try {
    // Try Supabase first
    let patients = await supabaseListPatients();

    // Fall back to Prisma if Supabase is empty (transition period)
    if (patients.length === 0) {
      patients = await db.patient.findMany({
        where: { deletedAt: null },
        include: { diagnoses: { where: { active: true } } },
        orderBy: { createdAt: "desc" },
      });
    }

    const data = patients.map((p) => {
      const bmi =
        p.height && p.weight && p.height > 0
          ? p.weight / Math.pow(p.height / 100, 2)
          : null;
      const birthDate = p.birthDate ? new Date(p.birthDate) : new Date();
      return {
        id: p.id,
        mrn: p.mrn,
        name: p.name,
        gender: p.gender,
        birthDate: birthDate.toISOString(),
        ageYears: ageFromBirth(birthDate),
        height: p.height,
        weight: p.weight,
        bmi: bmi ? Math.round(bmi * 10) / 10 : null,
        phone: p.phone,
        diagnoses: (p.diagnoses || []).filter((d: any) => d.active).map((d: any) => d.type),
      };
    });
    return ok(data);
  } catch (e) {
    return handleZod(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(PatientCreateSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    // Check existing MRN
    const { client } = await getServerClient();
    const { data: existing } = await client
      .from("patients")
      .select("id")
      .eq("mrn", d.mrn)
      .maybeSingle();
    if (existing) return err("MRN sudah terdaftar", 409);

    const { data: patient, error } = await supabaseCreatePatient({
      mrn: d.mrn,
      name: d.name,
      gender: d.gender,
      birthDate: d.birthDate,
      phone: d.phone,
      address: d.address,
      religion: d.religion,
      bloodType: d.bloodType,
      allergy: d.allergy,
      height: d.height ?? null,
      weight: d.weight ?? null,
      isPregnant: d.isPregnant,
      pregnancyTrimester: d.pregnancyTrimester,
      isLactating: d.isLactating,
      lactationMonth: d.lactationMonth,
      notes: d.notes,
    });

    if (error) {
      if (error.includes("Authentication required")) return err(error, 401);
      return err(error, 500);
    }

    // Create diagnoses
    if (d.diagnoses.length > 0) {
      const diagnoses = d.diagnoses.map((type) => ({
        patient_id: patient.id,
        type,
        active: true,
      }));
      const { error: diagError } = await client.from("diagnoses").insert(diagnoses);
      if (diagError) {
        console.error("[patients POST] Failed to create diagnoses:", diagError);
      }
    }

    // Create anthropometry + weight record if height & weight provided
    if (d.height && d.weight) {
      const bmi = d.weight / Math.pow(d.height / 100, 2);
      const cat =
        bmi < 18.5 ? "UNDERWEIGHT" : bmi < 23 ? "NORMAL" : bmi < 25 ? "OVERWEIGHT" : "OBESE";

      const { error: anthroError } = await client.from("anthropometry").insert({
        patient_id: patient.id,
        weight: d.weight,
        height: d.height,
        bmi: Math.round(bmi * 10) / 10,
        bmi_category: cat,
      });
      if (anthroError) {
        console.error("[patients POST] Failed to create anthropometry:", anthroError);
      }

      const { error: wrError } = await supabaseCreateWeightRecord({
        patientId: patient.id,
        weight: d.weight,
        height: d.height,
        date: new Date().toISOString(),
      });
      if (wrError) {
        console.error("[patients POST] Failed to create initial weight record:", wrError);
      }
    }

    return ok(patient, 201);
  } catch (e) {
    return handleZod(e);
  }
}
