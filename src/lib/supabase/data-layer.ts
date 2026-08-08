// =====================================================================
// CareLivia — Supabase Data Layer (PRIMARY database)
// ALL CRUD operations use supabase.from() — NO Prisma, NO SQLite.
//
// This module provides typed data access functions that map between
// camelCase (frontend/Prisma convention) and snake_case (Supabase PostgreSQL).
//
// Authentication:
//   - Server-side client reads user session from cookies
//   - Public reads (foods, categories) work with anon role
//   - Writes and patient data require authenticated session
//   - If no session, writes return { error: "Authentication required" }
// =====================================================================

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------
// Type mappings: camelCase ↔ snake_case
// ---------------------------------------------------------------------

// Food: Prisma camelCase → Supabase snake_case
export function foodToSupabase(f: any): any {
  return {
    id: f.id,
    name: f.name,
    english_name: f.englishName ?? f.english_name ?? null,
    alias: f.alias ?? null,
    code: f.code ?? null,
    category_id: f.categoryId ?? f.category_id,
    subcategory_id: f.subcategoryId ?? f.subcategory_id ?? null,
    source: (f.source ?? "TKPI").toUpperCase(),
    description: f.description ?? null,
    energy: f.energy,
    protein: f.protein,
    fat: f.fat,
    carb: f.carb,
    fiber: f.fiber ?? 0,
    sugar: f.sugar ?? 0,
    water: f.water ?? 0,
    ash: f.ash ?? 0,
    sodium: f.sodium ?? 0,
    potassium: f.potassium ?? 0,
    calcium: f.calcium ?? 0,
    magnesium: f.magnesium ?? 0,
    iron: f.iron ?? 0,
    phosphorus: f.phosphorus ?? 0,
    zinc: f.zinc ?? 0,
    vit_a: f.vitA ?? f.vit_a ?? 0,
    vit_b1: f.vitB1 ?? f.vit_b1 ?? 0,
    vit_b2: f.vitB2 ?? f.vit_b2 ?? 0,
    vit_b3: f.vitB3 ?? f.vit_b3 ?? 0,
    vit_b6: f.vitB6 ?? f.vit_b6 ?? 0,
    vit_b12: f.vitB12 ?? f.vit_b12 ?? 0,
    folate: f.folate ?? 0,
    vit_c: f.vitC ?? f.vit_c ?? 0,
    vit_d: f.vitD ?? f.vit_d ?? 0,
    vit_e: f.vitE ?? f.vit_e ?? 0,
    vit_k: f.vitK ?? f.vit_k ?? 0,
    cholesterol: f.cholesterol ?? 0,
    gi: f.gi ?? 0,
    glycemic_load: f.glycemicLoad ?? f.glycemic_load ?? 0,
    urt: f.urt ?? null,
    urt_gram: f.urtGram ?? f.urt_gram ?? null,
    bdd: f.bdd ?? 100,
    price: f.price ?? 0,
    price_unit: f.priceUnit ?? f.price_unit ?? "g",
    price_location: f.priceLocation ?? f.price_location ?? null,
    price_source: f.priceSource ?? f.price_source ?? null,
    price_updated_at: f.priceUpdatedAt ?? f.price_updated_at ?? null,
    price_is_estimate: f.priceIsEstimate ?? f.price_is_estimate ?? false,
    unit: f.unit ?? "g",
    image_url: f.imageUrl ?? f.image_url ?? null,
    tags: f.tags ?? "",
    approved: f.approved ?? true,
    version: f.version ?? 1,
    deleted_at: f.deletedAt ?? f.deleted_at ?? null,
  };
}

export function foodFromSupabase(row: any, category?: any): any {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    englishName: row.english_name,
    alias: row.alias,
    code: row.code,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    source: row.source,
    description: row.description,
    energy: row.energy,
    protein: row.protein,
    fat: row.fat,
    carb: row.carb,
    fiber: row.fiber,
    sugar: row.sugar,
    water: row.water,
    ash: row.ash,
    sodium: row.sodium,
    potassium: row.potassium,
    calcium: row.calcium,
    magnesium: row.magnesium,
    iron: row.iron,
    phosphorus: row.phosphorus,
    zinc: row.zinc,
    vitA: row.vit_a,
    vitB1: row.vit_b1,
    vitB2: row.vit_b2,
    vitB3: row.vit_b3,
    vitB6: row.vit_b6,
    vitB12: row.vit_b12,
    folate: row.folate,
    vitC: row.vit_c,
    vitD: row.vit_d,
    vitE: row.vit_e,
    vitK: row.vit_k,
    cholesterol: row.cholesterol,
    gi: row.gi,
    glycemicLoad: row.glycemic_load,
    urt: row.urt,
    urtGram: row.urt_gram,
    bdd: row.bdd,
    price: row.price,
    priceUnit: row.price_unit,
    priceLocation: row.price_location,
    priceSource: row.price_source,
    priceUpdatedAt: row.price_updated_at,
    priceIsEstimate: row.price_is_estimate,
    unit: row.unit,
    imageUrl: row.image_url,
    tags: row.tags,
    approved: row.approved,
    version: row.version,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: category ? { id: category.id, name: category.name, slug: category.slug, icon: category.icon } : undefined,
  };
}

// Patient mapping
export function patientToSupabase(p: any, partial = false): any {
  // For partial updates, only include fields that are explicitly provided
  if (partial) {
    const out: any = {};
    if (p.id !== undefined) out.id = p.id;
    if (p.mrn !== undefined) out.mrn = p.mrn;
    if (p.name !== undefined) out.name = p.name;
    if (p.gender !== undefined) out.gender = p.gender.toUpperCase();
    if (p.birthDate !== undefined) out.birth_date = p.birthDate;
    if (p.birth_date !== undefined) out.birth_date = p.birth_date;
    if (p.phone !== undefined) out.phone = p.phone;
    if (p.address !== undefined) out.address = p.address;
    if (p.religion !== undefined) out.religion = p.religion.toUpperCase();
    if (p.bloodType !== undefined) out.blood_type = p.bloodType.toUpperCase();
    if (p.blood_type !== undefined) out.blood_type = p.blood_type.toUpperCase();
    if (p.allergy !== undefined) out.allergy = p.allergy;
    if (p.height !== undefined) out.height = p.height;
    if (p.weight !== undefined) out.weight = p.weight;
    if (p.isPregnant !== undefined) out.is_pregnant = p.isPregnant;
    if (p.is_pregnant !== undefined) out.is_pregnant = p.is_pregnant;
    if (p.pregnancyTrimester !== undefined) out.pregnancy_trimester = p.pregnancyTrimester;
    if (p.pregnancy_trimester !== undefined) out.pregnancy_trimester = p.pregnancy_trimester;
    if (p.isLactating !== undefined) out.is_lactating = p.isLactating;
    if (p.is_lactating !== undefined) out.is_lactating = p.is_lactating;
    if (p.lactationMonth !== undefined) out.lactation_month = p.lactationMonth;
    if (p.lactation_month !== undefined) out.lactation_month = p.lactation_month;
    if (p.notes !== undefined) out.notes = p.notes;
    if (p.deletedAt !== undefined) out.deleted_at = p.deletedAt;
    if (p.deleted_at !== undefined) out.deleted_at = p.deleted_at;
    return out;
  }
  // Full create — include all fields with defaults
  return {
    id: p.id,
    mrn: p.mrn,
    name: p.name,
    gender: (p.gender ?? "MALE").toUpperCase(),
    birth_date: p.birthDate ?? p.birth_date,
    phone: p.phone ?? "",
    address: p.address ?? "",
    religion: (p.religion ?? "ISLAM").toUpperCase(),
    blood_type: (p.bloodType ?? p.blood_type ?? "UNKNOWN").toUpperCase(),
    allergy: p.allergy ?? "",
    height: p.height,
    weight: p.weight,
    is_pregnant: p.isPregnant ?? p.is_pregnant ?? false,
    pregnancy_trimester: p.pregnancyTrimester ?? p.pregnancy_trimester ?? 0,
    is_lactating: p.isLactating ?? p.is_lactating ?? false,
    lactation_month: p.lactationMonth ?? p.lactation_month ?? 0,
    notes: p.notes,
    deleted_at: p.deletedAt ?? p.deleted_at ?? null,
  };
}

export function patientFromSupabase(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    mrn: row.mrn,
    name: row.name,
    gender: row.gender,
    birthDate: row.birth_date,
    phone: row.phone,
    address: row.address,
    religion: row.religion,
    bloodType: row.blood_type,
    allergy: row.allergy,
    height: row.height,
    weight: row.weight,
    isPregnant: row.is_pregnant,
    pregnancyTrimester: row.pregnancy_trimester,
    isLactating: row.is_lactating,
    lactationMonth: row.lactation_month,
    notes: row.notes,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Meal plan mapping
export function mealPlanToSupabase(m: any): any {
  return {
    id: m.id,
    patient_id: m.patientId ?? m.patient_id,
    preset_id: m.presetId ?? m.preset_id ?? null,
    date: m.date ?? new Date().toISOString(),
    target_cal: m.targetCal ?? m.target_cal ?? 0,
    target_protein: m.targetProtein ?? m.target_protein ?? 0,
    target_fat: m.targetFat ?? m.target_fat ?? 0,
    target_carb: m.targetCarb ?? m.target_carb ?? 0,
    target_fiber: m.targetFiber ?? m.target_fiber ?? 0,
    target_sodium: m.targetSodium ?? m.target_sodium ?? 0,
    total_cal: m.totalCal ?? m.total_cal ?? 0,
    total_protein: m.totalProtein ?? m.total_protein ?? 0,
    total_fat: m.totalFat ?? m.total_fat ?? 0,
    total_carb: m.totalCarb ?? m.total_carb ?? 0,
    total_fiber: m.totalFiber ?? m.total_fiber ?? 0,
    total_sodium: m.totalSodium ?? m.total_sodium ?? 0,
    compliance: m.compliance ?? 0,
    status: m.status ?? "DRAFT",
    ai_model: m.aiModel ?? m.ai_model ?? null,
    ai_reasoning: m.aiReasoning ?? m.ai_reasoning ?? null,
    notes: m.notes,
    deleted_at: m.deletedAt ?? m.deleted_at ?? null,
  };
  // Note: is_active is intentionally NOT set here — it's only ever
  // changed via fn_set_meal_plan_active / fn_save_meal_plan_draft /
  // fn_apply_meal_plan_history, which atomically guarantee a single
  // active plan per patient. A plain insert/update must never set it.
}

export function mealPlanFromSupabase(row: any, items?: any[], preset?: any, patient?: any): any {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    presetId: row.preset_id,
    date: row.date,
    targetCal: row.target_cal,
    targetProtein: row.target_protein,
    targetFat: row.target_fat,
    targetCarb: row.target_carb,
    targetFiber: row.target_fiber,
    targetSodium: row.target_sodium,
    totalCal: row.total_cal,
    totalProtein: row.total_protein,
    totalFat: row.total_fat,
    totalCarb: row.total_carb,
    totalFiber: row.total_fiber,
    totalSodium: row.total_sodium,
    compliance: row.compliance,
    status: row.status,
    isActive: row.is_active ?? false,
    aiModel: row.ai_model,
    aiReasoning: row.ai_reasoning,
    notes: row.notes,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items ?? [],
    preset: preset ?? null,
    patient: patient ?? null,
  };
}

// Meal plan item mapping
export function mealItemToSupabase(i: any): any {
  return {
    id: i.id,
    meal_plan_id: i.mealPlanId ?? i.meal_plan_id,
    slot: (i.slot ?? "LUNCH").toUpperCase(),
    food_id: i.foodId ?? i.food_id,
    amount: i.amount,
    cal: i.cal ?? 0,
    protein: i.protein ?? 0,
    fat: i.fat ?? 0,
    carb: i.carb ?? 0,
    fiber: i.fiber ?? 0,
    sodium: i.sodium ?? 0,
  };
}

export function mealItemFromSupabase(row: any, food?: any): any {
  if (!row) return null;
  return {
    id: row.id,
    mealPlanId: row.meal_plan_id,
    slot: row.slot,
    foodId: row.food_id,
    amount: row.amount,
    cal: row.cal,
    protein: row.protein,
    fat: row.fat,
    carb: row.carb,
    fiber: row.fiber,
    sodium: row.sodium,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    food: food ?? null,
  };
}

// Weight record mapping
export function weightRecordFromSupabase(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    weight: row.weight,
    height: row.height,
    bmi: row.bmi,
    bmiCategory: row.bmi_category,
    weightChange: row.weight_change,
    weightChangePct: row.weight_change_pct,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Nutrition assessment mapping
export function assessmentFromSupabase(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    recordedAt: row.recorded_at,
    must: row.must,
    mustScore: row.must_score,
    sga: row.sga,
    nrs2002: row.nrs2002,
    nrsScore: row.nrs_score,
    mna: row.mna,
    mnaScore: row.mna_score,
    pps: row.pps,
    ecog: row.ecog,
    barthel: row.barthel,
    frailty: row.frailty,
    frailtyScore: row.frailty_score,
    fallRisk: row.fall_risk,
    handGrip: row.hand_grip,
    calfCirc: row.calf_circ,
    activity: row.activity,
    stress: row.stress,
    notes: row.notes,
    karnofsky: row.karnofsky,
    cfs: row.cfs,
    sarcfScore: row.sarcf_score,
    sarcfPositive: row.sarcf_positive,
    calfCategory: row.calf_category,
    sarcCalfScore: row.sarc_calf_score,
    sarcCalfPositive: row.sarc_calf_positive,
    morseHistoryFall: row.morse_history_fall,
    morseSecondaryDx: row.morse_secondary_dx,
    morseAmbulatoryAid: row.morse_ambulatory_aid,
    morseIvTherapy: row.morse_iv_therapy,
    morseGait: row.morse_gait,
    morseMentalStatus: row.morse_mental_status,
    morseScore: row.morse_score,
    tugCategory: row.tug_category,
    barthelItems: row.barthel_items,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Food record mapping
export function foodRecordFromSupabase(row: any, food?: any): any {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    slot: row.slot,
    foodId: row.food_id,
    amount: row.amount,
    consumed: row.consumed,
    cal: row.cal,
    protein: row.protein,
    fat: row.fat,
    carb: row.carb,
    fiber: row.fiber,
    sodium: row.sodium,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    food: food ?? null,
  };
}

// Preset mapping
export function presetFromSupabase(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    isTemplate: row.is_template,
    isFavorite: row.is_favorite,
    totalCal: row.total_cal,
    targetWeight: row.target_weight,
    bmr: row.bmr,
    tdee: row.tdee,
    proteinPct: row.protein_pct,
    carbPct: row.carb_pct,
    fatPct: row.fat_pct,
    proteinG: row.protein_g,
    carbG: row.carb_g,
    fatG: row.fat_g,
    fiberG: row.fiber_g,
    sodiumMg: row.sodium_mg,
    potassiumMg: row.potassium_mg,
    fluidMl: row.fluid_ml,
    goal: row.goal,
    diagnoses: row.diagnoses,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------
// Helper: Get authenticated server client + session
// ---------------------------------------------------------------------
export async function getServerClient(): Promise<{
  client: SupabaseClient;
  session: { user: any } | null;
}> {
  const client = await createClient();
  const { data: { session } } = await client.auth.getSession();
  return {
    client,
    session: session ? { user: session.user } : null,
  };
}

// ---------------------------------------------------------------------
// Helper: Resolve patient ID (Prisma cuid → Supabase UUID)
// Frontend stores Prisma cuid IDs in its state. Supabase has UUIDs.
// This function tries: 1) Direct UUID lookup, 2) MRN lookup, 3) Prisma fallback
// Returns the Supabase UUID if found, or the original ID if not.
// ---------------------------------------------------------------------
const patientIdCache = new Map<string, string>();

export async function resolvePatientId(patientId: string): Promise<string> {
  // Check if it's already a valid UUID (36 chars with dashes)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId)) {
    return patientId;
  }

  // Check cache
  if (patientIdCache.has(patientId)) {
    return patientIdCache.get(patientId)!;
  }

  try {
    // Try Prisma first — get the MRN
    const { db } = await import("@/lib/db");
    const prismaPatient = await db.patient.findUnique({
      where: { id: patientId },
      select: { mrn: true, name: true },
    });

    if (!prismaPatient) {
      console.warn(`[resolvePatientId] Patient not found in Prisma: ${patientId}`);
      return patientId; // Can't resolve, return original
    }

    // Try Supabase lookup by MRN (this works even with anon role if patient exists)
    const { client } = await getServerClient();
    const { data: supaPatient, error } = await client
      .from("patients")
      .select("id")
      .eq("mrn", prismaPatient.mrn)
      .maybeSingle();

    if (error) {
      console.warn(`[resolvePatientId] Supabase lookup error for MRN ${prismaPatient.mrn}:`, error.message);
    }

    if (supaPatient?.id) {
      console.log(`[resolvePatientId] Resolved ${patientId} → ${supaPatient.id} (via MRN ${prismaPatient.mrn})`);
      patientIdCache.set(patientId, supaPatient.id);
      return supaPatient.id;
    }

    console.warn(`[resolvePatientId] Patient not found in Supabase by MRN ${prismaPatient.mrn}, returning original ID`);
  } catch (e) {
    console.warn("[resolvePatientId] Failed to resolve:", patientId, e);
  }

  return patientId; // Return original if resolution fails
}

// ---------------------------------------------------------------------
// Helper: Resolve food ID (Prisma cuid → Supabase UUID)
// ---------------------------------------------------------------------
const foodIdCache = new Map<string, string>();

export async function resolveFoodId(foodId: string): Promise<string> {
  // Check if it's already a valid UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(foodId)) {
    return foodId;
  }

  if (foodIdCache.has(foodId)) {
    return foodIdCache.get(foodId)!;
  }

  try {
    const { db } = await import("@/lib/db");
    const prismaFood = await db.food.findUnique({
      where: { id: foodId },
      select: { name: true },
    });

    if (!prismaFood) {
      console.warn(`[resolveFoodId] Food not found in Prisma: ${foodId}`);
      return foodId;
    }

    const { client } = await getServerClient();
    const { data: supaFood, error } = await client
      .from("foods")
      .select("id")
      .eq("name", prismaFood.name)
      .maybeSingle();

    if (error) {
      console.warn(`[resolveFoodId] Supabase lookup error for food "${prismaFood.name}":`, error.message);
    }

    if (supaFood?.id) {
      console.log(`[resolveFoodId] Resolved ${foodId} → ${supaFood.id} (via name "${prismaFood.name}")`);
      foodIdCache.set(foodId, supaFood.id);
      return supaFood.id;
    }

    console.warn(`[resolveFoodId] Food not found in Supabase by name "${prismaFood.name}", returning original ID`);
  } catch (e) {
    console.warn("[resolveFoodId] Failed to resolve:", foodId, e);
  }

  return foodId;
}

// ---------------------------------------------------------------------
// FOODS — Public reads (anon OK), writes require auth
// ---------------------------------------------------------------------
export async function supabaseListFoods(params?: {
  search?: string;
  categorySlug?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: any[]; total: number }> {
  const { client } = await getServerClient();
  const limit = params?.limit ?? 100;
  const offset = params?.offset ?? 0;

  let query = client
    .from("foods")
    .select("*, food_categories(*)", { count: "exact" })
    .is("deleted_at", null)
    .eq("approved", true)
    .range(offset, offset + limit - 1)
    .order("name");

  if (params?.search) {
    query = query.or(`name.ilike.%${params.search}%,english_name.ilike.%${params.search}%,tags.ilike.%${params.search}%`);
  }

  // Category filter requires subquery — skip for now, filter in memory
  const { data, error, count } = await query;

  if (error) {
    console.error("[Supabase] listFoods error:", error);
    return { data: [], total: 0 };
  }

  let rows = (data || []).map((row: any) =>
    foodFromSupabase(row, row.food_categories),
  );

  // In-memory category filter
  if (params?.categorySlug && params.categorySlug !== "all") {
    rows = rows.filter((f: any) => f.category?.slug === params.categorySlug);
  }

  return { data: rows, total: count ?? rows.length };
}

export async function supabaseGetFood(id: string): Promise<any | null> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("foods")
    .select("*, food_categories(*)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[Supabase] getFood error:", error);
    return null;
  }

  return foodFromSupabase(data, data.food_categories);
}

export async function supabaseUpsertFood(food: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required. Please log in." };

  const payload = foodToSupabase(food);
  const { data, error } = await client
    .from("foods")
    .upsert(payload)
    .select("*, food_categories(*)")
    .single();

  if (error) {
    console.error("[Supabase] upsertFood error:", error);
    return { data: null, error: error.message };
  }

  return { data: foodFromSupabase(data, data.food_categories), error: null };
}

// ---------------------------------------------------------------------
// FOOD CATEGORIES — Public reads
// ---------------------------------------------------------------------
export async function supabaseListCategories(): Promise<any[]> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("food_categories")
    .select("*")
    .order("name");

  if (error) {
    console.error("[Supabase] listCategories error:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// =====================================================================
// FOOD IMPORT — Excel import (duplicate check, batched bulk upsert,
// Riwayat Import, Export Database). See:
//   supabase/migrations/021_food_import.sql
// =====================================================================

export type FoodImportRow = {
  rowIndex: number;
  strategy: "CREATE" | "UPDATE" | "SKIP";
  existingId?: string | null;
  code?: string | null;
  name: string;
  categoryName: string;
  subcategoryName?: string | null;
  source?: string;
  description?: string | null;
  urt?: string | null;
  urtGram?: number | null;
  bdd?: number;
  price?: number;
  energy: number;
  protein: number;
  fat: number;
  carb: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  potassium?: number;
  calcium?: number;
  magnesium?: number;
  iron?: number;
  phosphorus?: number;
  zinc?: number;
  vitA?: number;
  vitB1?: number;
  vitB2?: number;
  vitB3?: number;
  vitB6?: number;
  vitB12?: number;
  folate?: number;
  vitC?: number;
  vitD?: number;
  vitE?: number;
  vitK?: number;
  cholesterol?: number;
  gi?: number;
  glycemicLoad?: number;
};

// Checks which {code, name} pairs already exist in `foods`, so the
// client can offer Lewati / Update Data Lama / Tambah Sebagai Baru.
export async function supabaseCheckFoodDuplicates(
  items: { code?: string | null; name: string }[],
): Promise<any[]> {
  const { client } = await getServerClient();

  const codes = [...new Set(items.map((i) => i.code).filter((c): c is string => !!c && c.trim() !== ""))];
  const names = [...new Set(items.map((i) => i.name?.trim().toLowerCase()).filter(Boolean))];

  if (codes.length === 0 && names.length === 0) return [];

  let matches: any[] = [];

  if (codes.length > 0) {
    const { data } = await client.from("foods").select("id, code, name").in("code", codes).is("deleted_at", null);
    matches = matches.concat(data || []);
  }
  if (names.length > 0) {
    // Supabase JS doesn't support case-insensitive `in`, so fetch by exact
    // name list first, then also try a broader ilike pass in chunks.
    const { data } = await client
      .from("foods")
      .select("id, code, name")
      .is("deleted_at", null)
      .or(names.map((n) => `name.ilike.${n}`).join(","));
    matches = matches.concat(data || []);
  }

  // De-dupe by id
  const byId = new Map<string, any>();
  for (const m of matches) byId.set(m.id, m);

  return Array.from(byId.values()).map((m) => ({ id: m.id, code: m.code, name: m.name }));
}

export async function supabaseBulkUpsertFoods(
  rows: FoodImportRow[],
): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data, error } = await client.rpc("fn_bulk_upsert_foods", {
    p_rows: rows,
    p_actor: session.user?.email ?? session.user?.id ?? "unknown",
  });

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function supabaseCreateFoodImportHistory(entry: {
  fileName: string;
  totalRows: number;
  successCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  durationMs: number;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  errorLog?: any[];
}): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data, error } = await client
    .from("food_import_history")
    .insert({
      file_name: entry.fileName,
      total_rows: entry.totalRows,
      success_count: entry.successCount,
      updated_count: entry.updatedCount,
      skipped_count: entry.skippedCount,
      failed_count: entry.failedCount,
      duration_ms: entry.durationMs,
      status: entry.status,
      error_log: entry.errorLog ?? [],
      actor: session.user?.email ?? session.user?.id ?? "unknown",
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function supabaseListFoodImportHistory(): Promise<any[]> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("food_import_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[Supabase] listFoodImportHistory error:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    fileName: row.file_name,
    totalRows: row.total_rows,
    successCount: row.success_count,
    updatedCount: row.updated_count,
    skippedCount: row.skipped_count,
    failedCount: row.failed_count,
    durationMs: row.duration_ms,
    status: row.status,
    errorLog: row.error_log,
    actor: row.actor,
    createdAt: row.created_at,
  }));
}

// Full database export — flat rows matching the Excel template columns.
export async function supabaseExportAllFoods(): Promise<any[]> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("foods")
    .select("*, food_categories(name), food_subcategories(name)")
    .is("deleted_at", null)
    .order("name");

  if (error) {
    console.error("[Supabase] exportAllFoods error:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    kode_bahan: row.code ?? "",
    nama_bahan: row.name,
    kategori: row.food_categories?.name ?? "",
    sub_kategori: row.food_subcategories?.name ?? "",
    satuan_rumah_tangga: row.urt ?? "",
    berat_satuan_g: row.urt_gram ?? "",
    energi_kcal_100g: row.energy,
    protein_g_100g: row.protein,
    lemak_g_100g: row.fat,
    karbohidrat_g_100g: row.carb,
    serat_g_100g: row.fiber,
    gula_g_100g: row.sugar,
    natrium_mg_100g: row.sodium,
    kalium_mg_100g: row.potassium,
    kalsium_mg_100g: row.calcium,
    fosfor_mg_100g: row.phosphorus,
    zat_besi_mg_100g: row.iron,
    seng_mg_100g: row.zinc,
    magnesium_mg_100g: row.magnesium,
    vitamin_a_mcg: row.vit_a,
    vitamin_b1_mg: row.vit_b1,
    vitamin_b2_mg: row.vit_b2,
    vitamin_b3_mg: row.vit_b3,
    vitamin_b6_mg: row.vit_b6,
    vitamin_b12_mcg: row.vit_b12,
    folat_mcg: row.folate,
    vitamin_c_mg: row.vit_c,
    vitamin_d_IU: row.vit_d,
    vitamin_e_mg: row.vit_e,
    vitamin_k_mcg: row.vit_k,
    kolesterol_mg: row.cholesterol,
    indeks_glikemik: row.gi,
    beban_glikemik: row.glycemic_load,
    harga_per_porsi: row.price,
    edible_portion: row.bdd,
    sumber_data: row.source,
    catatan: row.description ?? "",
  }));
}

export async function supabaseUpsertCategory(cat: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data, error } = await client
    .from("food_categories")
    .upsert({ id: cat.id, name: cat.name, slug: cat.slug, icon: cat.icon })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

// ---------------------------------------------------------------------
// PATIENTS — Require authentication
// ---------------------------------------------------------------------
export async function supabaseListPatients(): Promise<any[]> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("patients")
    .select("*, diagnoses(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Supabase] listPatients error:", error);
    return [];
  }

  return (data || []).map((row: any) => {
    const p = patientFromSupabase(row);
    p.diagnoses = (row.diagnoses || []).map((d: any) => ({
      id: d.id,
      patientId: d.patient_id,
      type: d.type,
      icd: d.icd,
      severity: d.severity,
      notes: d.notes,
      active: d.active,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
    return p;
  });
}

export async function supabaseGetPatient(id: string): Promise<any | null> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("patients")
    .select("*, diagnoses(*), nutrition_assessments(*)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[Supabase] getPatient error:", error);
    return null;
  }

  const p = patientFromSupabase(data);
  p.diagnoses = (data.diagnoses || []).map((d: any) => ({
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
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
  p.assessments = (data.nutrition_assessments || []).map(assessmentFromSupabase);
  return p;
}

export async function supabaseCreatePatient(p: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) {
    console.warn("[Supabase] createPatient BLOCKED: No authenticated session");
    return { data: null, error: "Authentication required. Please log in." };
  }

  const payload = patientToSupabase(p);
  delete payload.id; // Let Supabase generate UUID

  console.log("[Supabase] createPatient INSERT start", { table: "patients", payload });
  const { data, error } = await client
    .from("patients")
    .insert(payload)
    .select()
    .single();
  console.log("[Supabase] createPatient INSERT result", { data: data ? { id: data.id } : null, error: error ? { code: error.code, message: error.message, details: error.details, hint: error.hint } : null });

  if (error) {
    console.error("[Supabase] createPatient FAILED:", { code: error.code, message: error.message, details: error.details, hint: error.hint, payload });
    return { data: null, error: error.message };
  }

  console.log("[Supabase] createPatient SUCCESS:", { id: data.id, mrn: data.mrn });
  return { data: patientFromSupabase(data), error: null };
}

export async function supabaseUpdatePatient(id: string, updates: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const payload = patientToSupabase(updates, true); // partial=true — only update sent fields
  delete payload.id;

  const { data, error } = await client
    .from("patients")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: patientFromSupabase(data), error: null };
}

export async function supabaseSoftDeletePatient(id: string): Promise<{ error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { error: "Authentication required." };

  const { error } = await client
    .from("patients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------
// MEAL PLANS — Require authentication for writes
// ---------------------------------------------------------------------
export async function supabaseListMealPlans(patientId?: string): Promise<any[]> {
  const { client } = await getServerClient();
  let query = client
    .from("meal_plans")
    .select("*, patients(*, diagnoses(*)), nutrition_presets(*), meal_plan_items(*, foods(*, food_categories(*)))")
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(20);

  if (patientId) {
    query = query.eq("patient_id", patientId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[Supabase] listMealPlans error:", error);
    return [];
  }

  return (data || []).map((row: any) => {
    const items = (row.meal_plan_items || []).map((item: any) =>
      mealItemFromSupabase(item, item.foods ? foodFromSupabase(item.foods, item.foods.food_categories) : null),
    );
    return mealPlanFromSupabase(
      row,
      items,
      row.nutrition_presets ? presetFromSupabase(row.nutrition_presets) : null,
      row.patients ? patientFromSupabase(row.patients) : null,
    );
  });
}

export async function supabaseCreateMealPlan(plan: any, items: any[]): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) {
    console.warn("[Supabase] createMealPlan BLOCKED: No authenticated session");
    return { data: null, error: "Authentication required. Please log in to save meal plans." };
  }

  const planPayload = mealPlanToSupabase(plan);
  delete planPayload.id;

  console.log("[Supabase] createMealPlan INSERT start", { table: "meal_plans", payload: planPayload, itemCount: items.length });
  const { data: planData, error: planError } = await client
    .from("meal_plans")
    .insert(planPayload)
    .select()
    .single();
  console.log("[Supabase] createMealPlan INSERT result", { data: planData ? { id: planData.id } : null, error: planError ? { code: planError.code, message: planError.message } : null });

  if (planError) {
    console.error("[Supabase] createMealPlan FAILED:", { code: planError.code, message: planError.message, details: planError.details, hint: planError.hint, payload: planPayload });
    return { data: null, error: planError.message };
  }

  // Insert items
  if (items.length > 0) {
    const itemPayloads = items.map((i) => {
      const payload = mealItemToSupabase(i);
      payload.meal_plan_id = planData.id;
      delete payload.id;
      return payload;
    });

    const { error: itemsError } = await client
      .from("meal_plan_items")
      .insert(itemPayloads);

    if (itemsError) {
      console.error("[Supabase] createMealPlanItems error:", itemsError);
      // Plan was created but items failed — return partial success
      return { data: mealPlanFromSupabase(planData, []), error: `Plan created but items failed: ${itemsError.message}` };
    }
  }

  // Make this the patient's one and only "Meal Plan Aktif" — deactivates
  // every other plan for this patient atomically via fn_set_meal_plan_active.
  // Best-effort: if it fails (e.g. function not migrated yet), the plan
  // is still saved — it just won't be flagged active until retried.
  const { error: activateError } = await client.rpc("fn_set_meal_plan_active", {
    p_meal_plan_id: planData.id,
  });
  if (activateError) {
    console.warn("[Supabase] fn_set_meal_plan_active failed:", activateError.message);
  }

  // Fetch complete plan with items
  const { data: fullPlan } = await client
    .from("meal_plans")
    .select("*, meal_plan_items(*, foods(*, food_categories(*)))")
    .eq("id", planData.id)
    .single();

  const planItems = (fullPlan?.meal_plan_items || []).map((item: any) =>
    mealItemFromSupabase(item, item.foods ? foodFromSupabase(item.foods, item.foods.food_categories) : null),
  );

  return { data: mealPlanFromSupabase(fullPlan || planData, planItems), error: null };
}

// ---------------------------------------------------------------------
// Fetch the single active meal plan for a patient — the "Meal Plan
// Aktif" that the Editor, Shopping Planner, Isi Piringku visualization,
// and nutrition validation all read from (single source of truth).
// Falls back to the most recent non-deleted plan if none is flagged
// active yet (e.g. pre-migration data).
// ---------------------------------------------------------------------
export async function supabaseGetActiveMealPlan(patientId: string): Promise<any | null> {
  const { client } = await getServerClient();

  const { data: activeRow } = await client
    .from("meal_plans")
    .select("*, patients(*, diagnoses(*)), nutrition_presets(*), meal_plan_items(*, foods(*, food_categories(*)))")
    .eq("patient_id", patientId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  const row =
    activeRow ??
    (
      await client
        .from("meal_plans")
        .select("*, patients(*, diagnoses(*)), nutrition_presets(*), meal_plan_items(*, foods(*, food_categories(*)))")
        .eq("patient_id", patientId)
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data;

  if (!row) return null;

  const items = (row.meal_plan_items || []).map((item: any) =>
    mealItemFromSupabase(item, item.foods ? foodFromSupabase(item.foods, item.foods.food_categories) : null),
  );
  return mealPlanFromSupabase(
    row,
    items,
    row.nutrition_presets ? presetFromSupabase(row.nutrition_presets) : null,
    row.patients ? patientFromSupabase(row.patients) : null,
  );
}

// ---------------------------------------------------------------------
// FOOD RECORDS — Require authentication for writes
// ---------------------------------------------------------------------
export async function supabaseListFoodRecords(patientId: string, date?: string): Promise<any[]> {
  const { client } = await getServerClient();
  let query = client
    .from("food_records")
    .select("*, foods(*, food_categories(*))")
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
    console.error("[Supabase] listFoodRecords error:", error);
    return [];
  }

  return (data || []).map((row: any) =>
    foodRecordFromSupabase(row, row.foods ? foodFromSupabase(row.foods, row.foods.food_categories) : null),
  );
}

export async function supabaseCreateFoodRecord(record: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) {
    console.warn("[Supabase] createFoodRecord BLOCKED: No authenticated session");
    return { data: null, error: "Authentication required. Please log in." };
  }

  const payload = {
    patient_id: record.patientId ?? record.patient_id,
    food_id: record.foodId ?? record.food_id,
    slot: (record.slot ?? "LUNCH").toUpperCase(),
    amount: record.amount,
    consumed: record.consumed ?? 100,
    date: record.date ?? new Date().toISOString(),
    cal: record.cal ?? 0,
    protein: record.protein ?? 0,
    fat: record.fat ?? 0,
    carb: record.carb ?? 0,
    fiber: record.fiber ?? 0,
    sodium: record.sodium ?? 0,
    notes: record.notes,
  };

  console.log("[Supabase] createFoodRecord INSERT start", { table: "food_records", payload });
  const { data, error } = await client
    .from("food_records")
    .insert(payload)
    .select()
    .single();
  console.log("[Supabase] createFoodRecord INSERT result", { data: data ? { id: data.id } : null, error: error ? { code: error.code, message: error.message } : null });

  if (error) {
    console.error("[Supabase] createFoodRecord FAILED:", { code: error.code, message: error.message, details: error.details, hint: error.hint, payload });
    return { data: null, error: error.message };
  }
  console.log("[Supabase] createFoodRecord SUCCESS:", { id: data.id });
  return { data: foodRecordFromSupabase(data), error: null };
}

export async function supabaseDeleteFoodRecord(id: string): Promise<{ error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { error: "Authentication required." };

  const { error } = await client.from("food_records").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------
// WEIGHT RECORDS
// ---------------------------------------------------------------------
export async function supabaseListWeightRecords(patientId: string): Promise<any[]> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("weight_records")
    .select("*")
    .eq("patient_id", patientId)
    .order("date", { ascending: true })
    .limit(100);

  if (error) return [];
  return (data || []).map(weightRecordFromSupabase);
}

// ---------------------------------------------------------------------
// LABORATORIUM — server-side read used by the AI Clinical Assessment
// prompt builder so lab results become a genuine AI Evaluation input
// instead of the "no lab data" disclaimer the assessment used to emit.
// ---------------------------------------------------------------------
export function labResultFromSupabase(row: any): any {
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
  };
}

export async function supabaseListLabResults(patientId: string): Promise<any[]> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("laboratory_results")
    .select("*")
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("lab_date", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[Supabase] listLabResults error:", error);
    return [];
  }
  return (data || []).map(labResultFromSupabase);
}

export async function supabaseCreateWeightRecord(record: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) {
    console.warn("[Supabase] createWeightRecord BLOCKED: No authenticated session");
    return { data: null, error: "Authentication required." };
  }

  const payload = {
    patient_id: record.patientId ?? record.patient_id,
    date: record.date ?? new Date().toISOString(),
    weight: record.weight,
    height: record.height,
    bmi: record.bmi,
    bmi_category: record.bmiCategory ?? record.bmi_category,
    weight_change: record.weightChange ?? record.weight_change,
    weight_change_pct: record.weightChangePct ?? record.weight_change_pct,
    note: record.note,
    created_by: session.user?.email ?? "system",
  };

  console.log("[Supabase] createWeightRecord INSERT start", { table: "weight_records", payload });
  const { data, error } = await client
    .from("weight_records")
    .insert(payload)
    .select()
    .single();
  console.log("[Supabase] createWeightRecord INSERT result", { data: data ? { id: data.id } : null, error: error ? { code: error.code, message: error.message } : null });

  if (error) {
    console.error("[Supabase] createWeightRecord FAILED:", { code: error.code, message: error.message, details: error.details, hint: error.hint, payload });
    return { data: null, error: error.message };
  }
  console.log("[Supabase] createWeightRecord SUCCESS:", { id: data.id });
  return { data: weightRecordFromSupabase(data), error: null };
}

export async function supabaseDeleteWeightRecord(id: string): Promise<{ error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { error: "Authentication required." };

  const { error } = await client.from("weight_records").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------
// NUTRITION ASSESSMENTS
// ---------------------------------------------------------------------
export async function supabaseListAssessments(patientId: string): Promise<any[]> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("nutrition_assessments")
    .select("*")
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false })
    .limit(20);

  if (error) return [];
  return (data || []).map(assessmentFromSupabase);
}

export async function supabaseGetAssessmentById(id: string): Promise<any | null> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("nutrition_assessments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return assessmentFromSupabase(data);
}

export async function supabaseCreateAssessment(a: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) {
    console.warn("[Supabase] createAssessment BLOCKED: No authenticated session");
    return { data: null, error: "Authentication required." };
  }

  const payload = {
    patient_id: a.patientId ?? a.patient_id,
    recorded_at: a.recordedAt ?? a.recorded_at ?? new Date().toISOString(),
    must: a.must,
    must_score: a.mustScore ?? a.must_score,
    sga: a.sga,
    nrs2002: a.nrs2002,
    nrs_score: a.nrsScore ?? a.nrs_score,
    mna: a.mna,
    mna_score: a.mnaScore ?? a.mna_score,
    pps: a.pps,
    ecog: a.ecog,
    barthel: a.barthel,
    frailty: a.frailty,
    frailty_score: a.frailtyScore ?? a.frailty_score,
    fall_risk: a.fallRisk ?? a.fall_risk,
    hand_grip: a.handGrip ?? a.hand_grip,
    calf_circ: a.calfCirc ?? a.calf_circ,
    activity: (a.activity ?? "BED_REST").toUpperCase(),
    stress: (a.stress ?? "NONE").toUpperCase(),
    notes: a.notes,
    karnofsky: a.karnofsky ?? null,
    cfs: a.cfs ?? null,
    sarcf_score: a.sarcfScore ?? a.sarcf_score ?? null,
    sarcf_positive: a.sarcfPositive ?? a.sarcf_positive ?? null,
    calf_category: a.calfCategory ?? a.calf_category ?? null,
    sarc_calf_score: a.sarcCalfScore ?? a.sarc_calf_score ?? null,
    sarc_calf_positive: a.sarcCalfPositive ?? a.sarc_calf_positive ?? null,
    morse_history_fall: a.morseHistoryFall ?? a.morse_history_fall ?? null,
    morse_secondary_dx: a.morseSecondaryDx ?? a.morse_secondary_dx ?? null,
    morse_ambulatory_aid: a.morseAmbulatoryAid ?? a.morse_ambulatory_aid ?? null,
    morse_iv_therapy: a.morseIvTherapy ?? a.morse_iv_therapy ?? null,
    morse_gait: a.morseGait ?? a.morse_gait ?? null,
    morse_mental_status: a.morseMentalStatus ?? a.morse_mental_status ?? null,
    morse_score: a.morseScore ?? a.morse_score ?? null,
    tug_category: a.tugCategory ?? a.tug_category ?? null,
    barthel_items: a.barthelItems ?? a.barthel_items ?? null,
    created_by: session.user?.email ?? "system",
  };

  console.log("[Supabase] createAssessment INSERT start", { table: "nutrition_assessments", payload });
  const { data, error } = await client
    .from("nutrition_assessments")
    .insert(payload)
    .select()
    .single();
  console.log("[Supabase] createAssessment INSERT result", { data: data ? { id: data.id } : null, error: error ? { code: error.code, message: error.message } : null });

  if (error) {
    console.error("[Supabase] createAssessment FAILED:", { code: error.code, message: error.message, details: error.details, hint: error.hint, payload });
    return { data: null, error: error.message };
  }
  console.log("[Supabase] createAssessment SUCCESS:", { id: data.id });
  return { data: assessmentFromSupabase(data), error: null };
}

export async function supabaseDeleteAssessment(id: string): Promise<{ error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { error: "Authentication required." };

  const { error } = await client.from("nutrition_assessments").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------
// NUTRITION PRESETS
// ---------------------------------------------------------------------
export async function supabaseListPresets(patientId?: string): Promise<any[]> {
  const { client } = await getServerClient();
  let query = client
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
    console.error("[Supabase] listPresets error:", error);
    return [];
  }
  return (data || []).map(presetFromSupabase);
}

export async function supabaseCreatePreset(p: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) {
    console.warn("[Supabase] createPreset BLOCKED: No authenticated session");
    return { data: null, error: "Authentication required." };
  }

  const payload = {
    patient_id: p.patientId ?? p.patient_id ?? null,
    name: p.name,
    description: p.description ?? "",
    color: p.color ?? "#10b981",
    icon: p.icon ?? "utensils",
    is_template: p.isTemplate ?? p.is_template ?? false,
    is_favorite: p.isFavorite ?? p.is_favorite ?? false,
    total_cal: p.totalCal ?? p.total_cal,
    target_weight: p.targetWeight ?? p.target_weight,
    bmr: p.bmr,
    tdee: p.tdee,
    protein_pct: p.proteinPct ?? p.protein_pct,
    carb_pct: p.carbPct ?? p.carb_pct,
    fat_pct: p.fatPct ?? p.fat_pct,
    protein_g: p.proteinG ?? p.protein_g,
    carb_g: p.carbG ?? p.carb_g,
    fat_g: p.fatG ?? p.fat_g,
    fiber_g: p.fiberG ?? p.fiber_g ?? 25,
    sodium_mg: p.sodiumMg ?? p.sodium_mg ?? 2300,
    potassium_mg: p.potassiumMg ?? p.potassium_mg,
    fluid_ml: p.fluidMl ?? p.fluid_ml,
    goal: (p.goal ?? "GENERAL").toUpperCase(),
    diagnoses: p.diagnoses ?? "",
    created_by: session.user?.email ?? "system",
    updated_by: session.user?.email ?? "system",
  };

  console.log("[Supabase] createPreset INSERT start", { table: "nutrition_presets", payload });
  const { data, error } = await client
    .from("nutrition_presets")
    .insert(payload)
    .select()
    .single();
  console.log("[Supabase] createPreset INSERT result", { data: data ? { id: data.id } : null, error: error ? { code: error.code, message: error.message } : null });

  if (error) {
    console.error("[Supabase] createPreset FAILED:", { code: error.code, message: error.message, details: error.details, hint: error.hint, payload });
    return { data: null, error: error.message };
  }
  console.log("[Supabase] createPreset SUCCESS:", { id: data.id });
  return { data: presetFromSupabase(data), error: null };
}

// ---------------------------------------------------------------------
// RECIPES
// ---------------------------------------------------------------------
export async function supabaseListRecipes(): Promise<any[]> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("recipes")
    .select("*, recipe_items(*, foods(*, food_categories(*)))")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return [];
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    servings: row.servings,
    method: row.method,
    imageUrl: row.image_url,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.recipe_items || []).map((ri: any) => ({
      id: ri.id,
      recipeId: ri.recipe_id,
      foodId: ri.food_id,
      amount: ri.amount,
      food: ri.foods ? foodFromSupabase(ri.foods, ri.foods.food_categories) : null,
    })),
  }));
}

export async function supabaseCreateRecipe(r: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data: recipeData, error: recipeError } = await client
    .from("recipes")
    .insert({
      name: r.name,
      description: r.description,
      servings: r.servings ?? 1,
      method: r.method,
      image_url: r.imageUrl ?? r.image_url,
    })
    .select()
    .single();

  if (recipeError) return { data: null, error: recipeError.message };

  if (r.items && r.items.length > 0) {
    const items = r.items.map((i: any) => ({
      recipe_id: recipeData.id,
      food_id: i.foodId ?? i.food_id,
      amount: i.amount,
    }));
    const { error: itemsError } = await client.from("recipe_items").insert(items);
    if (itemsError) return { data: recipeData, error: itemsError.message };
  }

  return { data: recipeData, error: null };
}

export async function supabaseDeleteRecipe(id: string): Promise<{ error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { error: "Authentication required." };

  const { error } = await client.from("recipes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------
// EXERCISE PLANS
// ---------------------------------------------------------------------
export async function supabaseListExercisePlans(patientId?: string): Promise<any[]> {
  const { client } = await getServerClient();
  let query = client
    .from("exercise_plans")
    .select("*, exercise_items(*)")
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(20);

  if (patientId) query = query.eq("patient_id", patientId);

  const { data, error } = await query;
  if (error) return [];
  return (data || []).map((row: any) => ({
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    totalBurned: row.total_burned,
    targetBurned: row.target_burned,
    notes: row.notes,
    sourceProgramIds: row.source_program_ids || [],
    planDetails: row.plan_details || {},
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.exercise_items || []).map((ei: any) => ({
      id: ei.id,
      exercisePlanId: ei.exercise_plan_id,
      name: ei.name,
      type: ei.type,
      intensity: ei.intensity,
      duration: ei.duration,
      caloriesBurned: ei.calories_burned,
      met: ei.met,
      notes: ei.notes,
      instructions: ei.instructions,
      setsReps: ei.sets_reps,
    })),
  }));
}

export async function supabaseCreateExercisePlan(plan: any, items: any[]): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data: planData, error: planError } = await client
    .from("exercise_plans")
    .insert({
      patient_id: plan.patientId ?? plan.patient_id,
      total_burned: plan.totalBurned ?? plan.total_burned ?? 0,
      target_burned: plan.targetBurned ?? plan.target_burned ?? 0,
      notes: plan.notes,
      source_program_ids: plan.sourceProgramIds ?? plan.source_program_ids ?? [],
      plan_details: plan.planDetails ?? plan.plan_details ?? {},
    })
    .select()
    .single();

  if (planError) return { data: null, error: planError.message };

  if (items.length > 0) {
    const itemPayloads = items.map((i) => ({
      exercise_plan_id: planData.id,
      name: i.name,
      type: (i.type ?? "AEROBIC").toUpperCase(),
      intensity: (i.intensity ?? "MODERATE").toUpperCase(),
      duration: i.duration,
      calories_burned: i.caloriesBurned ?? i.calories_burned ?? 0,
      met: i.met ?? 3,
      notes: i.notes,
    }));
    const { error: itemsError } = await client.from("exercise_items").insert(itemPayloads);
    if (itemsError) return { data: planData, error: itemsError.message };
  }

  return { data: planData, error: null };
}

// ---------------------------------------------------------------------
// EXERCISE PROGRAM LIBRARY (evidence-based grounding for AI generation)
// ---------------------------------------------------------------------
export async function supabaseFindExercisePrograms(
  diagnosisTypes: string[],
  limit: number = 3,
): Promise<any[]> {
  if (!diagnosisTypes.length) return [];
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("exercise_programs")
    .select("*")
    .eq("is_active", true)
    .overlaps("linked_diagnosis_types", diagnosisTypes)
    .limit(limit);

  if (error) {
    console.warn("[Supabase] findExercisePrograms error:", error.message);
    return [];
  }
  return data || [];
}

// ---------------------------------------------------------------------
// SAVED MEAL PLANS
// ---------------------------------------------------------------------
export async function supabaseListSavedMealPlans(patientId?: string): Promise<any[]> {
  const { client } = await getServerClient();
  let query = client
    .from("saved_meal_plans")
    .select("*, saved_meal_plan_items(*, foods(*, food_categories(*)))")
    .order("created_at", { ascending: false })
    .limit(50);

  if (patientId) query = query.eq("patient_id", patientId);

  const { data, error } = await query;
  if (error) return [];
  return (data || []).map((row: any) => ({
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    date: row.date,
    totalCal: row.total_cal,
    totalProtein: row.total_protein,
    totalFat: row.total_fat,
    totalCarb: row.total_carb,
    totalFiber: row.total_fiber,
    totalSodium: row.total_sodium,
    compliance: row.compliance,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.saved_meal_plan_items || []).map((i: any) => ({
      id: i.id,
      savedMealPlanId: i.saved_meal_plan_id,
      slot: i.slot,
      foodId: i.food_id,
      amount: i.amount,
      cal: i.cal,
      protein: i.protein,
      fat: i.fat,
      carb: i.carb,
      fiber: i.fiber,
      sodium: i.sodium,
      food: i.foods ? foodFromSupabase(i.foods, i.foods.food_categories) : null,
    })),
  }));
}

export async function supabaseCreateSavedMealPlan(plan: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data: planData, error: planError } = await client
    .from("saved_meal_plans")
    .insert({
      patient_id: plan.patientId ?? plan.patient_id,
      name: plan.name,
      total_cal: plan.totalCal ?? plan.total_cal ?? 0,
      total_protein: plan.totalProtein ?? plan.total_protein ?? 0,
      total_fat: plan.totalFat ?? plan.total_fat ?? 0,
      total_carb: plan.totalCarb ?? plan.total_carb ?? 0,
      total_fiber: plan.totalFiber ?? plan.total_fiber ?? 0,
      total_sodium: plan.totalSodium ?? plan.total_sodium ?? 0,
      total_potassium: plan.totalPotassium ?? plan.total_potassium ?? 0,
      notes: plan.notes,
    })
    .select()
    .single();

  if (planError) return { data: null, error: planError.message };

  if (plan.items && plan.items.length > 0) {
    // Fetch food names from Supabase for each food_id
    const foodIds = [...new Set(plan.items.map((i: any) => i.foodId ?? i.food_id))];
    const foodNameMap = new Map<string, string>();
    if (foodIds.length > 0) {
      const { data: foods } = await client
        .from("foods")
        .select("id, name")
        .in("id", foodIds);
      for (const f of (foods || [])) {
        foodNameMap.set(f.id, f.name);
      }
    }

    const items = plan.items.map((i: any) => ({
      saved_meal_plan_id: planData.id,
      slot: (i.slot ?? "LUNCH").toUpperCase(),
      food_id: i.foodId ?? i.food_id,
      food_name: i.foodName ?? foodNameMap.get(i.foodId ?? i.food_id) ?? "Unknown",
      urt: i.urt ?? null,
      amount: i.amount,
      cal: i.cal ?? 0,
      protein: i.protein ?? 0,
      fat: i.fat ?? 0,
      carb: i.carb ?? 0,
      fiber: i.fiber ?? 0,
      sodium: i.sodium ?? 0,
      potassium: i.potassium ?? 0,
    }));
    const { error: itemsError } = await client.from("saved_meal_plan_items").insert(items);
    if (itemsError) return { data: planData, error: itemsError.message };
  }

  return { data: planData, error: null };
}

export async function supabaseDeleteSavedMealPlan(id: string): Promise<{ error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { error: "Authentication required." };

  const { error } = await client.from("saved_meal_plans").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------
// DASHBOARD STATS
// ---------------------------------------------------------------------
export async function supabaseGetDashboardStats(): Promise<any> {
  const { client } = await getServerClient();

  const [patients, foods, mealPlans, foodRecords] = await Promise.all([
    client.from("patients").select("id", { count: "exact", head: true }).is("deleted_at", null),
    client.from("foods").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("approved", true),
    client.from("meal_plans").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "FINAL"),
    client.from("food_records").select("id, cal", { count: "exact" }).gte("date", new Date(Date.now() - 86400000).toISOString()),
  ]);

  const todayCalories = (foodRecords.data || []).reduce((sum: number, r: any) => sum + (r.cal || 0), 0);

  return {
    totalPatients: patients.count ?? 0,
    activeMealPlans: mealPlans.count ?? 0,
    totalFoods: foods.count ?? 0,
    todayCalories: Math.round(todayCalories),
    todayFoodRecords: foodRecords.data?.length ?? 0,
  };
}

// ---------------------------------------------------------------------
// TEST WRITE — Insert a test row and read it back
// ---------------------------------------------------------------------
export async function supabaseTestWrite(): Promise<{ success: boolean; data: any; error: string | null }> {
  const { client, session } = await getServerClient();

  if (!session) {
    return {
      success: false,
      data: null,
      error: "Authentication required. Please log in first, then click Test Write again.",
    };
  }

  // Insert test row into audit_logs (safe table for testing)
  const testId = crypto.randomUUID();
  const { data: insertData, error: insertError } = await client
    .from("audit_logs")
    .insert({
      entity: "test_connection",
      entity_id: testId,
      action: "TEST_WRITE",
      actor: session.user?.email ?? "unknown",
      diff: { timestamp: new Date().toISOString(), source: "database-monitor" },
    })
    .select()
    .single();

  if (insertError) {
    return { success: false, data: null, error: insertError.message };
  }

  // Read it back
  const { data: readData, error: readError } = await client
    .from("audit_logs")
    .select("*")
    .eq("entity_id", testId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (readError) {
    return { success: true, data: insertData, error: null };
  }

  return { success: true, data: readData, error: null };
}

// ---------------------------------------------------------------------
// DATABASE INFO — Get Supabase project metadata
// ---------------------------------------------------------------------
export async function supabaseGetDatabaseInfo(): Promise<any> {
  const { client, session } = await getServerClient();

  // Test connection by querying food_categories (publicly readable)
  const start = Date.now();
  const { error } = await client.from("food_categories").select("id").limit(1);
  const latency = Date.now() - start;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const projectId = process.env.SUPABASE_PROJECT_ID || url.replace("https://", "").replace(".supabase.co", "");
  const region = "Southeast Asia (Singapore)"; // Default — can't query without service role

  // Count rows in key tables (public reads)
  const [foodsCount, categoriesCount, patientsCount, mealPlansCount] = await Promise.all([
    client.from("foods").select("id", { count: "exact", head: true }).is("deleted_at", null),
    client.from("food_categories").select("id", { count: "exact", head: true }),
    client.from("patients").select("id", { count: "exact", head: true }).is("deleted_at", null),
    client.from("meal_plans").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  return {
    databaseType: "Supabase PostgreSQL",
    isConnected: !error,
    latency: latency,
    error: error?.message ?? null,
    supabaseUrl: url,
    projectId: projectId,
    region: region,
    schema: "public",
    postgresVersion: "15.x (Supabase managed)",
    session: session
      ? {
          userId: session.user.id,
          email: session.user.email,
          isAuthenticated: true,
        }
      : {
          isAuthenticated: false,
        },
    tableCounts: {
      foods: foodsCount.count ?? 0,
      food_categories: categoriesCount.count ?? 0,
      patients: patientsCount.count ?? 0,
      meal_plans: mealPlansCount.count ?? 0,
    },
    authConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    realtimeAvailable: true,
    storageConfigured: false, // Would need service role key to verify
    anonKeyConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

// =====================================================================
// EXTENDED HELPERS — Preset/Recipe/SavedMenu/MealItem CRUD
// Server-side equivalents of frontend-data.ts functions.
// =====================================================================

const KCAL_PER_GRAM_CONST = { protein: 4, carb: 4, fat: 9 };

function computePresetGrams(totalCal: number, pPct: number, cPct: number, fPct: number) {
  return {
    proteinG: Math.round(((totalCal * pPct) / 100 / KCAL_PER_GRAM_CONST.protein) * 10) / 10,
    carbG: Math.round(((totalCal * cPct) / 100 / KCAL_PER_GRAM_CONST.carb) * 10) / 10,
    fatG: Math.round(((totalCal * fPct) / 100 / KCAL_PER_GRAM_CONST.fat) * 10) / 10,
  };
}

// ---------------------------------------------------------------------
// PRESETS — Get / Update / Delete / Favorite / Clone / History
// ---------------------------------------------------------------------
export async function supabaseGetPreset(id: string): Promise<any | null> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("nutrition_presets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[Supabase] getPreset error:", error);
    return null;
  }
  if (!data) return null;
  const preset = presetFromSupabase(data);

  // Fetch history + meal plan count in parallel
  const [histRes, countRes] = await Promise.all([
    client
      .from("nutrition_preset_history")
      .select("*")
      .eq("preset_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    client
      .from("meal_plans")
      .select("id", { count: "exact", head: true })
      .eq("preset_id", id),
  ]);

  preset.history = (histRes.data || []).map((h: any) => ({
    id: h.id,
    presetId: h.preset_id,
    changes: typeof h.changes === "string" ? safeJsonParse(h.changes) : h.changes,
    version: h.version,
    actor: h.actor,
    reason: h.reason,
    createdAt: h.created_at,
  }));
  preset._count = { mealPlans: countRes.count ?? 0 };
  return preset;
}

function safeJsonParse(s: any): any {
  if (s == null) return null;
  if (typeof s !== "string") return s;
  try { return JSON.parse(s); } catch { return s; }
}

const PRESET_TRACKED_FIELDS = [
  "name", "description", "color", "totalCal", "proteinPct", "carbPct",
  "fatPct", "fiberG", "sodiumMg", "potassiumMg", "fluidMl", "goal",
  "diagnoses", "isFavorite",
] as const;

// camelCase → snake_case for preset fields
function presetUpdateToSupabase(d: any): any {
  const out: any = {};
  if (d.name !== undefined) out.name = d.name;
  if (d.description !== undefined) out.description = d.description;
  if (d.color !== undefined) out.color = d.color;
  if (d.icon !== undefined) out.icon = d.icon;
  if (d.isFavorite !== undefined) out.is_favorite = d.isFavorite;
  if (d.isTemplate !== undefined) out.is_template = d.isTemplate;
  if (d.totalCal !== undefined) out.total_cal = d.totalCal;
  if (d.targetWeight !== undefined) out.target_weight = d.targetWeight;
  if (d.bmr !== undefined) out.bmr = d.bmr;
  if (d.tdee !== undefined) out.tdee = d.tdee;
  if (d.proteinPct !== undefined) out.protein_pct = d.proteinPct;
  if (d.carbPct !== undefined) out.carb_pct = d.carbPct;
  if (d.fatPct !== undefined) out.fat_pct = d.fatPct;
  if (d.proteinG !== undefined) out.protein_g = d.proteinG;
  if (d.carbG !== undefined) out.carb_g = d.carbG;
  if (d.fatG !== undefined) out.fat_g = d.fatG;
  if (d.fiberG !== undefined) out.fiber_g = d.fiberG;
  if (d.sodiumMg !== undefined) out.sodium_mg = d.sodiumMg;
  if (d.potassiumMg !== undefined) out.potassium_mg = d.potassiumMg;
  if (d.fluidMl !== undefined) out.fluid_ml = d.fluidMl;
  if (d.goal !== undefined) out.goal = String(d.goal).toUpperCase();
  if (d.diagnoses !== undefined) out.diagnoses = d.diagnoses;
  return out;
}

export async function supabaseUpdatePreset(id: string, updates: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  // Fetch existing
  const { data: existing, error: fetchErr } = await client
    .from("nutrition_presets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { data: null, error: fetchErr.message };
  if (!existing || existing.deleted_at) return { data: null, error: "Preset tidak ditemukan" };

  // Compute new macros
  const newProtein = updates.proteinPct ?? existing.protein_pct;
  const newCarb = updates.carbPct ?? existing.carb_pct;
  const newFat = updates.fatPct ?? existing.fat_pct;
  const macroSum = newProtein + newCarb + newFat;
  if (Math.abs(macroSum - 100) > 10) {
    return { data: null, error: `Total persentase makronutrien harus ~100% (saat ini ${macroSum}%)` };
  }
  const newTotalCal = updates.totalCal ?? existing.total_cal;
  const grams = computePresetGrams(newTotalCal, newProtein, newCarb, newFat);

  // Track changes for history
  const existingCamel = presetFromSupabase(existing);
  const changes: Record<string, { from: any; to: any }> = {};
  for (const field of PRESET_TRACKED_FIELDS) {
    if (updates[field] !== undefined && updates[field] !== (existingCamel as any)[field]) {
      changes[field] = { from: (existingCamel as any)[field], to: updates[field] };
    }
  }

  const payload = presetUpdateToSupabase(updates);
  payload.protein_g = grams.proteinG;
  payload.carb_g = grams.carbG;
  payload.fat_g = grams.fatG;
  payload.version = (existing.version || 1) + 1;
  payload.updated_by = session.user?.email ?? "doctor";

  const { data: updated, error: updateErr } = await client
    .from("nutrition_presets")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (updateErr) return { data: null, error: updateErr.message };

  // Record history if there were changes
  if (Object.keys(changes).length > 0) {
    await client.from("nutrition_preset_history").insert({
      preset_id: id,
      changes,
      version: payload.version,
      actor: session.user?.email ?? "doctor",
      reason: updates.reason || "Preset diperbarui",
    }).then(({ error }: any) => {
      if (error) console.warn("[Supabase] preset history insert failed:", error.message);
    });
  }

  return { data: presetFromSupabase(updated), error: null };
}

export async function supabaseDeletePreset(id: string): Promise<{ error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { error: "Authentication required." };

  const { data: existing } = await client
    .from("nutrition_presets")
    .select("version, name, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.deleted_at) return { error: "Preset tidak ditemukan" };

  const { error: updateErr } = await client
    .from("nutrition_presets")
    .update({ deleted_at: new Date().toISOString(), deleted_by: session.user?.email ?? "doctor" })
    .eq("id", id);
  if (updateErr) return { error: updateErr.message };

  await client.from("nutrition_preset_history").insert({
    preset_id: id,
    changes: { action: "DELETE" },
    version: existing.version || 1,
    actor: session.user?.email ?? "doctor",
    reason: "Preset dihapus (soft delete)",
  }).then(({ error }: any) => {
    if (error) console.warn("[Supabase] preset history insert (delete) failed:", error.message);
  });

  return { error: null };
}

export async function supabaseTogglePresetFavorite(id: string): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data: existing } = await client
    .from("nutrition_presets")
    .select("is_favorite, version, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.deleted_at) return { data: null, error: "Preset tidak ditemukan" };

  const newValue = !existing.is_favorite;
  const { data: updated, error: updateErr } = await client
    .from("nutrition_presets")
    .update({ is_favorite: newValue })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (updateErr) return { data: null, error: updateErr.message };

  await client.from("nutrition_preset_history").insert({
    preset_id: id,
    changes: { isFavorite: { from: existing.is_favorite, to: newValue } },
    version: existing.version || 1,
    actor: session.user?.email ?? "doctor",
    reason: newValue ? "Ditandai sebagai favorit" : "Dihapus dari favorit",
  }).then(({ error }: any) => {
    if (error) console.warn("[Supabase] preset history insert (favorite) failed:", error.message);
  });

  return { data: { id, isFavorite: newValue }, error: null };
}

export async function supabaseClonePreset(
  sourceId: string,
  options: { newName?: string; patientId?: string | null },
): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data: source } = await client
    .from("nutrition_presets")
    .select("*")
    .eq("id", sourceId)
    .maybeSingle();
  if (!source || source.deleted_at) return { data: null, error: "Preset sumber tidak ditemukan" };

  const cloneName = options.newName || `${source.name} (Salinan)`;
  const clonePatientId = options.patientId !== undefined ? options.patientId : source.patient_id;

  const insertPayload: any = {
    patient_id: clonePatientId ?? null,
    name: cloneName,
    description: source.description,
    color: source.color,
    icon: source.icon,
    is_template: false,
    is_favorite: false,
    total_cal: source.total_cal,
    target_weight: source.target_weight,
    bmr: source.bmr,
    tdee: source.tdee,
    protein_pct: source.protein_pct,
    carb_pct: source.carb_pct,
    fat_pct: source.fat_pct,
    protein_g: source.protein_g,
    carb_g: source.carb_g,
    fat_g: source.fat_g,
    fiber_g: source.fiber_g,
    sodium_mg: source.sodium_mg,
    potassium_mg: source.potassium_mg,
    fluid_ml: source.fluid_ml,
    goal: source.goal,
    diagnoses: source.diagnoses,
    version: 1,
    created_by: session.user?.email ?? "doctor",
    updated_by: session.user?.email ?? "doctor",
  };

  const { data: clone, error: insertErr } = await client
    .from("nutrition_presets")
    .insert(insertPayload)
    .select("*")
    .single();
  if (insertErr) return { data: null, error: insertErr.message };

  await client.from("nutrition_preset_history").insert({
    preset_id: clone.id,
    changes: { action: "CLONE", sourcePresetId: sourceId, sourceName: source.name },
    version: 1,
    actor: session.user?.email ?? "doctor",
    reason: `Duplikat dari "${source.name}"`,
  }).then(({ error }: any) => {
    if (error) console.warn("[Supabase] preset history insert (clone) failed:", error.message);
  });

  return { data: presetFromSupabase(clone), error: null };
}

export async function supabaseFetchPresetHistory(presetId: string): Promise<any[]> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("nutrition_preset_history")
    .select("*")
    .eq("preset_id", presetId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[Supabase] fetchPresetHistory error:", error);
    return [];
  }
  return (data || []).map((h: any) => ({
    id: h.id,
    presetId: h.preset_id,
    changes: typeof h.changes === "string" ? safeJsonParse(h.changes) : h.changes,
    version: h.version,
    actor: h.actor,
    reason: h.reason,
    createdAt: h.created_at,
  }));
}

// ---------------------------------------------------------------------
// RECIPES — Get / Update
// ---------------------------------------------------------------------
export async function supabaseGetRecipe(id: string): Promise<any | null> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("recipes")
    .select("*, recipe_items(*, foods(*, food_categories(*)))")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[Supabase] getRecipe error:", error);
    return null;
  }
  if (!data) return null;
  return mapRecipeRow(data);
}

function mapRecipeRow(row: any): any {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    servings: row.servings,
    method: row.method,
    imageUrl: row.image_url,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.recipe_items || []).map((ri: any) => ({
      id: ri.id,
      recipeId: ri.recipe_id,
      foodId: ri.food_id,
      amount: ri.amount,
      food: ri.foods ? foodFromSupabase(ri.foods, ri.foods.food_categories) : null,
    })),
  };
}

export async function supabaseUpdateRecipe(id: string, updates: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data: existing } = await client
    .from("recipes")
    .select("id, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.deleted_at) return { data: null, error: "Resep tidak ditemukan" };

  // Replace items if provided
  if (updates.items && Array.isArray(updates.items)) {
    const { error: delErr } = await client.from("recipe_items").delete().eq("recipe_id", id);
    if (delErr) return { data: null, error: delErr.message };

    if (updates.items.length > 0) {
      const itemPayloads = updates.items.map((it: any) => ({
        recipe_id: id,
        food_id: it.foodId ?? it.food_id,
        amount: it.amount,
      }));
      const { error: itemsErr } = await client.from("recipe_items").insert(itemPayloads);
      if (itemsErr) return { data: null, error: itemsErr.message };
    }
  }

  const patch: any = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.servings !== undefined) patch.servings = updates.servings;
  if (updates.method !== undefined) patch.method = updates.method;
  if (updates.imageUrl !== undefined) patch.image_url = updates.imageUrl;

  if (Object.keys(patch).length > 0) {
    const { error: updateErr } = await client.from("recipes").update(patch).eq("id", id);
    if (updateErr) return { data: null, error: updateErr.message };
  }

  // Refetch with items
  const { data: refreshed, error: refErr } = await client
    .from("recipes")
    .select("*, recipe_items(*, foods(*, food_categories(*)))")
    .eq("id", id)
    .maybeSingle();
  if (refErr) return { data: null, error: refErr.message };
  return { data: mapRecipeRow(refreshed), error: null };
}

// ---------------------------------------------------------------------
// SAVED MEAL PLANS — Get / Mark Used
// ---------------------------------------------------------------------
export async function supabaseGetSavedMealPlan(id: string): Promise<any | null> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("saved_meal_plans")
    .select("*, saved_meal_plan_items(*, foods(*, food_categories(*)))")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[Supabase] getSavedMealPlan error:", error);
    return null;
  }
  if (!data) return null;
  return mapSavedMealPlanRow(data);
}

function mapSavedMealPlanRow(row: any): any {
  return {
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    description: row.description,
    notes: row.notes,
    totalCal: row.total_cal,
    totalProtein: row.total_protein,
    totalFat: row.total_fat,
    totalCarb: row.total_carb,
    totalFiber: row.total_fiber,
    totalSodium: row.total_sodium,
    totalPotassium: row.total_potassium,
    version: row.version,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.saved_meal_plan_items || []).map((i: any) => ({
      id: i.id,
      savedMealPlanId: i.saved_meal_plan_id,
      slot: i.slot,
      foodId: i.food_id,
      foodName: i.food_name,
      urt: i.urt,
      amount: i.amount,
      cal: i.cal,
      protein: i.protein,
      fat: i.fat,
      carb: i.carb,
      fiber: i.fiber,
      sodium: i.sodium,
      potassium: i.potassium,
      food: i.foods ? foodFromSupabase(i.foods, i.foods.food_categories) : null,
    })),
  };
}

export async function supabaseMarkSavedMealPlanUsed(id: string): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data: existing } = await client
    .from("saved_meal_plans")
    .select("id, deleted_at, use_count")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.deleted_at) return { data: null, error: "Meal plan tidak ditemukan" };

  const newUseCount = (existing.use_count || 0) + 1;
  const { data: updated, error: updateErr } = await client
    .from("saved_meal_plans")
    .update({ use_count: newUseCount, last_used_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (updateErr) return { data: null, error: updateErr.message };
  return { data: updated, error: null };
}

// ---------------------------------------------------------------------
// SAVED MENUS — List / Get / Create / Update / Mark Used / Delete
// ---------------------------------------------------------------------
export async function supabaseListSavedMenus(params?: {
  patientId?: string;
  category?: string;
  q?: string;
}): Promise<any[]> {
  const { client } = await getServerClient();
  let query = client
    .from("saved_menus")
    .select("*, saved_menu_items(*, foods(*, food_categories(*)))")
    .is("deleted_at", null)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (params?.patientId) query = query.eq("patient_id", params.patientId);
  if (params?.category) query = query.eq("category", params.category);
  if (params?.q) query = query.ilike("name", `%${params.q}%`);

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase] listSavedMenus error:", error);
    return [];
  }
  return (data || []).map(mapSavedMenuRow);
}

function mapSavedMenuRow(row: any): any {
  return {
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    category: row.category,
    notes: row.notes,
    totalCal: row.total_cal,
    totalProtein: row.total_protein,
    totalFat: row.total_fat,
    totalCarb: row.total_carb,
    totalFiber: row.total_fiber,
    totalSodium: row.total_sodium,
    totalPotassium: row.total_potassium,
    version: row.version,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.saved_menu_items || []).map((i: any) => ({
      id: i.id,
      savedMenuId: i.saved_menu_id,
      foodId: i.food_id,
      foodName: i.food_name,
      urt: i.urt,
      amount: i.amount,
      cal: i.cal,
      protein: i.protein,
      fat: i.fat,
      carb: i.carb,
      fiber: i.fiber,
      sodium: i.sodium,
      potassium: i.potassium,
      food: i.foods ? foodFromSupabase(i.foods, i.foods.food_categories) : null,
    })),
  };
}

export async function supabaseGetSavedMenu(id: string): Promise<any | null> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("saved_menus")
    .select("*, saved_menu_items(*, foods(*, food_categories(*)))")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[Supabase] getSavedMenu error:", error);
    return null;
  }
  if (!data) return null;
  return mapSavedMenuRow(data);
}

export async function supabaseCreateSavedMenu(data: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const totals = (data.items || []).reduce(
    (acc: any, i: any) => ({
      cal: acc.cal + i.cal,
      protein: acc.protein + i.protein,
      fat: acc.fat + i.fat,
      carb: acc.carb + i.carb,
      fiber: acc.fiber + i.fiber,
      sodium: acc.sodium + i.sodium,
      potassium: acc.potassium + i.potassium,
    }),
    { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0, potassium: 0 },
  );

  const insertPayload: any = {
    patient_id: data.patientId ?? data.patient_id ?? null,
    name: data.name,
    category: data.category,
    notes: data.notes ?? "",
    total_cal: Math.round(totals.cal * 10) / 10,
    total_protein: Math.round(totals.protein * 10) / 10,
    total_fat: Math.round(totals.fat * 10) / 10,
    total_carb: Math.round(totals.carb * 10) / 10,
    total_fiber: Math.round(totals.fiber * 10) / 10,
    total_sodium: Math.round(totals.sodium),
    total_potassium: Math.round(totals.potassium),
    created_by: session.user?.email ?? "system",
  };

  const { data: menuRow, error: menuErr } = await client
    .from("saved_menus")
    .insert(insertPayload)
    .select("*")
    .single();
  if (menuErr) return { data: null, error: menuErr.message };

  if (data.items && data.items.length > 0) {
    const itemPayloads = data.items.map((it: any) => ({
      saved_menu_id: menuRow.id,
      food_id: it.foodId ?? it.food_id,
      food_name: it.foodName,
      urt: it.urt ?? null,
      amount: it.amount,
      cal: it.cal,
      protein: it.protein,
      fat: it.fat,
      carb: it.carb,
      fiber: it.fiber,
      sodium: it.sodium,
      potassium: it.potassium,
    }));
    const { error: itemsErr } = await client.from("saved_menu_items").insert(itemPayloads);
    if (itemsErr) return { data: menuRow, error: itemsErr.message };
  }

  // Refetch with items
  const { data: refreshed } = await client
    .from("saved_menus")
    .select("*, saved_menu_items(*, foods(*, food_categories(*)))")
    .eq("id", menuRow.id)
    .maybeSingle();
  return { data: refreshed ? mapSavedMenuRow(refreshed) : menuRow, error: null };
}

export async function supabaseUpdateSavedMenu(id: string, updates: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data: existing } = await client
    .from("saved_menus")
    .select("id, deleted_at, version")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.deleted_at) return { data: null, error: "Menu tidak ditemukan" };

  if (updates.items && Array.isArray(updates.items)) {
    const { error: delErr } = await client.from("saved_menu_items").delete().eq("saved_menu_id", id);
    if (delErr) return { data: null, error: delErr.message };

    if (updates.items.length > 0) {
      const itemPayloads = updates.items.map((it: any) => ({
        saved_menu_id: id,
        food_id: it.foodId ?? it.food_id,
        food_name: it.foodName,
        urt: it.urt ?? null,
        amount: it.amount,
        cal: it.cal,
        protein: it.protein,
        fat: it.fat,
        carb: it.carb,
        fiber: it.fiber,
        sodium: it.sodium,
        potassium: it.potassium,
      }));
      const { error: itemsErr } = await client.from("saved_menu_items").insert(itemPayloads);
      if (itemsErr) return { data: null, error: itemsErr.message };
    }
  }

  const patch: any = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.items) {
    const totals = (updates.items as any[]).reduce(
      (acc, i) => ({
        cal: acc.cal + i.cal,
        protein: acc.protein + i.protein,
        fat: acc.fat + i.fat,
        carb: acc.carb + i.carb,
        fiber: acc.fiber + i.fiber,
        sodium: acc.sodium + i.sodium,
        potassium: acc.potassium + i.potassium,
      }),
      { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0, potassium: 0 },
    );
    patch.total_cal = Math.round(totals.cal * 10) / 10;
    patch.total_protein = Math.round(totals.protein * 10) / 10;
    patch.total_fat = Math.round(totals.fat * 10) / 10;
    patch.total_carb = Math.round(totals.carb * 10) / 10;
    patch.total_fiber = Math.round(totals.fiber * 10) / 10;
    patch.total_sodium = Math.round(totals.sodium);
    patch.total_potassium = Math.round(totals.potassium);
  }
  patch.version = (existing.version || 1) + 1;

  const { error: updateErr } = await client.from("saved_menus").update(patch).eq("id", id);
  if (updateErr) return { data: null, error: updateErr.message };

  const { data: refreshed } = await client
    .from("saved_menus")
    .select("*, saved_menu_items(*, foods(*, food_categories(*)))")
    .eq("id", id)
    .maybeSingle();
  return { data: refreshed ? mapSavedMenuRow(refreshed) : null, error: null };
}

export async function supabaseMarkSavedMenuUsed(id: string): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data: existing } = await client
    .from("saved_menus")
    .select("id, deleted_at, use_count")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.deleted_at) return { data: null, error: "Menu tidak ditemukan" };

  const newUseCount = (existing.use_count || 0) + 1;
  const { data: updated, error: updateErr } = await client
    .from("saved_menus")
    .update({ use_count: newUseCount, last_used_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (updateErr) return { data: null, error: updateErr.message };
  return { data: updated, error: null };
}

export async function supabaseDeleteSavedMenu(id: string): Promise<{ error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { error: "Authentication required." };

  const { data: existing } = await client
    .from("saved_menus")
    .select("id, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.deleted_at) return { error: "Menu tidak ditemukan" };

  const { error: updateErr } = await client
    .from("saved_menus")
    .update({ deleted_at: new Date().toISOString(), deleted_by: session.user?.email ?? "system" })
    .eq("id", id);
  return { error: updateErr?.message ?? null };
}

// ---------------------------------------------------------------------
// MEAL PLAN ITEMS — List / Add / Update / Delete
// ---------------------------------------------------------------------
export async function supabaseListMealItems(mealPlanId: string): Promise<any[]> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("meal_plan_items")
    .select("*, foods(*, food_categories(*))")
    .eq("meal_plan_id", mealPlanId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[Supabase] listMealItems error:", error);
    return [];
  }
  return (data || []).map((row: any) =>
    mealItemFromSupabase(row, row.foods ? foodFromSupabase(row.foods, row.foods.food_categories) : null),
  );
}

export async function supabaseAddMealItem(mealPlanId: string, data: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const payload = {
    meal_plan_id: mealPlanId,
    slot: (data.slot ?? "LUNCH").toUpperCase(),
    food_id: data.foodId ?? data.food_id,
    amount: data.amount,
    cal: data.cal ?? 0,
    protein: data.protein ?? 0,
    fat: data.fat ?? 0,
    carb: data.carb ?? 0,
    fiber: data.fiber ?? 0,
    sodium: data.sodium ?? 0,
  };

  const { data: inserted, error } = await client
    .from("meal_plan_items")
    .insert(payload)
    .select("*, foods(*, food_categories(*))")
    .single();
  if (error) return { data: null, error: error.message };
  return { data: mealItemFromSupabase(inserted, inserted.foods ? foodFromSupabase(inserted.foods, inserted.foods.food_categories) : null), error: null };
}

export async function supabaseUpdateMealItem(itemId: string, data: any): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const patch: any = {};
  if (data.foodId !== undefined) patch.food_id = data.foodId;
  if (data.amount !== undefined) patch.amount = data.amount;
  if (data.cal !== undefined) patch.cal = data.cal;
  if (data.protein !== undefined) patch.protein = data.protein;
  if (data.fat !== undefined) patch.fat = data.fat;
  if (data.carb !== undefined) patch.carb = data.carb;
  if (data.fiber !== undefined) patch.fiber = data.fiber;
  if (data.sodium !== undefined) patch.sodium = data.sodium;
  if (data.slot !== undefined) patch.slot = String(data.slot).toUpperCase();

  const { data: updated, error } = await client
    .from("meal_plan_items")
    .update(patch)
    .eq("id", itemId)
    .select("*, foods(*, food_categories(*))")
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!updated) return { data: null, error: "Item tidak ditemukan" };
  return { data: mealItemFromSupabase(updated, updated.foods ? foodFromSupabase(updated.foods, updated.foods.food_categories) : null), error: null };
}

export async function supabaseDeleteMealItem(itemId: string): Promise<{ error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { error: "Authentication required." };

  const { error } = await client.from("meal_plan_items").delete().eq("id", itemId);
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------
// MEAL PLAN — Get single (for recalc & shopping aggregation)
// ---------------------------------------------------------------------
export async function supabaseGetMealPlan(id: string): Promise<any | null> {
  const { client } = await getServerClient();

  // Fetch meal plan basic info (no nested joins to avoid FK hint issues)
  const { data: plan, error: planError } = await client
    .from("meal_plans")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (planError || !plan) {
    if (planError) console.error("[Supabase] getMealPlan error:", planError);
    return null;
  }

  // Fetch items separately with foods (no food_categories nested join)
  const { data: items, error: itemsError } = await client
    .from("meal_plan_items")
    .select("*, foods(*)")
    .eq("meal_plan_id", id);

  if (itemsError) {
    console.error("[Supabase] getMealPlan items error:", itemsError);
  }

  const mappedItems = (items || []).map((item: any) =>
    mealItemFromSupabase(item, item.foods ? foodFromSupabase(item.foods, null) : null),
  );

  return mealPlanFromSupabase(plan, mappedItems, null, null);
}

export async function supabaseUpdateMealPlanTotals(id: string, totals: any): Promise<{ error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { error: "Authentication required." };
  const { error } = await client
    .from("meal_plans")
    .update({
      total_cal: Math.round(totals.cal),
      total_protein: Math.round(totals.protein),
      total_fat: Math.round(totals.fat),
      total_carb: Math.round(totals.carb),
      total_fiber: Math.round(totals.fiber),
      total_sodium: Math.round(totals.sodium),
      compliance: totals.compliance,
    })
    .eq("id", id);
  return { error: error?.message ?? null };
}

// =====================================================================
// MEAL PLAN — Draft/Preview/Save transaction + Riwayat Meal Plan
// Backs the "Edit Meal Plan Terkini (Database)" editor: all edits stay
// client-side until "Simpan Meal Plan" is pressed, then everything is
// committed atomically via the fn_save_meal_plan_draft() Postgres
// function (see supabase/migrations/020_meal_plan_transactional_save.sql).
// =====================================================================

export type MealPlanDraftItem = {
  id?: string | null; // existing meal_plan_items.id — omit/null for new items
  slot: string;
  foodId: string;
  amount: number;
  cal?: number;
  protein?: number;
  fat?: number;
  carb?: number;
  fiber?: number;
  sodium?: number;
};

export async function supabaseSaveMealPlanDraft(
  mealPlanId: string,
  items: MealPlanDraftItem[],
  deletedItemIds: string[] = [],
  name?: string | null,
): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data, error } = await client.rpc("fn_save_meal_plan_draft", {
    p_meal_plan_id: mealPlanId,
    p_items: items.map((i) => ({
      id: i.id ?? null,
      slot: (i.slot ?? "LUNCH").toUpperCase(),
      foodId: i.foodId,
      amount: i.amount,
      cal: i.cal ?? 0,
      protein: i.protein ?? 0,
      fat: i.fat ?? 0,
      carb: i.carb ?? 0,
      fiber: i.fiber ?? 0,
      sodium: i.sodium ?? 0,
    })),
    p_deleted_item_ids: deletedItemIds,
    p_name: name ?? null,
    p_actor: session.user?.email ?? session.user?.id ?? "unknown",
  });

  if (error) return { data: null, error: error.message };

  const plan = mealPlanFromSupabase(data?.plan, data?.items ?? []);
  return { data: plan, error: null };
}

export async function supabaseListMealPlanHistory(patientId?: string): Promise<any[]> {
  const { client } = await getServerClient();

  let planIds: string[] | null = null;
  if (patientId) {
    const { data: plans } = await client
      .from("meal_plans")
      .select("id")
      .eq("patient_id", patientId);
    const ids: string[] = (plans || []).map((p: any) => p.id);
    if (ids.length === 0) return [];
    planIds = ids;
  }

  let query = client
    .from("meal_plan_history")
    .select("id, meal_plan_id, action, changes, snapshot, actor, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (planIds) {
    const idsToFilter: string[] = planIds;
    query = query.in("meal_plan_id", idsToFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase] listMealPlanHistory error:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    mealPlanId: row.meal_plan_id,
    action: row.action,
    name: row.changes?.name || row.snapshot?.name || null,
    totals: row.snapshot?.totals ?? null,
    itemCount: Array.isArray(row.snapshot?.items) ? row.snapshot.items.length : 0,
    actor: row.actor,
    createdAt: row.created_at,
  }));
}

export async function supabaseGetMealPlanHistoryDetail(historyId: string): Promise<any | null> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("meal_plan_history")
    .select("id, meal_plan_id, action, changes, snapshot, actor, created_at")
    .eq("id", historyId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    mealPlanId: data.meal_plan_id,
    action: data.action,
    name: data.changes?.name || data.snapshot?.name || null,
    items: data.snapshot?.items ?? [],
    totals: data.snapshot?.totals ?? null,
    actor: data.actor,
    createdAt: data.created_at,
  };
}

// ---------------------------------------------------------------------
// Meal Plan History — full comparison detail ("View" button)
// Loads one history snapshot + the target/patient context from its
// parent meal_plans row + that day's Food Record + computes the
// Meal Plan vs Food Record comparison table (with 🟢/🟡/🔴 indicator)
// and a deterministic (rule-based, no LLM call — fast & reliable for a
// detail page) AI Evaluation narrative.
// ---------------------------------------------------------------------
const COMPARISON_COMPONENTS: { key: "cal" | "protein" | "fat" | "carb" | "fiber" | "sodium"; label: string; unit: string }[] = [
  { key: "cal", label: "Kalori", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "fat", label: "Lemak", unit: "g" },
  { key: "carb", label: "Karbohidrat", unit: "g" },
  { key: "fiber", label: "Serat", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
];

// Indicator thresholds (% deviation of Food Record vs Meal Plan target):
// within 10%  -> 🟢 sesuai target
// 10–25%      -> 🟡 mendekati target
// beyond 25%  -> 🔴 jauh dari target
function comparisonIndicator(planValue: number, actualValue: number): "GREEN" | "YELLOW" | "RED" {
  if (!planValue || planValue <= 0) return actualValue > 0 ? "YELLOW" : "GREEN";
  const pctDiff = Math.abs(actualValue - planValue) / planValue;
  if (pctDiff <= 0.1) return "GREEN";
  if (pctDiff <= 0.25) return "YELLOW";
  return "RED";
}

function buildAiEvaluation(
  compliance: number,
  rows: { label: string; plan: number; actual: number; diff: number; indicator: string }[],
): string {
  const lines: string[] = [];
  lines.push(`Kepatuhan terhadap Meal Plan: ${Math.round(compliance)}%.`);
  for (const r of rows) {
    if (r.plan <= 0) continue;
    const pct = Math.round((r.diff / r.plan) * 100);
    if (r.indicator === "GREEN") {
      lines.push(`${r.label} telah sesuai target.`);
    } else if (r.diff < 0) {
      lines.push(`${r.label} kurang ${Math.abs(pct)}% dari target.`);
    } else {
      lines.push(`${r.label} berlebih ${Math.abs(pct)}% dari target.`);
    }
  }
  const worst = rows
    .filter((r) => r.plan > 0)
    .sort((a, b) => Math.abs(b.diff / (b.plan || 1)) - Math.abs(a.diff / (a.plan || 1)))[0];
  if (worst && worst.indicator !== "GREEN") {
    if (worst.diff < 0) {
      lines.push(`Disarankan menambah asupan ${worst.label.toLowerCase()} pada makan berikutnya untuk mendekati target harian.`);
    } else {
      lines.push(`Disarankan mengurangi porsi sumber ${worst.label.toLowerCase()} agar sesuai target harian.`);
    }
  }
  return lines.join(" ");
}

// Reads a single saved "meal plan vs food record" comparison row, plus its
// patient, straight from comparison_history — used by the Riwayat
// Perbandingan "View" modal / PDF export. Reads the stored comparison_json
// (results) verbatim; does not recompute anything.
export async function supabaseGetComparisonById(id: string): Promise<any | null> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("comparison_history")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  let patient: any = null;
  if (data.patient_id) {
    const { data: patientRow } = await client
      .from("patients")
      .select("id, name, mrn")
      .eq("id", data.patient_id)
      .maybeSingle();
    patient = patientRow ? { id: patientRow.id, name: patientRow.name, mrn: patientRow.mrn } : null;
  }

  return {
    id: data.id,
    patientId: data.patient_id,
    patient,
    mealPlanId: data.meal_plan_id,
    savedMenuName: data.saved_menu_name,
    foodRecordDate: data.food_record_date,
    complianceScore: data.compliance_score,
    results: data.results ?? null,
    aiInsight: data.ai_insight,
    createdAt: data.created_at,
  };
}

export async function supabaseGetMealPlanHistoryComparison(historyId: string): Promise<any | null> {
  const { client } = await getServerClient();

  const { data: historyRow, error: historyError } = await client
    .from("meal_plan_history")
    .select("id, meal_plan_id, action, changes, snapshot, actor, created_at")
    .eq("id", historyId)
    .maybeSingle();
  if (historyError || !historyRow) return null;

  const { data: planRow } = await client
    .from("meal_plans")
    .select("id, patient_id, date, target_cal, target_protein, target_fat, target_carb, target_fiber, target_sodium")
    .eq("id", historyRow.meal_plan_id)
    .maybeSingle();

  const patientId: string | null = planRow?.patient_id ?? null;
  let patient: any = null;
  if (patientId) {
    const { data: patientRow } = await client
      .from("patients")
      .select("id, name, mrn")
      .eq("id", patientId)
      .maybeSingle();
    patient = patientRow ? { id: patientRow.id, name: patientRow.name, mrn: patientRow.mrn } : null;
  }

  const items: any[] = historyRow.snapshot?.items ?? [];
  const planTotals = historyRow.snapshot?.totals ?? {
    cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0,
  };
  const targets = planRow
    ? {
        targetCal: planRow.target_cal,
        targetProtein: planRow.target_protein,
        targetFat: planRow.target_fat,
        targetCarb: planRow.target_carb,
        targetFiber: planRow.target_fiber,
        targetSodium: planRow.target_sodium,
      }
    : null;

  // Comparison date: the calendar day this snapshot was recorded.
  const compareDate = new Date(historyRow.created_at);
  const compareDateStr = compareDate.toISOString().slice(0, 10);

  let foodRecords: any[] = [];
  if (patientId) {
    foodRecords = await supabaseListFoodRecords(patientId, compareDateStr);
  }

  const recordTotals = foodRecords.reduce(
    (acc, r) => {
      acc.cal += r.cal || 0;
      acc.protein += r.protein || 0;
      acc.fat += r.fat || 0;
      acc.carb += r.carb || 0;
      acc.fiber += r.fiber || 0;
      acc.sodium += r.sodium || 0;
      return acc;
    },
    { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0 },
  );

  const comparisonRows = COMPARISON_COMPONENTS.map((c) => {
    const planValue = planTotals[c.key] ?? 0;
    const actualValue = recordTotals[c.key] ?? 0;
    const diff = actualValue - planValue;
    return {
      key: c.key,
      label: c.label,
      unit: c.unit,
      plan: planValue,
      actual: actualValue,
      diff,
      indicator: comparisonIndicator(planValue, actualValue),
    };
  });

  const compliance =
    planTotals.cal > 0 ? Math.max(0, 100 - (Math.abs(recordTotals.cal - planTotals.cal) / planTotals.cal) * 100) : 0;

  const aiEvaluation = buildAiEvaluation(compliance, comparisonRows);

  return {
    id: historyRow.id,
    mealPlanId: historyRow.meal_plan_id,
    action: historyRow.action,
    name: historyRow.changes?.name || historyRow.snapshot?.name || null,
    createdAt: historyRow.created_at,
    compareDate: compareDateStr,
    patient,
    targets,
    items: items.map((i: any) => ({
      slot: i.slot,
      foodName: i.foodName,
      amount: i.amount,
      cal: i.cal,
      protein: i.protein,
      fat: i.fat,
      carb: i.carb,
      fiber: i.fiber,
      sodium: i.sodium,
    })),
    planTotals,
    foodRecords: foodRecords.map((r: any) => ({
      slot: r.slot,
      foodName: r.food?.name || "Makanan",
      amount: r.amount,
      consumed: r.consumed,
      date: r.date,
      cal: r.cal,
      protein: r.protein,
      fat: r.fat,
      carb: r.carb,
      fiber: r.fiber,
      sodium: r.sodium,
    })),
    recordTotals,
    comparison: comparisonRows,
    compliance,
    aiEvaluation,
    sugarNote: "Data gula tidak tersedia pada basis data komposisi pangan (TKPI) yang digunakan sistem.",
  };
}

export async function supabaseDeleteMealPlanHistory(historyId: string): Promise<{ error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { error: "Authentication required." };
  const { error } = await client.from("meal_plan_history").delete().eq("id", historyId);
  return { error: error?.message ?? null };
}

export async function supabaseApplyMealPlanHistory(
  mealPlanId: string,
  historyId: string,
): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data, error } = await client.rpc("fn_apply_meal_plan_history", {
    p_meal_plan_id: mealPlanId,
    p_history_id: historyId,
    p_actor: session.user?.email ?? session.user?.id ?? "unknown",
  });

  if (error) return { data: null, error: error.message };
  const plan = mealPlanFromSupabase(data?.plan, data?.items ?? []);
  return { data: plan, error: null };
}


// =====================================================================

// ---------------------------------------------------------------------
// BOUCHARD ACTIVITY RECORD (BAR)
// ---------------------------------------------------------------------

export function bouchardAssessmentFromSupabase(row: any): any {
  return {
    id: row.id,
    patientId: row.patient_id,
    assessmentDate: row.assessment_date,
    weightKg: Number(row.weight_kg),
    day1Date: row.day1_date,
    day1Codes: row.day1_codes || [],
    day2Date: row.day2_date,
    day2Codes: row.day2_codes || [],
    day3Date: row.day3_date,
    day3Codes: row.day3_codes || [],
    dayResults: row.day_results || [],
    avgEnergyExpenditure: Number(row.avg_energy_expenditure ?? 0),
    avgMet: Number(row.avg_met ?? 0),
    avgPal: Number(row.avg_pal ?? 0),
    palCategory: row.pal_category,
    minutesByBucket: row.minutes_by_bucket || {},
    whoStatus: row.who_status || {},
    aiSummary: row.ai_summary,
    aiFindings: row.ai_findings || [],
    aiRecommendations: row.ai_recommendations || [],
    aiRiskLevel: row.ai_risk_level,
    aiModel: row.ai_model,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function supabaseListBouchardAssessments(patientId?: string): Promise<any[]> {
  const { client } = await getServerClient();
  let query = client
    .from("bouchard_assessments")
    .select("*")
    .is("deleted_at", null)
    .order("assessment_date", { ascending: false })
    .limit(30);

  if (patientId) query = query.eq("patient_id", patientId);

  const { data, error } = await query;
  if (error) {
    console.warn("[bouchard] list failed:", error.message);
    return [];
  }
  return (data || []).map(bouchardAssessmentFromSupabase);
}

export async function supabaseGetBouchardAssessment(id: string): Promise<any | null> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("bouchard_assessments")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return bouchardAssessmentFromSupabase(data);
}

export async function supabaseCreateBouchardAssessment(
  payload: any,
): Promise<{ data: any | null; error: string | null }> {
  const { client, session } = await getServerClient();
  if (!session) return { data: null, error: "Authentication required." };

  const { data, error } = await client
    .from("bouchard_assessments")
    .insert({
      patient_id: payload.patientId,
      assessment_date: payload.assessmentDate,
      weight_kg: payload.weightKg,
      day1_date: payload.day1Date ?? null,
      day1_codes: payload.day1Codes ?? [],
      day2_date: payload.day2Date ?? null,
      day2_codes: payload.day2Codes ?? [],
      day3_date: payload.day3Date ?? null,
      day3_codes: payload.day3Codes ?? [],
      day_results: payload.dayResults ?? [],
      avg_energy_expenditure: payload.avgEnergyExpenditure ?? 0,
      avg_met: payload.avgMet ?? 0,
      avg_pal: payload.avgPal ?? 0,
      pal_category: payload.palCategory ?? null,
      minutes_by_bucket: payload.minutesByBucket ?? {},
      who_status: payload.whoStatus ?? {},
      notes: payload.notes ?? null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: bouchardAssessmentFromSupabase(data), error: null };
}

export async function supabaseUpdateBouchardAssessmentAI(
  id: string,
  ai: {
    aiSummary?: string;
    aiFindings?: string[];
    aiRecommendations?: string[];
    aiRiskLevel?: string;
    aiModel?: string;
  },
): Promise<{ data: any | null; error: string | null }> {
  const { client } = await getServerClient();
  const { data, error } = await client
    .from("bouchard_assessments")
    .update({
      ai_summary: ai.aiSummary,
      ai_findings: ai.aiFindings ?? [],
      ai_recommendations: ai.aiRecommendations ?? [],
      ai_risk_level: ai.aiRiskLevel,
      ai_model: ai.aiModel,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: bouchardAssessmentFromSupabase(data), error: null };
}

export async function supabaseDeleteBouchardAssessment(id: string): Promise<{ error: string | null }> {
  const { client } = await getServerClient();
  const { error } = await client
    .from("bouchard_assessments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error?.message ?? null };
}

/**
 * Latest BAR result for a patient — used by AI Meal Plan, Exercise Plan,
 * and AI Clinical Decision Support to read PAL/MET/Energy Expenditure
 * without duplicating the Bouchard calculation logic.
 */
export async function supabaseGetLatestBouchardAssessment(patientId: string): Promise<any | null> {
  const list = await supabaseListBouchardAssessments(patientId);
  return list[0] ?? null;
}
