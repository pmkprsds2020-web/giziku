"use client";

import * as React from "react";
import {
  Dumbbell,
  User,
  Flame,
  Timer,
  Activity,
  ListChecks,
  Sparkles,
  StickyNote,
  TrendingUp,
  BookOpenCheck,
  AlertTriangle,
  Target,
  GraduationCap,
  CalendarRange,
  Wind,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
  LoadingState,
} from "@/components/carelivia/ui-helpers";
import {
  usePatients,
  usePatient,
  useGenerateExercise,
  useExercisePlans,
  useAIExercisePlan,
} from "@/hooks/use-carelivia";
import { useCareLiviaStore } from "@/store/carelivia";
import { DIAGNOSIS_ADJUSTMENTS } from "@/lib/clinical/constants";
import { buildMobilityNotes } from "@/lib/clinical/assessment-adjustments";
import type {
  DiagnosisType,
  ExerciseIntensity,
  ExerciseType,
} from "@prisma/client";

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

const INTENSITY_COLORS: Record<ExerciseIntensity, string> = {
  LOW: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  MODERATE:
    "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  HIGH: "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

interface ExerciseItem {
  id: string;
  name: string;
  type: ExerciseType;
  intensity: ExerciseIntensity;
  duration: number;
  caloriesBurned: number;
  met: number;
  notes?: string | null;
  instructions?: string | null;
  setsReps?: string | null;
}

interface ExercisePlanDetails {
  warmup?: string;
  cooldown?: string;
  red_flags?: string[];
  monitoring_targets?: string[];
  patient_education?: string;
  weekly_progression?: string;
  contraindications?: string[];
}

interface ExercisePlan {
  id: string;
  date: string | Date;
  targetBurned: number;
  totalBurned: number;
  notes?: string | null;
  items: ExerciseItem[];
  sourceProgramIds?: string[];
  planDetails?: ExercisePlanDetails;
}

function ageFromBirthDate(birth: string | Date | null | undefined): number {
  if (!birth) return 0;
  const birthDate = typeof birth === "string" ? new Date(birth) : birth;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

function computeBmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number {
  if (!weightKg || !heightCm) return 0;
  return Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10;
}

export function ExerciseView() {
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
  const { data: exercisePlans, isLoading: exerciseLoading } = useExercisePlans(selectedPatientId || null);
  const generateMut = useGenerateExercise();
  const aiGenerateMut = useAIExercisePlan();

  const selectedPatient = patients?.find((p) => p.id === selectedPatientId);
  const latestPlan: ExercisePlan | undefined = Array.isArray(exercisePlans) && exercisePlans.length > 0
    ? exercisePlans[0]
    : undefined;

  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id);
    setActivePatient(id);
  };

  const handleGenerate = async () => {
    if (!selectedPatientId) {
      toast.error("Pilih pasien terlebih dahulu");
      return;
    }
    try {
      await generateMut.mutateAsync({ patientId: selectedPatientId });
      toast.success("Rencana latihan berhasil dibuat");
    } catch (e: any) {
      toast.error(e.message || "Gagal membuat rencana latihan");
    }
  };

  const handleGenerateAI = async () => {
    if (!selectedPatientId || !patient) {
      toast.error("Pilih pasien terlebih dahulu");
      return;
    }
    if (!patient.weight || !patient.height) {
      toast.error("Tinggi & berat badan pasien harus diisi untuk generate dengan AI");
      return;
    }
    const activeDiagnoses = (patient.diagnoses || [])
      .filter((d: any) => d.active !== false)
      .map((d: any) => d.type as string);
    const latestAssessment = (patient.assessments || [])[0];
    const mobilityNotes = latestAssessment ? buildMobilityNotes(latestAssessment) : "";

    try {
      await aiGenerateMut.mutateAsync({
        patientId: selectedPatientId,
        patientName: patient.name,
        ageYears: ageFromBirthDate(patient.birthDate),
        gender: patient.gender,
        bmi: computeBmi(patient.weight, patient.height),
        diagnoses: activeDiagnoses,
        activityLevel: latestAssessment?.activity || "LIGHT",
        mobilityNotes,
      });
      toast.success("Rencana latihan berbasis AI berhasil dibuat");
    } catch (e: any) {
      toast.error(e.message || "Gagal membuat rencana latihan dengan AI");
    }
  };

  return (
    <div>
      <PageHeader
        title="Rencana Latihan (Exercise Plan)"
        subtitle="Personalisasi berdasarkan diagnosis, BMI, ECOG, Barthel & risiko jatuh"
        icon={Dumbbell}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={generateMut.isPending || !selectedPatientId}
            >
              {generateMut.isPending ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-pulse" /> Membuat...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Generate (Rule-Based)
                </>
              )}
            </Button>
            <Button
              onClick={handleGenerateAI}
              disabled={aiGenerateMut.isPending || !selectedPatientId}
            >
              {aiGenerateMut.isPending ? (
                <>
                  <BookOpenCheck className="mr-2 h-4 w-4 animate-pulse" /> AI Membuat...
                </>
              ) : (
                <>
                  <BookOpenCheck className="mr-2 h-4 w-4" /> Generate dengan AI
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Patient selector */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
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
        {selectedPatient && (
          <div className="flex flex-wrap gap-1">
            {Array.isArray(selectedPatient.diagnoses) && selectedPatient.diagnoses.slice(0, 3).map((raw: any, i: number) => {
              const d: string = typeof raw === "string" ? raw : (raw?.type ?? "");
              if (!d) return null;
              return (
                <Badge key={`${d}-${i}`} variant="secondary" className="text-[10px]">
                  {DIAGNOSIS_ADJUSTMENTS[d as DiagnosisType]?.label.split(" ")[0] || d}
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {!selectedPatientId ? (
        <EmptyState
          title="Pilih pasien untuk memulai"
          description="Sistem akan menyusun rencana latihan berbasis MET (Compendium of Physical Activities)."
          icon={Dumbbell}
        />
      ) : isLoading ? (
        <LoadingState count={4} />
      ) : !latestPlan ? (
        <EmptyState
          title="Belum ada rencana latihan"
          description="Gunakan 'Generate dengan AI' untuk rencana yang dipersonalisasi & berbasis pedoman klinis (ACSM/ADA/ESC/dll.), atau 'Rule-Based' untuk perhitungan cepat berbasis tabel MET."
          icon={Sparkles}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={handleGenerate} disabled={generateMut.isPending}>
                <Sparkles className="mr-2 h-4 w-4" /> Rule-Based
              </Button>
              <Button onClick={handleGenerateAI} disabled={aiGenerateMut.isPending}>
                <BookOpenCheck className="mr-2 h-4 w-4" /> Generate dengan AI
              </Button>
            </div>
          }
        />
      ) : (
        <ExercisePlanDetail plan={latestPlan} />
      )}
    </div>
  );
}

function ExercisePlanDetail({ plan }: { plan: ExercisePlan }) {
  const items = plan.items || [];
  const totalDuration = items.reduce((s, i) => s + i.duration, 0);
  const totalBurned = plan.totalBurned || items.reduce((s, i) => s + i.caloriesBurned, 0);
  const targetBurned = plan.targetBurned || 0;
  const burnPct = targetBurned > 0 ? Math.min(100, (totalBurned / targetBurned) * 100) : 0;
  const planDate = new Date(plan.date).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Target Burned"
          value={Math.round(targetBurned)}
          unit="kcal"
          icon={TrendingUp}
          color="amber"
          sublabel="20% kalori harian"
        />
        <StatCard
          label="Aktual Burned"
          value={Math.round(totalBurned)}
          unit="kcal"
          icon={Flame}
          color={burnPct >= 90 ? "emerald" : burnPct >= 60 ? "amber" : "rose"}
          sublabel={`${Math.round(burnPct)}% dari target`}
        />
        <StatCard
          label="Total Durasi"
          value={totalDuration}
          unit="menit"
          icon={Timer}
          color="teal"
          sublabel={`${items.length} jenis latihan`}
        />
        <StatCard
          label="Jumlah Latihan"
          value={items.length}
          unit="item"
          icon={ListChecks}
          color="violet"
          sublabel={planDate}
        />
      </div>

      {/* Warmup */}
      {plan.planDetails?.warmup && (
        <SectionCard title="Pemanasan" description="Lakukan sebelum latihan inti">
          <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
            <Wind className="h-5 w-5 shrink-0 text-teal-600" />
            <p className="text-sm leading-relaxed text-foreground">{plan.planDetails.warmup}</p>
          </div>
        </SectionCard>
      )}

      {/* Exercise items table */}
      <SectionCard
        title="Daftar Latihan"
        description={`${items.length} item · Formula: MET × berat (kg) × durasi (menit) / 60`}
      >
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Tidak ada item latihan.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Nama Latihan</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Intensitas</TableHead>
                  <TableHead className="text-right">Durasi</TableHead>
                  <TableHead className="text-right">Kalori</TableHead>
                  <TableHead className="text-right">MET</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <React.Fragment key={item.id}>
                    <TableRow>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary" />
                          {item.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {EXERCISE_TYPE_LABELS[item.type] || item.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${INTENSITY_COLORS[item.intensity]}`}
                        >
                          {INTENSITY_LABELS[item.intensity] || item.intensity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.duration} <span className="text-xs text-muted-foreground">min</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-primary">
                        {Math.round(item.caloriesBurned)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">kcal</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {item.met.toFixed(1)}
                      </TableCell>
                    </TableRow>
                    {(item.instructions || item.setsReps || item.notes) && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="bg-muted/20 py-3">
                          <div className="space-y-1 pl-6 text-sm">
                            {item.setsReps && (
                              <p className="font-medium text-foreground">{item.setsReps}</p>
                            )}
                            {item.instructions && (
                              <p className="leading-relaxed text-muted-foreground">
                                <span className="font-medium text-foreground">Cara melakukan: </span>
                                {item.instructions}
                              </p>
                            )}
                            {item.notes && (
                              <p className="leading-relaxed text-amber-700 dark:text-amber-400">
                                <span className="font-medium">Perhatian: </span>
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Cooldown */}
      {plan.planDetails?.cooldown && (
        <SectionCard title="Pendinginan & Peregangan" description="Lakukan setelah latihan inti selesai">
          <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
            <Wind className="h-5 w-5 shrink-0 text-teal-600" />
            <p className="text-sm leading-relaxed text-foreground">{plan.planDetails.cooldown}</p>
          </div>
        </SectionCard>
      )}

      {/* Red flags */}
      {plan.planDetails?.red_flags && plan.planDetails.red_flags.length > 0 && (
        <SectionCard
          title="Kapan Harus Berhenti (Red Flags)"
          description="Hentikan latihan segera bila muncul gejala berikut"
        >
          <div className="flex gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed text-rose-800 dark:text-rose-300">
              {plan.planDetails.red_flags.map((flag, i) => (
                <li key={i}>{flag}</li>
              ))}
            </ul>
          </div>
        </SectionCard>
      )}

      {/* Monitoring targets & progression */}
      {((plan.planDetails?.monitoring_targets && plan.planDetails.monitoring_targets.length > 0) ||
        plan.planDetails?.weekly_progression) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {plan.planDetails?.monitoring_targets && plan.planDetails.monitoring_targets.length > 0 && (
            <SectionCard title="Target Monitoring" description="Yang perlu dipantau secara berkala">
              <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                <Target className="h-5 w-5 shrink-0 text-emerald-600" />
                <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed text-foreground">
                  {plan.planDetails.monitoring_targets.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            </SectionCard>
          )}
          {plan.planDetails?.weekly_progression && (
            <SectionCard title="Progresi Mingguan" description="Cara meningkatkan latihan secara bertahap">
              <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                <CalendarRange className="h-5 w-5 shrink-0 text-violet-600" />
                <p className="text-sm leading-relaxed text-foreground">{plan.planDetails.weekly_progression}</p>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* Patient education */}
      {plan.planDetails?.patient_education && (
        <SectionCard title="Edukasi Pasien" description="Untuk disampaikan langsung ke pasien">
          <div className="flex gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
            <GraduationCap className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-200">
              {plan.planDetails.patient_education}
            </p>
          </div>
        </SectionCard>
      )}

      {/* Clinical notes */}
      {plan.notes && (
        <SectionCard
          title="Catatan Klinis"
          description="Pertimbangan klinis perencanaan latihan"
        >
          <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
            <StickyNote className="h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-2">
              {Array.isArray(plan.sourceProgramIds) && plan.sourceProgramIds.length > 0 && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <BookOpenCheck className="h-3 w-3" /> Evidence-Based (Exercise Program Library)
                </Badge>
              )}
              <p className="text-sm leading-relaxed text-foreground">{plan.notes}</p>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
