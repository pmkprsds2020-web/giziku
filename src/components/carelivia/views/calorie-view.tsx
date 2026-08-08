"use client";

import * as React from "react";
import {
  Calculator,
  Zap,
  Beef,
  Wheat,
  Droplet,
  AlertTriangle,
  ClipboardCheck,
  Sparkles,
  User,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/carelivia/ui-helpers";
import { PresetManagerPanel } from "@/components/carelivia/preset-manager";
import {
  useComputeCalorie,
  usePatients,
} from "@/hooks/use-carelivia";
import { useCareLiviaStore } from "@/store/carelivia";
import {
  ACTIVITY_LABELS,
  STRESS_LABELS,
  DIAGNOSIS_ADJUSTMENTS,
} from "@/lib/clinical/constants";
import type {
  ActivityLevel,
  StressLevel,
  DiagnosisType,
  Gender,
} from "@prisma/client";

const ACTIVITY_OPTS = Object.keys(ACTIVITY_LABELS) as ActivityLevel[];
const STRESS_OPTS = Object.keys(STRESS_LABELS) as StressLevel[];
const DIAGNOSIS_OPTS = Object.keys(DIAGNOSIS_ADJUSTMENTS) as DiagnosisType[];

export function CalorieView() {
  const { data: patients } = usePatients();
  const { activePatientId, setActivePatient } = useCareLiviaStore();
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>(
    activePatientId || "",
  );
  const [activePresetId, setActivePresetId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activePatientId && !selectedPatientId) {
      setSelectedPatientId(activePatientId);
    }
  }, [activePatientId, selectedPatientId]);

  const [form, setForm] = React.useState({
    gender: "FEMALE" as Gender,
    ageYears: "56",
    heightCm: "155",
    weightKg: "62",
    activity: "LIGHT" as ActivityLevel,
    stress: "MILD" as StressLevel,
    diagnoses: ["DM", "HT"] as string[],
    isPregnant: false,
    pregnancyTrimester: "1",
    isLactating: false,
  });

  const mut = useComputeCalorie();
  const result = mut.data;

  const compute = () => {
    if (!form.ageYears || !form.heightCm || !form.weightKg) {
      toast.error("Lengkapi usia, tinggi, dan berat badan");
      return;
    }
    mut.mutate({
      gender: form.gender,
      ageYears: Number(form.ageYears),
      heightCm: Number(form.heightCm),
      weightKg: Number(form.weightKg),
      activity: form.activity,
      stress: form.stress,
      diagnoses: form.diagnoses as DiagnosisType[],
      isPregnant: form.isPregnant,
      pregnancyTrimester: Number(form.pregnancyTrimester),
      isLactating: form.isLactating,
    });
  };

  return (
    <div>
      <PageHeader
        title="Kalkulator Kalori CareLivia"
        subtitle="Formula klinis 11-langkah dengan audit trail — bukan Harris-Benedict/Mifflin"
        icon={Calculator}
      />

      {/* Patient selector + Preset Manager */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Pasien:</span>
          </div>
          <Select value={selectedPatientId} onValueChange={(v) => { setSelectedPatientId(v); setActivePatient(v); }}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Pilih pasien (opsional)..." />
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
        {selectedPatientId && (
          <SectionCard
            title="Nutrition Preset Management"
            description="Simpan beberapa konfigurasi gizi (Save 1, 2, 3, dst) untuk dipakai ulang di Meal Plan"
          >
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <PresetManagerPanel
                patientId={selectedPatientId}
                activePresetId={activePresetId}
                onSelectPreset={(p) => {
                  setActivePresetId(p.id);
                  toast.success(`Preset "${p.name}" aktif`);
              }}
              currentResult={result || undefined}
              currentDiagnoses={form.diagnoses as DiagnosisType[]}
            />
            </div>
          </SectionCard>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Input form */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Input Pasien"
            description="Parameter klinis untuk perhitungan"
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Jenis Kelamin</Label>
                  <Select
                    value={form.gender}
                    onValueChange={(v) => setForm({ ...form, gender: v as Gender })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Laki-laki</SelectItem>
                      <SelectItem value="FEMALE">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Usia (tahun)</Label>
                  <Input
                    type="number"
                    value={form.ageYears}
                    onChange={(e) => setForm({ ...form, ageYears: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tinggi (cm)</Label>
                  <Input
                    type="number"
                    value={form.heightCm}
                    onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Berat (kg)</Label>
                  <Input
                    type="number"
                    value={form.weightKg}
                    onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Aktivitas</Label>
                  <Select
                    value={form.activity}
                    onValueChange={(v) => setForm({ ...form, activity: v as ActivityLevel })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_OPTS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {ACTIVITY_LABELS[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stress Klinis</Label>
                  <Select
                    value={form.stress}
                    onValueChange={(v) => setForm({ ...form, stress: v as StressLevel })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STRESS_OPTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STRESS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Diagnosis</Label>
                <ScrollArea className="h-28 rounded-md border border-border p-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {DIAGNOSIS_OPTS.map((d) => (
                      <label key={d} className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                        <Checkbox
                          checked={form.diagnoses.includes(d)}
                          onCheckedChange={(c) =>
                            setForm({
                              ...form,
                              diagnoses: c
                                ? [...form.diagnoses, d]
                                : form.diagnoses.filter((x) => x !== d),
                            })
                          }
                        />
                        <span className="leading-tight">
                          {DIAGNOSIS_ADJUSTMENTS[d].label.split("(")[0].trim()}
                        </span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {form.gender === "FEMALE" && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5">
                  <label className="flex items-center gap-1.5 text-[11px]">
                    <Checkbox
                      checked={form.isPregnant}
                      onCheckedChange={(c) => setForm({ ...form, isPregnant: !!c })}
                    />
                    Hamil
                  </label>
                  {form.isPregnant && (
                    <Select
                      value={form.pregnancyTrimester}
                      onValueChange={(v) => setForm({ ...form, pregnancyTrimester: v })}
                    >
                      <SelectTrigger className="h-7 w-28 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">T1</SelectItem>
                        <SelectItem value="2">T2</SelectItem>
                        <SelectItem value="3">T3</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <label className="flex items-center gap-1.5 text-[11px]">
                    <Checkbox
                      checked={form.isLactating}
                      onCheckedChange={(c) => setForm({ ...form, isLactating: !!c })}
                    />
                    Menyusui
                  </label>
                </div>
              )}

              <Button onClick={compute} disabled={mut.isPending} className="w-full">
                {mut.isPending ? (
                  "Menghitung..."
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Hitung Kalori
                  </>
                )}
              </Button>
            </div>
          </SectionCard>
        </div>

        {/* Result */}
        <div className="lg:col-span-3">
          {!result ? (
            <SectionCard title="Hasil Perhitungan" description="Klik 'Hitung Kalori' untuk memulai">
              <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground">
                <Calculator className="mb-3 h-12 w-12 opacity-30" />
                <p className="text-sm">Audit trail 11-langkah akan muncul di sini</p>
              </div>
            </SectionCard>
          ) : (
            <div className="space-y-4">
              {/* KPI */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Target Kalori"
                  value={result.targetCalorie}
                  unit="kcal"
                  icon={Zap}
                  color="emerald"
                />
                <StatCard
                  label="BMI"
                  value={result.bmi}
                  unit="kg/m²"
                  icon={Calculator}
                  color={result.bmi < 18.5 ? "teal" : result.bmi < 25 ? "emerald" : "rose"}
                  sublabel={result.bmiLabel}
                />
                <StatCard
                  label="BBI"
                  value={result.ibw}
                  unit="kg"
                  icon={Beef}
                  color="violet"
                  sublabel="Berat Badan Ideal"
                />
                <StatCard
                  label="Hidrasi"
                  value={result.waterMl}
                  unit="ml"
                  icon={Droplet}
                  color="teal"
                  sublabel="per hari"
                />
              </div>

              {/* Macros */}
              <SectionCard
                title="Distribusi Makronutrien"
                description={result.primaryDiagnosis?.notes}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <MacroBar
                    label="Protein"
                    grams={result.macros.proteinG}
                    kcal={result.macros.proteinKcal}
                    pct={result.macros.proteinPct}
                    color="bg-rose-500"
                    icon={Beef}
                  />
                  <MacroBar
                    label="Karbohidrat"
                    grams={result.macros.carbG}
                    kcal={result.macros.carbKcal}
                    pct={result.macros.carbPct}
                    color="bg-amber-500"
                    icon={Wheat}
                  />
                  <MacroBar
                    label="Lemak"
                    grams={result.macros.fatG}
                    kcal={result.macros.fatKcal}
                    pct={result.macros.fatPct}
                    color="bg-violet-500"
                    icon={Droplet}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <MicroChip label="Serat" value={`${result.fiberTarget} g`} />
                  <MicroChip label="Natrium max" value={`${result.sodiumMax} mg`} />
                  {result.potassiumMax && (
                    <MicroChip label="Kalium max" value={`${result.potassiumMax} mg`} />
                  )}
                  {result.phosphorusMax && (
                    <MicroChip label="Fosfor max" value={`${result.phosphorusMax} mg`} />
                  )}
                </div>
              </SectionCard>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Perhatian Klinis</AlertTitle>
                  <AlertDescription>
                    <ul className="list-inside list-disc space-y-1 text-xs">
                      {result.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Audit trail */}
              <SectionCard
                title="Audit Trail Formula CareLivia"
                description="11 langkah — dapat diaudit oleh dokter/ahli gizi"
              >
                <div className="max-h-[75vh] overflow-y-auto overflow-x-hidden pr-1 sm:max-h-[70vh] md:max-h-[75vh]">
                  <div className="space-y-2">
                    {result.steps.map((s: any) => (
                      <div
                        key={s.step}
                        className="w-full rounded-lg border border-border/60 bg-muted/20 p-3 transition-all duration-300 ease-in-out hover:border-primary/30"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                            {s.step}
                          </span>
                          <p className="text-sm font-semibold text-foreground">{s.name}</p>
                          <Badge variant="outline" className="ml-auto text-[11px]">
                            {s.output} {s.unit}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">{s.description}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-foreground/80">
                          <span className="rounded bg-primary/10 px-1.5 py-0.5">{s.formula}</span>
                          <span className="text-muted-foreground">←</span>
                          <span className="text-muted-foreground">{s.input}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MacroBar({
  label,
  grams,
  kcal,
  pct,
  color,
  icon: Icon,
}: {
  label: string;
  grams: number;
  kcal: number;
  pct: number;
  color: string;
  icon: any;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </span>
        <span className="text-xs font-bold text-foreground">{pct}%</span>
      </div>
      <div className="mb-1.5 text-lg font-bold cl-stat-num text-foreground">
        {grams}
        <span className="ml-1 text-xs font-normal text-muted-foreground">g</span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">{kcal} kcal</p>
    </div>
  );
}

function MicroChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
