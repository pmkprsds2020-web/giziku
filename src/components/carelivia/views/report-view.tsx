"use client";

import * as React from "react";
import {
  FileText,
  User,
  Printer,
  Download,
  Loader2,
  HeartPulse,
  Activity,
  Target,
  Beef,
  Droplet,
  Wheat,
  Leaf,
  Utensils,
  Dumbbell,
  Brain,
  Stethoscope,
  ClipboardCheck,
  AlertTriangle,
  ClipboardList,
  ShoppingCart,
  FlaskConical,
  Footprints,
  Dna,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  PageHeader,
  EmptyState,
  LoadingState,
} from "@/components/carelivia/ui-helpers";
import {
  usePatients,
  usePatient,
  useActiveMealPlanView,
  useExercisePlans,
  useFoodRecords,
  useShoppingList,
  useAssessments,
  useWeightRecords,
  useLabResults,
  useBouchardAssessments,
} from "@/hooks/use-carelivia";
import { useGenomicReports, useGenomicReportDetail } from "@/hooks/use-nutrigenomic";
import { BUCKET_LABELS, type BouchardCategory } from "@/lib/clinical/bouchard";
import { LAB_CATEGORY_LABELS, LAB_STATUS_LABELS, type LabCategory } from "@/lib/clinical/lab-catalog";
import { AIClinicalAssessmentDashboard } from "@/components/carelivia/ai-clinical-assessment";
import { useCareLiviaStore } from "@/store/carelivia";
import { exportClinicalReportPdf } from "@/lib/pdf/export-clinical-report";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  DIAGNOSIS_ADJUSTMENTS,
  classifyBMI,
  idealBodyWeight,
} from "@/lib/clinical/constants";
import type {
  DiagnosisType,
  Gender,
  MealSlot,
  ExerciseType,
  ExerciseIntensity,
} from "@prisma/client";

const SLOT_LABELS: Record<MealSlot, string> = {
  BREAKFAST: "Sarapan",
  MORNING_SNACK: "Snack Pagi",
  LUNCH: "Makan Siang",
  AFTERNOON_SNACK: "Snack Sore",
  DINNER: "Makan Malam",
  EVENING_SNACK: "Snack Malam",
};

const SLOT_ORDER: MealSlot[] = [
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "EVENING_SNACK",
];

const GENDER_LABELS: Record<Gender, string> = {
  MALE: "Laki-laki",
  FEMALE: "Perempuan",
};

const RELIGION_LABELS: Record<string, string> = {
  ISLAM: "Islam",
  KRISTEN: "Kristen",
  KATOLIK: "Katolik",
  HINDU: "Hindu",
  BUDDHA: "Buddha",
  KONGHUCU: "Konghucu",
  OTHER: "Lainnya",
};

const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  AEROBIC: "Aerobik",
  RESISTANCE: "Resistance",
  FLEXIBILITY: "Fleksibilitas",
  BALANCE: "Keseimbangan",
  FUNCTIONAL: "Fungsional",
};

const INTENSITY_LABELS: Record<ExerciseIntensity, string> = {
  LOW: "Ringan",
  MODERATE: "Sedang",
  HIGH: "Berat",
};

function calcAge(birthDate: string | Date): number {
  const d = new Date(birthDate);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 86400000));
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Compliance / adequacy marker — 🟢 sesuai · 🟡 kurang/lebih · 🔴 jauh dari target
function nutrientStatus(pct: number): { dot: string; label: string; className: string } {
  if (pct >= 90 && pct <= 110) {
    return { dot: "🟢", label: "Sesuai", className: "text-emerald-600 dark:text-emerald-400" };
  }
  if ((pct >= 70 && pct < 90) || (pct > 110 && pct <= 130)) {
    return { dot: "🟡", label: pct < 90 ? "Kurang" : "Lebih", className: "text-amber-600 dark:text-amber-400" };
  }
  return { dot: "🔴", label: pct < 70 ? "Jauh Kurang" : "Jauh Berlebih", className: "text-rose-600 dark:text-rose-400" };
}

export function ReportView() {
  const { data: patients } = usePatients();
  const { activePatientId, setActivePatient } = useCareLiviaStore();
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>(
    activePatientId || "",
  );

  React.useEffect(() => {
    if (activePatientId && !selectedPatientId) {
      setSelectedPatientId(activePatientId);
    }
  }, [activePatientId, selectedPatientId]);

  const { data: patient, isLoading } = usePatient(selectedPatientId || null);
  const { user } = useAuth();
  const [isExporting, setIsExporting] = React.useState(false);

  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id);
    setActivePatient(id);
  };

  // "Cetak" — opens the native browser print dialog. Kept as a separate,
  // explicit action from "Unduh PDF" so the person isn't forced through a
  // print dialog just to get a file.
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      toast.info(
        "Membuka dialog cetak — pilih 'Simpan sebagai PDF' sebagai printer untuk mengunduh PDF",
        { duration: 5000 },
      );
      setTimeout(() => window.print(), 500);
    }
  };

  // "Unduh PDF" — generates the file directly client-side, without going
  // through the browser's print dialog at all.
  const handleDownloadPdf = async () => {
    const node = document.querySelector<HTMLElement>(".cl-report");
    if (!node || !patient) return;

    setIsExporting(true);
    try {
      const doctorName = user?.user_metadata?.name || (user?.email ? user.email.split("@")[0] : null);
      const documentNumber = `CL-NUT/${new Date().getFullYear()}/${(patient.mrn || "").replace(/[^0-9A-Z]/g, "").slice(-6) || "—"}`;
      const fileName = `laporan-nutrisi-${(patient.name || "pasien").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

      await exportClinicalReportPdf(node, {
        documentNumber,
        patientName: patient.name,
        patientMrn: patient.mrn,
        doctorName,
        fileName,
      });
    } catch (e) {
      console.error("[export-pdf] failed:", e);
      toast.error("Gagal membuat PDF. Coba lagi, atau gunakan tombol Cetak.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Laporan Nutrisi Klinis"
        subtitle="Laporan profesional siap cetak / PDF untuk arsip rekam medis — terisi otomatis dari seluruh modul CareLivia"
        icon={FileText}
        actions={
          selectedPatientId && patient ? (
            <div className="no-print flex items-center gap-2">
              <Button onClick={handlePrint} size="sm" variant="outline">
                <Printer className="mr-2 h-4 w-4" /> Cetak
              </Button>
              <Button onClick={handleDownloadPdf} size="sm" disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isExporting ? "Membuat PDF..." : "Unduh PDF"}
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Patient selector — no-print */}
      <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Pasien:</span>
        </div>
        <Select value={selectedPatientId} onValueChange={handleSelectPatient}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Pilih pasien..." />
          </SelectTrigger>
          <SelectContent>
            {(patients || []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} ({p.mrn})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedPatientId ? (
        <EmptyState
          title="Pilih pasien untuk menampilkan laporan"
          description="Laporan nutrisi klinis profesional akan dibuat otomatis dari data pasien terkini — tidak perlu input ulang."
          icon={FileText}
        />
      ) : isLoading ? (
        <LoadingState count={3} />
      ) : !patient ? (
        <EmptyState
          title="Data pasien tidak ditemukan"
          icon={FileText}
        />
      ) : (
        <ClinicalReport patient={patient} />
      )}
    </div>
  );
}

function ClinicalReport({ patient }: { patient: any }) {
  const { user } = useAuth();

  // ---------------------------------------------------------------------
  // SINGLE SOURCE OF TRUTH — pulled live from each module's own hook so
  // the report always mirrors what's currently saved in the app, instead
  // of relying on a stale/incomplete nested `patient` object.
  // ---------------------------------------------------------------------
  const { data: assessments } = useAssessments(patient.id);
  const { data: weightData } = useWeightRecords(patient.id);
  const { data: mealPlanView, isLoading: mealPlanLoading } = useActiveMealPlanView(patient.id);
  const { data: exercisePlans, isLoading: exerciseLoading } = useExercisePlans(patient.id);
  const { data: foodRecords, isLoading: foodRecordsLoading } = useFoodRecords(patient.id);
  const { data: labResults, isLoading: labLoading } = useLabResults(patient.id);
  const { data: bouchardHistory, isLoading: bouchardLoading } = useBouchardAssessments(patient.id);
  const { data: genomicReports, isLoading: genomicReportsLoading } = useGenomicReports(patient.id);

  // Only the most recent ANALYZED report is shown in the clinical report —
  // never diagnoses, never a placeholder if none exists (point #21/#22).
  const latestAnalyzedGenomicReport = React.useMemo(() => {
    if (!genomicReports || genomicReports.length === 0) return null;
    return genomicReports.find((r: any) => r.status === "ANALYZED") || null;
  }, [genomicReports]);
  const { data: genomicDetail, isLoading: genomicDetailLoading } = useGenomicReportDetail(
    latestAnalyzedGenomicReport?.id || null,
  );

  // Latest result per test name, grouped by category — for the report table.
  const latestLabsByCategory = React.useMemo(() => {
    if (!labResults || labResults.length === 0) return {};
    const latestByTest = new Map<string, any>();
    for (const r of labResults) {
      if (!latestByTest.has(r.testName)) latestByTest.set(r.testName, r);
    }
    const grouped: Record<string, any[]> = {};
    for (const r of latestByTest.values()) {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push(r);
    }
    return grouped;
  }, [labResults]);

  const latestMealPlan = mealPlanView?.mealPlan || null;
  const latestExercisePlan = (exercisePlans || [])[0] || null;
  const latestAssessment = (assessments || [])[0] || null;
  const latestBouchard = (bouchardHistory || [])[0] || null;
  const weightSummary = weightData?.summary || null;
  const latestWeightRecord = (weightData?.records || [])[weightData?.records?.length - 1 || 0] || null;

  const { data: shoppingData, isError: shoppingError } = useShoppingList(latestMealPlan?.id);

  const age = calcAge(patient.birthDate);
  const height = patient.height ?? null;
  const weight = patient.weight ?? null;
  const bmi =
    height && weight ? weight / Math.pow(height / 100, 2) : null;
  const bmiInfo = bmi != null ? classifyBMI(bmi) : null;
  const bbi =
    height != null ? idealBodyWeight(height, patient.gender) : null;

  const activeDiagnoses = (patient.diagnoses || [])
    .map((raw: any, i: number) => (typeof raw === "string" ? { id: `${raw}-${i}`, type: raw, active: true } : raw))
    .filter((d: any) => d.active !== false && d.type);

  // Meal items grouped by slot
  const itemsBySlot: Record<string, any[]> = {};
  (latestMealPlan?.items || []).forEach((item: any) => {
    if (!itemsBySlot[item.slot]) itemsBySlot[item.slot] = [];
    itemsBySlot[item.slot].push(item);
  });

  // Meal plan totals — prefer the persisted total_* columns, fall back to
  // summing items client-side if a plan was saved before those existed.
  const mealTotals = React.useMemo(() => {
    if (!latestMealPlan) return null;
    const items = latestMealPlan.items || [];
    const fallback = items.reduce(
      (acc: any, i: any) => ({
        cal: acc.cal + (i.cal || 0),
        protein: acc.protein + (i.protein || 0),
        fat: acc.fat + (i.fat || 0),
        carb: acc.carb + (i.carb || 0),
        fiber: acc.fiber + (i.fiber || 0),
        sodium: acc.sodium + (i.sodium || 0),
      }),
      { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0 },
    );
    return {
      cal: latestMealPlan.totalCal ?? fallback.cal,
      protein: latestMealPlan.totalProtein ?? fallback.protein,
      fat: latestMealPlan.totalFat ?? fallback.fat,
      carb: latestMealPlan.totalCarb ?? fallback.carb,
      fiber: latestMealPlan.totalFiber ?? fallback.fiber,
      sodium: latestMealPlan.totalSodium ?? fallback.sodium,
    };
  }, [latestMealPlan]);

  // Catatan Asupan — group food records by date, use the most recent day
  // tracked as the day compared against the active Meal Plan target.
  const latestIntakeDay = React.useMemo(() => {
    if (!foodRecords || foodRecords.length === 0) return null;
    const byDate: Record<string, any[]> = {};
    for (const r of foodRecords) {
      const key = new Date(r.date).toDateString();
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(r);
    }
    const dates = Object.keys(byDate).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );
    if (dates.length === 0) return null;
    const items = byDate[dates[0]];
    const totals = items.reduce(
      (acc: any, i: any) => ({
        cal: acc.cal + (i.cal || 0),
        protein: acc.protein + (i.protein || 0),
        fat: acc.fat + (i.fat || 0),
        carb: acc.carb + (i.carb || 0),
      }),
      { cal: 0, protein: 0, fat: 0, carb: 0 },
    );
    return { date: items[0].date, items, totals };
  }, [foodRecords]);

  // Data completeness — informational only, never blocks the report from
  // rendering, per point 3 of the refactor spec.
  const missingItems: string[] = [];
  if (!height || !weight) missingItems.push("Antropometri (tinggi/berat badan)");
  if (activeDiagnoses.length === 0) missingItems.push("Diagnosis aktif");
  if (!mealPlanLoading && !latestMealPlan) missingItems.push("Meal Plan Aktif");
  if (!exerciseLoading && !latestExercisePlan) missingItems.push("Rencana Latihan");
  if (!latestAssessment) missingItems.push("Asesmen Gizi & Fungsional");
  if (!labLoading && Object.keys(latestLabsByCategory).length === 0) missingItems.push("Hasil Laboratorium");
  // Informational only — Bouchard & Nutrigenomic are NEVER mandatory and
  // never block report generation (point #26 of the integration spec).
  if (!bouchardLoading && !latestBouchard) missingItems.push("Bouchard Activity Record (opsional)");
  if (!genomicReportsLoading && !latestAnalyzedGenomicReport) missingItems.push("Nutrigenomic AI (opsional)");

  const doctorName = user?.user_metadata?.name || (user?.email ? user.email.split("@")[0] : null);

  return (
    <div>
      {/* Completeness notice — no-print, purely informational for the clinician */}
      {missingItems.length > 0 && (
        <div className="no-print mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Beberapa data belum lengkap untuk pasien ini:</p>
            <p className="mt-0.5">{missingItems.join(" · ")}</p>
            <p className="mt-0.5 text-amber-700/80 dark:text-amber-400/70">
              Laporan tetap dapat dicetak — bagian terkait akan menampilkan &quot;Belum tersedia&quot;.
            </p>
          </div>
        </div>
      )}

      <div className="cl-report mx-auto max-w-[820px] rounded-lg border border-border bg-white shadow-sm print:border-0 print:shadow-none dark:bg-card">
        {/* === Header band === */}
        <div className="cl-gradient-primary relative overflow-hidden px-6 py-6 text-primary-foreground print:py-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">CareLivia CNMS</p>
                <p className="text-[11px] uppercase tracking-widest text-primary-foreground/80">
                  Clinical Nutrition Management System
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-primary-foreground/90">
              <p className="font-semibold uppercase tracking-wide">
                LAPORAN NUTRISI KLINIS
              </p>
              <p className="mt-0.5">
                {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p>No. Dok: CL-NUT/{new Date().getFullYear()}/{(patient.mrn || "").replace(/[^0-9A-Z]/g, "").slice(-6) || "—"}</p>
              {doctorName && <p>Dokter Penanggung Jawab: {doctorName}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6 print:px-8 sm:px-8">
          {/* === 1. Patient identification summary === */}
          <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Nama Pasien</p>
                <p className="text-lg font-bold text-foreground">{patient.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">No. Rekam Medis</p>
                <p className="font-mono font-semibold text-foreground">{patient.mrn}</p>
              </div>
            </div>
          </div>

          {/* === 2. Profil Pasien === */}
          <ReportSection title="Profil Pasien" icon={User}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
              <Field label="Nama Lengkap" value={patient.name} />
              <Field label="No. Rekam Medis" value={patient.mrn} mono />
              <Field label="Jenis Kelamin" value={GENDER_LABELS[patient.gender] || patient.gender} />
              <Field label="Usia" value={`${age} tahun`} />
              <Field label="Tanggal Lahir" value={fmtDate(patient.birthDate)} />
              <Field label="No. Telepon" value={patient.phone || "—"} />
              <Field label="Agama" value={RELIGION_LABELS[patient.religion] || patient.religion || "—"} />
              <Field label="Gol. Darah" value={patient.bloodType || "—"} />
              <Field label="Alergi" value={patient.allergy || "Tidak ada"} />
              <div className="col-span-2 sm:col-span-3">
                <Field label="Alamat" value={patient.address || "—"} />
              </div>
            </div>
          </ReportSection>

          {/* === 3. Antropometri === */}
          <ReportSection title="Antropometri" icon={Activity}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Tinggi Badan" value={height ? `${height} cm` : "Belum tersedia"} />
              <Metric label="Berat Badan" value={weight ? `${weight} kg` : "Belum tersedia"} />
              <Metric
                label="BMI"
                value={bmi ? (Math.round(bmi * 10) / 10).toString() : "Belum tersedia"}
                hint={bmiInfo ? bmiInfo.label : undefined}
              />
              <Metric
                label="BBI (Ideal)"
                value={bbi ? `${Math.round(bbi * 10) / 10} kg` : "Belum tersedia"}
                hint="Broca-Indonesia"
              />
            </div>
            {weightSummary && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric
                  label="Perubahan BB"
                  value={
                    weightSummary.totalChange != null
                      ? `${weightSummary.totalChange > 0 ? "+" : ""}${weightSummary.totalChange} kg`
                      : "—"
                  }
                  hint={weightSummary.totalPct != null ? `${weightSummary.totalPct}%` : undefined}
                />
                <Metric
                  label="% Berat Ideal"
                  value={bbi && weight ? `${Math.round((weight / bbi) * 1000) / 10}%` : "—"}
                />
                <Metric
                  label="Tanggal Pengukuran Terakhir"
                  value={latestWeightRecord ? fmtDate(latestWeightRecord.date) : "—"}
                />
              </div>
            )}
            {bmiInfo && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Kategori BMI:</span>
                <Badge
                  variant="outline"
                  className="text-[10px]"
                  style={{
                    borderColor: bmiInfo.color,
                    color: bmiInfo.color,
                  }}
                >
                  {bmiInfo.label} ({bmiInfo.category})
                </Badge>
                {patient.isPregnant && (
                  <span className="text-muted-foreground">
                    · Hamil, trimester {patient.pregnancyTrimester ?? "—"}
                  </span>
                )}
                {patient.isLactating && (
                  <span className="text-muted-foreground">
                    · Menyusui, bulan ke-{patient.lactationMonth ?? "—"}
                  </span>
                )}
              </div>
            )}
          </ReportSection>

          {/* === 4. Diagnosis === */}
          <ReportSection title="Diagnosis Aktif" icon={Stethoscope}>
            {activeDiagnoses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum tersedia — tidak ada diagnosis aktif tercatat untuk pasien ini.</p>
            ) : (
              <div className="space-y-2">
                {activeDiagnoses.map((d: any) => {
                  const adj = DIAGNOSIS_ADJUSTMENTS[d.type as DiagnosisType];
                  return (
                    <div
                      key={d.id}
                      className="rounded-md border border-border/60 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {adj?.label || d.type}
                          </p>
                          {(d.notes || adj?.notes) && (
                            <p className="text-[11px] text-muted-foreground">{d.notes || adj?.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(d.icd || adj?.icd) && (
                            <Badge variant="outline" className="text-[10px]">
                              ICD {d.icd || adj?.icd}
                            </Badge>
                          )}
                          {d.status && (
                            <Badge variant="outline" className="text-[10px]">
                              {d.status}
                            </Badge>
                          )}
                          {d.priority && (
                            <Badge variant="outline" className="text-[10px]">
                              Prioritas {d.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {(d.target || d.doctor) && (
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                          {d.target && <span><b>Target terapi:</b> {d.target}</span>}
                          {d.doctor && <span><b>Dokter:</b> {d.doctor}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ReportSection>

          {/* === 4b. Laboratorium === */}
          <ReportSection title="Hasil Laboratorium" icon={FlaskConical}>
            {labLoading ? (
              <p className="text-sm text-muted-foreground">Memuat hasil laboratorium…</p>
            ) : Object.keys(latestLabsByCategory).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum tersedia — belum ada hasil laboratorium tercatat untuk pasien ini.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(latestLabsByCategory).map(([category, tests]) => (
                  <div key={category}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {LAB_CATEGORY_LABELS[category as LabCategory] || category}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border/30">
                          {tests.map((t: any) => {
                            const s = LAB_STATUS_LABELS[t.status] || LAB_STATUS_LABELS.NORMAL;
                            return (
                              <tr key={t.id}>
                                <td className="py-1 pr-2 text-foreground">{t.testName}</td>
                                <td className="px-2 text-right tabular-nums font-semibold">
                                  {t.value} {t.unit}
                                </td>
                                <td className="px-2 text-xs text-muted-foreground">
                                  Normal: {t.referenceMin ?? "—"}–{t.referenceMax ?? "—"}
                                </td>
                                <td className={`px-2 text-xs font-medium ${s.className}`}>{s.emoji} {s.label}</td>
                                <td className="pl-2 text-right text-[11px] text-muted-foreground">
                                  {fmtDate(t.labDate)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[10px] text-muted-foreground">
              Tanda vital berkala (tekanan darah, nadi, suhu, saturasi) belum memiliki modul input pada CareLivia.
            </p>
          </ReportSection>

          {/* === 4c. Asesmen Gizi & Fungsional === */}
          {latestAssessment && (
            <ReportSection title="Asesmen Gizi & Fungsional" icon={ClipboardCheck}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {latestAssessment.must && (
                  <AssessmentScoreCard
                    label="MUST"
                    score={latestAssessment.mustScore != null ? String(latestAssessment.mustScore) : "—"}
                    category={latestAssessment.must === "LOW" ? "Risiko Rendah" : latestAssessment.must === "MEDIUM" ? "Risiko Sedang" : "Risiko Tinggi"}
                    color={latestAssessment.must === "LOW" ? "emerald" : latestAssessment.must === "MEDIUM" ? "amber" : "rose"}
                  />
                )}
                {latestAssessment.sga && (
                  <AssessmentScoreCard
                    label="SGA"
                    score={latestAssessment.sga}
                    category={latestAssessment.sga === "A" ? "Gizi Baik" : latestAssessment.sga === "B" ? "Sedang" : "Berat"}
                    color={latestAssessment.sga === "A" ? "emerald" : latestAssessment.sga === "B" ? "amber" : "rose"}
                  />
                )}
                {latestAssessment.nrs2002 && (
                  <AssessmentScoreCard
                    label="NRS-2002"
                    score={latestAssessment.nrsScore != null ? String(latestAssessment.nrsScore) : "—"}
                    category={latestAssessment.nrs2002 === "AT_RISK" ? "Berisiko" : "Tidak Berisiko"}
                    color={latestAssessment.nrs2002 === "AT_RISK" ? "rose" : "emerald"}
                  />
                )}
                {latestAssessment.mna && (
                  <AssessmentScoreCard
                    label="MNA"
                    score={latestAssessment.mnaScore != null ? String(latestAssessment.mnaScore) : "—"}
                    category={latestAssessment.mna === "NORMAL" ? "Normal" : latestAssessment.mna === "AT_RISK" ? "Berisiko" : "Malnutrisi"}
                    color={latestAssessment.mna === "NORMAL" ? "emerald" : latestAssessment.mna === "AT_RISK" ? "amber" : "rose"}
                  />
                )}
                {latestAssessment.ecog != null && (
                  <AssessmentScoreCard
                    label="ECOG"
                    score={latestAssessment.ecog}
                    category={latestAssessment.ecog === "0" ? "Aktif" : latestAssessment.ecog === "1" ? "Ringan" : latestAssessment.ecog === "2" ? "Bisa Jalan" : latestAssessment.ecog === "3" ? "Bedrest >50%" : "Bedrest Total"}
                    color={Number(latestAssessment.ecog) <= 1 ? "emerald" : Number(latestAssessment.ecog) <= 2 ? "amber" : "rose"}
                  />
                )}
                {latestAssessment.barthel != null && (
                  <AssessmentScoreCard
                    label="Barthel"
                    score={String(latestAssessment.barthel)}
                    category={latestAssessment.barthel >= 95 ? "Mandiri" : latestAssessment.barthel >= 60 ? "Bantuan Minimal" : latestAssessment.barthel >= 40 ? "Bantuan Sedang" : "Ketergantungan"}
                    color={latestAssessment.barthel >= 60 ? "emerald" : latestAssessment.barthel >= 40 ? "amber" : "rose"}
                  />
                )}
                {latestAssessment.frailty && (
                  <AssessmentScoreCard
                    label="FRAIL"
                    score={latestAssessment.frailtyScore != null ? String(latestAssessment.frailtyScore) : "—"}
                    category={latestAssessment.frailty === "ROBUST" ? "Robust" : latestAssessment.frailty === "PREFRAIL" ? "Prefrail" : "Frail"}
                    color={latestAssessment.frailty === "ROBUST" ? "emerald" : latestAssessment.frailty === "PREFRAIL" ? "amber" : "rose"}
                  />
                )}
                {latestAssessment.fallRisk && (
                  <AssessmentScoreCard
                    label="Fall Risk"
                    score={latestAssessment.fallRisk}
                    category={latestAssessment.fallRisk === "LOW" ? "Rendah" : latestAssessment.fallRisk === "MODERATE" ? "Sedang" : "Tinggi"}
                    color={latestAssessment.fallRisk === "LOW" ? "emerald" : latestAssessment.fallRisk === "MODERATE" ? "amber" : "rose"}
                  />
                )}
                {latestAssessment.handGrip != null && (
                  <AssessmentScoreCard
                    label="Hand Grip"
                    score={`${latestAssessment.handGrip} kg`}
                    category={latestAssessment.handGrip < 27 ? "Risiko Sarcopenia" : "Normal"}
                    color={latestAssessment.handGrip < 27 ? "amber" : "emerald"}
                  />
                )}
                {latestAssessment.calfCirc != null && (
                  <AssessmentScoreCard
                    label="Calf Circ."
                    score={`${latestAssessment.calfCirc} cm`}
                    category={latestAssessment.calfCirc < 31 ? "Risiko Sarcopenia" : "Normal"}
                    color={latestAssessment.calfCirc < 31 ? "amber" : "emerald"}
                  />
                )}
              </div>
              {(latestAssessment.activity || latestAssessment.stress) && (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {latestAssessment.activity && (
                    <span className="rounded-md border border-border bg-muted/30 px-2 py-1">
                      <strong>Aktivitas:</strong> {latestAssessment.activity.replace("_", " ")}
                    </span>
                  )}
                  {latestAssessment.stress && latestAssessment.stress !== "NONE" && (
                    <span className="rounded-md border border-border bg-muted/30 px-2 py-1">
                      <strong>Stress:</strong> {latestAssessment.stress}
                    </span>
                  )}
                  {latestAssessment.notes && (
                    <span className="rounded-md border border-border bg-muted/30 px-2 py-1">
                      <strong>Catatan:</strong> {latestAssessment.notes}
                    </span>
                  )}
                </div>
              )}
              <p className="mt-2 text-[10px] text-muted-foreground">
                Tanggal asesmen: {fmtDate(latestAssessment.recordedAt)}
              </p>
            </ReportSection>
          )}

          {/* === 5. Target Gizi === */}
          {latestMealPlan ? (
            <ReportSection title="Target Gizi" icon={Target}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <NutrientCard label="Kalori" value={Math.round(latestMealPlan.targetCal)} unit="kcal" icon={Activity} />
                <NutrientCard label="Protein" value={Math.round(latestMealPlan.targetProtein)} unit="g" icon={Beef} />
                <NutrientCard label="Lemak" value={Math.round(latestMealPlan.targetFat)} unit="g" icon={Droplet} />
                <NutrientCard label="Karbohidrat" value={Math.round(latestMealPlan.targetCarb)} unit="g" icon={Wheat} />
                <NutrientCard label="Serat" value={Math.round(latestMealPlan.targetFiber)} unit="g" icon={Leaf} />
                <NutrientCard label="Natrium" value={Math.round(latestMealPlan.targetSodium)} unit="mg" icon={Leaf} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Meal plan aktif: {fmtDate(latestMealPlan.date)} · Status {latestMealPlan.status}
              </p>
            </ReportSection>
          ) : (
            <ReportSection title="Target Gizi" icon={Target}>
              <p className="text-sm text-muted-foreground">
                {mealPlanLoading ? "Memuat data meal plan…" : "Belum tersedia — belum ada Meal Plan Aktif untuk pasien ini."}
              </p>
            </ReportSection>
          )}

          {/* === 6. Rencana Makan (Isi Piringku AI) === */}
          {latestMealPlan && (
            <ReportSection
              title="Rencana Makan — Hasil AI Isi Piringku"
              icon={Utensils}
              subtitle={`${(latestMealPlan.items || []).length} item · Compliance ${Math.round(latestMealPlan.compliance || 0)}%`}
            >
              <div className="space-y-3">
                {SLOT_ORDER.map((slot) => {
                  const items = itemsBySlot[slot] || [];
                  if (items.length === 0) return null;
                  const slotCal = items.reduce((s, i) => s + i.cal, 0);
                  return (
                    <div key={slot} className="rounded-md border border-border/50">
                      <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-3 py-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          {SLOT_LABELS[slot]}
                        </span>
                        <span className="text-xs font-bold text-primary">
                          {Math.round(slotCal)} kcal
                        </span>
                      </div>
                      <div className="divide-y divide-border/30">
                        {items.map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 px-3 py-1.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-foreground">{item.food?.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {item.amount}g{item.food?.urt ? ` · URT ${item.food.urt}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
                              <span>P {Math.round(item.protein)}g</span>
                              <span className="font-semibold text-primary">
                                {Math.round(item.cal)} kcal
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ReportSection>
          )}

          {/* === 7. Validasi Kecukupan Gizi === */}
          {latestMealPlan && mealTotals && (
            <ReportSection title="Validasi Kecukupan Gizi" icon={ClipboardList}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-2">Zat Gizi</th>
                      <th className="px-2 text-right">Target</th>
                      <th className="px-2 text-right">Rencana Makan</th>
                      <th className="px-2 text-right">%</th>
                      <th className="pl-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {[
                      { label: "Energi", unit: "kcal", target: latestMealPlan.targetCal, actual: mealTotals.cal },
                      { label: "Protein", unit: "g", target: latestMealPlan.targetProtein, actual: mealTotals.protein },
                      { label: "Lemak", unit: "g", target: latestMealPlan.targetFat, actual: mealTotals.fat },
                      { label: "Karbohidrat", unit: "g", target: latestMealPlan.targetCarb, actual: mealTotals.carb },
                      { label: "Serat", unit: "g", target: latestMealPlan.targetFiber, actual: mealTotals.fiber },
                      { label: "Natrium", unit: "mg", target: latestMealPlan.targetSodium, actual: mealTotals.sodium },
                    ].map((row) => {
                      const pct = row.target ? Math.round((row.actual / row.target) * 1000) / 10 : 0;
                      const status = nutrientStatus(pct);
                      return (
                        <tr key={row.label}>
                          <td className="py-1.5 pr-2 font-medium text-foreground">{row.label}</td>
                          <td className="px-2 text-right tabular-nums text-muted-foreground">
                            {Math.round(row.target || 0)} {row.unit}
                          </td>
                          <td className="px-2 text-right tabular-nums text-foreground">
                            {Math.round(row.actual)} {row.unit}
                          </td>
                          <td className="px-2 text-right tabular-nums font-semibold">{pct}%</td>
                          <td className={`pl-2 text-right text-[11px] font-medium ${status.className}`}>
                            {status.dot} {status.label}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ReportSection>
          )}

          {/* === 8. Catatan Asupan (Food Record) — kepatuhan vs Meal Plan === */}
          <ReportSection
            title="Catatan Asupan"
            icon={ClipboardList}
            subtitle={latestIntakeDay ? `Tercatat ${fmtDate(latestIntakeDay.date)}` : undefined}
          >
            {foodRecordsLoading ? (
              <p className="text-sm text-muted-foreground">Memuat catatan asupan…</p>
            ) : !latestIntakeDay ? (
              <p className="text-sm text-muted-foreground">Belum tersedia — belum ada catatan asupan (food record) untuk pasien ini.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="Asupan Energi" value={`${Math.round(latestIntakeDay.totals.cal)} kcal`} />
                  <Metric label="Asupan Protein" value={`${Math.round(latestIntakeDay.totals.protein)} g`} />
                  {latestMealPlan && (
                    <Metric
                      label="Kepatuhan vs Target"
                      value={`${Math.round((latestIntakeDay.totals.cal / (latestMealPlan.targetCal || 1)) * 100)}%`}
                      hint="Energi aktual / target"
                    />
                  )}
                  <Metric label="Jumlah Item Tercatat" value={String(latestIntakeDay.items.length)} />
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-1.5 pr-2">Waktu Makan</th>
                        <th className="px-2">Makanan</th>
                        <th className="px-2 text-right">Jumlah</th>
                        <th className="pl-2 text-right">Kalori</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {latestIntakeDay.items.map((r: any) => (
                        <tr key={r.id}>
                          <td className="py-1.5 pr-2 text-xs text-muted-foreground">
                            {SLOT_LABELS[r.slot as MealSlot] || r.slot}
                          </td>
                          <td className="px-2 text-foreground">{r.food?.name || "—"}</td>
                          <td className="px-2 text-right tabular-nums text-muted-foreground">{r.amount}g</td>
                          <td className="pl-2 text-right tabular-nums font-semibold text-primary">
                            {Math.round(r.cal)} kcal
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </ReportSection>

          {/* === 9. Rencana Latihan === */}
          {exerciseLoading ? (
            <ReportSection title="Rencana Latihan" icon={Dumbbell}>
              <p className="text-sm text-muted-foreground">Memuat rencana latihan…</p>
            </ReportSection>
          ) : latestExercisePlan ? (
            <ReportSection
              title="Rencana Latihan"
              icon={Dumbbell}
              subtitle={`Target ${Math.round(latestExercisePlan.targetBurned)} kcal · Aktual ${Math.round(latestExercisePlan.totalBurned)} kcal`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-2">Latihan</th>
                      <th className="px-2">Tipe</th>
                      <th className="px-2">Intensitas</th>
                      <th className="px-2 text-right">Durasi</th>
                      <th className="px-2 text-right">Kalori</th>
                      <th className="pl-2 text-right">MET</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {(latestExercisePlan.items || []).map((item: any) => (
                      <tr key={item.id}>
                        <td className="py-1.5 pr-2 font-medium text-foreground">{item.name}</td>
                        <td className="px-2 text-xs text-muted-foreground">
                          {EXERCISE_TYPE_LABELS[item.type as ExerciseType] || item.type}
                        </td>
                        <td className="px-2 text-xs text-muted-foreground">
                          {INTENSITY_LABELS[item.intensity as ExerciseIntensity] || item.intensity}
                        </td>
                        <td className="px-2 text-right tabular-nums">{item.duration} min</td>
                        <td className="px-2 text-right font-semibold tabular-nums text-primary">
                          {Math.round(item.caloriesBurned)} kcal
                        </td>
                        <td className="pl-2 text-right tabular-nums text-muted-foreground">
                          {item.met.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {latestExercisePlan.notes && (
                <p className="mt-2 rounded-md bg-muted/30 p-2 text-[11px] text-muted-foreground">
                  <b>Catatan:</b> {latestExercisePlan.notes}
                </p>
              )}
            </ReportSection>
          ) : (
            <ReportSection title="Rencana Latihan" icon={Dumbbell}>
              <p className="text-sm text-muted-foreground">Belum tersedia — belum ada rencana latihan tersusun untuk pasien ini.</p>
            </ReportSection>
          )}

          {/* === 10. Bouchard Activity Record — hanya ditampilkan bila tersedia === */}
          {bouchardLoading ? (
            <ReportSection title="Bouchard Activity Record" icon={Footprints}>
              <p className="text-sm text-muted-foreground">Memuat Bouchard Activity Record…</p>
            </ReportSection>
          ) : !latestBouchard ? (
            <ReportSection title="Bouchard Activity Record" icon={Footprints}>
              <p className="text-sm text-muted-foreground">Belum tersedia.</p>
            </ReportSection>
          ) : (
            <ReportSection
              title="Bouchard Activity Record"
              icon={Footprints}
              subtitle={`Tanggal ${new Date(latestBouchard.assessmentDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Energy Expenditure" value={`${Math.round(latestBouchard.avgEnergyExpenditure)} kcal/hari`} />
                <Metric label="MET" value={String(latestBouchard.avgMet)} />
                <Metric label="PAL" value={String(latestBouchard.avgPal)} />
                <Metric label="Kategori" value={latestBouchard.palCategory || "—"} />
              </div>

              {/* Distribusi aktivitas */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-2">Aktivitas</th>
                      <th className="px-2 text-right">Menit/hari</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {Object.entries(BUCKET_LABELS).map(([bucket, label]) => (
                      <tr key={bucket}>
                        <td className="py-1.5 pr-2 text-foreground">{label}</td>
                        <td className="px-2 text-right tabular-nums font-medium text-primary">
                          {Math.round((latestBouchard.minutesByBucket?.[bucket as BouchardCategory["bucket"]] ?? 0))} menit
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Status WHO */}
              <div className="mt-3 rounded-md bg-muted/30 p-3 text-xs">
                <p>
                  <b>Aktivitas aerobik setara moderat:</b>{" "}
                  {latestBouchard.whoStatus?.moderateVigorousMinutesPerWeek ?? 0} menit/minggu
                </p>
                {latestBouchard.whoStatus?.message && (
                  <p className="mt-1 text-muted-foreground">{latestBouchard.whoStatus.message}</p>
                )}
              </div>

              {/* Resume Analisis AI Bouchard — tidak pernah di-generate otomatis saat laporan dibuka */}
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Resume Analisis AI Bouchard
                </p>
                {latestBouchard.aiSummary ? (
                  <div className="space-y-2 rounded-md border border-border/60 p-3 text-xs leading-relaxed">
                    <p className="text-foreground">{latestBouchard.aiSummary}</p>
                    {latestBouchard.aiFindings?.length > 0 && (
                      <div>
                        <p className="font-medium text-foreground">Temuan:</p>
                        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                          {latestBouchard.aiFindings.map((f: string, i: number) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {latestBouchard.aiRecommendations?.length > 0 && (
                      <div>
                        <p className="font-medium text-foreground">Rekomendasi:</p>
                        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                          {latestBouchard.aiRecommendations.map((r: string, i: number) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {latestBouchard.aiRiskLevel && (
                      <p>
                        <b>Risiko:</b> {latestBouchard.aiRiskLevel}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Interpretasi AI Bouchard belum tersedia.</p>
                )}
              </div>
            </ReportSection>
          )}

          {/* === 11. Resume Nutrigenomic AI — hanya bila status ANALYZED tersedia === */}
          {genomicReportsLoading || (latestAnalyzedGenomicReport && genomicDetailLoading) ? (
            <ReportSection title="Resume Nutrigenomic AI" icon={Dna}>
              <p className="text-sm text-muted-foreground">Memuat Nutrigenomic AI…</p>
            </ReportSection>
          ) : !latestAnalyzedGenomicReport || !genomicDetail?.interpretation ? (
            <ReportSection title="Resume Nutrigenomic AI" icon={Dna}>
              <p className="text-sm text-muted-foreground">Belum tersedia.</p>
            </ReportSection>
          ) : (
            <ReportSection
              title="Resume Nutrigenomic AI"
              icon={Dna}
              subtitle={
                latestAnalyzedGenomicReport.examDate
                  ? `Pemeriksaan ${new Date(latestAnalyzedGenomicReport.examDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
                  : undefined
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Laboratorium" value={latestAnalyzedGenomicReport.laboratoryName || "—"} />
                <Metric label="Jumlah Gen" value={String(latestAnalyzedGenomicReport.totalGenes ?? genomicDetail.findings.length ?? 0)} />
                <Metric label="Jumlah SNP" value={String(latestAnalyzedGenomicReport.totalSnps ?? 0)} />
              </div>

              {genomicDetail.interpretation.summary && (
                <p className="mt-3 text-sm leading-relaxed text-foreground">{genomicDetail.interpretation.summary}</p>
              )}

              {genomicDetail.interpretation.riskSummary && Object.keys(genomicDetail.interpretation.riskSummary).length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ringkasan Risiko</p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {Object.entries(genomicDetail.interpretation.riskSummary)
                      .filter(([k, v]) => k !== "exercisePerformance" && v)
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between rounded-md border border-border/50 px-2 py-1 text-xs">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-medium text-foreground">{String(v)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {genomicDetail.interpretation.clinicalImplications?.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Implikasi Klinis</p>
                  <ul className="space-y-1 text-xs">
                    {genomicDetail.interpretation.clinicalImplications.map((c: any, i: number) => (
                      <li key={i} className="rounded-md border border-border/40 p-2">
                        <span className="font-medium">{c.relatedDiagnosis}</span>
                        {c.relatedGene && <span className="text-muted-foreground"> × {c.relatedGene}</span>}
                        <p className="mt-0.5 text-muted-foreground">{c.implication}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {genomicDetail.interpretation.nutritionImplications && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Implikasi Nutrisi</p>
                  <div className="grid gap-2 sm:grid-cols-2 text-xs">
                    {Object.entries({
                      Makronutrien: genomicDetail.interpretation.nutritionImplications.macronutrients,
                      Mikronutrien: genomicDetail.interpretation.nutritionImplications.micronutrients,
                      Antioksidan: genomicDetail.interpretation.nutritionImplications.antioxidants,
                      Fitonutrien: genomicDetail.interpretation.nutritionImplications.phytonutrients,
                      Serat: genomicDetail.interpretation.nutritionImplications.fiber,
                    })
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k}>
                          <p className="font-medium text-foreground">{k}</p>
                          <p className="mt-0.5 text-muted-foreground">{v as string}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {genomicDetail.interpretation.recommendedFoods?.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Makanan yang Direkomendasikan</p>
                  <div className="flex flex-wrap gap-1.5">
                    {genomicDetail.interpretation.recommendedFoods.map((f: string, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-emerald-500/10 text-[11px] text-emerald-700 dark:text-emerald-400">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {genomicDetail.interpretation.restrictedFoods?.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Makanan yang Perlu Dibatasi</p>
                  <div className="flex flex-wrap gap-1.5">
                    {genomicDetail.interpretation.restrictedFoods.map((f: string, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-rose-500/10 text-[11px] text-rose-700 dark:text-rose-400">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {genomicDetail.interpretation.interventionPriorities?.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prioritas Intervensi</p>
                  <ol className="list-decimal space-y-1 pl-4 text-xs">
                    {genomicDetail.interpretation.interventionPriorities.map((p: string, i: number) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ol>
                </div>
              )}

              {genomicDetail.interpretation.supplementation?.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Suplementasi</p>
                  <div className="space-y-1.5 text-xs">
                    {genomicDetail.interpretation.supplementation.map((s: any, i: number) => (
                      <div key={i} className="rounded-md border border-border/40 p-2">
                        <span className="font-medium">{s.supplement}</span>
                        {s.reasoning && <p className="mt-0.5 text-muted-foreground">{s.reasoning}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {genomicDetail.interpretation.exerciseRecommendations?.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rekomendasi Latihan</p>
                  <div className="space-y-1.5 text-xs">
                    {genomicDetail.interpretation.exerciseRecommendations.map((e: any, i: number) => (
                      <div key={i} className="rounded-md border border-border/40 p-2">
                        <p className="font-medium">{e.recommendation}</p>
                        {e.reasoning && <p className="mt-0.5 text-muted-foreground">{e.reasoning}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {genomicDetail.interpretation.monitoringPlan?.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Monitoring</p>
                  <div className="space-y-1 text-xs">
                    {genomicDetail.interpretation.monitoringPlan.map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between border-b border-border/30 pb-1 last:border-0">
                        <span>{m.parameter}</span>
                        <span className="text-muted-foreground">
                          {m.intervalMonths ? `tiap ${m.intervalMonths} bulan` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-3 rounded-md bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                Interpretasi nutrigenomik merupakan informasi pendukung berbasis hasil pemeriksaan genetik dan bukti
                yang tersedia, bukan diagnosis penyakit dan tidak menggantikan penilaian klinis dokter.
              </p>
            </ReportSection>
          )}

          {/* === 12. Shopping Planner === */}
          <ReportSection title="Shopping Planner" icon={ShoppingCart}>
            {!latestMealPlan ? (
              <p className="text-sm text-muted-foreground">Belum tersedia — memerlukan Meal Plan Aktif terlebih dahulu.</p>
            ) : shoppingError || !shoppingData?.shoppingList ? (
              <p className="text-sm text-muted-foreground">Belum tersedia — daftar belanja belum dibuat untuk meal plan aktif ini.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Metric
                    label="Periode"
                    value={
                      shoppingData.shoppingList.period === "WEEKLY"
                        ? "Mingguan"
                        : shoppingData.shoppingList.period === "MONTHLY"
                          ? "Bulanan"
                          : "Harian"
                    }
                  />
                  <Metric label="Jumlah Bahan" value={String(shoppingData.shoppingList.items?.length || 0)} />
                  <Metric
                    label="Total Estimasi Biaya"
                    value={`Rp ${Math.round(shoppingData.totalEstimate || 0).toLocaleString("id-ID")}`}
                  />
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-1.5 pr-2">Bahan Makanan</th>
                        <th className="px-2 text-right">Jumlah</th>
                        <th className="pl-2 text-right">Estimasi Biaya</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {(shoppingData.shoppingList.items || []).map((item: any, i: number) => (
                        <tr key={item.foodId || i}>
                          <td className="py-1.5 pr-2 text-foreground">{item.food?.name || "—"}</td>
                          <td className="px-2 text-right tabular-nums text-muted-foreground">
                            {item.amount}{item.unit ? ` ${item.unit}` : "g"}
                          </td>
                          <td className="pl-2 text-right tabular-nums font-semibold text-primary">
                            Rp {Math.round(item.estPrice || 0).toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </ReportSection>

          {/* === 13. AI Evaluation — Clinical Decision Support System === */}
          {/* Covers Rekomendasi Nutrisi, Target Terapi, Monitoring, Edukasi Pasien,
              Risiko/Komplikasi & Kesimpulan AI — reads the persisted evaluation,
              never auto-regenerates on report load. */}
          <ReportSection title="Evaluasi AI CareLivia" icon={Brain}>
            <AIClinicalAssessmentDashboard patientId={patient.id} patientName={patient.name} />
          </ReportSection>

          {/* === 14. Footer — signature + QR === */}
          <div className="mt-8 flex flex-col gap-6 border-t border-border pt-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex gap-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Dokter Penanggung Jawab
                </p>
                <div className="mt-6 border-b border-foreground/60 pb-0.5 text-sm">
                  {doctorName || "__________________________"}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tanggal
                </p>
                <div className="mt-6 border-b border-foreground/60 pb-0.5 text-sm">
                  __________________________
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-md border-2 border-foreground/70">
                <div className="grid grid-cols-5 gap-0.5">
                  {Array.from({ length: 25 }).map((_, i) => {
                    const seed = (i * 7 + 3) % 5;
                    return (
                      <div
                        key={i}
                        className={`h-2 w-2 ${seed % 2 === 0 ? "bg-foreground" : "bg-transparent"}`}
                      />
                    );
                  })}
                </div>
              </div>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                QR Verifikasi
              </p>
            </div>
          </div>

          {/* Report footer note */}
          <div className="border-t border-border/40 pt-3 text-center text-[10px] text-muted-foreground">
            Dokumen ini dihasilkan otomatis oleh CareLivia Clinical Nutrition Management System dari data pasien
            terkini — tidak ada input manual ulang.
            <br />
            Sesuai pedoman PERKENI · ESPEN · ASPEN · KDIGO · WHO · Kemenkes RI.
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportSection({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border/60 pb-4 last:border-b-0 last:pb-0">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex flex-1 flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
            {title}
          </h3>
          {subtitle && (
            <span className="text-[11px] text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-base font-bold text-foreground">{value}</p>
      {hint && (
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function NutrientCard({
  label,
  value,
  unit,
  icon: Icon,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-bold tabular-nums text-foreground">
          {value}
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
            {unit}
          </span>
        </p>
      </div>
    </div>
  );
}

// Assessment Score Card — for clinical report
function AssessmentScoreCard({
  label,
  score,
  category,
  color,
}: {
  label: string;
  score: string;
  category: string;
  color: "emerald" | "amber" | "rose";
}) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
    amber: "border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
    rose: "border-rose-300 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400",
  };
  return (
    <div className={`rounded-md border p-2 ${colorMap[color]}`}>
      <p className="text-[9px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-base font-bold tabular-nums">{score}</p>
      <p className="text-[9px] opacity-80">{category}</p>
    </div>
  );
}
