"use client";

import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------
// CareLivia — Frontend Supabase Data Layer (Browser Client)
// ALL reads go directly to Supabase PostgreSQL via browser client.
// No API routes for reads — eliminates 404s and ID mismatches.
//
// Writes also go directly to Supabase (RLS requires authenticated session).
// Only AI/complex operations use API routes (meal-plan generate, exercise, etc.)
// ---------------------------------------------------------------------

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient();
  }
  return supabaseClient;
}

// ---------------------------------------------------------------------
// PATIENTS — Direct Supabase reads
// ---------------------------------------------------------------------
export async function supabaseFetchPatients(): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("patients")
    .select("*, diagnoses(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[frontend] fetchPatients error:", error);
    throw new Error(error.message);
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    mrn: p.mrn,
    name: p.name,
    gender: p.gender,
    birthDate: p.birth_date,
    phone: p.phone,
    address: p.address,
    religion: p.religion,
    bloodType: p.blood_type,
    allergy: p.allergy,
    height: p.height,
    weight: p.weight,
    isPregnant: p.is_pregnant,
    pregnancyTrimester: p.pregnancy_trimester,
    isLactating: p.is_lactating,
    lactationMonth: p.lactation_month,
    notes: p.notes,
    diagnoses: (p.diagnoses || []).filter((d: any) => d.active).map((d: any) => ({
      id: d.id,
      type: d.type,
      active: d.active,
    })),
  }));
}

export async function supabaseFetchPatient(id: string): Promise<any | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("patients")
    .select("*, diagnoses(*), nutrition_assessments(*), weight_records(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("[frontend] fetchPatient error:", error);
    return null;
  }

  return {
    id: data.id,
    mrn: data.mrn,
    name: data.name,
    gender: data.gender,
    birthDate: data.birth_date,
    phone: data.phone,
    address: data.address,
    religion: data.religion,
    bloodType: data.blood_type,
    allergy: data.allergy,
    height: data.height,
    weight: data.weight,
    isPregnant: data.is_pregnant,
    pregnancyTrimester: data.pregnancy_trimester,
    isLactating: data.is_lactating,
    lactationMonth: data.lactation_month,
    notes: data.notes,
    diagnoses: (data.diagnoses || []).map((d: any) => ({
      id: d.id,
      patientId: d.patient_id,
      type: d.type,
      icd: d.icd,
      severity: d.severity,
      notes: d.notes,
      active: d.active,
      classification: d.classification,
      status: d.status,
      priority: d.priority,
      diagnosedAt: d.diagnosed_at,
      doctor: d.doctor,
      target: d.target,
    })),
    assessments: (data.nutrition_assessments || []).map((a: any) => ({
      id: a.id,
      patientId: a.patient_id,
      recordedAt: a.recorded_at,
      must: a.must,
      mustScore: a.must_score,
      sga: a.sga,
      nrs2002: a.nrs2002,
      nrsScore: a.nrs_score,
      ecog: a.ecog,
      barthel: a.barthel,
      activity: a.activity,
      stress: a.stress,
    })),
    weightRecords: (data.weight_records || []).map((w: any) => ({
      id: w.id,
      patientId: w.patient_id,
      date: w.date,
      weight: w.weight,
      height: w.height,
      bmi: w.bmi,
      bmiCategory: w.bmi_category,
      note: w.note,
    })),
  };
}

// ---------------------------------------------------------------------
// FOODS — Direct Supabase reads (anon can read foods)
// ---------------------------------------------------------------------
export async function supabaseFetchFoods(params?: {
  q?: string;
  categoryId?: string;
  highProtein?: boolean;
  lowGi?: boolean;
  lowSodium?: boolean;
  highFiber?: boolean;
}): Promise<{ foods: any[]; categories: any[] }> {
  const supabase = getSupabase();

  // Fetch foods with category
  let query = supabase
    .from("foods")
    .select("*, food_categories(*)")
    .is("deleted_at", null)
    .eq("approved", true)
    .order("name")
    .limit(200);

  if (params?.q) {
    query = query.or(`name.ilike.%${params.q}%,english_name.ilike.%${params.q}%,tags.ilike.%${params.q}%`);
  }

  const { data: foods, error: foodsError } = await query;
  if (foodsError) console.error("[frontend] fetchFoods error:", foodsError);

  // Fetch categories
  const { data: categories, error: catError } = await supabase
    .from("food_categories")
    .select("*")
    .order("name");
  if (catError) console.error("[frontend] fetchCategories error:", catError);

  // Map foods to camelCase
  let mapped = (foods || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    englishName: f.english_name,
    categoryId: f.category_id,
    category: f.food_categories ? {
      id: f.food_categories.id,
      name: f.food_categories.name,
      slug: f.food_categories.slug,
      icon: f.food_categories.icon,
    } : null,
    energy: f.energy,
    protein: f.protein,
    fat: f.fat,
    carb: f.carb,
    fiber: f.fiber,
    sodium: f.sodium,
    potassium: f.potassium,
    calcium: f.calcium,
    iron: f.iron,
    gi: f.gi,
    urt: f.urt,
    urtGram: f.urt_gram,
    price: f.price,
    priceUnit: f.price_unit,
    priceLocation: f.price_location,
    priceSource: f.price_source,
    priceUpdatedAt: f.price_updated_at,
    priceIsEstimate: f.price_is_estimate,
    tags: f.tags,
    source: f.source,
  }));

  // Apply filters
  if (params?.categoryId) mapped = mapped.filter((f) => f.categoryId === params.categoryId);
  if (params?.highProtein) mapped = mapped.filter((f) => f.protein >= 10);
  if (params?.lowGi) mapped = mapped.filter((f) => f.gi < 55 && f.gi > 0);
  if (params?.lowSodium) mapped = mapped.filter((f) => f.sodium <= 100);
  if (params?.highFiber) mapped = mapped.filter((f) => f.fiber >= 3);

  // Count foods per category
  const countMap = new Map<string, number>();
  for (const f of mapped) {
    if (f.categoryId) countMap.set(f.categoryId, (countMap.get(f.categoryId) || 0) + 1);
  }

  const mappedCategories = (categories || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    _count: { foods: countMap.get(c.id) || 0 },
  }));

  return { foods: mapped, categories: mappedCategories };
}

// ---------------------------------------------------------------------
// DASHBOARD — Direct Supabase count queries + patient summaries
// ---------------------------------------------------------------------
export async function supabaseFetchDashboard(): Promise<any> {
  const supabase = getSupabase();

  try {
    // Count queries
    const [patientsCount, foodsCount, mealPlansCount, foodRecordsData] = await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("foods").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("approved", true),
      supabase.from("meal_plans").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "FINAL"),
      supabase.from("food_records").select("id, cal, date", { count: "exact" }).limit(500),
    ]);

    // Fetch recent patients with diagnoses for summaries
    const { data: patients } = await supabase
      .from("patients")
      .select("id, mrn, name, height, weight, diagnoses(*)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch recent meal plans (without nested patient join to avoid FK hint issues)
    const { data: recentPlansRaw } = await supabase
      .from("meal_plans")
      .select("id, date, total_cal, compliance, status, patient_id")
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(10);

    // Fetch patient names separately
    const patientIds = (recentPlansRaw || []).map((p: any) => p.patient_id).filter(Boolean);
    let patientMap: Record<string, any> = {};
    if (patientIds.length > 0) {
      const { data: planPatients } = await supabase
        .from("patients")
        .select("id, name, mrn")
        .in("id", patientIds);
      for (const p of (planPatients || [])) {
        patientMap[p.id] = p;
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRecords = (foodRecordsData.data || []).filter((r: any) => new Date(r.date) >= todayStart);
    const todayCalories = todayRecords.reduce((sum: number, r: any) => sum + (r.cal || 0), 0);

    // Build patient summaries
    const patientSummaries = (patients || []).map((p: any) => {
      const bmi = p.height && p.weight && p.height > 0
        ? p.weight / Math.pow(p.height / 100, 2)
        : null;
      return {
        id: p.id,
        mrn: p.mrn,
        name: p.name,
        bmi: bmi ? Math.round(bmi * 10) / 10 : null,
        diagnoses: (p.diagnoses || []).filter((d: any) => d.active).map((d: any) => d.type),
      };
    });

    // Build recent plans — use patientMap instead of nested join
    const recentPlans = (recentPlansRaw || []).map((mp: any) => {
      const patient = patientMap[mp.patient_id];
      return {
        id: mp.id,
        date: mp.date,
        totalCal: mp.total_cal,
        compliance: mp.compliance,
        status: mp.status,
        patientName: patient?.name || "Unknown",
        patientMrn: patient?.mrn || "",
      };
    });

    // Diagnosis distribution
    const diagnosisDist: Record<string, number> = {};
    for (const p of (patients || [])) {
      for (const d of (p.diagnoses || [])) {
        if (d.active) {
          diagnosisDist[d.type] = (diagnosisDist[d.type] || 0) + 1;
        }
      }
    }

    return {
      totalPatients: patientsCount.count ?? 0,
      activeMealPlans: mealPlansCount.count ?? 0,
      totalFoods: foodsCount.count ?? 0,
      todayCalTotal: Math.round(todayCalories),
      todayRecords: todayRecords.length,
      patientSummaries,
      recentPlans,
      diagnosisDistribution: diagnosisDist,
    };
  } catch (e) {
    console.error("[frontend] fetchDashboard error:", e);
    return {
      totalPatients: 0,
      activeMealPlans: 0,
      totalFoods: 0,
      todayCalTotal: 0,
      todayRecords: 0,
      patientSummaries: [],
      recentPlans: [],
      diagnosisDistribution: {},
    };
  }
}

// ---------------------------------------------------------------------
// WEIGHT RECORDS — Direct Supabase
// ---------------------------------------------------------------------
export async function supabaseFetchWeightRecords(patientId: string): Promise<any> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("weight_records")
    .select("*")
    .eq("patient_id", patientId)
    .order("date", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[frontend] fetchWeightRecords error:", error);
    return { records: [], summary: null, periodChanges: [], alerts: [] };
  }

  const records = (data || []).map((r: any) => ({
    id: r.id,
    patientId: r.patient_id,
    date: r.date,
    weight: r.weight,
    height: r.height,
    bmi: r.bmi,
    bmiCategory: r.bmi_category,
    weightChange: r.weight_change,
    weightChangePct: r.weight_change_pct,
    note: r.note,
  }));

  // Compute summary
  const latest = records[records.length - 1] || null;
  const first = records[0] || null;
  const totalChange = latest && first ? Math.round((latest.weight - first.weight) * 10) / 10 : 0;
  const totalPct = latest && first && first.weight > 0
    ? Math.round(((latest.weight - first.weight) / first.weight) * 1000) / 10
    : 0;

  return {
    records,
    summary: latest ? {
      latestWeight: latest.weight,
      latestBMI: latest.bmi,
      latestBMICategory: latest.bmiCategory,
      latestDate: latest.date,
      totalChange,
      totalPct,
      recordCount: records.length,
    } : null,
    periodChanges: [
      { label: "7 hari", change: null, pct: null },
      { label: "30 hari", change: null, pct: null },
      { label: "3 bulan", change: null, pct: null },
      { label: "6 bulan", change: null, pct: null },
      { label: "1 tahun", change: null, pct: null },
    ],
    alerts: [],
  };
}

export async function supabaseAddWeightRecord(data: {
  patientId: string;
  weight: number;
  height?: number | null;
  date?: string;
  note?: string;
}): Promise<any> {
  const supabase = getSupabase();
  const height = data.height ?? null;
  const bmi = height ? Math.round((data.weight / Math.pow(height / 100, 2)) * 10) / 10 : null;
  const bmiCategory = bmi
    ? bmi < 18.5 ? "UNDERWEIGHT" : bmi < 23 ? "NORMAL" : bmi < 25 ? "OVERWEIGHT" : "OBESE"
    : null;

  const { data: record, error } = await supabase
    .from("weight_records")
    .insert({
      patient_id: data.patientId,
      date: data.date ?? new Date().toISOString(),
      weight: data.weight,
      height,
      bmi,
      bmi_category: bmiCategory,
      note: data.note ?? "",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Update patient's current weight
  await supabase
    .from("patients")
    .update({ weight: data.weight, height: height ?? undefined })
    .eq("id", data.patientId);

  return record;
}

export async function supabaseDeleteWeightRecord(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("weight_records").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// NUTRITION ASSESSMENTS — Direct Supabase
// ---------------------------------------------------------------------
export async function supabaseFetchAssessments(patientId: string): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("nutrition_assessments")
    .select("*")
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[frontend] fetchAssessments error:", error);
    return [];
  }

  return (data || []).map((a: any) => ({
    id: a.id,
    patientId: a.patient_id,
    recordedAt: a.recorded_at,
    must: a.must,
    mustScore: a.must_score,
    sga: a.sga,
    nrs2002: a.nrs2002,
    nrsScore: a.nrs_score,
    mna: a.mna,
    mnaScore: a.mna_score,
    pps: a.pps,
    ecog: a.ecog,
    barthel: a.barthel,
    frailty: a.frailty,
    frailtyScore: a.frailty_score,
    fallRisk: a.fall_risk,
    handGrip: a.hand_grip,
    calfCirc: a.calf_circ,
    activity: a.activity,
    stress: a.stress,
    notes: a.notes,
    karnofsky: a.karnofsky,
    cfs: a.cfs,
    sarcfScore: a.sarcf_score,
    sarcfPositive: a.sarcf_positive,
    calfCategory: a.calf_category,
    sarcCalfScore: a.sarc_calf_score,
    sarcCalfPositive: a.sarc_calf_positive,
    morseHistoryFall: a.morse_history_fall,
    morseSecondaryDx: a.morse_secondary_dx,
    morseAmbulatoryAid: a.morse_ambulatory_aid,
    morseIvTherapy: a.morse_iv_therapy,
    morseGait: a.morse_gait,
    morseMentalStatus: a.morse_mental_status,
    morseScore: a.morse_score,
    tugCategory: a.tug_category,
    barthelItems: a.barthel_items,
  }));
}

export async function supabaseCreateAssessment(data: any): Promise<any> {
  const supabase = getSupabase();
  const { data: record, error } = await supabase
    .from("nutrition_assessments")
    .insert({
      patient_id: data.patientId,
      recorded_at: new Date().toISOString(),
      must: data.must,
      must_score: data.mustScore,
      sga: data.sga,
      nrs2002: data.nrs2002,
      nrs_score: data.nrsScore,
      mna: data.mna,
      mna_score: data.mnaScore,
      pps: data.pps,
      ecog: data.ecog,
      barthel: data.barthel,
      frailty: data.frailty,
      frailty_score: data.frailtyScore,
      fall_risk: data.fallRisk,
      hand_grip: data.handGrip,
      calf_circ: data.calfCirc,
      activity: data.activity,
      stress: data.stress,
      notes: data.notes ?? "",
      karnofsky: data.karnofsky ?? null,
      cfs: data.cfs ?? null,
      sarcf_score: data.sarcfScore ?? null,
      sarcf_positive: data.sarcfPositive ?? null,
      calf_category: data.calfCategory ?? null,
      sarc_calf_score: data.sarcCalfScore ?? null,
      sarc_calf_positive: data.sarcCalfPositive ?? null,
      morse_history_fall: data.morseHistoryFall ?? null,
      morse_secondary_dx: data.morseSecondaryDx ?? null,
      morse_ambulatory_aid: data.morseAmbulatoryAid ?? null,
      morse_iv_therapy: data.morseIvTherapy ?? null,
      morse_gait: data.morseGait ?? null,
      morse_mental_status: data.morseMentalStatus ?? null,
      morse_score: data.morseScore ?? null,
      tug_category: data.tugCategory ?? null,
      barthel_items: data.barthelItems ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return record;
}

export async function supabaseDeleteAssessment(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("nutrition_assessments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// DIAGNOSIS — standalone CRUD (Diagnosis Aktif card). Separate from
// patient create/update, so a patient can accumulate multiple diagnoses
// over time without re-submitting the whole patient form. Every write
// appends a row to diagnosis_history for the timeline/audit trail.
// ---------------------------------------------------------------------
function diagnosisFromSupabase(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    type: row.type,
    icd: row.icd,
    severity: row.severity,
    notes: row.notes,
    active: row.active,
    classification: row.classification,
    status: row.status,
    priority: row.priority,
    diagnosedAt: row.diagnosed_at,
    doctor: row.doctor,
    target: row.target,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function supabaseFetchDiagnoses(patientId: string): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("patient_id", patientId)
    .order("priority", { ascending: true })
    .order("diagnosed_at", { ascending: false });

  if (error) {
    console.error("[frontend] fetchDiagnoses error:", error);
    return [];
  }
  return (data || []).map(diagnosisFromSupabase);
}

export async function supabaseCreateDiagnosis(data: {
  patientId: string;
  type: string;
  icd?: string;
  classification?: string;
  status?: string;
  priority?: string;
  diagnosedAt?: string;
  doctor?: string;
  target?: string;
  notes?: string;
}): Promise<any> {
  const supabase = getSupabase();
  const { data: record, error } = await supabase
    .from("diagnoses")
    .insert({
      patient_id: data.patientId,
      type: data.type,
      icd: data.icd ?? null,
      active: true,
      classification: data.classification ?? "UTAMA",
      status: data.status ?? "AKTIF",
      priority: data.priority ?? "SEDANG",
      diagnosed_at: data.diagnosedAt ?? new Date().toISOString().slice(0, 10),
      doctor: data.doctor ?? null,
      target: data.target ?? null,
      notes: data.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("diagnosis_history").insert({
    diagnosis_id: record.id,
    patient_id: data.patientId,
    action: "CREATED",
    changes: record,
  });

  return diagnosisFromSupabase(record);
}

export async function supabaseUpdateDiagnosis(
  id: string,
  data: Partial<{
    icd: string;
    classification: string;
    status: string;
    priority: string;
    diagnosedAt: string;
    doctor: string;
    target: string;
    notes: string;
    active: boolean;
  }>,
): Promise<any> {
  const supabase = getSupabase();
  const updatePayload: any = {};
  if (data.icd !== undefined) updatePayload.icd = data.icd;
  if (data.classification !== undefined) updatePayload.classification = data.classification;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.priority !== undefined) updatePayload.priority = data.priority;
  if (data.diagnosedAt !== undefined) updatePayload.diagnosed_at = data.diagnosedAt;
  if (data.doctor !== undefined) updatePayload.doctor = data.doctor;
  if (data.target !== undefined) updatePayload.target = data.target;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.active !== undefined) updatePayload.active = data.active;

  const { data: record, error } = await supabase
    .from("diagnoses")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("diagnosis_history").insert({
    diagnosis_id: id,
    patient_id: record.patient_id,
    action: "UPDATED",
    changes: updatePayload,
  });

  return diagnosisFromSupabase(record);
}

export async function supabaseDeleteDiagnosis(id: string): Promise<void> {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from("diagnoses").select("patient_id").eq("id", id).single();

  const { error } = await supabase.from("diagnoses").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (existing) {
    await supabase.from("diagnosis_history").insert({
      diagnosis_id: id,
      patient_id: existing.patient_id,
      action: "DELETED",
      changes: null,
    });
  }
}

// ---------------------------------------------------------------------
// LABORATORIUM — categorized lab results, status auto-computed against
// reference_min/max, and reference data (critical thresholds + monitoring
// schedule) for clinical alerts / reminders.
// ---------------------------------------------------------------------
function labResultFromSupabase(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    category: row.category,
    testName: row.test_name,
    value: row.value,
    unit: row.unit,
    referenceMin: row.reference_min,
    referenceMax: row.reference_max,
    status: row.status,
    labDate: row.lab_date,
    laboratoryName: row.laboratory_name,
    notes: row.notes,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// NORMAL | BORDERLINE | TINGGI | RENDAH — see canonical definition in
// @/lib/clinical/lab-catalog (re-exported here for callers that already
// import status/CRUD helpers from this file).
export { computeLabStatus } from "@/lib/clinical/lab-catalog";
import { computeLabStatus } from "@/lib/clinical/lab-catalog";

export async function supabaseFetchLabResults(patientId: string): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("laboratory_results")
    .select("*")
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("lab_date", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[frontend] fetchLabResults error:", error);
    return [];
  }
  return (data || []).map(labResultFromSupabase);
}

export async function supabaseCreateLabResult(data: {
  patientId: string;
  category: string;
  testName: string;
  value: number;
  unit?: string;
  referenceMin?: number | null;
  referenceMax?: number | null;
  labDate?: string;
  laboratoryName?: string;
  notes?: string;
  source?: "MANUAL" | "OCR";
}): Promise<any> {
  const supabase = getSupabase();
  const status = computeLabStatus(data.value, data.referenceMin ?? null, data.referenceMax ?? null);
  const { data: record, error } = await supabase
    .from("laboratory_results")
    .insert({
      patient_id: data.patientId,
      category: data.category,
      test_name: data.testName,
      value: data.value,
      unit: data.unit ?? null,
      reference_min: data.referenceMin ?? null,
      reference_max: data.referenceMax ?? null,
      status,
      lab_date: data.labDate ?? new Date().toISOString().slice(0, 10),
      laboratory_name: data.laboratoryName ?? null,
      notes: data.notes ?? null,
      source: data.source ?? "MANUAL",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return labResultFromSupabase(record);
}

export async function supabaseUpdateLabResult(
  id: string,
  data: Partial<{
    value: number;
    unit: string;
    referenceMin: number | null;
    referenceMax: number | null;
    labDate: string;
    laboratoryName: string;
    notes: string;
  }>,
): Promise<any> {
  const supabase = getSupabase();
  const updatePayload: any = {};
  if (data.unit !== undefined) updatePayload.unit = data.unit;
  if (data.referenceMin !== undefined) updatePayload.reference_min = data.referenceMin;
  if (data.referenceMax !== undefined) updatePayload.reference_max = data.referenceMax;
  if (data.labDate !== undefined) updatePayload.lab_date = data.labDate;
  if (data.laboratoryName !== undefined) updatePayload.laboratory_name = data.laboratoryName;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.value !== undefined) {
    updatePayload.value = data.value;
    updatePayload.status = computeLabStatus(
      data.value,
      data.referenceMin ?? null,
      data.referenceMax ?? null,
    );
  }

  const { data: record, error } = await supabase
    .from("laboratory_results")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return labResultFromSupabase(record);
}

export async function supabaseDeleteLabResult(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("laboratory_results")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function supabaseFetchLabCriticalThresholds(): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("lab_critical_thresholds").select("*");
  if (error) return [];
  return (data || []).map((r: any) => ({
    testName: r.test_name,
    criticalLow: r.critical_low,
    criticalHigh: r.critical_high,
    message: r.message,
  }));
}

export async function supabaseFetchLabMonitoringSchedule(): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("lab_monitoring_schedule").select("*");
  if (error) return [];
  return (data || []).map((r: any) => ({
    diagnosisType: r.diagnosis_type,
    testName: r.test_name,
    intervalMonths: r.interval_months,
  }));
}

// ---------------------------------------------------------------------
// FOOD RECORDS — Direct Supabase
// ---------------------------------------------------------------------
export async function supabaseFetchFoodRecords(patientId: string, date?: string): Promise<any[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("food_records")
    .select("*, foods(*)")
    .eq("patient_id", patientId)
    .order("date", { ascending: false })
    .limit(100);

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    query = query.gte("date", start.toISOString()).lte("date", end.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error("[frontend] fetchFoodRecords error:", error);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    patientId: r.patient_id,
    date: r.date,
    slot: r.slot,
    foodId: r.food_id,
    amount: r.amount,
    consumed: r.consumed,
    cal: r.cal,
    protein: r.protein,
    fat: r.fat,
    carb: r.carb,
    fiber: r.fiber,
    sodium: r.sodium,
    notes: r.notes,
    food: r.foods ? {
      id: r.foods.id,
      name: r.foods.name,
      energy: r.foods.energy,
      protein: r.foods.protein,
      fat: r.foods.fat,
      carb: r.foods.carb,
      fiber: r.foods.fiber,
      category: r.foods.food_categories ? {
        slug: r.foods.food_categories.slug,
        name: r.foods.food_categories.name,
      } : null,
    } : null,
  }));
}

export async function supabaseAddFoodRecord(data: {
  patientId: string;
  foodId: string;
  slot: string;
  amount: number;
  consumed?: number;
  date?: string;
  notes?: string;
}): Promise<any> {
  const supabase = getSupabase();

  // Fetch food to compute nutrition
  const { data: food } = await supabase
    .from("foods")
    .select("*")
    .eq("id", data.foodId)
    .single();

  if (!food) throw new Error("Makanan tidak ditemukan");

  const ratio = data.amount / 100;
  const consumedRatio = (data.consumed ?? 100) / 100;

  const { data: record, error } = await supabase
    .from("food_records")
    .insert({
      patient_id: data.patientId,
      food_id: data.foodId,
      slot: data.slot.toUpperCase(),
      amount: data.amount,
      consumed: data.consumed ?? 100,
      date: data.date ?? new Date().toISOString(),
      cal: food.energy * ratio * consumedRatio,
      protein: food.protein * ratio * consumedRatio,
      fat: food.fat * ratio * consumedRatio,
      carb: food.carb * ratio * consumedRatio,
      fiber: food.fiber * ratio * consumedRatio,
      sodium: food.sodium * ratio * consumedRatio,
      notes: data.notes ?? "",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return record;
}

export async function supabaseDeleteFoodRecord(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("food_records").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// MEAL PLANS — Direct Supabase reads
// ---------------------------------------------------------------------
export async function supabaseFetchMealPlans(
  patientId?: string,
  cached?: { patients?: any[]; presets?: any[] },
): Promise<any[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("meal_plans")
    .select("*")
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(20);

  if (patientId) {
    query = query.eq("patient_id", patientId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[frontend] fetchMealPlans error:", JSON.stringify(error));
    return [];
  }

  // Fetch related data separately to avoid FK hint issues
  const plans = data || [];
  if (plans.length === 0) return [];

  // Get unique patient IDs and food IDs
  const patientIds = [...new Set(plans.map((p: any) => p.patient_id).filter(Boolean))];
  const presetIds = [...new Set(plans.map((p: any) => p.preset_id).filter(Boolean))];
  const planIds = plans.map((p: any) => p.id);

  // Reuse already-loaded patients/presets (e.g. from usePatients()/usePresets()
  // hooks on the same page) instead of re-querying Supabase for data we
  // already have in memory. Only fall back to a network call for IDs that
  // are genuinely missing from the provided cache.
  const cachedPatientMap = new Map((cached?.patients || []).map((p: any) => [p.id, p]));
  const missingPatientIds = patientIds.filter((id) => !cachedPatientMap.has(id));

  const cachedPresetMap = new Map((cached?.presets || []).map((p: any) => [p.id, p]));
  const missingPresetIds = presetIds.filter((id) => !cachedPresetMap.has(id));

  const [patientsRes, presetsRes, itemsRes] = await Promise.all([
    missingPatientIds.length > 0
      ? supabase.from("patients").select("*, diagnoses(*)").in("id", missingPatientIds)
      : Promise.resolve({ data: [], error: null }),
    missingPresetIds.length > 0
      ? supabase.from("nutrition_presets").select("*").in("id", missingPresetIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("meal_plan_items").select("*, foods(*)").in("meal_plan_id", planIds).order("created_at", { ascending: true }),
  ]);

  // Build lookup maps — cached entries first, then whatever we had to fetch
  const patientMap: Record<string, any> = {};
  for (const p of [...(cached?.patients || []), ...(patientsRes.data || [])]) {
    if (!patientIds.includes(p.id)) continue;
    patientMap[p.id] = {
      id: p.id,
      name: p.name,
      mrn: p.mrn,
      diagnoses: (p.diagnoses || []).filter((d: any) => d.active).map((d: any) => ({ type: d.type, active: d.active })),
    };
  }

  const presetMap: Record<string, any> = {};
  for (const p of [...(cached?.presets || []), ...(presetsRes.data || [])]) {
    if (!presetIds.includes(p.id)) continue;
    presetMap[p.id] = {
      id: p.id,
      name: p.name,
      totalCal: p.total_cal ?? p.totalCal,
    };
  }

  const itemsByPlan: Record<string, any[]> = {};
  for (const item of (itemsRes.data || [])) {
    if (!itemsByPlan[item.meal_plan_id]) itemsByPlan[item.meal_plan_id] = [];
    itemsByPlan[item.meal_plan_id].push({
      id: item.id,
      slot: item.slot,
      foodId: item.food_id,
      amount: item.amount,
      cal: item.cal,
      protein: item.protein,
      fat: item.fat,
      carb: item.carb,
      fiber: item.fiber,
      sodium: item.sodium,
      food: item.foods ? {
        id: item.foods.id,
        name: item.foods.name,
      } : null,
    });
  }

  return plans.map((p: any) => ({
    id: p.id,
    patientId: p.patient_id,
    presetId: p.preset_id,
    date: p.date,
    targetCal: p.target_cal,
    targetProtein: p.target_protein,
    targetFat: p.target_fat,
    targetCarb: p.target_carb,
    targetFiber: p.target_fiber,
    targetSodium: p.target_sodium,
    totalCal: p.total_cal,
    totalProtein: p.total_protein,
    totalFat: p.total_fat,
    totalCarb: p.total_carb,
    totalFiber: p.total_fiber,
    totalSodium: p.total_sodium,
    compliance: p.compliance,
    status: p.status,
    isActive: p.is_active ?? false,
    aiModel: p.ai_model,
    aiReasoning: p.ai_reasoning,
    preset: presetMap[p.preset_id] || null,
    patient: patientMap[p.patient_id] || null,
    items: itemsByPlan[p.id] || [],
  }));
}

// ---------------------------------------------------------------------
// NUTRITION PRESETS — Direct Supabase
// ---------------------------------------------------------------------
export async function supabaseFetchPresets(patientId?: string): Promise<any[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("nutrition_presets")
    .select("*")
    .is("deleted_at", null)
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: true });

  if (patientId) {
    query = query.or(`patient_id.eq.${patientId},is_template.eq.true`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[frontend] fetchPresets error:", error);
    return [];
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    patientId: p.patient_id,
    name: p.name,
    description: p.description,
    color: p.color,
    icon: p.icon,
    isTemplate: p.is_template,
    isFavorite: p.is_favorite,
    totalCal: p.total_cal,
    proteinPct: p.protein_pct,
    carbPct: p.carb_pct,
    fatPct: p.fat_pct,
    proteinG: p.protein_g,
    carbG: p.carb_g,
    fatG: p.fat_g,
    fiberG: p.fiber_g,
    sodiumMg: p.sodium_mg,
    goal: p.goal,
    diagnoses: p.diagnoses,
  }));
}

// ---------------------------------------------------------------------
// RECIPES — Direct Supabase
// ---------------------------------------------------------------------
export async function supabaseFetchRecipes(q?: string): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("recipes")
    .select("*, recipe_items(*, foods(*))")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[frontend] fetchRecipes error:", error);
    return [];
  }

  let recipes = (data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    servings: r.servings,
    method: r.method,
    items: (r.recipe_items || []).map((ri: any) => ({
      id: ri.id,
      foodId: ri.food_id,
      amount: ri.amount,
      food: ri.foods ? {
        id: ri.foods.id,
        name: ri.foods.name,
        energy: ri.foods.energy,
        category: ri.foods.food_categories ? { slug: ri.foods.food_categories.slug } : null,
      } : null,
    })),
  }));

  if (q) {
    recipes = recipes.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  }

  return recipes;
}

// ---------------------------------------------------------------------
// SAVED MEAL PLANS — Direct Supabase
// ---------------------------------------------------------------------
export async function supabaseFetchSavedMealPlans(patientId?: string): Promise<any[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("saved_meal_plans")
    .select("*, saved_meal_plan_items(*, foods(*))")
    .order("created_at", { ascending: false })
    .limit(50);

  if (patientId) {
    query = query.eq("patient_id", patientId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[frontend] fetchSavedMealPlans error:", error);
    return [];
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    patientId: p.patient_id,
    name: p.name,
    totalCal: p.total_cal,
    totalProtein: p.total_protein,
    totalFat: p.total_fat,
    totalCarb: p.total_carb,
    totalFiber: p.total_fiber,
    totalSodium: p.total_sodium,
    notes: p.notes,
    createdAt: p.created_at,
    items: (p.saved_meal_plan_items || []).map((i: any) => ({
      id: i.id,
      slot: i.slot,
      foodId: i.food_id,
      foodName: i.food_name,
      amount: i.amount,
      cal: i.cal,
      protein: i.protein,
      food: i.foods ? {
        id: i.foods.id,
        name: i.foods.name,
        category: i.foods.food_categories ? { slug: i.foods.food_categories.slug } : null,
      } : null,
    })),
  }));
}

export async function supabaseCreateSavedMealPlan(data: any): Promise<any> {
  const supabase = getSupabase();
  const { data: plan, error } = await supabase
    .from("saved_meal_plans")
    .insert({
      patient_id: data.patientId ?? null,
      name: data.name,
      total_cal: data.totalCal ?? 0,
      total_protein: data.totalProtein ?? 0,
      total_fat: data.totalFat ?? 0,
      total_carb: data.totalCarb ?? 0,
      total_fiber: data.totalFiber ?? 0,
      total_sodium: data.totalSodium ?? 0,
      notes: data.notes ?? "",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (data.items && data.items.length > 0) {
    // Fetch food names
    const foodIds = [...new Set(data.items.map((i: any) => i.foodId))];
    const { data: foods } = await supabase.from("foods").select("id, name").in("id", foodIds);
    const nameMap = new Map((foods || []).map((f: any) => [f.id, f.name]));

    const items = data.items.map((i: any) => ({
      saved_meal_plan_id: plan.id,
      slot: (i.slot ?? "LUNCH").toUpperCase(),
      food_id: i.foodId,
      food_name: i.foodName ?? nameMap.get(i.foodId) ?? "Unknown",
      amount: i.amount,
      cal: i.cal ?? 0,
      protein: i.protein ?? 0,
      fat: i.fat ?? 0,
      carb: i.carb ?? 0,
      fiber: i.fiber ?? 0,
      sodium: i.sodium ?? 0,
    }));
    const { error: itemsError } = await supabase.from("saved_meal_plan_items").insert(items);
    if (itemsError) throw new Error(itemsError.message);
  }

  return plan;
}

export async function supabaseDeleteSavedMealPlan(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("saved_meal_plans").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// PATIENT CREATE/UPDATE — Direct Supabase
// ---------------------------------------------------------------------
export async function supabaseCreatePatient(data: any): Promise<any> {
  const supabase = getSupabase();
  const { data: patient, error } = await supabase
    .from("patients")
    .insert({
      mrn: data.mrn,
      name: data.name,
      gender: data.gender,
      birth_date: data.birthDate,
      phone: data.phone ?? "",
      address: data.address ?? "",
      religion: data.religion ?? "ISLAM",
      blood_type: data.bloodType ?? "UNKNOWN",
      allergy: data.allergy ?? "",
      height: data.height ?? null,
      weight: data.weight ?? null,
      is_pregnant: data.isPregnant ?? false,
      pregnancy_trimester: data.pregnancyTrimester ?? 0,
      is_lactating: data.isLactating ?? false,
      lactation_month: data.lactationMonth ?? 0,
      notes: data.notes,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Create diagnoses
  if (data.diagnoses && data.diagnoses.length > 0) {
    const diagnoses = data.diagnoses.map((type: string) => ({
      patient_id: patient.id,
      type,
      active: true,
    }));
    await supabase.from("diagnoses").insert(diagnoses);
  }

  return patient;
}

export async function supabaseUpdatePatient(id: string, data: any): Promise<any> {
  const supabase = getSupabase();
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.mrn !== undefined) updateData.mrn = data.mrn;
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.birthDate !== undefined) updateData.birth_date = data.birthDate;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.religion !== undefined) updateData.religion = data.religion;
  if (data.bloodType !== undefined) updateData.blood_type = data.bloodType;
  if (data.allergy !== undefined) updateData.allergy = data.allergy;
  if (data.height !== undefined) updateData.height = data.height;
  if (data.weight !== undefined) updateData.weight = data.weight;
  if (data.isPregnant !== undefined) updateData.is_pregnant = data.isPregnant;
  if (data.pregnancyTrimester !== undefined) updateData.pregnancy_trimester = data.pregnancyTrimester;
  if (data.isLactating !== undefined) updateData.is_lactating = data.isLactating;
  if (data.lactationMonth !== undefined) updateData.lactation_month = data.lactationMonth;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const { data: patient, error } = await supabase
    .from("patients")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return patient;
}

export async function supabaseSoftDeletePatient(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("patients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// RECIPE CREATE — Direct Supabase
// ---------------------------------------------------------------------
export async function supabaseCreateRecipe(data: any): Promise<any> {
  const supabase = getSupabase();
  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      name: data.name,
      description: data.description ?? "",
      servings: data.servings ?? 1,
      method: data.method ?? "",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (data.items && data.items.length > 0) {
    const items = data.items.map((i: any) => ({
      recipe_id: recipe.id,
      food_id: i.foodId,
      amount: i.amount,
    }));
    const { error: itemsError } = await supabase.from("recipe_items").insert(items);
    if (itemsError) throw new Error(itemsError.message);
  }

  return recipe;
}

export async function supabaseDeleteRecipe(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("recipes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// FOOD CRUD — Direct Supabase
// ---------------------------------------------------------------------
export async function supabaseCreateFood(data: any): Promise<any> {
  const supabase = getSupabase();
  const { data: food, error } = await supabase
    .from("foods")
    .insert({
      name: data.name,
      english_name: data.englishName ?? null,
      alias: data.alias ?? null,
      code: data.code ?? null,
      category_id: data.categoryId,
      source: data.source ?? "CUSTOM",
      description: data.description ?? null,
      energy: data.energy,
      protein: data.protein,
      fat: data.fat,
      carb: data.carb,
      fiber: data.fiber ?? 0,
      sodium: data.sodium ?? 0,
      potassium: data.potassium ?? 0,
      calcium: data.calcium ?? 0,
      magnesium: data.magnesium ?? 0,
      iron: data.iron ?? 0,
      phosphorus: data.phosphorus ?? 0,
      zinc: data.zinc ?? 0,
      vit_a: data.vitA ?? 0,
      vit_b1: data.vitB1 ?? 0,
      vit_c: data.vitC ?? 0,
      gi: data.gi ?? 0,
      urt: data.urt ?? null,
      urt_gram: data.urtGram ?? null,
      bdd: data.bdd ?? 100,
      price: data.price ?? 0,
      tags: data.tags ?? "",
      approved: data.approved ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return food;
}

export async function supabaseUpdateFood(id: string, data: any): Promise<any> {
  const supabase = getSupabase();
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.energy !== undefined) updateData.energy = data.energy;
  if (data.protein !== undefined) updateData.protein = data.protein;
  if (data.fat !== undefined) updateData.fat = data.fat;
  if (data.carb !== undefined) updateData.carb = data.carb;
  if (data.fiber !== undefined) updateData.fiber = data.fiber;
  if (data.sodium !== undefined) updateData.sodium = data.sodium;
  if (data.potassium !== undefined) updateData.potassium = data.potassium;
  if (data.calcium !== undefined) updateData.calcium = data.calcium;
  if (data.iron !== undefined) updateData.iron = data.iron;
  if (data.gi !== undefined) updateData.gi = data.gi;
  if (data.urt !== undefined) updateData.urt = data.urt;
  if (data.urtGram !== undefined) updateData.urt_gram = data.urtGram;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.approved !== undefined) updateData.approved = data.approved;
  if (data.categoryId !== undefined) updateData.category_id = data.categoryId;

  const { data: food, error } = await supabase
    .from("foods")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return food;
}

export async function supabaseDeleteFood(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("foods")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function supabaseFetchFoodPriceHistory(foodId: string): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("food_price_history")
    .select("*")
    .eq("food_id", foodId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data || []).map((r: any) => ({
    id: r.id,
    foodId: r.food_id,
    price: r.price,
    previousPrice: r.previous_price,
    unit: r.unit,
    location: r.location,
    source: r.source,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

export async function supabaseUpdateFoodPrice(data: {
  id: string;
  price: number;
  unit?: string;
  location?: string | null;
  source?: string | null;
  notes?: string | null;
}): Promise<any> {
  const supabase = getSupabase();
  // Get previous price
  const { data: food } = await supabase
    .from("foods")
    .select("price")
    .eq("id", data.id)
    .single();

  // Insert price history
  await supabase.from("food_price_history").insert({
    food_id: data.id,
    price: data.price,
    previous_price: food?.price ?? null,
    unit: data.unit ?? "g",
    location: data.location ?? null,
    source: data.source ?? null,
    notes: data.notes ?? null,
  });

  // Update food price
  const { data: updated, error } = await supabase
    .from("foods")
    .update({
      price: data.price,
      price_updated_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return updated;
}

export async function supabaseFetchFoodChangeLogs(foodId: string): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("food_change_logs")
    .select("*")
    .eq("food_id", foodId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data || []).map((r: any) => ({
    id: r.id,
    foodId: r.food_id,
    action: r.action,
    changes: r.changes,
    actor: r.actor,
    createdAt: r.created_at,
  }));
}

// ---------------------------------------------------------------------
// PRESET CRUD — Direct Supabase
// ---------------------------------------------------------------------
export async function supabaseCreatePreset(data: any): Promise<any> {
  const supabase = getSupabase();
  const { data: preset, error } = await supabase
    .from("nutrition_presets")
    .insert({
      patient_id: data.patientId ?? null,
      name: data.name,
      description: data.description ?? "",
      color: data.color ?? "#10b981",
      icon: data.icon ?? "utensils",
      is_template: data.isTemplate ?? false,
      is_favorite: data.isFavorite ?? false,
      total_cal: data.totalCal,
      target_weight: data.targetWeight ?? null,
      bmr: data.bmr ?? null,
      tdee: data.tdee ?? null,
      protein_pct: data.proteinPct,
      carb_pct: data.carbPct,
      fat_pct: data.fatPct,
      protein_g: data.proteinG,
      carb_g: data.carbG,
      fat_g: data.fatG,
      fiber_g: data.fiberG ?? 25,
      sodium_mg: data.sodiumMg ?? 2300,
      potassium_mg: data.potassiumMg ?? null,
      fluid_ml: data.fluidMl ?? null,
      goal: data.goal ?? "GENERAL",
      diagnoses: data.diagnoses ?? "",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return preset;
}

export async function supabaseUpdatePreset(id: string, data: any): Promise<any> {
  const supabase = getSupabase();
  const updateData: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      const snakeKey = k.replace(/[A-Z]/g, (l) => "_" + l.toLowerCase());
      updateData[snakeKey] = v;
    }
  }
  const { data: preset, error } = await supabase
    .from("nutrition_presets")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return preset;
}

export async function supabaseDeletePreset(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("nutrition_presets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function supabaseClonePreset(data: {
  id: string;
  newName?: string;
  patientId?: string | null;
}): Promise<any> {
  const supabase = getSupabase();
  // Fetch original
  const { data: original, error: fetchError } = await supabase
    .from("nutrition_presets")
    .select("*")
    .eq("id", data.id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  // Create clone
  const { data: clone, error: insertError } = await supabase
    .from("nutrition_presets")
    .insert({
      patient_id: data.patientId ?? original.patient_id,
      name: data.newName || `${original.name} (Salinan)`,
      description: original.description,
      color: original.color,
      icon: original.icon,
      is_template: false,
      is_favorite: false,
      total_cal: original.total_cal,
      target_weight: original.target_weight,
      bmr: original.bmr,
      tdee: original.tdee,
      protein_pct: original.protein_pct,
      carb_pct: original.carb_pct,
      fat_pct: original.fat_pct,
      protein_g: original.protein_g,
      carb_g: original.carb_g,
      fat_g: original.fat_g,
      fiber_g: original.fiber_g,
      sodium_mg: original.sodium_mg,
      potassium_mg: original.potassium_mg,
      fluid_ml: original.fluid_ml,
      goal: original.goal,
      diagnoses: original.diagnoses,
    })
    .select()
    .single();
  if (insertError) throw new Error(insertError.message);
  return clone;
}

export async function supabaseTogglePresetFavorite(id: string): Promise<any> {
  const supabase = getSupabase();
  const { data: preset } = await supabase
    .from("nutrition_presets")
    .select("is_favorite")
    .eq("id", id)
    .single();
  const { data: updated, error } = await supabase
    .from("nutrition_presets")
    .update({ is_favorite: !preset?.is_favorite })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return updated;
}

export async function supabaseFetchPresetHistory(id: string): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("nutrition_preset_history")
    .select("*")
    .eq("preset_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return data || [];
}

// ---------------------------------------------------------------------
// SAVED MENUS (per-slot) — Direct Supabase
// Note: saved_menus is a DIFFERENT table from saved_meal_plans
// ---------------------------------------------------------------------
export async function supabaseFetchSavedMenus(params: {
  patientId?: string;
  category?: string;
  q?: string;
}): Promise<any[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("saved_menus")
    .select("*, food:foods(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (params.patientId) query = query.eq("patient_id", params.patientId);
  if (params.category) query = query.eq("category", params.category);

  const { data, error } = await query;
  if (error) {
    console.error("[frontend] fetchSavedMenus error:", error);
    return [];
  }

  let menus = data || [];
  if (params.q) {
    const q = params.q.toLowerCase();
    menus = menus.filter((m: any) => m.name?.toLowerCase().includes(q));
  }

  return menus.map((m: any) => ({
    ...m,
    foodName: m.food?.name,
    foodId: m.food_id,
    patientId: m.patient_id,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  }));
}

export async function supabaseCreateSavedMenu(data: any): Promise<any> {
  const supabase = getSupabase();
  const { data: menu, error } = await supabase
    .from("saved_menus")
    .insert({
      patient_id: data.patientId ?? null,
      name: data.name,
      slot: data.slot,
      food_id: data.foodId,
      amount: data.amount,
      category: data.category ?? "general",
      notes: data.notes ?? "",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return menu;
}

export async function supabaseDeleteSavedMenu(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("saved_menus").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function supabaseMarkSavedMenuUsed(id: string): Promise<any> {
  const supabase = getSupabase();
  const { data: menu } = await supabase
    .from("saved_menus")
    .select("use_count")
    .eq("id", id)
    .single();
  const { data: updated, error } = await supabase
    .from("saved_menus")
    .update({
      use_count: (menu?.use_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return updated;
}

// ---------------------------------------------------------------------
// RECIPE UPDATE — Direct Supabase
// ---------------------------------------------------------------------
export async function supabaseUpdateRecipe(id: string, data: any): Promise<any> {
  const supabase = getSupabase();
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.servings !== undefined) updateData.servings = data.servings;
  if (data.method !== undefined) updateData.method = data.method;
  if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;

  const { data: recipe, error } = await supabase
    .from("recipes")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return recipe;
}

// ---------------------------------------------------------------------
// SAVED MEAL PLAN — Mark Used
// ---------------------------------------------------------------------
export async function supabaseMarkSavedMealPlanUsed(id: string): Promise<any> {
  const supabase = getSupabase();
  const { data: plan } = await supabase
    .from("saved_meal_plans")
    .select("use_count")
    .eq("id", id)
    .single();
  const { data: updated, error } = await supabase
    .from("saved_meal_plans")
    .update({
      use_count: (plan?.use_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return updated;
}

// ---------------------------------------------------------------------
// MEAL PLAN ITEMS — Direct Supabase CRUD
// ---------------------------------------------------------------------
export async function supabaseAddMealItem(
  mealPlanId: string,
  data: { slot: string; foodId: string; amount: number },
): Promise<any> {
  const supabase = getSupabase();
  const { data: item, error } = await supabase
    .from("meal_plan_items")
    .insert({
      meal_plan_id: mealPlanId,
      slot: data.slot.toUpperCase(),
      food_id: data.foodId,
      amount: data.amount,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return item;
}

export async function supabaseUpdateMealItem(
  mealPlanId: string,
  itemId: string,
  data: { foodId?: string; amount?: number },
): Promise<any> {
  const supabase = getSupabase();
  const updateData: any = {};
  if (data.foodId !== undefined) updateData.food_id = data.foodId;
  if (data.amount !== undefined) updateData.amount = data.amount;
  const { data: item, error } = await supabase
    .from("meal_plan_items")
    .update(updateData)
    .eq("id", itemId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return item;
}

export async function supabaseDeleteMealItem(itemId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("meal_plan_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// NUTRIGENOMIC AI — Direct Supabase CRUD
// Mirrors the Laboratorium pattern: the AI routes (/api/ai/nutrigenomic-
// extract, /api/ai/nutrigenomic-interpret) are read-only / reasoning-only
// — all persistence (report creation, confirmed findings, deletes) goes
// straight to Supabase from here, same as laboratory_results.
// ---------------------------------------------------------------------

export function genomicReportFromSupabase(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    laboratoryName: row.laboratory_name,
    examDate: row.exam_date,
    examType: row.exam_type,
    fileName: row.file_name,
    totalGenes: row.total_genes,
    totalSnps: row.total_snps,
    status: row.status,
    extractionNotes: row.extraction_notes,
    aiModel: row.ai_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function genomicFindingFromSupabase(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    reportId: row.report_id,
    patientId: row.patient_id,
    geneSymbol: row.gene_symbol,
    rsId: row.rs_id,
    genotype: row.genotype,
    clinicalMeaning: row.clinical_meaning,
    nutritionImpact: row.nutrition_impact,
    riskLevel: row.risk_level,
    evidenceLevel: row.evidence_level,
    referenceSummary: row.reference_summary,
    confidence: row.confidence,
    verifiedByClinician: row.verified_by_clinician,
    createdAt: row.created_at,
  };
}

export function genomicInterpretationFromSupabase(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    reportId: row.report_id,
    patientId: row.patient_id,
    summary: row.summary,
    riskSummary: row.risk_summary,
    clinicalImplications: row.clinical_implications,
    nutritionImplications: row.nutrition_implications,
    recommendedFoods: row.recommended_foods,
    restrictedFoods: row.restricted_foods,
    interventionPriorities: row.intervention_priorities,
    supplementation: row.supplementation,
    exerciseRecommendations: row.exercise_recommendations,
    monitoringPlan: row.monitoring_plan,
    aiModel: row.ai_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function supabaseFetchGenomicReports(patientId: string): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("genomic_reports")
    .select("*")
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("exam_date", { ascending: false });

  if (error) {
    console.error("[frontend] fetchGenomicReports error:", error);
    throw new Error(error.message);
  }
  return (data || []).map(genomicReportFromSupabase);
}

// Full detail: report + findings + interpretation (if already analyzed).
export async function supabaseFetchGenomicReportDetail(reportId: string): Promise<{
  report: any;
  findings: any[];
  interpretation: any | null;
} | null> {
  const supabase = getSupabase();

  const [{ data: reportRow, error: reportErr }, { data: findingRows, error: findingsErr }, { data: interpRow }] =
    await Promise.all([
      supabase.from("genomic_reports").select("*").eq("id", reportId).single(),
      supabase.from("genomic_findings").select("*").eq("report_id", reportId).order("gene_symbol", { ascending: true }),
      supabase.from("genomic_interpretations").select("*").eq("report_id", reportId).maybeSingle(),
    ]);

  if (reportErr || !reportRow) {
    console.error("[frontend] fetchGenomicReportDetail error:", reportErr);
    return null;
  }
  if (findingsErr) console.error("[frontend] fetchGenomicReportDetail findings error:", findingsErr);

  return {
    report: genomicReportFromSupabase(reportRow),
    findings: (findingRows || []).map(genomicFindingFromSupabase),
    interpretation: interpRow ? genomicInterpretationFromSupabase(interpRow) : null,
  };
}

// Creates the report row + its confirmed findings in one call (called
// after the clinician reviews/edits the AI extraction table — mirrors
// the "OCR -> Parsing -> Konfirmasi -> Simpan" flow used by Laboratorium).
export async function supabaseCreateGenomicReport(input: {
  patientId: string;
  laboratoryName?: string | null;
  examDate?: string | null;
  examType?: string | null;
  fileName?: string | null;
  extractionNotes?: string | null;
  aiModel?: string | null;
  findings: {
    geneSymbol: string;
    rsId?: string | null;
    genotype?: string | null;
    reportedCall?: string | null;
    confidence?: "HIGH" | "MEDIUM" | "LOW";
  }[];
}): Promise<{ reportId: string }> {
  const supabase = getSupabase();

  const { data: report, error: reportErr } = await supabase
    .from("genomic_reports")
    .insert({
      patient_id: input.patientId,
      laboratory_name: input.laboratoryName ?? null,
      exam_date: input.examDate ?? null,
      exam_type: input.examType ?? null,
      file_name: input.fileName ?? null,
      total_genes: input.findings.length,
      total_snps: input.findings.filter((f) => f.rsId).length,
      status: input.findings.length > 0 ? "PROCESSING" : "NEEDS_REVIEW",
      extraction_notes: input.extractionNotes ?? null,
      ai_model: input.aiModel ?? null,
    })
    .select()
    .single();

  if (reportErr) throw new Error(reportErr.message);

  if (input.findings.length > 0) {
    const { error: findingsErr } = await supabase.from("genomic_findings").insert(
      input.findings.map((f) => ({
        report_id: report.id,
        patient_id: input.patientId,
        gene_symbol: f.geneSymbol,
        rs_id: f.rsId ?? null,
        genotype: f.genotype ?? null,
        clinical_meaning: f.reportedCall ?? null, // pre-AI-interpretation: holds the raw reported call
        confidence: f.confidence ?? "MEDIUM",
        verified_by_clinician: true, // by definition — this insert only happens post clinician review
      })),
    );
    if (findingsErr) throw new Error(findingsErr.message);
  }

  return { reportId: report.id };
}

export async function supabaseDeleteGenomicReport(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("genomic_reports").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

// Fetch confirmed findings for meal-plan integration (used by the
// "Generate Precision Meal Plan" action) — only the most recent
// ANALYZED report's findings are used.
export async function supabaseFetchLatestGenomicFindings(patientId: string): Promise<any[]> {
  const supabase = getSupabase();
  const { data: latestReport } = await supabase
    .from("genomic_reports")
    .select("id")
    .eq("patient_id", patientId)
    .eq("status", "ANALYZED")
    .is("deleted_at", null)
    .order("exam_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestReport) return [];

  const { data, error } = await supabase
    .from("genomic_findings")
    .select("*")
    .eq("report_id", latestReport.id);

  if (error) {
    console.error("[frontend] fetchLatestGenomicFindings error:", error);
    return [];
  }
  return (data || []).map(genomicFindingFromSupabase);
}

export async function supabaseFetchGeneReference(): Promise<any[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("gene_reference").select("*").order("gene_symbol", { ascending: true });
  if (error) {
    console.error("[frontend] fetchGeneReference error:", error);
    return [];
  }
  return data || [];
}
