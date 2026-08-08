import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseListWeightRecords,
  supabaseCreateWeightRecord,
  supabaseGetPatient,
  supabaseUpdatePatient,
  getServerClient,
  resolvePatientId,
} from "@/lib/supabase/data-layer";

const CreateSchema = z.object({
  patientId: z.string().min(1),
  date: z.string().optional(),
  weight: z.number().min(1).max(500),
  height: z.number().min(50).max(250).optional().nullable(),
  note: z.string().optional().default(""),
});

function classifyBMI(bmi: number): string {
  if (bmi < 17) return "SEVERELY_UNDERWEIGHT";
  if (bmi < 18.5) return "UNDERWEIGHT";
  if (bmi < 23) return "NORMAL";
  if (bmi < 25) return "OVERWEIGHT";
  if (bmi < 30) return "OBESE_I";
  if (bmi < 35) return "OBESE_II";
  return "OBESE_III";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    if (!patientId) return err("patientId wajib diisi", 422);

    const resolvedId = await resolvePatientId(patientId);
    const records = await supabaseListWeightRecords(resolvedId);

    // Normalize date to ISO string for response shape compatibility
    const normalized = records.map((r: any) => ({
      ...r,
      date: r.date ? new Date(r.date).toISOString() : null,
    }));

    // Compute weight change for each record (from previous)
    const withChanges = normalized.map((r: any, i: number) => {
      const prev = i > 0 ? normalized[i - 1] : null;
      const change = prev ? Math.round((r.weight - prev.weight) * 10) / 10 : null;
      const changePct = prev && prev.weight > 0
        ? Math.round(((r.weight - prev.weight) / prev.weight) * 1000) / 10
        : null;
      return {
        ...r,
        weightChange: change,
        weightChangePct: changePct,
      };
    });

    // Reverse for display (newest first)
    const sorted = withChanges.slice().reverse();

    // Compute summary
    const latest = withChanges[withChanges.length - 1];
    const first = withChanges[0];
    let summary: any = null;
    if (latest && first && withChanges.length > 1) {
      const totalChange = Math.round((latest.weight - first.weight) * 10) / 10;
      const totalPct = first.weight > 0
        ? Math.round(((latest.weight - first.weight) / first.weight) * 1000) / 10
        : 0;
      const periodDays = Math.round(
        (new Date(latest.date).getTime() - new Date(first.date).getTime()) / 86400000,
      );
      const avgPerDay = periodDays > 0
        ? Math.round((totalChange / periodDays) * 100) / 100
        : 0;
      const avgPerWeek = Math.round((avgPerDay * 7) * 10) / 10;

      summary = {
        currentWeight: latest.weight,
        firstWeight: first.weight,
        totalChange,
        totalPct,
        periodDays,
        avgPerDay,
        avgPerWeek,
        recordCount: withChanges.length,
      };
    } else if (latest) {
      summary = {
        currentWeight: latest.weight,
        firstWeight: latest.weight,
        totalChange: 0,
        totalPct: 0,
        periodDays: 0,
        avgPerDay: 0,
        avgPerWeek: 0,
        recordCount: 1,
      };
    }

    // Compute period-based weight loss detection
    const now = new Date();
    const periods = [
      { label: "7 hari", days: 7 },
      { label: "30 hari", days: 30 },
      { label: "3 bulan", days: 90 },
      { label: "6 bulan", days: 180 },
      { label: "1 tahun", days: 365 },
    ];
    const periodChanges = periods.map((p) => {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - p.days);
      const recordsInPeriod = withChanges.filter(
        (r) => new Date(r.date) >= cutoff,
      );
      if (recordsInPeriod.length < 2) {
        return { label: p.label, change: null, pct: null };
      }
      const firstInPeriod = recordsInPeriod[0];
      const lastInPeriod = recordsInPeriod[recordsInPeriod.length - 1];
      const change = Math.round((lastInPeriod.weight - firstInPeriod.weight) * 10) / 10;
      const pct = firstInPeriod.weight > 0
        ? Math.round(((lastInPeriod.weight - firstInPeriod.weight) / firstInPeriod.weight) * 1000) / 10
        : 0;
      return { label: p.label, change, pct };
    });

    // Clinical alerts
    const alerts: { level: "warning" | "danger" | "info"; message: string }[] = [];
    const monthChange = periodChanges.find((p) => p.label === "30 hari");
    if (monthChange && monthChange.pct !== null) {
      if (monthChange.pct <= -10) {
        alerts.push({
          level: "danger",
          message: `Penurunan berat badan ${Math.abs(monthChange.pct)}% dalam 30 hari — Risiko tinggi malnutrisi. Pertimbangkan asesmen SGA/MUST/NRS-2002.`,
        });
      } else if (monthChange.pct <= -5) {
        alerts.push({
          level: "warning",
          message: `Penurunan berat badan ${Math.abs(monthChange.pct)}% dalam 30 hari — Risiko malnutrisi.`,
        });
      }
    }
    // Rapid weight gain alert
    if (monthChange && monthChange.pct !== null && monthChange.pct >= 5) {
      alerts.push({
        level: "warning",
        message: `Kenaikan berat badan ${monthChange.pct}% dalam 30 hari — Evaluasi edema, retensi cairan, atau gagal jantung.`,
      });
    }

    return ok({ records: sorted, summary, periodChanges, alerts });
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

    // Use provided height or patient's last known height
    const height = d.height ?? patient.height ?? null;
    if (!height) return err("Tinggi badan wajib diisi (tidak ada di profil pasien)", 422);

    const bmi = Math.round((d.weight / Math.pow(height / 100, 2)) * 10) / 10;
    const bmiCategory = classifyBMI(bmi);

    // Get previous record for change calculation
    const existingRecords = await supabaseListWeightRecords(resolvedPatientId);
    const prevRecord = existingRecords.length > 0
      ? existingRecords[existingRecords.length - 1]
      : null;

    const weightChange = prevRecord
      ? Math.round((d.weight - prevRecord.weight) * 10) / 10
      : null;
    const weightChangePct = prevRecord && prevRecord.weight > 0
      ? Math.round(((d.weight - prevRecord.weight) / prevRecord.weight) * 1000) / 10
      : null;

    const { data: record, error } = await supabaseCreateWeightRecord({
      patientId: resolvedPatientId,
      date: d.date ?? new Date().toISOString(),
      weight: d.weight,
      height,
      bmi,
      bmiCategory,
      weightChange,
      weightChangePct,
      note: d.note,
    });

    if (error) {
      if (error.includes("Authentication required")) return err(error, 401);
      return err(error, 500);
    }

    // Update patient's current weight + height
    const { error: updateError } = await supabaseUpdatePatient(resolvedPatientId, {
      weight: d.weight,
      height,
    });
    if (updateError) {
      console.error("[weight-records POST] Failed to update patient:", updateError);
    }

    // Also create anthropometry record
    const { client } = await getServerClient();
    const { error: anthroError } = await client.from("anthropometry").insert({
      patient_id: resolvedPatientId,
      weight: d.weight,
      height,
      bmi,
      bmi_category: bmiCategory,
      recorded_at: d.date ?? new Date().toISOString(),
    });
    if (anthroError) {
      console.error("[weight-records POST] Failed to create anthropometry:", anthroError);
    }

    return ok(record, 201);
  } catch (e) {
    return handleZod(e);
  }
}
