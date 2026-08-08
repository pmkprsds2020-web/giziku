"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Gender, ActivityLevel, StressLevel, DiagnosisType, MealSlot } from "@prisma/client";
import {
  // Patients
  supabaseFetchPatients,
  supabaseFetchPatient,
  supabaseCreatePatient,
  supabaseUpdatePatient,
  supabaseSoftDeletePatient,
  // Foods
  supabaseFetchFoods,
  supabaseCreateFood,
  supabaseUpdateFood,
  supabaseDeleteFood,
  supabaseFetchFoodPriceHistory,
  supabaseUpdateFoodPrice,
  supabaseFetchFoodChangeLogs,
  // Dashboard
  supabaseFetchDashboard,
  // Weight Records
  supabaseFetchWeightRecords,
  supabaseAddWeightRecord,
  supabaseDeleteWeightRecord,
  // Assessments
  supabaseFetchAssessments,
  supabaseCreateAssessment,
  supabaseDeleteAssessment,
  // Diagnosis (standalone CRUD)
  supabaseFetchDiagnoses,
  supabaseCreateDiagnosis,
  supabaseUpdateDiagnosis,
  supabaseDeleteDiagnosis,
  // Laboratorium
  supabaseFetchLabResults,
  supabaseCreateLabResult,
  supabaseUpdateLabResult,
  supabaseDeleteLabResult,
  supabaseFetchLabCriticalThresholds,
  supabaseFetchLabMonitoringSchedule,
  // Food Records
  supabaseFetchFoodRecords,
  supabaseAddFoodRecord,
  supabaseDeleteFoodRecord,
  // Meal Plans
  supabaseFetchMealPlans,
  supabaseAddMealItem,
  supabaseUpdateMealItem,
  supabaseDeleteMealItem,
  // Presets
  supabaseFetchPresets,
  supabaseCreatePreset,
  supabaseUpdatePreset,
  supabaseDeletePreset,
  supabaseClonePreset,
  supabaseTogglePresetFavorite,
  supabaseFetchPresetHistory,
  // Recipes
  supabaseFetchRecipes,
  supabaseCreateRecipe,
  supabaseDeleteRecipe,
  supabaseUpdateRecipe,
  // Saved Meal Plans
  supabaseFetchSavedMealPlans,
  supabaseCreateSavedMealPlan,
  supabaseDeleteSavedMealPlan,
  supabaseMarkSavedMealPlanUsed,
  // Saved Menus (per-slot)
  supabaseFetchSavedMenus,
  supabaseCreateSavedMenu,
  supabaseDeleteSavedMenu,
  supabaseMarkSavedMenuUsed,
} from "@/lib/supabase/frontend-data";

// Helper for API routes — ONLY for AI/complex server-side operations
// (z-ai-web-dev-sdk cannot run in browser)
async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || "Gagal memuat data");
  return body.data as T;
}

// ---------------- Patients (Direct Supabase) ----------------
export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: () => supabaseFetchPatients(),
  });
}

export function usePatient(id: string | null) {
  return useQuery({
    queryKey: ["patient", id],
    queryFn: () => supabaseFetchPatient(id!),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => supabaseCreatePatient(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => supabaseUpdatePatient(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient", id] });
    },
  });
}

export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseSoftDeletePatient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ---------------- Foods (Direct Supabase) ----------------
export function useFoods(params: { q?: string; categoryId?: string; highProtein?: boolean; lowGi?: boolean; lowSodium?: boolean; highFiber?: boolean }) {
  return useQuery({
    queryKey: ["foods", params],
    queryFn: () => supabaseFetchFoods(params),
  });
}

export function useCreateFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => supabaseCreateFood(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["foods"] }),
  });
}

export function useUpdateFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; [key: string]: any }) => {
      const { id, ...rest } = data;
      return supabaseUpdateFood(id, rest);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["foods"] }),
  });
}

export function useDeleteFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseDeleteFood(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["foods"] }),
  });
}

// ---------------- Food Import (Excel) ----------------

export function useCheckFoodDuplicates() {
  return useMutation({
    mutationFn: (items: { code?: string | null; name: string }[]) =>
      jsonFetch<any>("/api/foods/import/check-duplicates", {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
  });
}

export function useImportFoodsBatch() {
  return useMutation({
    mutationFn: (rows: any[]) =>
      jsonFetch<any>("/api/foods/import/batch", {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
  });
}

export function useRecordFoodImportHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: {
      fileName: string;
      totalRows: number;
      successCount: number;
      updatedCount: number;
      skippedCount: number;
      failedCount: number;
      durationMs: number;
      status: "COMPLETED" | "PARTIAL" | "FAILED";
      errorLog?: any[];
    }) =>
      jsonFetch<any>("/api/foods/import-history", {
        method: "POST",
        body: JSON.stringify(entry),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food-import-history"] });
      qc.invalidateQueries({ queryKey: ["foods"] });
    },
  });
}

export function useFoodImportHistory() {
  return useQuery({
    queryKey: ["food-import-history"],
    queryFn: () => jsonFetch<any[]>("/api/foods/import-history"),
  });
}

export function useExportFoods() {
  return useMutation({
    mutationFn: () => jsonFetch<any[]>("/api/foods/export"),
  });
}

export function useFoodPriceHistory(foodId: string | null) {
  return useQuery({
    queryKey: ["food-price-history", foodId],
    queryFn: () => supabaseFetchFoodPriceHistory(foodId!),
    enabled: !!foodId,
  });
}

export function useUpdateFoodPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; price: number; unit?: string; location?: string | null; source?: string | null; notes?: string | null }) =>
      supabaseUpdateFoodPrice(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food-price-history"] });
      qc.invalidateQueries({ queryKey: ["foods"] });
      // Manajemen Harga is the single source of truth for foods.price —
      // any already-generated Shopping Planner list needs to be
      // re-priced against it, so invalidate it too. Any mounted
      // ShoppingView will auto-refetch with the new price.
      qc.invalidateQueries({ queryKey: ["shopping-list"] });
    },
  });
}

export function useFoodChangeLogs(foodId: string | null) {
  return useQuery({
    queryKey: ["food-change-logs", foodId],
    queryFn: () => supabaseFetchFoodChangeLogs(foodId!),
    enabled: !!foodId,
  });
}

// ---------------- Calorie (API route — server-side clinical engine) ----------------
export interface CalorieInput { gender: Gender; ageYears: number; heightCm: number; weightKg: number; activity: ActivityLevel; stress: StressLevel; diagnoses: DiagnosisType[]; isPregnant?: boolean; pregnancyTrimester?: number; isLactating?: boolean; bouchardPalCategory?: "Sedentary" | "Low Active" | "Active" | "Very Active"; weightGoal?: "MAINTENANCE" | "WEIGHT_LOSS" | "WEIGHT_GAIN"; energyDeficitKcal?: number; }
export function useComputeCalorie() {
  return useMutation({
    mutationFn: (input: CalorieInput) => jsonFetch<any>("/api/calorie", { method: "POST", body: JSON.stringify(input) }),
  });
}

// ---------------- Meal Plans (Direct Supabase reads, API route for AI generation) ----------------
export function useMealPlans(patientId?: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["meal-plans", patientId],
    queryFn: () =>
      supabaseFetchMealPlans(patientId, {
        // Reuse whatever usePatients()/usePresets() already loaded on this
        // page instead of re-querying Supabase for the same rows.
        patients: qc.getQueryData<any[]>(["patients"]),
        presets: qc.getQueryData<any[]>(["presets", patientId]),
      }),
  });
}

// Loads the patient's "Meal Plan Aktif" reshaped into the full preview
// view (plan/calorieResult/aiReasoning/patient/targets) directly from
// the database — no AI call. This is what keeps the AI Meal Plan page
// from going blank on refresh / navigation-back / re-login: it's the
// single source of truth the page reads from on mount, instead of the
// ephemeral in-memory result of the last "Generate" click.
export function useActiveMealPlanView(patientId?: string) {
  return useQuery({
    queryKey: ["meal-plan-active-view", patientId],
    queryFn: () => jsonFetch<any>(`/api/meal-plan/active-view?patientId=${patientId}`),
    enabled: !!patientId,
    staleTime: 10_000,
  });
}

// AI generation — server-side (z-ai-web-dev-sdk).
// When `plan`/`calorieResult` (an already-generated preview from
// usePreviewIsiPiringku) are passed, the server persists that EXACT
// preview instead of regenerating — see the "FAST PATH" in
// /api/meal-plan/route.ts. Without them, it generates AND persists in
// one call (used by flows that skip the separate preview step).
export function useGenerateMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      patientId,
      presetId,
      plan,
      calorieResult,
      aiReasoning,
      preset,
    }: {
      patientId: string;
      presetId?: string;
      plan?: any;
      calorieResult?: any;
      aiReasoning?: string;
      preset?: any;
    }) =>
      jsonFetch<any>("/api/meal-plan", {
        method: "POST",
        body: JSON.stringify({ patientId, presetId, plan, calorieResult, aiReasoning, preset }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meal-plans"] });
      qc.invalidateQueries({ queryKey: ["meal-plan-active-view"] });
      qc.invalidateQueries({ queryKey: ["meal-plan-history"] });
    },
  });
}

// Isi Piringku preview — server-side AI engine
export function usePreviewIsiPiringku() {
  return useMutation({
    mutationFn: ({ patientId, presetId }: { patientId: string; presetId?: string }) =>
      jsonFetch<any>("/api/meal-plan/isi-piringku", {
        method: "POST",
        body: JSON.stringify({ patientId, presetId }),
      }),
  });
}

// Meal Plan Items — Direct Supabase
export function useAddMealItem(mealPlanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { slot: string; foodId: string; amount: number }) =>
      supabaseAddMealItem(mealPlanId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal-plans"] });
      qc.invalidateQueries({ queryKey: ["meal-plan-active-view"] }); },
  });
}

export function useUpdateMealItem(mealPlanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { itemId: string; foodId?: string; amount?: number }) =>
      supabaseUpdateMealItem(mealPlanId, data.itemId, { foodId: data.foodId, amount: data.amount }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal-plans"] });
      qc.invalidateQueries({ queryKey: ["meal-plan-active-view"] }); },
  });
}

export function useDeleteMealItem(mealPlanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => supabaseDeleteMealItem(itemId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal-plans"] });
      qc.invalidateQueries({ queryKey: ["meal-plan-active-view"] }); },
  });
}

// ---------------- Meal Plan Draft Save + Riwayat Meal Plan ----------------

export type MealPlanDraftItemPayload = {
  id?: string | null;
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

// Single "Simpan Meal Plan" mutation — sends the whole draft in one call.
export function useSaveMealPlanDraft(mealPlanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      items: MealPlanDraftItemPayload[];
      deletedItemIds?: string[];
      name?: string | null;
      saveToLibrary?: boolean;
      syncShopping?: boolean;
    }) =>
      jsonFetch<any>(`/api/meal-plan/${mealPlanId}/save`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meal-plans"] });
      qc.invalidateQueries({ queryKey: ["meal-plan-active-view"] });
      qc.invalidateQueries({ queryKey: ["meal-plan-history"] });
      qc.invalidateQueries({ queryKey: ["saved-meal-plans"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
    },
  });
}

export function useMealPlanHistory(patientId?: string) {
  return useQuery({
    queryKey: ["meal-plan-history", patientId],
    queryFn: () =>
      jsonFetch<any[]>(`/api/meal-plan-history${patientId ? `?patientId=${patientId}` : ""}`),
    enabled: !!patientId,
  });
}

export function useMealPlanHistoryDetail(historyId: string | null) {
  return useQuery({
    queryKey: ["meal-plan-history-detail", historyId],
    queryFn: () => jsonFetch<any>(`/api/meal-plan-history/${historyId}`),
    enabled: !!historyId,
  });
}

export function useMealPlanHistoryComparison(historyId: string | null) {
  return useQuery({
    queryKey: ["meal-plan-history-comparison", historyId],
    queryFn: () => jsonFetch<any>(`/api/meal-plan-history/${historyId}/comparison`),
    enabled: !!historyId,
  });
}

export function useDeleteMealPlanHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (historyId: string) =>
      jsonFetch<any>(`/api/meal-plan-history/${historyId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meal-plan-history"] }),
  });
}

// "Gunakan Meal Plan" — restores a snapshot as the active meal plan
export function useApplyMealPlanHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ historyId, mealPlanId }: { historyId: string; mealPlanId: string }) =>
      jsonFetch<any>(`/api/meal-plan-history/${historyId}/use`, {
        method: "POST",
        body: JSON.stringify({ mealPlanId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meal-plans"] });
      qc.invalidateQueries({ queryKey: ["meal-plan-active-view"] });
      qc.invalidateQueries({ queryKey: ["meal-plan-history"] });
    },
  });
}

// ---------------- Exercise (API route — server-side AI generation) ----------------
export function useExercisePlans(patientId: string | null) {
  return useQuery({
    queryKey: ["exercise-plans", patientId],
    queryFn: () => jsonFetch<any[]>(`/api/exercise?patientId=${patientId}`),
    enabled: !!patientId,
  });
}

export function useGenerateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId }: { patientId: string }) => jsonFetch<any>("/api/exercise", { method: "POST", body: JSON.stringify({ patientId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercise-plans"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
    },
  });
}

// ---------------- AI-Powered Hooks (OpenAI via /api/ai/*) ----------------

// AI Exercise Plan — generates personalized exercise plan via OpenAI,
// grounded in CareLivia's evidence-based exercise program library
export function useAIExercisePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      patientName: string;
      ageYears: number;
      gender: string;
      bmi: number;
      diagnoses: string[];
      activityLevel?: string;
      mobilityNotes?: string;
      targetCaloriesBurned?: number;
    }) => jsonFetch<any>("/api/ai/exercise-plan", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercise-plans"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
    },
  });
}

// AI Shopping Planner — generates shopping list with AI tips via OpenAI
export function useAIShoppingPlanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      patientName: string;
      mealPlanId: string;
      period?: "DAILY" | "WEEKLY" | "MONTHLY";
    }) => jsonFetch<any>("/api/ai/shopping-planner", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal-plans"] });
      qc.invalidateQueries({ queryKey: ["meal-plan-active-view"] }); },
  });
}

// AI Alternative Food — finds alternative foods for a given food item
export function useAIAlternativeFood() {
  return useMutation({
    mutationFn: (data: {
      foodId: string;
      foodName: string;
      categoryId?: string;
      patientId?: string;
      diagnoses?: string[];
    }) => jsonFetch<any>("/api/ai/alternative-food", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  });
}

// AI Food Record Analysis — analyzes food record compliance via OpenAI
export function useAIFoodRecordAnalysis() {
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      patientName: string;
      date: string;
      mealPlanId?: string;
    }) => jsonFetch<any>("/api/ai/food-record", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  });
}

// AI Patient Summary — generates clinical patient summary via OpenAI
export function useAIPatientSummary() {
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      patientName: string;
    }) => jsonFetch<any>("/api/ai/patient-summary", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  });
}

// AI Nutrition Analysis — analyzes nutrition adequacy via OpenAI
export function useAINutritionAnalysis() {
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      patientName: string;
      mealPlanId?: string;
    }) => jsonFetch<any>("/api/ai/nutrition-analysis", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  });
}

// AI Clinical Assessment — comprehensive CDSS evaluation ("AI Evaluation").
// Aggregates every module server-side; only patientId is required.
export function useGenerateClinicalAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { patientId: string }) =>
      jsonFetch<any>("/api/ai/clinical-assessment", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["clinical-assessment", variables.patientId] });
    },
  });
}

// Fetch the most recently generated & persisted AI Evaluation for a patient,
// so the report view can show it instantly without re-running the AI.
export function useClinicalAssessment(patientId: string | null) {
  return useQuery({
    queryKey: ["clinical-assessment", patientId],
    queryFn: () => jsonFetch<any>(`/api/ai/clinical-assessment?patientId=${encodeURIComponent(patientId!)}`),
    enabled: !!patientId,
  });
}

// AI Chat — streaming chat via Server-Sent Events
export function useAIChat() {
  return useMutation({
    mutationFn: async (data: {
      messages: { role: "user" | "assistant"; content: string }[];
      patientContext?: string;
      patientId?: string;
    }): Promise<string> => {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Chat gagal" }));
        throw new Error(err.error || "AI Chat tidak tersedia");
      }
      // Read streaming response
      const reader = res.body?.getReader();
      if (!reader) return "";
      let fullText = "";
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
      return fullText;
    },
  });
}

// ---------------- Food Record (Direct Supabase) ----------------
export function useFoodRecords(patientId: string | null, date?: string) {
  return useQuery({
    queryKey: ["food-records", patientId, date],
    queryFn: () => supabaseFetchFoodRecords(patientId!, date),
    enabled: !!patientId,
  });
}

export function useAddFoodRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { patientId: string; foodId: string; slot: MealSlot; amount: number; consumed?: number; date?: string; notes?: string }) =>
      supabaseAddFoodRecord(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food-records"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteFoodRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseDeleteFoodRecord(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-records"] }),
  });
}

// ---------------- Shopping (API route — server-side aggregation) ----------------
export function useGenerateShopping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { mealPlanId: string; period?: "DAILY" | "WEEKLY" | "MONTHLY" }) =>
      jsonFetch<any>("/api/shopping", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["patient"] });
      qc.invalidateQueries({ queryKey: ["shopping-list", variables.mealPlanId] });
    },
  });
}

// Live-priced shopping list — re-fetches items joined against the CURRENT
// foods.price (Manajemen Harga) rather than the frozen snapshot from the
// last time "Generate" was clicked. Invalidated automatically whenever a
// price is edited (see useUpdateFoodPrice) or a list is (re)generated.
export function useShoppingList(mealPlanId: string | undefined) {
  return useQuery({
    queryKey: ["shopping-list", mealPlanId],
    queryFn: () => jsonFetch<any>(`/api/shopping?mealPlanId=${mealPlanId}`),
    enabled: !!mealPlanId,
    retry: false, // 404 just means "not generated yet" — not worth retrying
  });
}

// ---------------- Dashboard (Direct Supabase) ----------------
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => supabaseFetchDashboard(),
  });
}

// ---------------- Weight Records (Direct Supabase) ----------------
export function useWeightRecords(patientId: string | null) {
  return useQuery({
    queryKey: ["weight-records", patientId],
    queryFn: () => supabaseFetchWeightRecords(patientId!),
    enabled: !!patientId,
  });
}

export function useAddWeightRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { patientId: string; date?: string; weight: number; height?: number | null; note?: string }) =>
      supabaseAddWeightRecord(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight-records"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteWeightRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseDeleteWeightRecord(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight-records"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
    },
  });
}

// ---------------- Assessments (Direct Supabase) ----------------
export function useAssessments(patientId: string | null) {
  return useQuery({
    queryKey: ["assessments", patientId],
    queryFn: () => supabaseFetchAssessments(patientId!),
    enabled: !!patientId,
  });
}

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => supabaseCreateAssessment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessments"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
    },
  });
}

export function useDeleteAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseDeleteAssessment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessments"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
    },
  });
}

// AI Assessment Summary — focused interpretation auto-generated right
// after a nutrition/functional assessment is saved (Ringkasan Interpretasi
// AI Otomatis). Scoped to one assessmentId, much lighter than the full
// Clinical Assessment (CDSS) feature.
export function useGenerateAssessmentSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { assessmentId: string }) =>
      jsonFetch<any>("/api/ai/assessment-summary", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["assessment-summary", variables.assessmentId] });
    },
  });
}

export function useAssessmentSummary(assessmentId: string | null) {
  return useQuery({
    queryKey: ["assessment-summary", assessmentId],
    queryFn: () => jsonFetch<any>(`/api/ai/assessment-summary?assessmentId=${encodeURIComponent(assessmentId!)}`),
    enabled: !!assessmentId,
  });
}

// ---------------- Diagnosis (Direct Supabase — standalone CRUD) ----------------
// Separate from useCreatePatient/useUpdatePatient: the "Diagnosis Aktif"
// card manages its own list independently so a patient can accumulate
// diagnoses over time without re-submitting the whole patient form.
export function useDiagnoses(patientId: string | null) {
  return useQuery({
    queryKey: ["diagnoses", patientId],
    queryFn: () => supabaseFetchDiagnoses(patientId!),
    enabled: !!patientId,
  });
}

export function useAddDiagnosis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
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
    }) => supabaseCreateDiagnosis(data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["diagnoses", variables.patientId] });
      qc.invalidateQueries({ queryKey: ["patient"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useUpdateDiagnosis(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string } & Partial<{
      icd: string;
      classification: string;
      status: string;
      priority: string;
      diagnosedAt: string;
      doctor: string;
      target: string;
      notes: string;
      active: boolean;
    }>) => supabaseUpdateDiagnosis(data.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagnoses", patientId] });
      qc.invalidateQueries({ queryKey: ["patient"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useDeleteDiagnosis(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseDeleteDiagnosis(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagnoses", patientId] });
      qc.invalidateQueries({ queryKey: ["patient"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

// ---------------- Laboratorium (Direct Supabase) ----------------
export function useLabResults(patientId: string | null) {
  return useQuery({
    queryKey: ["lab-results", patientId],
    queryFn: () => supabaseFetchLabResults(patientId!),
    enabled: !!patientId,
  });
}

export function useAddLabResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
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
    }) => supabaseCreateLabResult(data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["lab-results", variables.patientId] });
    },
  });
}

export function useUpdateLabResult(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string } & Partial<{
      value: number;
      unit: string;
      referenceMin: number | null;
      referenceMax: number | null;
      labDate: string;
      laboratoryName: string;
      notes: string;
    }>) => supabaseUpdateLabResult(data.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-results", patientId] }),
  });
}

export function useDeleteLabResult(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseDeleteLabResult(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-results", patientId] }),
  });
}

// Reference data — clinical constants, safe to cache for a long time.
export function useLabCriticalThresholds() {
  return useQuery({
    queryKey: ["lab-critical-thresholds"],
    queryFn: () => supabaseFetchLabCriticalThresholds(),
    staleTime: 60 * 60 * 1000,
  });
}

export function useLabMonitoringSchedule() {
  return useQuery({
    queryKey: ["lab-monitoring-schedule"],
    queryFn: () => supabaseFetchLabMonitoringSchedule(),
    staleTime: 60 * 60 * 1000,
  });
}

// ---------------- Nutrition Presets (Direct Supabase) ----------------
export function usePresets(patientId?: string) {
  return useQuery({
    queryKey: ["presets", patientId],
    queryFn: () => supabaseFetchPresets(patientId),
  });
}

export function usePresetTemplates() {
  return useQuery({
    queryKey: ["preset-templates"],
    queryFn: () => supabaseFetchPresets(undefined).then((p) => p.filter((x: any) => x.isTemplate)),
  });
}

export function usePreset(id: string | null) {
  return useQuery({
    queryKey: ["preset", id],
    queryFn: async () => {
      const all = await supabaseFetchPresets();
      return all.find((p: any) => p.id === id) || null;
    },
    enabled: !!id,
  });
}

export function useCreatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => supabaseCreatePreset(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presets"] }),
  });
}

export function useUpdatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; [key: string]: any }) => {
      const { id, ...rest } = data;
      return supabaseUpdatePreset(id, rest);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presets"] });
      qc.invalidateQueries({ queryKey: ["preset"] });
    },
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseDeletePreset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presets"] }),
  });
}

export function useClonePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; newName?: string; patientId?: string | null }) =>
      supabaseClonePreset(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presets"] }),
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseTogglePresetFavorite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presets"] }),
  });
}

export function usePresetHistory(id: string | null) {
  return useQuery({
    queryKey: ["preset-history", id],
    queryFn: () => supabaseFetchPresetHistory(id!),
    enabled: !!id,
  });
}

export function useComparePresets() {
  return useMutation({
    mutationFn: async (ids: string[]) => {
      // Client-side comparison: fetch presets and compare
      const all = await supabaseFetchPresets();
      return ids.map((id) => all.find((p: any) => p.id === id)).filter(Boolean);
    },
  });
}

// ---------------- Saved Menus (per-slot) — Direct Supabase ----------------
export function useSavedMenus(params: { patientId?: string; category?: string; q?: string }) {
  return useQuery({
    queryKey: ["saved-menus", params],
    queryFn: () => supabaseFetchSavedMenus(params),
  });
}

export function useCreateSavedMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => supabaseCreateSavedMenu(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-menus"] }),
  });
}

export function useDeleteSavedMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseDeleteSavedMenu(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-menus"] }),
  });
}

export function useMarkSavedMenuUsed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseMarkSavedMenuUsed(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-menus"] }),
  });
}

// ---------------- Saved Meal Plans (Direct Supabase) ----------------
export function useSavedMealPlans(patientId?: string, q?: string) {
  return useQuery({
    queryKey: ["saved-meal-plans", patientId, q],
    queryFn: () => supabaseFetchSavedMealPlans(patientId),
  });
}

export function useCreateSavedMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => supabaseCreateSavedMealPlan(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-meal-plans"] }),
  });
}

export function useDeleteSavedMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseDeleteSavedMealPlan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-meal-plans"] }),
  });
}

export function useMarkSavedMealPlanUsed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseMarkSavedMealPlanUsed(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-meal-plans"] }),
  });
}

// ---------------- Recipes (Direct Supabase) ----------------
export function useRecipes(q?: string) {
  return useQuery({
    queryKey: ["recipes", q],
    queryFn: () => supabaseFetchRecipes(q),
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => supabaseCreateRecipe(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useUpdateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; [key: string]: any }) => {
      const { id, ...rest } = data;
      return supabaseUpdateRecipe(id, rest);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseDeleteRecipe(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

// ---------------- Comparisons (API route — complex aggregation) ----------------
export function useComparisons(patientId: string | null) {
  return useQuery({
    queryKey: ["comparisons", patientId],
    queryFn: () => jsonFetch<any[]>(`/api/comparisons?patientId=${patientId}`),
    enabled: !!patientId,
  });
}

export function useRunComparison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { patientId: string; date: string; mealPlanId?: string; savedMenuId?: string; savedMealPlanId?: string }) =>
      jsonFetch<any>("/api/comparisons", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comparisons"] }),
  });
}

// ---------------- Weekly Compliance (API route — aggregation) ----------------
export function useWeeklyCompliance(patientId: string | null) {
  return useQuery({
    queryKey: ["weekly-compliance", patientId],
    queryFn: () => jsonFetch<any>(`/api/compliance/weekly?patientId=${patientId}`),
    enabled: !!patientId,
  });
}

// "AI-Powered Hooks" section is also fine since it mixes CRUD + AI)
// =====================================================================

// ---------------- Bouchard Activity Record (BAR) ----------------

export function useBouchardAssessments(patientId: string | null) {
  return useQuery({
    queryKey: ["bouchard", patientId],
    queryFn: () => jsonFetch<any[]>(`/api/bouchard?patientId=${patientId}`),
    enabled: !!patientId,
  });
}

export function useBouchardAssessment(id: string | null) {
  return useQuery({
    queryKey: ["bouchard-detail", id],
    queryFn: () => jsonFetch<any>(`/api/bouchard?id=${id}`),
    enabled: !!id,
  });
}

export function useSaveBouchardAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      patientId: string;
      weightKg: number;
      assessmentDate?: string;
      day1Date?: string;
      day1Codes: (number | null)[];
      day2Date?: string;
      day2Codes: (number | null)[];
      day3Date?: string;
      day3Codes: (number | null)[];
      notes?: string;
    }) =>
      jsonFetch<any>("/api/bouchard", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["bouchard", variables.patientId] });
    },
  });
}

export function useDeleteBouchardAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jsonFetch<any>(`/api/bouchard?id=${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bouchard"] });
    },
  });
}

export function useAIBouchardInsight() {
  return useMutation({
    mutationFn: (input: {
      assessmentId: string;
      patientId: string;
      patientName: string;
      ageYears?: number;
      gender?: string;
      diagnoses?: string[];
      weightKg: number;
      avgEnergyExpenditure: number;
      avgMet: number;
      avgPal: number;
      palCategory: string;
      minutesByBucket: Record<string, number>;
      whoMinutesPerWeek?: number;
    }) =>
      jsonFetch<any>("/api/ai/bouchard-insight", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
