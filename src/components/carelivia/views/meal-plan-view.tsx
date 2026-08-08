"use client";

import * as React from "react";
import {
  Utensils,
  Sparkles,
  User,
  Clock,
  CheckCircle2,
  Target,
  TrendingUp,
  Brain,
  AlertCircle,
  Plus,
  Trash2,
  Bookmark,
  Stethoscope,
  Activity,
  Save,
  FolderOpen,
  Apple,
  RotateCw,
  FlaskConical,
  ChevronDown,
  ChevronRight,
  Info,
  X,
  RefreshCw,
  Pencil,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
} from "@/components/carelivia/ui-helpers";
import { IsiPiringkuPlate } from "@/components/carelivia/isi-piringku-plate";
import {
  FoodPickerDialog,
  type FoodPickerResult,
} from "@/components/carelivia/food-picker-dialog";
import {
  usePatients,
  useMealPlans,
  useActiveMealPlanView,
  useGenerateMealPlan,
  usePreviewIsiPiringku,
  usePresets,
  useCreateSavedMealPlan,
  useSaveMealPlanDraft,
} from "@/hooks/use-carelivia";
import { useCareLiviaStore } from "@/store/carelivia";
import { DIAGNOSIS_ADJUSTMENTS } from "@/lib/clinical/constants";
import { computeFoodNutrition } from "@/lib/clinical/calorie-engine";
import type { DiagnosisType, MealSlot } from "@prisma/client";
import type { PlateGroup } from "@/lib/clinical/isi-piringku";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  COMPLIANCE_TIER_LABEL,
  COMPLIANCE_TIER_COLOR,
  COMPLIANCE_TIER_ICON,
  PLATE_GROUP_LABEL,
  PLATE_GROUP_ICON,
} from "@/lib/clinical/isi-piringku";

const SLOT_LABELS: Record<MealSlot, string> = {
  BREAKFAST: "Sarapan",
  MORNING_SNACK: "Snack Pagi",
  LUNCH: "Makan Siang",
  AFTERNOON_SNACK: "Snack Sore",
  DINNER: "Makan Malam",
  EVENING_SNACK: "Snack Malam",
};

const SLOT_DISTRIBUTION_PCT: Record<MealSlot, string> = {
  BREAKFAST: "20-25%",
  MORNING_SNACK: "5-10%",
  LUNCH: "30-35%",
  AFTERNOON_SNACK: "5-10%",
  DINNER: "25-30%",
  EVENING_SNACK: "0-5%",
};

const SLOT_COLORS: Record<MealSlot, string> = {
  BREAKFAST: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  MORNING_SNACK: "bg-orange-500/10 text-orange-700 dark:text-orange-400 ring-orange-500/20",
  LUNCH: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  AFTERNOON_SNACK: "bg-teal-500/10 text-teal-700 dark:text-teal-400 ring-teal-500/20",
  DINNER: "bg-violet-500/10 text-violet-700 dark:text-violet-400 ring-violet-500/20",
  EVENING_SNACK: "bg-slate-500/10 text-slate-700 dark:text-slate-400 ring-slate-500/20",
};

const MAIN_SLOTS: MealSlot[] = ["BREAKFAST", "LUNCH", "DINNER"];

export function MealPlanView() {
  const { data: patients } = usePatients();
  const { activePatientId } = useCareLiviaStore();
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>(
    activePatientId || "",
  );
  const [activePresetId, setActivePresetId] = React.useState<string | null>(null);
  const [activePresetName, setActivePresetName] = React.useState<string | null>(null);
  const [previewData, setPreviewData] = React.useState<any>(null);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");

  React.useEffect(() => {
    if (activePatientId && !selectedPatientId) {
      setSelectedPatientId(activePatientId);
    }
  }, [activePatientId, selectedPatientId]);

  const { data: plans, isLoading } = useMealPlans(selectedPatientId || undefined);
  const {
    data: activeView,
    isLoading: isActiveViewLoading,
    isFetching: isActiveViewFetching,
  } = useActiveMealPlanView(selectedPatientId || undefined);
  const { data: presets } = usePresets(selectedPatientId || undefined);
  const generateMut = useGenerateMealPlan();
  const previewMut = usePreviewIsiPiringku();
  const saveMut = useCreateSavedMealPlan();

  // "Meal Plan Aktif": the single source of truth the Editor loads.
  // Prefers the plan explicitly flagged active (set on generate/save);
  // falls back to most recent for plans saved before this flag existed.
  const latestPlan = plans?.find((p: any) => p.isActive) ?? plans?.[0];
  const selectedPatient = patients?.find((p) => p.id === selectedPatientId);
  const patientPresets = (presets || []).filter((p: any) => !p.isTemplate);
  const templatePresets = (presets || []).filter((p: any) => p.isTemplate);

  // Sync active preset from latest meal plan
  React.useEffect(() => {
    if (latestPlan?.presetId && !activePresetId) {
      setActivePresetId(latestPlan.presetId);
      setActivePresetName(latestPlan.preset?.name || null);
    }
  }, [latestPlan, activePresetId]);

  const handleGenerate = async () => {
    if (!selectedPatientId) {
      toast.error("Pilih pasien terlebih dahulu");
      return;
    }

    // STAGE 1: Check auth
    const { data: { session } } = await createSupabaseClient().auth.getSession();
    if (!session) {
      console.error("[generate] No active session — user not logged in");
      toast.error("Sesi login habis", {
        description: "Silakan login ulang untuk membuat meal plan.",
      });
      return;
    }
    console.log("[generate] Auth OK, user:", session.user.email);

    // STAGE 2: Check patient data
    if (!selectedPatient) {
      console.error("[generate] Patient not found in list:", selectedPatientId);
      toast.error("Data pasien tidak ditemukan", {
        description: "Pilih pasien yang valid dari daftar.",
      });
      return;
    }
    if (!selectedPatient.height || !selectedPatient.weight) {
      console.error("[generate] Patient missing height/weight:", selectedPatient.name);
      toast.error("Data pasien belum lengkap", {
        description: "Tinggi dan berat badan pasien harus diisi di Manajemen Pasien.",
      });
      return;
    }
    console.log("[generate] Patient OK:", selectedPatient.name, "BMI:", (selectedPatient.weight / Math.pow(selectedPatient.height / 100, 2)).toFixed(1));

    // STAGE 3: Call API
    try {
      console.log("[generate] Calling /api/meal-plan/isi-piringku...");
      const result = await previewMut.mutateAsync({
        patientId: selectedPatientId,
        presetId: activePresetId || undefined,
      });

      if (!result?.plan) {
        console.error("[generate] API returned no plan");
        toast.error("Generate gagal", {
          description: "API tidak mengembalikan meal plan. Coba lagi.",
        });
        return;
      }

      console.log("[generate] Success! Items:", result.plan.items?.length, "Cal:", result.plan.totals?.cal);
      setPreviewData(result);
      toast.success(
        activePresetName
          ? `Meal plan Isi Piringku dibuat dengan preset "${activePresetName}"`
          : "Meal plan Isi Piringku berhasil dibuat",
      );
    } catch (e: any) {
      console.error("[generate] API call failed:", e.message);

      // Provide specific error messages based on the error
      const msg = e.message || "";
      if (msg.includes("Pasien tidak ditemukan")) {
        toast.error("Pasien tidak ditemukan", {
          description: "Data pasien tidak ada di database Supabase. Pastikan pasien sudah dibuat.",
        });
      } else if (msg.includes("Authentication required") || msg.includes("auth")) {
        toast.error("Sesi login habis", {
          description: "Silakan login ulang, lalu coba Generate lagi.",
        });
      } else if (msg.includes("Tinggi & berat")) {
        toast.error("Data pasien belum lengkap", {
          description: "Tinggi dan berat badan pasien harus diisi.",
        });
      } else if (msg.includes("fetch") || msg.includes("network")) {
        toast.error("Koneksi gagal", {
          description: "Tidak dapat terhubung ke server. Periksa koneksi internet.",
        });
      } else {
        toast.error("Generate meal plan gagal", {
          description: msg || "Terjadi kesalahan tidak terduga.",
        });
      }
    }
  };

  const handlePersist = async () => {
    if (!selectedPatientId) return;
    // previewData is the exact "Daftar Menu Lengkap" the clinician is
    // looking at (from Generate / Generate Ulang). We must persist THIS,
    // not ask the server to generate a new one — the generator is
    // randomized/rotation-aware, so a second run can pick different
    // foods even for the same patient, which previously caused "Edit
    // Meal Plan Terkini (Database)" to show a different menu than what
    // was just previewed and saved.
    if (!previewData?.plan) {
      toast.error("Belum ada Meal Plan untuk disimpan", {
        description: "Tekan Generate terlebih dahulu.",
      });
      return;
    }
    try {
      await generateMut.mutateAsync({
        patientId: selectedPatientId,
        presetId: activePresetId || undefined,
        plan: previewData.plan,
        calorieResult: previewData.calorieResult,
        aiReasoning: previewData.aiReasoning,
        preset: previewData.preset,
      });
      toast.success("Meal plan disimpan ke database dan dijadikan Meal Plan Aktif");
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan meal plan");
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!selectedPatientId || !previewData) return;
    try {
      await saveMut.mutateAsync({
        patientId: selectedPatientId,
        name: saveName || `Meal Plan ${new Date().toLocaleDateString("id-ID")}`,
        date: new Date().toISOString(),
        totalCal: previewData.plan.totals.cal,
        totalProtein: previewData.plan.totals.protein,
        totalFat: previewData.plan.totals.fat,
        totalCarb: previewData.plan.totals.carb,
        totalFiber: previewData.plan.totals.fiber,
        totalSodium: previewData.plan.totals.sodium,
        compliance: previewData.plan.overallCompliance,
        notes: `Compliance: ${previewData.plan.overallTierLabel}`,
        items: previewData.plan.items.map((i: any) => ({
          slot: i.slot,
          foodId: i.foodId,
          amount: i.amount,
          cal: i.cal,
          protein: i.protein,
          fat: i.fat,
          carb: i.carb,
          fiber: i.fiber,
          sodium: i.sodium,
        })),
      });
      toast.success(`Meal plan "${saveName}" disimpan ke library`);
      setShowSaveDialog(false);
      setSaveName("");
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan meal plan");
    }
  };

  const handleSelectPreset = (preset: any) => {
    setActivePresetId(preset.id);
    setActivePresetName(preset.name);
    toast.success(`Preset "${preset.name}" dipilih — klik Generate untuk membuat Meal Plan baru`);
  };

  // ---------------------------------------------------------------------
  // Single source of truth for what's rendered below:
  //   1. previewData — a just-generated, not-yet-persisted preview
  //      (only exists in-memory for this session; takes priority so a
  //      fresh "Generate Ulang" is reflected immediately).
  //   2. activeView — the patient's Meal Plan Aktif loaded from the
  //      database (survives refresh, navigation, logout/login).
  //   3. cachedView — a localStorage snapshot of #2, shown immediately
  //      while #2 is still in flight so a slow connection never shows
  //      a blank "Belum ada Meal Plan" for a plan that actually exists.
  // ---------------------------------------------------------------------
  const CACHE_KEY = selectedPatientId ? `carelivia:meal-plan-view:${selectedPatientId}` : null;
  const [cachedView, setCachedView] = React.useState<any>(null);

  React.useEffect(() => {
    if (!CACHE_KEY) {
      setCachedView(null);
      return;
    }
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      setCachedView(raw ? JSON.parse(raw) : null);
    } catch {
      setCachedView(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CACHE_KEY]);

  React.useEffect(() => {
    if (!CACHE_KEY || !activeView) return;
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(activeView));
    } catch {
      // localStorage full/unavailable — cache is a best-effort fallback only
    }
  }, [CACHE_KEY, activeView]);

  const viewData = previewData ?? activeView ?? cachedView;
  // Only show the loading skeleton before we have ANYTHING to show —
  // once a cached/db view exists, background refetches stay silent.
  const isLoadingInitialView =
    !viewData && (previewMut.isPending || isActiveViewLoading || (isActiveViewFetching && !!selectedPatientId));

  const plan = viewData?.plan;
  const calorieResult = viewData?.calorieResult;
  const aiReasoning = viewData?.aiReasoning;
  const patientInfo = viewData?.patient;
  const targets = viewData?.targets;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Meal Plan — Isi Piringku"
        subtitle="Pedoman Gizi Seimbang Kemenkes RI: 4 kelompok makanan di setiap makan utama"
        icon={Utensils}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPreviewData(null);
                setActivePresetId(null);
                setActivePresetName(null);
              }}
            >
              <X className="mr-1.5 h-4 w-4" /> Reset
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={previewMut.isPending || !selectedPatientId}
              size="sm"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {previewMut.isPending ? "Menyusun…" : "Generate Isi Piringku"}
            </Button>
          </>
        }
      />

      {/* Patient + Preset selector */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">
                <User className="mr-1 inline h-3.5 w-3.5" /> Pasien
              </Label>
              <Select
                value={selectedPatientId}
                onValueChange={setSelectedPatientId}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Pilih pasien" />
                </SelectTrigger>
                <SelectContent>
                  {(patients || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.mrn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground">
                <Target className="mr-1 inline h-3.5 w-3.5" /> Preset Aktif (opsional)
              </Label>
              <Select
                value={activePresetId || "__none__"}
                onValueChange={(v) => {
                  if (v === "__none__") {
                    setActivePresetId(null);
                    setActivePresetName(null);
                  } else {
                    const p = (presets || []).find((x: any) => x.id === v);
                    if (p) handleSelectPreset(p);
                  }
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Tanpa preset (pakai target CareLivia)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Tanpa preset —</SelectItem>
                  {patientPresets.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Preset Pasien
                      </div>
                      {patientPresets.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.totalCal} kcal)
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {templatePresets.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Template
                      </div>
                      {templatePresets.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.totalCal} kcal)
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground">
                <Activity className="mr-1 inline h-3.5 w-3.5" /> Diagnosis Utama
              </Label>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {selectedPatient?.diagnoses?.length ? (
                  selectedPatient.diagnoses.map((raw: any, idx: number) => {
                    const d: string = typeof raw === "string" ? raw : (raw?.type ?? "");
                    if (!d) return null;
                    return (
                      <Badge key={`${d}-${idx}`} variant="secondary" className="text-xs">
                        {DIAGNOSIS_ADJUSTMENTS[d as DiagnosisType]?.label || d}
                      </Badge>
                    );
                  })
                ) : (
                  <Badge variant="outline" className="text-xs">Umum</Badge>
                )}
              </div>
            </div>
          </div>

          {activePresetName && (
            <Alert className="mt-4 border-violet-500/30 bg-violet-500/5">
              <Target className="h-4 w-4 text-violet-600" />
              <AlertTitle className="text-sm">Preset aktif: {activePresetName}</AlertTitle>
              <AlertDescription className="text-xs">
                Target akan di-override dengan nilai preset. Klik Generate untuk menyusun ulang.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoadingInitialView && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
          <p className="col-span-full text-center text-xs text-muted-foreground">Loading Meal Plan…</p>
        </div>
      )}

      {/* Empty state — only after we've actually finished checking the database */}
      {!plan && !isLoadingInitialView && (
        <EmptyState
          icon={Utensils}
          title="Belum ada Meal Plan"
          description="Pilih pasien lalu klik Generate untuk menyusun rencana makan sesuai Pedoman Isi Piringku Kemenkes RI. Setiap makan utama akan berisi 4 kelompok: makanan pokok, lauk pauk, sayuran, dan buah."
          action={
            <Button onClick={handleGenerate} disabled={!selectedPatientId}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Generate Sekarang
            </Button>
          }
        />
      )}

      {/* MAIN CONTENT — Isi Piringku plan */}
      {plan && calorieResult && (
        <>
          {/* Top summary stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Target Energi"
              value={calorieResult.targetCalorie.toLocaleString("id-ID")}
              unit="kcal"
              icon={Target}
              color="primary"
              sublabel={`BMI ${calorieResult.bmi} (${calorieResult.bmiLabel})`}
            />
            <StatCard
              label="Energi Aktual"
              value={plan.totals.cal.toLocaleString("id-ID")}
              unit="kcal"
              icon={TrendingUp}
              color="emerald"
              sublabel={`${Math.round((plan.totals.cal / calorieResult.targetCalorie) * 100)}% dari target`}
            />
            <StatCard
              label="Compliance Isi Piringku"
              value={plan.overallCompliance}
              unit="%"
              icon={CheckCircle2}
              color={plan.overallCompliance >= 90 ? "emerald" : plan.overallCompliance >= 70 ? "amber" : "rose"}
              sublabel={`${COMPLIANCE_TIER_ICON[plan.overallTier]} ${plan.overallTierLabel}`}
            />
            <StatCard
              label="Distribusi Makro"
              value={`P${Math.round((plan.totals.protein * 4 / plan.totals.cal) * 100)}/L${Math.round((plan.totals.fat * 9 / plan.totals.cal) * 100)}/K${Math.round((plan.totals.carb * 4 / plan.totals.cal) * 100)}`}
              icon={Activity}
              color="violet"
              sublabel={`Protein ${plan.totals.protein}g · Lemak ${plan.totals.fat}g · Karbo ${plan.totals.carb}g`}
            />
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleGenerate} variant="outline" size="sm" disabled={previewMut.isPending}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              {previewMut.isPending ? "Menyusun ulang…" : "Generate Ulang"}
            </Button>
            <Button onClick={handlePersist} variant="default" size="sm" disabled={generateMut.isPending}>
              <Save className="mr-1.5 h-4 w-4" />
              {generateMut.isPending ? "Menyimpan…" : "Simpan ke Database"}
            </Button>
            <Button onClick={() => setShowSaveDialog(true)} variant="outline" size="sm">
              <Bookmark className="mr-1.5 h-4 w-4" /> Simpan ke Library
            </Button>
            {patientInfo && (
              <Badge variant="outline" className="ml-auto text-xs">
                <User className="mr-1 h-3 w-3" />
                {patientInfo.name} · {patientInfo.mrn}
              </Badge>
            )}
          </div>

          {/* ROTATION WARNINGS */}
          {plan.rotationWarnings.length > 0 && (
            <Alert className="border-amber-500/30 bg-amber-500/5">
              <RotateCw className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-sm">Peringatan Variasi Menu (Rotasi 14 Hari)</AlertTitle>
              <AlertDescription className="text-xs">
                <ul className="list-disc pl-4 space-y-0.5">
                  {plan.rotationWarnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* LAB-DRIVEN FOOD ADJUSTMENTS */}
          {plan.labFoodAdjustments && plan.labFoodAdjustments.length > 0 && (
            <Alert className="border-sky-500/30 bg-sky-500/5">
              <FlaskConical className="h-4 w-4 text-sky-600" />
              <AlertTitle className="text-sm">Penyesuaian Menu Berdasarkan Hasil Laboratorium</AlertTitle>
              <AlertDescription className="text-xs">
                <ul className="list-disc pl-4 space-y-0.5">
                  {plan.labFoodAdjustments.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* PLATE VISUALIZATION — 3 main meals */}
          <SectionCard
            title="Visualisasi Isi Piringku"
            description="Setiap makan utama mengikuti proporsi: 2/3 makanan pokok + 1/3 lauk pauk (setengah piring pertama); 2/3 sayuran + 1/3 buah (setengah piring kedua)"
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plan.slotSummaries
                .filter((s: any) => MAIN_SLOTS.includes(s.slot))
                .map((s: any) => (
                  <PlateMealCard key={s.slot} summary={s} />
                ))}
            </div>
          </SectionCard>

          {/* DETAILED MEAL ITEMS BY SLOT */}
          <SectionCard
            title="Daftar Menu Lengkap"
            description="Klik item untuk melihat alternatif pengganti setara nutrisi"
          >
            <div className="space-y-3">
              {plan.slotSummaries.map((s: any) => (
                <SlotItemsCard key={s.slot} summary={s} />
              ))}
            </div>
          </SectionCard>

          {/* NUTRITION VALIDATION TABLE */}
          <SectionCard
            title="Validasi Kecukupan Gizi"
            description="Target terpenuhi jika 95-105% dari kebutuhan harian (Kemenkes RI)"
          >
            <NutritionValidationTable validation={plan.validation} />
          </SectionCard>

          {/* AI REASONING */}
          {aiReasoning && (
            <SectionCard
              title="Evaluasi AI CareLivia"
              description="Analisis klinis berbasis Pedoman Isi Piringku & diagnosis pasien"
            >
              <div className="rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-primary/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/10">
                    <Brain className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                    CareLivia AI Nutritionist
                  </span>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                  {aiReasoning}
                </p>
              </div>
            </SectionCard>
          )}

          {/* GROUP COVERAGE SUMMARY */}
          <SectionCard
            title="Cakupan Kelompok Makanan Hari Ini"
            description="Jumlah item per kelompok — ideal: 3+ makanan pokok, 3+ lauk, 3+ sayur, 3+ buah"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <GroupCoverageCard
                group="STAPLE"
                count={plan.groupCoverage.staple}
                target={3}
              />
              <GroupCoverageCard
                group="PROTEIN"
                count={plan.groupCoverage.protein}
                target={3}
              />
              <GroupCoverageCard
                group="VEGETABLE"
                count={plan.groupCoverage.vegetable}
                target={3}
              />
              <GroupCoverageCard
                group="FRUIT"
                count={plan.groupCoverage.fruit}
                target={3}
              />
            </div>
          </SectionCard>

          {/* CLINICAL GUIDELINES REFERENCE */}
          <SectionCard
            title="Panduan Klinis & Distribusi Energi"
            description="Acuan: Permenkes RI No.41/2014, Pedoman Gizi Seimbang 2023, PERKENI, ESPEN, KDIGO"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Distribusi Energi per Waktu Makan
                </h4>
                <div className="space-y-1.5">
                  {(Object.keys(SLOT_LABELS) as MealSlot[]).map((slot) => (
                    <div
                      key={slot}
                      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium">{SLOT_LABELS[slot]}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {SLOT_DISTRIBUTION_PCT[slot]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Modifikasi Diagnosis
                </h4>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                  <p className="font-semibold text-foreground">
                    {calorieResult.primaryDiagnosis?.label || "Umum"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {calorieResult.primaryDiagnosis?.notes}
                  </p>
                  {calorieResult.warnings.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-amber-700 dark:text-amber-400">
                      {calorieResult.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {/* EDITABLE LATEST PERSISTED MEAL PLAN — add/edit/delete foods */}
      {latestPlan && selectedPatientId && (
        <LatestMealPlanEditor plan={latestPlan} />
      )}

      {/* SAVE TO LIBRARY DIALOG */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simpan ke Library Meal Plan</DialogTitle>
            <DialogDescription>
              Beri nama untuk meal plan ini. Anda dapat memuatnya kembali nanti untuk pasien yang sama.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="save-name">Nama Meal Plan</Label>
              <Input
                id="save-name"
                placeholder="cth: Menu DM 1500 kcal Hari 1"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            {plan && (
              <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="grid grid-cols-2 gap-2">
                  <span>Total: <strong className="text-foreground">{plan.totals.cal} kcal</strong></span>
                  <span>Protein: <strong className="text-foreground">{plan.totals.protein}g</strong></span>
                  <span>Lemak: <strong className="text-foreground">{plan.totals.fat}g</strong></span>
                  <span>Karbo: <strong className="text-foreground">{plan.totals.carb}g</strong></span>
                  <span>Serat: <strong className="text-foreground">{plan.totals.fiber}g</strong></span>
                  <span>Compliance: <strong className="text-foreground">{plan.overallCompliance}%</strong></span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={saveMut.isPending || !saveName.trim()}
            >
              {saveMut.isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------
// PlateMealCard — visual plate + compliance for one main meal
// ---------------------------------------------------------------------
function PlateMealCard({ summary }: { summary: any }) {
  const items = summary.items || [];
  const calPct = summary.slotTargetCal > 0 ? Math.round((summary.slotActualCal / summary.slotTargetCal) * 100) : 0;
  const tierColor = COMPLIANCE_TIER_COLOR[summary.compliance.tier as keyof typeof COMPLIANCE_TIER_COLOR];

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${SLOT_COLORS[summary.slot as MealSlot]}`}>
                {SLOT_LABELS[summary.slot as MealSlot]}
              </span>
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Target {summary.slotTargetCal} kcal · Aktual {summary.slotActualCal} kcal ({calPct}%)
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: tierColor }}>
              {summary.compliance.score}%
            </div>
            <div className="text-[10px] font-medium" style={{ color: tierColor }}>
              {COMPLIANCE_TIER_ICON[summary.compliance.tier as keyof typeof COMPLIANCE_TIER_ICON]} {COMPLIANCE_TIER_LABEL[summary.compliance.tier as keyof typeof COMPLIANCE_TIER_LABEL]}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center pt-2">
        <IsiPiringkuPlate
          items={items.map((i: any) => ({
            group: i.group as PlateGroup,
            foodName: i.foodName,
            grams: i.amount,
            cal: i.cal,
          }))}
          size={240}
          showLegend={false}
        />
        {summary.compliance.recommendations.length > 0 && (
          <div className="mt-3 w-full rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Saran Perbaikan
            </p>
            <ul className="space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300">
              {summary.compliance.recommendations.map((r: string, i: number) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// SlotItemsCard — detailed item list per slot, with alternatives
// ---------------------------------------------------------------------
function SlotItemsCard({ summary }: { summary: any }) {
  const [open, setOpen] = React.useState(true);
  const items = summary.items || [];
  const isMain = MAIN_SLOTS.includes(summary.slot as MealSlot);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border/60">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30">
            <div className="flex items-center gap-2">
              {open ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${SLOT_COLORS[summary.slot as MealSlot]}`}>
                {SLOT_LABELS[summary.slot as MealSlot]}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {SLOT_DISTRIBUTION_PCT[summary.slot as MealSlot]}
              </Badge>
              {isMain && (
                <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700">
                  Isi Piringku
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                {items.length} item · {summary.slotActualCal} kcal
              </span>
              {isMain && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: COMPLIANCE_TIER_COLOR[summary.compliance.tier as keyof typeof COMPLIANCE_TIER_COLOR] }}
                >
                  {summary.compliance.score}%
                </span>
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="divide-y divide-border/40 border-t border-border/40">
            {items.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground">
                Tidak ada item — slot mungkin tidak dapat dipenuhi karena keterbatasan database makanan.
              </div>
            ) : (
              items.map((item: any, idx: number) => (
                <MealItemRow key={idx} item={item} />
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------
// MealItemRow — single item with expandable alternatives
// ---------------------------------------------------------------------
function MealItemRow({ item }: { item: any }) {
  const [showAlts, setShowAlts] = React.useState(false);
  const alts = item.alternatives || [];

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
            style={{ background: `${item.groupColor}22` }}
          >
            {item.groupIcon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{item.foodName}</p>
              <Badge
                variant="outline"
                className="shrink-0 text-[9px]"
                style={{
                  borderColor: `${item.groupColor}55`,
                  color: item.groupColor,
                  background: `${item.groupColor}11`,
                }}
              >
                {item.groupLabel}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span><strong className="text-foreground">{item.amount}g</strong></span>
              {item.urt && <span>· {item.urt}</span>}
              <span>· <strong className="text-foreground">{item.cal}</strong> kkal</span>
              <span>· P {item.protein}g</span>
              <span>· L {item.fat}g</span>
              <span>· K {item.carb}g</span>
              <span>· Serat {item.fiber}g</span>
              <span>· Na {item.sodium}mg</span>
            </div>
          </div>
        </div>
        {alts.length > 0 && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setShowAlts(!showAlts)}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  {alts.length} alternatif
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Lihat {alts.length} makanan pengganti setara nutrisi</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {showAlts && alts.length > 0 && (
        <div className="mt-2 ml-12 space-y-1.5 rounded-md border border-dashed border-border/60 bg-muted/20 p-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Alternatif Pengganti ({alts.length})
          </p>
          {alts.map((alt: any, i: number) => (
            <div
              key={i}
              className="flex items-start justify-between gap-2 rounded bg-background/60 p-1.5 text-[11px]"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {alt.foodName} <span className="text-muted-foreground">· {alt.amount}g</span>
                </p>
                <p className="text-[10px] text-muted-foreground">{alt.reason}</p>
              </div>
              <div className="shrink-0 text-right text-[10px] text-muted-foreground">
                <div><strong className="text-foreground">{alt.cal}</strong> kkal</div>
                <div>P {alt.protein}g</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// NutritionValidationTable — target vs actual with OK/LOW/HIGH
// ---------------------------------------------------------------------
function NutritionValidationTable({ validation }: { validation: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Nutrien</th>
            <th className="py-2 pr-3 font-medium">Target</th>
            <th className="py-2 pr-3 font-medium">Aktual</th>
            <th className="py-2 pr-3 font-medium">Pencapaian</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {validation.map((row: any, i: number) => {
            const statusColor =
              row.status === "OK"
                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20"
                : row.status === "LOW"
                ? "bg-amber-500/10 text-amber-700 ring-amber-500/20"
                : "bg-rose-500/10 text-rose-700 ring-rose-500/20";
            const statusLabel =
              row.status === "OK" ? "✓ Tercapai" : row.status === "LOW" ? "↓ Kurang" : "↑ Berlebih";
            const pctColor =
              row.pct >= 95 && row.pct <= 105
                ? "text-emerald-600"
                : row.pct < 95
                ? "text-amber-600"
                : "text-rose-600";
            return (
              <tr key={i}>
                <td className="py-2 pr-3 font-medium text-foreground">{row.nutrient}</td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {row.target} <span className="text-[10px]">{row.unit}</span>
                </td>
                <td className="py-2 pr-3 text-foreground">
                  {row.actual} <span className="text-[10px]">{row.unit}</span>
                </td>
                <td className={`py-2 pr-3 font-semibold ${pctColor}`}>{row.pct}%</td>
                <td className="py-2">
                  <Badge variant="outline" className={`text-[10px] ring-1 ${statusColor}`}>
                    {statusLabel}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted-foreground">
        <Info className="mr-1 inline h-3 w-3" />
        Standar kepatuhan: 95-105% dianggap tercapai. Natrium adalah batas atas (&gt;100% = berlebih).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// GroupCoverageCard — count of items per plate group
// ---------------------------------------------------------------------
function GroupCoverageCard({
  group,
  count,
  target,
}: {
  group: PlateGroup;
  count: number;
  target: number;
}) {
  const pct = Math.min(100, Math.round((count / target) * 100));
  const isComplete = count >= target;
  return (
    <div className="rounded-lg border border-border/60 bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-2xl">{PLATE_GROUP_ICON[group]}</span>
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-500" />
        )}
      </div>
      <p className="text-xs font-medium text-muted-foreground">
        {PLATE_GROUP_LABEL[group]}
      </p>
      <p className="mt-1 text-2xl font-bold text-foreground">
        {count}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          / {target}+
        </span>
      </p>
      <Progress value={pct} className="mt-2 h-1.5" />
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        {isComplete ? "Cakupan terpenuhi" : "Tambah variasi"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// LatestMealPlanEditor — Draft/Preview/Save editor for the latest
// persisted meal plan.
//
// Design: edits (gram change, food swap, add, delete) update local
// `draft` state immediately for realtime totals/macro/Isi Piringku
// recompute. Nothing is persisted until the person clicks "Simpan
// Meal Plan" — this is a full manual save, there is no auto-save.
// That click calls /api/meal-plan/[id]/save, which applies everything
// atomically (fn_save_meal_plan_draft), writes a Riwayat Meal Plan
// snapshot, syncs the Saved Meal Library, and refreshes the Shopping
// Planner if one already exists.
// ---------------------------------------------------------------------

type NutrientPer100 = {
  energy: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
  potassium: number;
};

type DraftItem = {
  key: string; // stable React key — existing item.id, or "new-<uuid>"
  id: string | null; // existing meal_plan_items.id, null = not yet saved
  slot: MealSlot;
  foodId: string;
  foodName: string;
  amount: number;
  per100: NutrientPer100;
};

function buildDraftItemFromServer(item: any): DraftItem {
  const amount = Number(item.amount) || 0;
  const per100: NutrientPer100 =
    amount > 0
      ? {
          energy: ((Number(item.cal) || 0) / amount) * 100,
          protein: ((Number(item.protein) || 0) / amount) * 100,
          fat: ((Number(item.fat) || 0) / amount) * 100,
          carb: ((Number(item.carb) || 0) / amount) * 100,
          fiber: ((Number(item.fiber) || 0) / amount) * 100,
          sodium: ((Number(item.sodium) || 0) / amount) * 100,
          potassium: 0,
        }
      : { energy: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0, potassium: 0 };
  return {
    key: item.id,
    id: item.id,
    slot: item.slot,
    foodId: item.foodId,
    foodName: item.food?.name || "Makanan tidak diketahui",
    amount,
    per100,
  };
}

function draftItemNutrition(d: DraftItem) {
  const n = computeFoodNutrition(d.per100, d.amount || 0);
  return {
    cal: Math.round(n.cal * 10) / 10,
    protein: Math.round(n.protein * 10) / 10,
    fat: Math.round(n.fat * 10) / 10,
    carb: Math.round(n.carb * 10) / 10,
    fiber: Math.round(n.fiber * 10) / 10,
    sodium: Math.round(n.sodium * 10) / 10,
  };
}

function LatestMealPlanEditor({ plan }: { plan: any }) {
  const serverItems: any[] = Array.isArray(plan.items) ? plan.items : [];

  const [draft, setDraft] = React.useState<DraftItem[]>(() =>
    serverItems.map(buildDraftItemFromServer),
  );
  const [dirty, setDirty] = React.useState(false);
  const [planName, setPlanName] = React.useState("");

  // Resync draft from the server whenever the persisted plan actually
  // changes (new plan, or our own save completed) — but never while the
  // user has unsaved local edits, so we don't clobber their work.
  React.useEffect(() => {
    if (!dirty) {
      setDraft(serverItems.map(buildDraftItemFromServer));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, plan.updatedAt]);

  const saveMut = useSaveMealPlanDraft(plan.id);

  const itemsBySlot = React.useMemo(() => {
    const map: Record<string, DraftItem[]> = {};
    for (const item of draft) {
      const slot = String(item.slot || "");
      if (!map[slot]) map[slot] = [];
      map[slot].push(item);
    }
    return map;
  }, [draft]);

  // Realtime totals — always computed from the local draft, never from
  // stale server data, so every dependent panel (totals, macro split,
  // Isi Piringku, validation) stays in sync while editing.
  const totals = React.useMemo(() => {
    const t = { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0 };
    for (const d of draft) {
      const n = draftItemNutrition(d);
      t.cal += n.cal;
      t.protein += n.protein;
      t.fat += n.fat;
      t.carb += n.carb;
      t.fiber += n.fiber;
      t.sodium += n.sodium;
    }
    return {
      cal: Math.round(t.cal),
      protein: Math.round(t.protein * 10) / 10,
      fat: Math.round(t.fat * 10) / 10,
      carb: Math.round(t.carb * 10) / 10,
      fiber: Math.round(t.fiber * 10) / 10,
      sodium: Math.round(t.sodium),
    };
  }, [draft]);

  const targetCal = Number(plan.targetCal) || 0;
  const pctOfTarget = targetCal > 0 ? Math.round((totals.cal / targetCal) * 100) : 0;

  const planDate = plan.date ? new Date(plan.date) : null;
  const dateLabel = planDate
    ? planDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const macroPct =
    totals.cal > 0
      ? {
          p: Math.round(((totals.protein * 4) / totals.cal) * 100),
          l: Math.round(((totals.fat * 9) / totals.cal) * 100),
          k: Math.round(((totals.carb * 4) / totals.cal) * 100),
        }
      : { p: 0, l: 0, k: 0 };

  const handleGramChange = (key: string, amount: number) => {
    setDraft((prev) => prev.map((it) => (it.key === key ? { ...it, amount } : it)));
    setDirty(true);
  };

  const handleReplaceFood = (key: string, result: FoodPickerResult) => {
    const per100: NutrientPer100 =
      result.amount > 0
        ? {
            energy: (result.cal / result.amount) * 100,
            protein: (result.protein / result.amount) * 100,
            fat: (result.fat / result.amount) * 100,
            carb: (result.carb / result.amount) * 100,
            fiber: (result.fiber / result.amount) * 100,
            sodium: (result.sodium / result.amount) * 100,
            potassium: (result.potassium / result.amount) * 100,
          }
        : { energy: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0, potassium: 0 };
    setDraft((prev) =>
      prev.map((it) =>
        it.key === key
          ? { ...it, foodId: result.foodId, foodName: result.foodName, amount: result.amount, per100 }
          : it,
      ),
    );
    setDirty(true);
    toast.info(`"${result.foodName}" akan diterapkan setelah kamu menekan Simpan Meal Plan`);
  };

  const handleDeleteItem = (key: string) => {
    setDraft((prev) => prev.filter((it) => it.key !== key));
    setDirty(true);
  };

  const handleAddItem = (slot: MealSlot, result: FoodPickerResult) => {
    const per100: NutrientPer100 =
      result.amount > 0
        ? {
            energy: (result.cal / result.amount) * 100,
            protein: (result.protein / result.amount) * 100,
            fat: (result.fat / result.amount) * 100,
            carb: (result.carb / result.amount) * 100,
            fiber: (result.fiber / result.amount) * 100,
            sodium: (result.sodium / result.amount) * 100,
            potassium: (result.potassium / result.amount) * 100,
          }
        : { energy: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0, potassium: 0 };
    const newItem: DraftItem = {
      key: `new-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      id: null,
      slot,
      foodId: result.foodId,
      foodName: result.foodName,
      amount: result.amount,
      per100,
    };
    setDraft((prev) => [...prev, newItem]);
    setDirty(true);
    toast.info(`"${result.foodName}" ditambahkan ke draft — belum tersimpan`);
  };

  const handleDiscard = () => {
    setDraft(serverItems.map(buildDraftItemFromServer));
    setDirty(false);
    toast.message("Perubahan draft dibatalkan");
  };

  const handleSave = async () => {
    const deletedItemIds = serverItems
      .map((it: any) => it.id as string)
      .filter((id: string) => !draft.some((d) => d.id === id));

    const items = draft.map((d) => {
      const n = draftItemNutrition(d);
      return {
        id: d.id,
        slot: d.slot,
        foodId: d.foodId,
        amount: d.amount,
        cal: n.cal,
        protein: n.protein,
        fat: n.fat,
        carb: n.carb,
        fiber: n.fiber,
        sodium: n.sodium,
      };
    });

    try {
      const res = await saveMut.mutateAsync({
        items,
        deletedItemIds,
        name: planName.trim() || null,
        saveToLibrary: true,
        syncShopping: true,
      });
      setDirty(false);
      const w = res?.warnings as string[] | undefined;
      if (w && w.length > 0) {
        toast.warning("Meal plan tersimpan, dengan catatan", {
          description: w.join(" · "),
        });
      } else {
        toast.success("Meal plan berhasil disimpan ke database, Riwayat, Saved Meal Library" +
          (res?.shoppingSynced ? ", dan Shopping Planner" : ""));
      }
    } catch (e: any) {
      // Save failed — keep the local draft and `dirty` state exactly as
      // they were so the person's edits are never lost; they can retry
      // by clicking "Simpan Meal Plan" again.
      toast.error(e.message || "Gagal menyimpan meal plan. Silakan coba lagi.");
    }
  };

  return (
    <SectionCard
      title="Edit Meal Plan Terkini (Database)"
      description="Ubah gram/makanan sepuasnya — perubahan hanya di draft. Tekan “Simpan Meal Plan” untuk mengunci ke database."
    >
      {/* Plan summary — realtime from draft */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tanggal Plan</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{dateLabel}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Energi</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {totals.cal} kcal
            {targetCal > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">/ {targetCal} ({pctOfTarget}%)</span>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Makro (P/L/K)</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {totals.protein}g / {totals.fat}g / {totals.carb}g
          </p>
          <p className="text-[10px] text-muted-foreground">
            Distribusi P{macroPct.p}/L{macroPct.l}/K{macroPct.k}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Serat & Natrium</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {totals.fiber}g · {totals.sodium}mg
          </p>
        </div>
      </div>

      {dirty && (
        <Alert className="mb-4 border-amber-500/30 bg-amber-500/5">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm">Ada perubahan belum tersimpan</AlertTitle>
          <AlertDescription className="text-xs">
            Perubahan Anda masih berada di draft. Tekan "Simpan Meal Plan" untuk menyimpan ke database.
          </AlertDescription>
        </Alert>
      )}

      {draft.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Meal plan ini belum memiliki item. Tambahkan makanan pada salah satu slot di bawah.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.keys(SLOT_LABELS) as MealSlot[]).map((slot) => (
            <EditableSlotItemsCard
              key={slot}
              slot={slot}
              items={itemsBySlot[slot] || []}
              onGramChange={handleGramChange}
              onReplaceFood={handleReplaceFood}
              onDelete={handleDeleteItem}
              onAdd={(result) => handleAddItem(slot, result)}
            />
          ))}
        </div>
      )}

      {/* Sticky save bar — the ONLY place edits are committed to Supabase */}
      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-5 border-t border-border/60 bg-background/95 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Nama meal plan (opsional, untuk Riwayat & Library)"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className="h-9 max-w-xs text-xs"
          />
          <div className="ml-auto flex items-center gap-2">
            {dirty && (
              <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saveMut.isPending}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Batal
              </Button>
            )}
            <Button onClick={() => handleSave()} size="sm" disabled={saveMut.isPending}>
              <Save className="mr-1.5 h-4 w-4" />
              {saveMut.isPending ? "Menyimpan…" : "Simpan Meal Plan"}
            </Button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------
// EditableSlotItemsCard — one slot's draft items + "+ Tambah Makanan"
// Purely presentational: all state lives in the parent's draft array.
// ---------------------------------------------------------------------
function EditableSlotItemsCard({
  slot,
  items,
  onGramChange,
  onReplaceFood,
  onDelete,
  onAdd,
}: {
  slot: MealSlot;
  items: DraftItem[];
  onGramChange: (key: string, amount: number) => void;
  onReplaceFood: (key: string, result: FoodPickerResult) => void;
  onDelete: (key: string) => void;
  onAdd: (result: FoodPickerResult) => void;
}) {
  const [open, setOpen] = React.useState(true);
  const [showAddFood, setShowAddFood] = React.useState(false);

  const slotCal = items.reduce((sum, it) => sum + draftItemNutrition(it).cal, 0);
  const isMain = MAIN_SLOTS.includes(slot);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border/60">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30">
            <div className="flex items-center gap-2">
              {open ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${SLOT_COLORS[slot]}`}
              >
                {SLOT_LABELS[slot]}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {SLOT_DISTRIBUTION_PCT[slot]}
              </Badge>
              {isMain && (
                <Badge variant="secondary" className="bg-emerald-500/10 text-[10px] text-emerald-700">
                  Isi Piringku
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                {items.length} item · {Math.round(slotCal)} kcal
              </span>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="divide-y divide-border/40 border-t border-border/40">
            {items.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground">
                Slot kosong — tambahkan makanan untuk mengisi slot ini.
              </div>
            ) : (
              items.map((item) => (
                <EditableMealItemRow
                  key={item.key}
                  item={item}
                  onGramChange={onGramChange}
                  onReplaceFood={onReplaceFood}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>

          <div className="border-t border-border/40 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center border border-dashed border-border/60 text-xs"
              onClick={() => setShowAddFood(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Makanan
            </Button>
          </div>
        </CollapsibleContent>
      </div>

      <FoodPickerDialog
        open={showAddFood}
        onOpenChange={setShowAddFood}
        onSelect={onAdd}
        title={`Tambah Makanan — ${SLOT_LABELS[slot]}`}
        excludeFoodIds={items.map((it) => it.foodId)}
      />
    </Collapsible>
  );
}

// ---------------------------------------------------------------------
// EditableMealItemRow — one draft item: inline gram editor, food swap,
// delete. All handlers only call back into the parent's draft state —
// no Supabase mutation happens here anymore.
// ---------------------------------------------------------------------
function EditableMealItemRow({
  item,
  onGramChange,
  onReplaceFood,
  onDelete,
}: {
  item: DraftItem;
  onGramChange: (key: string, amount: number) => void;
  onReplaceFood: (key: string, result: FoodPickerResult) => void;
  onDelete: (key: string) => void;
}) {
  const [gramsInput, setGramsInput] = React.useState<string>(String(item.amount || 0));
  const [isEditingFood, setIsEditingFood] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    setGramsInput(String(item.amount || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.amount]);

  const nutrition = draftItemNutrition(item);
  const isNew = item.id === null;

  const handleGramsInput = (value: string) => {
    setGramsInput(value);
    const num = Number(value);
    if (!Number.isNaN(num) && num > 0) {
      onGramChange(item.key, num);
    }
  };

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base">
            <Apple className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{item.foodName}</p>
              {isNew && (
                <Badge variant="outline" className="bg-emerald-500/10 text-[9px] text-emerald-700">
                  baru — belum tersimpan
                </Badge>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <label className="flex items-center gap-1">
                <Input
                  type="number"
                  value={gramsInput}
                  onChange={(e) => handleGramsInput(e.target.value)}
                  className="h-6 w-16 px-1.5 py-0 text-xs"
                  min={1}
                  max={2000}
                />
                <span>g</span>
              </label>
              <span>
                · <strong className="text-foreground">{nutrition.cal}</strong> kkal
              </span>
              <span>· P {nutrition.protein}g</span>
              <span>· L {nutrition.fat}g</span>
              <span>· K {nutrition.carb}g</span>
              <span>· Serat {nutrition.fiber}g</span>
              <span>· Na {nutrition.sodium}mg</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsEditingFood(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ganti makanan</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {confirmDelete ? (
            <div className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/5 px-1">
              <span className="px-1 text-[10px] text-rose-700 dark:text-rose-400">Hapus?</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-rose-700 hover:bg-rose-500/10 dark:text-rose-400"
                onClick={() => onDelete(item.key)}
              >
                Ya
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setConfirmDelete(false)}
              >
                Tidak
              </Button>
            </div>
          ) : (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Hapus makanan</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <FoodPickerDialog
        open={isEditingFood}
        onOpenChange={setIsEditingFood}
        onSelect={(result) => onReplaceFood(item.key, result)}
        title={`Ganti Makanan — ${item.foodName}`}
        defaultAmount={item.amount || 100}
      />
    </div>
  );
}
