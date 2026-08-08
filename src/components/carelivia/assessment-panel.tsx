"use client";

import * as React from "react";
import {
  ClipboardCheck,
  Activity,
  Shield,
  Hand,
  Ruler,
  Stethoscope,
  AlertTriangle,
  Save,
  Trash2,
  Plus,
  Timer,
  Sparkles,
  RefreshCw,
  FileDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  useAssessments,
  useCreateAssessment,
  useDeleteAssessment,
  useGenerateAssessmentSummary,
  useAssessmentSummary,
} from "@/hooks/use-carelivia";
import {
  ACTIVITY_LABELS,
  STRESS_LABELS,
} from "@/lib/clinical/constants";
import type { ActivityLevel, StressLevel } from "@prisma/client";

const ACTIVITY_OPTS = Object.keys(ACTIVITY_LABELS) as ActivityLevel[];
const STRESS_OPTS = Object.keys(STRESS_LABELS) as StressLevel[];

// =====================================================================
// SCORING — semua nilai berasal dari pilihan klik (radio/card/checkbox),
// tidak ada slider maupun scroll-to-select di seluruh modul ini.
// =====================================================================

// ---------------------------------------------------------------------
// MUST (Malnutrition Universal Screening Tool)
// ---------------------------------------------------------------------
function computeMUST(bmi: number, weightLossPct: number, acuteDisease: boolean) {
  const bmiScore = bmi > 20 ? 0 : bmi >= 18.5 ? 1 : 2;
  const wlScore = weightLossPct < 5 ? 0 : weightLossPct <= 10 ? 1 : 2;
  const acuteScore = acuteDisease ? 2 : 0;
  const total = bmiScore + wlScore + acuteScore;
  return {
    score: total,
    category: total === 0 ? "LOW" : total === 1 ? "MEDIUM" : "HIGH",
    label:
      total === 0 ? "Risiko Rendah" : total === 1 ? "Risiko Sedang" : "Risiko Tinggi",
    color:
      total === 0 ? "emerald" : total === 1 ? "amber" : "rose",
  };
}

// NRS-2002 (ESPEN): score >=3 = at risk
function computeNRS(impairedNutrition: number, diseaseSeverity: number, ageBonus: boolean) {
  const total = impairedNutrition + diseaseSeverity + (ageBonus ? 1 : 0);
  return {
    score: total,
    category: total >= 3 ? "AT_RISK" : "NOT_AT_RISK",
    label: total >= 3 ? "Berisiko" : "Tidak Berisiko",
  };
}

// MNA Short Form (0-14): 12-14 normal, 8-11 at risk, 0-7 malnourished
function computeMNA(score: number) {
  return {
    category:
      score >= 12 ? "NORMAL" : score >= 8 ? "AT_RISK" : "MALNOURISHED",
    label:
      score >= 12
        ? "Status Gizi Normal"
        : score >= 8
          ? "Berisiko Malnutrisi"
          : "Malnutrisi",
  };
}

// Barthel Index interpretation (total 0-100)
function barthelLabel(score: number) {
  if (score >= 95) return { label: "Mandiri", color: "emerald" };
  if (score >= 60) return { label: "Bantuan Minimal", color: "amber" };
  if (score >= 40) return { label: "Bantuan Sedang", color: "amber" };
  if (score >= 20) return { label: "Bantuan Berat", color: "rose" };
  return { label: "Tergantung Total", color: "rose" };
}

// FRAIL scale: 0 = Robust, 1-2 = Prefrail, >=3 = Frail
function frailtyLabel(score: number) {
  if (score === 0) return { category: "ROBUST", label: "Robust", color: "emerald" };
  if (score <= 2) return { category: "PREFRAIL", label: "Prefrail", color: "amber" };
  return { category: "FRAIL", label: "Frail", color: "rose" };
}

// Karnofsky Performance Scale
function karnofskyLabel(score: number) {
  if (score >= 80) return { label: "Aktivitas Normal", color: "emerald" };
  if (score >= 50) return { label: "Perlu Bantuan Sebagian", color: "amber" };
  return { label: "Perawatan Total", color: "rose" };
}

// Clinical Frailty Scale (1-9)
function cfsLabel(score: number) {
  if (score <= 3) return { label: "Fit / Sehat", color: "emerald" };
  if (score <= 5) return { label: "Vulnerable–Mild Frailty", color: "amber" };
  return { label: "Frailty Sedang–Berat", color: "rose" };
}

// SARC-F (EWGSOP2): >=4 = probable sarcopenia
function computeSarcF(strength: number, walking: number, chair: number, stairs: number, falls: number) {
  const total = strength + walking + chair + stairs + falls;
  return { score: total, positive: total >= 4 };
}

// SARC-CalF: SARC-F + 10 if calf circumference below cutoff. >=11 = positive.
function computeSarcCalf(sarcfScore: number, calfCategory: string) {
  const isLow = calfCategory === "M_LOW" || calfCategory === "F_LOW";
  const total = sarcfScore + (isLow ? 10 : 0);
  return { score: total, positive: total >= 11 };
}

// Morse Fall Scale: 0-24 Tidak Berisiko/Rendah, 25-44 Sedang, >=45 Tinggi
const MORSE_AMBULATORY_SCORE: Record<string, number> = {
  NONE: 0,
  CRUTCH_CANE_WALKER: 15,
  FURNITURE: 30,
};
const MORSE_GAIT_SCORE: Record<string, number> = {
  NORMAL: 0,
  WEAK: 10,
  IMPAIRED: 20,
};
function computeMorse(opts: {
  historyFall: boolean;
  secondaryDx: boolean;
  ambulatoryAid: string;
  ivTherapy: boolean;
  gait: string;
  mentalStatus: string;
}) {
  const total =
    (opts.historyFall ? 25 : 0) +
    (opts.secondaryDx ? 15 : 0) +
    (MORSE_AMBULATORY_SCORE[opts.ambulatoryAid] ?? 0) +
    (opts.ivTherapy ? 20 : 0) +
    (MORSE_GAIT_SCORE[opts.gait] ?? 0) +
    (opts.mentalStatus === "OVERESTIMATES" ? 15 : 0);
  const category = total >= 45 ? "HIGH" : total >= 25 ? "MODERATE" : "LOW";
  const label = total >= 45 ? "Risiko Tinggi" : total >= 25 ? "Risiko Sedang" : "Risiko Rendah";
  const color = total >= 45 ? "rose" : total >= 25 ? "amber" : "emerald";
  return { score: total, category, label, color };
}

// ---------------------------------------------------------------------
// Barthel Index — 10 item resmi, total otomatis 0-100
// ---------------------------------------------------------------------
const BARTHEL_ITEMS: { key: string; label: string; options: { v: number; l: string }[] }[] = [
  { key: "feeding", label: "Makan", options: [{ v: 0, l: "Tidak mampu" }, { v: 5, l: "Perlu bantuan" }, { v: 10, l: "Mandiri" }] },
  { key: "bathing", label: "Mandi", options: [{ v: 0, l: "Tergantung" }, { v: 5, l: "Mandiri" }] },
  { key: "grooming", label: "Perawatan Diri", options: [{ v: 0, l: "Perlu bantuan" }, { v: 5, l: "Mandiri" }] },
  { key: "dressing", label: "Berpakaian", options: [{ v: 0, l: "Tergantung" }, { v: 5, l: "Perlu bantuan" }, { v: 10, l: "Mandiri" }] },
  { key: "bowels", label: "BAB", options: [{ v: 0, l: "Inkontinen" }, { v: 5, l: "Kadang tak terkontrol" }, { v: 10, l: "Kontinen" }] },
  { key: "bladder", label: "BAK", options: [{ v: 0, l: "Inkontinen" }, { v: 5, l: "Kadang tak terkontrol" }, { v: 10, l: "Kontinen" }] },
  { key: "toilet", label: "Penggunaan Toilet", options: [{ v: 0, l: "Tergantung" }, { v: 5, l: "Perlu bantuan" }, { v: 10, l: "Mandiri" }] },
  { key: "transfer", label: "Transfer (Kursi–Tempat Tidur)", options: [{ v: 0, l: "Tidak mampu" }, { v: 5, l: "Bantuan besar" }, { v: 10, l: "Bantuan minimal" }, { v: 15, l: "Mandiri" }] },
  { key: "mobility", label: "Mobilitas / Berjalan", options: [{ v: 0, l: "Imobil" }, { v: 5, l: "Kursi roda mandiri" }, { v: 10, l: "Bantuan 1 orang" }, { v: 15, l: "Mandiri" }] },
  { key: "stairs", label: "Naik Tangga", options: [{ v: 0, l: "Tidak mampu" }, { v: 5, l: "Perlu bantuan" }, { v: 10, l: "Mandiri" }] },
];
const BARTHEL_DEFAULT: Record<string, number> = BARTHEL_ITEMS.reduce((acc, item) => {
  acc[item.key] = item.options[item.options.length - 1].v;
  return acc;
}, {} as Record<string, number>);

// MNA Short Form rows — pilihan resmi, bukan slider
const MNA_ROWS: { key: string; label: string; options: { v: number; l: string }[] }[] = [
  {
    key: "foodIntake",
    label: "Asupan Makanan (3 bulan terakhir)",
    options: [{ v: 0, l: "Menurun drastis" }, { v: 1, l: "Menurun sedang" }, { v: 2, l: "Tidak menurun" }],
  },
  {
    key: "weightLoss",
    label: "Penurunan BB (3 bulan terakhir)",
    options: [{ v: 0, l: ">3 kg" }, { v: 1, l: "Tidak tahu" }, { v: 2, l: "1–3 kg" }, { v: 3, l: "Tidak ada" }],
  },
  {
    key: "mobility",
    label: "Mobilitas",
    options: [{ v: 0, l: "Bedrest / kursi roda" }, { v: 1, l: "Bisa turun, tak keluar rumah" }, { v: 2, l: "Bisa keluar rumah" }],
  },
  {
    key: "psych",
    label: "Stress Psikologis / Neuropsikologis",
    options: [{ v: 0, l: "Demensia/depresi berat" }, { v: 1, l: "Demensia ringan" }, { v: 2, l: "Tidak ada masalah" }],
  },
  {
    key: "bmi",
    label: "BMI (kg/m²)",
    options: [{ v: 0, l: "<19" }, { v: 1, l: "19–21" }, { v: 2, l: "21–23" }, { v: 3, l: "≥23" }],
  },
];
const MNA_DEFAULT: Record<string, number> = MNA_ROWS.reduce((acc, row) => {
  acc[row.key] = row.options[row.options.length - 1].v;
  return acc;
}, {} as Record<string, number>);

// SARC-F rows
const SARCF_ROWS: { key: string; label: string; hint: string }[] = [
  { key: "strength", label: "Kekuatan (Strength)", hint: "Mengangkat/membawa beban 4.5 kg" },
  { key: "walking", label: "Berjalan (Assistance walking)", hint: "Berjalan melintasi ruangan" },
  { key: "chair", label: "Bangun dari Kursi", hint: "Berpindah dari kursi/tempat tidur" },
  { key: "stairs", label: "Naik Tangga", hint: "Menaiki 10 anak tangga" },
  { key: "falls", label: "Riwayat Jatuh", hint: "Jumlah jatuh dalam 1 tahun terakhir" },
];
const SARCF_OPTIONS: Record<string, { v: number; l: string }[]> = {
  strength: [{ v: 0, l: "Tidak sulit" }, { v: 1, l: "Sedikit sulit" }, { v: 2, l: "Sangat sulit/tak mampu" }],
  walking: [{ v: 0, l: "Tidak sulit" }, { v: 1, l: "Sedikit sulit" }, { v: 2, l: "Sangat sulit/tak mampu" }],
  chair: [{ v: 0, l: "Tidak sulit" }, { v: 1, l: "Sedikit sulit" }, { v: 2, l: "Sangat sulit/butuh bantuan" }],
  stairs: [{ v: 0, l: "Tidak sulit" }, { v: 1, l: "Sedikit sulit" }, { v: 2, l: "Sangat sulit/tak mampu" }],
  falls: [{ v: 0, l: "Tidak pernah" }, { v: 1, l: "1–3 kali" }, { v: 2, l: "≥4 kali" }],
};
const SARCF_DEFAULT: Record<string, number> = { strength: 0, walking: 0, chair: 0, stairs: 0, falls: 0 };

export function AssessmentPanel({ patientId }: { patientId: string }) {
  const { data: assessments, isLoading } = useAssessments(patientId);
  const [showForm, setShowForm] = React.useState(false);
  const deleteMut = useDeleteAssessment();

  const latest = assessments?.[0];

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus asesmen ini?")) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Asesmen dihapus");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleExportPdf = () => {
    window.open(`/api/assessments/export-pdf?patientId=${encodeURIComponent(patientId)}`, "_blank");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Asesmen Gizi & Fungsional</h3>
          {latest && (
            <Badge variant="outline" className="text-[10px]">
              Terakhir: {new Date(latest.recordedAt).toLocaleDateString("id-ID")}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {assessments && assessments.length > 0 && (
            <Button size="sm" variant="outline" className="h-8" onClick={handleExportPdf}>
              <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export PDF
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8" onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Asesmen Baru
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      ) : !assessments || assessments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <ClipboardCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Belum ada asesmen</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Buat asesmen gizi komprehensif (MUST, NRS-2002, SGA, MNA, ECOG, Karnofsky, Barthel, FRAIL, CFS, Morse Fall Scale, SARC-F/SARC-CalF).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Ringkasan Interpretasi AI Otomatis untuk asesmen terbaru */}
          {latest && <AssessmentAISummaryCard assessmentId={latest.id} />}

          {/* Latest assessment summary cards */}
          {latest && <AssessmentSummary assessment={latest} />}

          {/* History list */}
          {assessments.length > 1 && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Riwayat Asesmen
              </p>
              <ScrollArea className="max-h-40">
                <div className="space-y-1">
                  {Array.isArray(assessments) && assessments.slice(1).map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-md border border-border/40 px-3 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {new Date(a.recordedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {a.must && (
                          <Badge variant="outline" className="text-[9px]">{a.must}</Badge>
                        )}
                        {a.sga && (
                          <Badge variant="outline" className="text-[9px]">SGA {a.sga}</Badge>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-rose-500"
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}

      <AssessmentFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        patientId={patientId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Ringkasan Interpretasi AI Otomatis — compact card shown above the score
// grid. Auto-populates once AssessmentFormDialog's submit() triggers
// generation; also offers a manual "Buat/Perbarui" button for older
// assessments that don't have one yet.
// ---------------------------------------------------------------------
const NUTRISI_LABEL: Record<string, { label: string; color: "emerald" | "amber" | "rose" }> = {
  NORMAL: { label: "Status Gizi Normal", color: "emerald" },
  AT_RISK: { label: "Berisiko Malnutrisi", color: "amber" },
  MALNUTRITION: { label: "Malnutrisi", color: "rose" },
  GLIM_COMPATIBLE: { label: "Malnutrisi (Kriteria GLIM Terpenuhi)", color: "rose" },
};

function AssessmentAISummaryCard({ assessmentId }: { assessmentId: string }) {
  const { data: summary, isLoading } = useAssessmentSummary(assessmentId);
  const generate = useGenerateAssessmentSummary();

  const current = generate.data || summary;
  const busy = generate.isPending;

  const handleGenerate = () => {
    generate.mutate(
      { assessmentId },
      { onError: (e: any) => toast.error(e?.message || "Gagal membuat ringkasan AI") },
    );
  };

  if (isLoading && !current) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-3">
        <div className="h-16 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed border-border/60 bg-muted/10 p-3">
        <p className="text-xs text-muted-foreground">Belum ada ringkasan interpretasi AI untuk asesmen ini.</p>
        <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={handleGenerate} disabled={busy}>
          {busy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Buat Ringkasan AI
        </Button>
      </div>
    );
  }

  const nutrisi = NUTRISI_LABEL[current.kesimpulan_nutrisi] || NUTRISI_LABEL.NORMAL;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Ringkasan Interpretasi AI
        </p>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={`text-[9px] ${nutrisi.color === "emerald" ? "border-emerald-300 text-emerald-700" : nutrisi.color === "amber" ? "border-amber-300 text-amber-700" : "border-rose-300 text-rose-700"}`}>
            {nutrisi.label}
          </Badge>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleGenerate} disabled={busy} title="Perbarui ringkasan">
            <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-foreground">{current.ringkasan}</p>

      {current.diagnosis_gizi && (
        <p className="mt-2 text-[11px] italic text-muted-foreground">
          <span className="font-semibold not-italic">Diagnosis Gizi: </span>
          {current.diagnosis_gizi}
        </p>
      )}

      {current.intervensi?.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Intervensi</p>
          <ul className="mt-0.5 space-y-0.5 text-[11px] text-foreground">
            {current.intervensi.map((it: string, i: number) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-primary">•</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {current.monitoring?.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Monitoring</p>
          <ul className="mt-0.5 space-y-0.5 text-[11px] text-foreground">
            {current.monitoring.map((it: string, i: number) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-primary">•</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {current.red_flags?.length > 0 && (
        <div className="mt-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
          <p className="mb-0.5 font-bold uppercase">Segera ke dokter jika:</p>
          <ul className="space-y-0.5">
            {current.red_flags.map((f: string, i: number) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </div>
      )}

      {current.guideline_references?.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Rujukan: {current.guideline_references.join(" · ")}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Assessment Summary — displays latest assessment as score cards
// ---------------------------------------------------------------------
function AssessmentSummary({ assessment }: { assessment: any }) {
  const mustColor =
    assessment.must === "LOW" ? "emerald" : assessment.must === "MEDIUM" ? "amber" : "rose";
  const sgaColor = assessment.sga === "A" ? "emerald" : assessment.sga === "B" ? "amber" : "rose";
  const frailtyInfo = assessment.frailty
    ? frailtyLabel(assessment.frailtyScore || 0)
    : null;
  const barthelInfo = assessment.barthel != null ? barthelLabel(assessment.barthel) : null;
  const karnofskyInfo = assessment.karnofsky != null ? karnofskyLabel(assessment.karnofsky) : null;
  const cfsInfo = assessment.cfs != null ? cfsLabel(assessment.cfs) : null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {assessment.must && (
        <ScoreCard
          title="MUST"
          score={assessment.mustScore != null ? String(assessment.mustScore) : "—"}
          label={assessment.must === "LOW" ? "Risiko Rendah" : assessment.must === "MEDIUM" ? "Risiko Sedang" : "Risiko Tinggi"}
          color={mustColor as any}
          icon={Shield}
        />
      )}
      {assessment.sga && (
        <ScoreCard
          title="SGA"
          score={assessment.sga}
          label={assessment.sga === "A" ? "Gizi Baik" : assessment.sga === "B" ? "Malnutrisi Sedang" : "Malnutrisi Berat"}
          color={sgaColor as any}
          icon={Stethoscope}
        />
      )}
      {assessment.nrs2002 && (
        <ScoreCard
          title="NRS-2002"
          score={assessment.nrsScore != null ? String(assessment.nrsScore) : "—"}
          label={assessment.nrs2002 === "AT_RISK" ? "Berisiko" : "Tidak Berisiko"}
          color={assessment.nrs2002 === "AT_RISK" ? "rose" : "emerald"}
          icon={Shield}
        />
      )}
      {assessment.mna && (
        <ScoreCard
          title="MNA"
          score={assessment.mnaScore != null ? String(assessment.mnaScore) : "—"}
          label={
            assessment.mna === "NORMAL"
              ? "Normal"
              : assessment.mna === "AT_RISK"
                ? "Berisiko"
                : "Malnutrisi"
          }
          color={
            assessment.mna === "NORMAL" ? "emerald" : assessment.mna === "AT_RISK" ? "amber" : "rose"
          }
          icon={Stethoscope}
        />
      )}
      {assessment.ecog != null && (
        <ScoreCard
          title="ECOG"
          score={assessment.ecog}
          label={
            assessment.ecog === "0"
              ? "Aktif"
              : assessment.ecog === "1"
                ? "Aktif Ringan"
                : assessment.ecog === "2"
                  ? "Bisa Jalan"
                  : assessment.ecog === "3"
                    ? "Bedrest >50%"
                    : "Bedrest Total"
          }
          color={Number(assessment.ecog) <= 1 ? "emerald" : Number(assessment.ecog) <= 2 ? "amber" : "rose"}
          icon={Activity}
        />
      )}
      {assessment.karnofsky != null && karnofskyInfo && (
        <ScoreCard
          title="Karnofsky"
          score={String(assessment.karnofsky)}
          label={karnofskyInfo.label}
          color={karnofskyInfo.color as any}
          icon={Activity}
        />
      )}
      {assessment.barthel != null && barthelInfo && (
        <ScoreCard
          title="Barthel Index"
          score={String(assessment.barthel)}
          label={barthelInfo.label}
          color={barthelInfo.color as any}
          icon={Activity}
        />
      )}
      {assessment.frailty && frailtyInfo && (
        <ScoreCard
          title="Frailty (FRAIL)"
          score={assessment.frailtyScore != null ? String(assessment.frailtyScore) : "—"}
          label={frailtyInfo.label}
          color={frailtyInfo.color as any}
          icon={Shield}
        />
      )}
      {assessment.cfs != null && cfsInfo && (
        <ScoreCard
          title="Clinical Frailty Scale"
          score={String(assessment.cfs)}
          label={cfsInfo.label}
          color={cfsInfo.color as any}
          icon={Shield}
        />
      )}
      {assessment.fallRisk && (
        <ScoreCard
          title="Fall Risk (Morse)"
          score={assessment.morseScore != null ? String(assessment.morseScore) : assessment.fallRisk}
          label={assessment.fallRisk === "LOW" ? "Rendah" : assessment.fallRisk === "MODERATE" ? "Sedang" : "Tinggi"}
          color={assessment.fallRisk === "LOW" ? "emerald" : assessment.fallRisk === "MODERATE" ? "amber" : "rose"}
          icon={AlertTriangle}
        />
      )}
      {assessment.sarcfScore != null && (
        <ScoreCard
          title="SARC-F"
          score={String(assessment.sarcfScore)}
          label={assessment.sarcfPositive ? "Probable Sarcopenia" : "Normal"}
          color={assessment.sarcfPositive ? "rose" : "emerald"}
          icon={Shield}
        />
      )}
      {assessment.handGrip != null && (
        <ScoreCard
          title="Hand Grip"
          score={`${assessment.handGrip} kg`}
          label="Kekuatan genggam"
          color="violet"
          icon={Hand}
        />
      )}
      {assessment.activity && (
        <ScoreCard
          title="Aktivitas"
          score={ACTIVITY_LABELS[assessment.activity as ActivityLevel]?.split(" ")[0] || "—"}
          label="Level aktivitas"
          color="teal"
          icon={Activity}
        />
      )}
      {assessment.stress && assessment.stress !== "NONE" && (
        <ScoreCard
          title="Stress"
          score={STRESS_LABELS[assessment.stress as StressLevel]?.split(" ")[1] || assessment.stress}
          label="Faktor stress"
          color="amber"
          icon={AlertTriangle}
        />
      )}
    </div>
  );
}

function ScoreCard({
  title,
  score,
  label,
  color,
  icon: Icon,
}: {
  title: string;
  score: string;
  label: string;
  color: "emerald" | "amber" | "rose" | "violet" | "teal";
  icon: any;
}) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
    amber: "border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
    rose: "border-rose-300 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400",
    violet: "border-violet-300 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400",
    teal: "border-teal-300 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400",
  };
  return (
    <div className={`rounded-lg border p-2.5 ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide opacity-80">
          <Icon className="h-3 w-3" />
          {title}
        </span>
      </div>
      <p className="mt-1 text-xl font-bold cl-stat-num">{score}</p>
      <p className="text-[10px] opacity-80">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Generic click-only choice group (replaces every slider/scroll input)
// ---------------------------------------------------------------------
function ChoiceGroup({
  options,
  value,
  onChange,
  columns = 3,
}: {
  options: { v: number | string; l: string }[];
  value: number | string;
  onChange: (v: any) => void;
  columns?: number;
}) {
  return (
    <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((opt) => (
        <button
          key={String(opt.v)}
          type="button"
          onClick={() => onChange(opt.v)}
          className={`rounded-md border-2 px-2 py-1.5 text-center text-[11px] font-medium transition-all ${
            value === opt.v
              ? "border-primary bg-primary/10 text-primary"
              : "border-border hover:border-primary/40"
          }`}
        >
          {opt.l}
        </button>
      ))}
    </div>
  );
}

function ScoreRow({
  label,
  options,
  value,
  onChange,
  columns,
}: {
  label: string;
  options: { v: number; l: string }[];
  value: number;
  onChange: (v: number) => void;
  columns?: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
      </div>
      <ChoiceGroup options={options} value={value} onChange={onChange} columns={columns ?? options.length} />
    </div>
  );
}

// ---------------------------------------------------------------------
// Assessment Form Dialog — multi-tab comprehensive clinical assessment
// ---------------------------------------------------------------------
function AssessmentFormDialog({
  open,
  onOpenChange,
  patientId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientId: string;
}) {
  const createMut = useCreateAssessment();
  const summaryMut = useGenerateAssessmentSummary();

  // MUST inputs — BMI & weight-loss kept as numeric input (measured values),
  // acute disease is a click choice.
  const [bmi, setBmi] = React.useState("22");
  const [weightLossPct, setWeightLossPct] = React.useState("0");
  const [acuteDisease, setAcuteDisease] = React.useState(false);
  const must = computeMUST(Number(bmi) || 22, Number(weightLossPct) || 0, acuteDisease);

  // NRS-2002 inputs — click choice (0-3), no slider
  const [nrsNutrition, setNrsNutrition] = React.useState(0);
  const [nrsDisease, setNrsDisease] = React.useState(0);
  const [nrsAgeBonus, setNrsAgeBonus] = React.useState(false);
  const nrs = computeNRS(nrsNutrition, nrsDisease, nrsAgeBonus);

  // SGA
  const [sga, setSga] = React.useState<"A" | "B" | "C" | "">("");

  // MNA Short Form — click choice per item
  const [mnaValues, setMnaValues] = React.useState<Record<string, number>>(MNA_DEFAULT);
  const mnaScore = Object.values(mnaValues).reduce((a, b) => a + b, 0);
  const mna = computeMNA(mnaScore);

  // Functional
  const [ecog, setEcog] = React.useState<string>("");
  const [karnofsky, setKarnofsky] = React.useState<number | null>(null);
  const [barthelValues, setBarthelValues] = React.useState<Record<string, number>>(BARTHEL_DEFAULT);
  const barthel = Object.values(barthelValues).reduce((a, b) => a + b, 0);
  const [pps, setPps] = React.useState("");

  // Frailty (FRAIL scale) — checkbox
  const [frailFatigue, setFrailFatigue] = React.useState(false);
  const [frailResistance, setFrailResistance] = React.useState(false);
  const [frailAmbulation, setFrailAmbulation] = React.useState(false);
  const [frailIllness, setFrailIllness] = React.useState(false);
  const [frailLoss, setFrailLoss] = React.useState(false);
  const frailtyScore = [frailFatigue, frailResistance, frailAmbulation, frailIllness, frailLoss].filter(Boolean).length;
  const frailty = frailtyLabel(frailtyScore);

  // Clinical Frailty Scale (1-9) — card choice
  const [cfs, setCfs] = React.useState<number | null>(null);

  // Morse Fall Scale — full instrument, click choice per item
  const [morseHistoryFall, setMorseHistoryFall] = React.useState(false);
  const [morseSecondaryDx, setMorseSecondaryDx] = React.useState(false);
  const [morseAmbulatoryAid, setMorseAmbulatoryAid] = React.useState("NONE");
  const [morseIvTherapy, setMorseIvTherapy] = React.useState(false);
  const [morseGait, setMorseGait] = React.useState("NORMAL");
  const [morseMentalStatus, setMorseMentalStatus] = React.useState("ORIENTED");
  const morse = computeMorse({
    historyFall: morseHistoryFall,
    secondaryDx: morseSecondaryDx,
    ambulatoryAid: morseAmbulatoryAid,
    ivTherapy: morseIvTherapy,
    gait: morseGait,
    mentalStatus: morseMentalStatus,
  });

  // Timed Up and Go (TUG) — categorical click choice, informational
  const [tugCategory, setTugCategory] = React.useState("");

  // SARC-F / SARC-CalF (EWGSOP2)
  const [sarcfValues, setSarcfValues] = React.useState<Record<string, number>>(SARCF_DEFAULT);
  const sarcf = computeSarcF(sarcfValues.strength, sarcfValues.walking, sarcfValues.chair, sarcfValues.stairs, sarcfValues.falls);
  const [calfCategory, setCalfCategory] = React.useState("");
  const sarcCalf = computeSarcCalf(sarcf.score, calfCategory);

  // Physical
  const [handGrip, setHandGrip] = React.useState("");

  // CareLivia inputs
  const [activity, setActivity] = React.useState<ActivityLevel>("LIGHT");
  const [stress, setStress] = React.useState<StressLevel>("NONE");
  const [notes, setNotes] = React.useState("");

  const submit = async () => {
    try {
      const created = await createMut.mutateAsync({
        patientId,
        must: must.category,
        mustScore: must.score,
        sga: sga || null,
        nrs2002: nrs.category,
        nrsScore: nrs.score,
        mna: mna.category,
        mnaScore,
        pps: pps || null,
        ecog: ecog || null,
        karnofsky,
        barthel,
        barthelItems: barthelValues,
        frailty: frailty.category,
        frailtyScore,
        cfs,
        fallRisk: morse.category,
        morseScore: morse.score,
        morseHistoryFall,
        morseSecondaryDx,
        morseAmbulatoryAid,
        morseIvTherapy,
        morseGait,
        morseMentalStatus,
        tugCategory: tugCategory || null,
        sarcfScore: sarcf.score,
        sarcfPositive: sarcf.positive,
        calfCategory: calfCategory || null,
        sarcCalfScore: calfCategory ? sarcCalf.score : null,
        sarcCalfPositive: calfCategory ? sarcCalf.positive : null,
        handGrip: handGrip ? Number(handGrip) : null,
        activity,
        stress,
        notes,
      });
      toast.success("Asesmen gizi disimpan");
      onOpenChange(false);
      // Ringkasan Interpretasi AI Otomatis — fire-and-forget, tidak
      // memblokir penutupan dialog. Kartu ringkasan akan muncul begitu
      // hasilnya siap (lihat AssessmentSummary di bawah).
      if (created?.id) {
        summaryMut.mutate({ assessmentId: created.id });
      }
      // reset
      setSga("");
      setEcog("");
      setKarnofsky(null);
      setCfs(null);
      setTugCategory("");
      setCalfCategory("");
      setHandGrip("");
      setNotes("");
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan asesmen");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-hidden p-0 sm:max-w-[760px]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Asesmen Gizi & Fungsional Komprehensif
          </DialogTitle>
          <DialogDescription>
            Screening multi-alat (klik saja — tanpa slider): MUST, NRS-2002, SGA, MNA, ECOG, Karnofsky, Barthel, FRAIL, CFS, Morse Fall Scale, TUG, SARC-F/SARC-CalF.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="screening" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-6 grid grid-cols-5">
            <TabsTrigger value="screening">Screening</TabsTrigger>
            <TabsTrigger value="functional">Fungsional</TabsTrigger>
            <TabsTrigger value="frailty">Frailty & Fall</TabsTrigger>
            <TabsTrigger value="sarcopenia">Sarkopenia</TabsTrigger>
            <TabsTrigger value="clinical">Klinis</TabsTrigger>
          </TabsList>

          <ScrollArea className="max-h-[55vh] px-6 py-4">
            <TabsContent value="screening" className="mt-0 space-y-4">
              {/* MUST */}
              <AssessmentSection title="MUST (Malnutrition Universal Screening Tool)" icon={Shield}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">BMI (kg/m²)</Label>
                    <Input type="number" value={bmi} onChange={(e) => setBmi(e.target.value)} step="0.1" />
                  </div>
                  <div>
                    <Label className="text-xs">Penurunan BB (%)</Label>
                    <Input type="number" value={weightLossPct} onChange={(e) => setWeightLossPct(e.target.value)} step="0.1" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                      <Checkbox checked={acuteDisease} onCheckedChange={(c) => setAcuteDisease(!!c)} />
                      Penyakit akut
                    </label>
                  </div>
                </div>
                <ScoreResult score={`Skor: ${must.score}`} label={must.label} color={must.color} />
              </AssessmentSection>

              {/* NRS-2002 */}
              <AssessmentSection title="NRS-2002 (Nutritional Risk Screening — ESPEN)" icon={Shield}>
                <div className="space-y-3">
                  <ScoreRow
                    label="Gangguan Nutrisi"
                    value={nrsNutrition}
                    onChange={setNrsNutrition}
                    options={[
                      { v: 0, l: "Normal" },
                      { v: 1, l: "Ringan" },
                      { v: 2, l: "Sedang" },
                      { v: 3, l: "Berat" },
                    ]}
                  />
                  <ScoreRow
                    label="Keparahan Penyakit"
                    value={nrsDisease}
                    onChange={setNrsDisease}
                    options={[
                      { v: 0, l: "Tidak ada" },
                      { v: 1, l: "Ringan" },
                      { v: 2, l: "Sedang" },
                      { v: 3, l: "Berat" },
                    ]}
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <Checkbox checked={nrsAgeBonus} onCheckedChange={(c) => setNrsAgeBonus(!!c)} />
                    Pasien ≥70 tahun (+1)
                  </label>
                </div>
                <ScoreResult score={`Skor: ${nrs.score}`} label={nrs.label} color={nrs.score >= 3 ? "rose" : "emerald"} />
              </AssessmentSection>

              {/* SGA */}
              <AssessmentSection title="SGA (Subjective Global Assessment)" icon={Stethoscope}>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "A", label: "A — Gizi Baik", color: "emerald" },
                    { val: "B", label: "B — Sedang", color: "amber" },
                    { val: "C", label: "C — Berat", color: "rose" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setSga(opt.val as any)}
                      className={`rounded-lg border-2 p-3 text-center text-xs font-medium transition-all ${
                        sga === opt.val
                          ? opt.color === "emerald"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950"
                            : opt.color === "amber"
                              ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950"
                              : "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </AssessmentSection>

              {/* MNA Short Form */}
              <AssessmentSection title="MNA Short Form (Lansia)" icon={Stethoscope}>
                <div className="space-y-3">
                  {MNA_ROWS.map((row) => (
                    <ScoreRow
                      key={row.key}
                      label={row.label}
                      value={mnaValues[row.key]}
                      onChange={(v) => setMnaValues((s) => ({ ...s, [row.key]: v }))}
                      options={row.options}
                    />
                  ))}
                </div>
                <ScoreResult score={`Skor: ${mnaScore}/14`} label={mna.label} color={mnaScore >= 12 ? "emerald" : mnaScore >= 8 ? "amber" : "rose"} />
              </AssessmentSection>
            </TabsContent>

            <TabsContent value="functional" className="mt-0 space-y-4">
              <AssessmentSection title="ECOG Performance Status" icon={Activity}>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { val: "0", label: "0", desc: "Aktif" },
                    { val: "1", label: "1", desc: "Ringan" },
                    { val: "2", label: "2", desc: "Bisa jalan" },
                    { val: "3", label: "3", desc: "Bedrest >50%" },
                    { val: "4", label: "4", desc: "Bedrest total" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setEcog(opt.val)}
                      className={`rounded-lg border-2 p-2 text-center transition-all ${
                        ecog === opt.val
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="text-lg font-bold">{opt.label}</p>
                      <p className="text-[9px] text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </AssessmentSection>

              <AssessmentSection title="Karnofsky Performance Scale" icon={Activity}>
                <div className="grid grid-cols-5 gap-1.5">
                  {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map((v) => (
                    <button
                      key={v}
                      onClick={() => setKarnofsky(v)}
                      className={`rounded-lg border-2 p-2 text-center transition-all ${
                        karnofsky === v
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="text-sm font-bold">{v}</p>
                    </button>
                  ))}
                </div>
                {karnofsky != null && (
                  <ScoreResult score={`Skor: ${karnofsky}`} label={karnofskyLabel(karnofsky).label} color={karnofskyLabel(karnofsky).color as any} />
                )}
              </AssessmentSection>

              <AssessmentSection title="Barthel Index (Aktivitas Kehidupan Sehari-hari, 10 item)" icon={Activity}>
                <div className="space-y-3">
                  {BARTHEL_ITEMS.map((item) => (
                    <ScoreRow
                      key={item.key}
                      label={item.label}
                      value={barthelValues[item.key]}
                      onChange={(v) => setBarthelValues((s) => ({ ...s, [item.key]: v }))}
                      options={item.options}
                    />
                  ))}
                </div>
                <ScoreResult score={`Total: ${barthel}/100`} label={barthelLabel(barthel).label} color={barthelLabel(barthel).color as any} />
              </AssessmentSection>

              <AssessmentSection title="PPS (Palliative Performance Scale)" icon={Stethoscope}>
                <div>
                  <Label className="text-xs">Skor PPS (%)</Label>
                  <Select value={pps} onValueChange={setPps}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih skor PPS..." />
                    </SelectTrigger>
                    <SelectContent>
                      {["100", "90", "80", "70", "60", "50", "40", "30", "20", "10"].map((v) => (
                        <SelectItem key={v} value={v}>{v}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </AssessmentSection>
            </TabsContent>

            <TabsContent value="frailty" className="mt-0 space-y-4">
              <AssessmentSection title="FRAIL Scale (5 komponen)" icon={Shield}>
                <div className="space-y-2">
                  <FrailRow label="Fatigue — merasa lelah sebagian besar waktu?" checked={frailFatigue} onChange={setFrailFatigue} />
                  <FrailRow label="Resistance — kesulitan naik 10 tangga tanpa bantuan?" checked={frailResistance} onChange={setFrailResistance} />
                  <FrailRow label="Ambulation — kesulitan berjalan satu blok?" checked={frailAmbulation} onChange={setFrailAmbulation} />
                  <FrailRow label="Illnesses — ≥5 kondisi kronis?" checked={frailIllness} onChange={setFrailIllness} />
                  <FrailRow label="Loss of weight — penurunan BB >5% dalam 12 bulan?" checked={frailLoss} onChange={setFrailLoss} />
                </div>
                <ScoreResult score={`Skor: ${frailtyScore}/5`} label={frailty.label} color={frailty.color as any} />
              </AssessmentSection>

              <AssessmentSection title="Clinical Frailty Scale (CFS 1–9)" icon={Shield}>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-9">
                  {[
                    { v: 1, l: "Very Fit" },
                    { v: 2, l: "Well" },
                    { v: 3, l: "Managing Well" },
                    { v: 4, l: "Vulnerable" },
                    { v: 5, l: "Mild Frailty" },
                    { v: 6, l: "Moderate" },
                    { v: 7, l: "Severe" },
                    { v: 8, l: "Very Severe" },
                    { v: 9, l: "Terminally Ill" },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setCfs(opt.v)}
                      className={`rounded-lg border-2 p-2 text-center transition-all ${
                        cfs === opt.v
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="text-sm font-bold">{opt.v}</p>
                      <p className="text-[8px] leading-tight text-muted-foreground">{opt.l}</p>
                    </button>
                  ))}
                </div>
                {cfs != null && (
                  <ScoreResult score={`CFS: ${cfs}`} label={cfsLabel(cfs).label} color={cfsLabel(cfs).color as any} />
                )}
              </AssessmentSection>

              <AssessmentSection title="Morse Fall Scale" icon={AlertTriangle}>
                <div className="space-y-3">
                  <ScoreRow
                    label="Riwayat Jatuh (saat ini/3 bulan terakhir)"
                    value={morseHistoryFall ? 1 : 0}
                    onChange={(v) => setMorseHistoryFall(v === 1)}
                    options={[{ v: 0, l: "Tidak" }, { v: 1, l: "Ya" }]}
                    columns={2}
                  />
                  <ScoreRow
                    label="Diagnosis Sekunder (≥2 diagnosis medis)"
                    value={morseSecondaryDx ? 1 : 0}
                    onChange={(v) => setMorseSecondaryDx(v === 1)}
                    options={[{ v: 0, l: "Tidak" }, { v: 1, l: "Ya" }]}
                    columns={2}
                  />
                  <div>
                    <Label className="text-xs font-medium">Alat Bantu Ambulasi</Label>
                    <div className="mt-1">
                      <ChoiceGroup
                        columns={3}
                        value={morseAmbulatoryAid}
                        onChange={setMorseAmbulatoryAid}
                        options={[
                          { v: "NONE", l: "Bedrest / Mandiri / Perawat" },
                          { v: "CRUTCH_CANE_WALKER", l: "Kruk / Tongkat / Walker" },
                          { v: "FURNITURE", l: "Berpegangan Furnitur" },
                        ]}
                      />
                    </div>
                  </div>
                  <ScoreRow
                    label="Terpasang Infus / Heparin Lock"
                    value={morseIvTherapy ? 1 : 0}
                    onChange={(v) => setMorseIvTherapy(v === 1)}
                    options={[{ v: 0, l: "Tidak" }, { v: 1, l: "Ya" }]}
                    columns={2}
                  />
                  <div>
                    <Label className="text-xs font-medium">Gaya Berjalan (Gait)</Label>
                    <div className="mt-1">
                      <ChoiceGroup
                        columns={3}
                        value={morseGait}
                        onChange={setMorseGait}
                        options={[
                          { v: "NORMAL", l: "Normal / Bedrest" },
                          { v: "WEAK", l: "Lemah" },
                          { v: "IMPAIRED", l: "Terganggu" },
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Status Mental</Label>
                    <div className="mt-1">
                      <ChoiceGroup
                        columns={2}
                        value={morseMentalStatus}
                        onChange={setMorseMentalStatus}
                        options={[
                          { v: "ORIENTED", l: "Sadar akan keterbatasan" },
                          { v: "OVERESTIMATES", l: "Overestimate kemampuan" },
                        ]}
                      />
                    </div>
                  </div>
                </div>
                <ScoreResult score={`Skor Morse: ${morse.score}`} label={morse.label} color={morse.color as any} />
              </AssessmentSection>

              <AssessmentSection title="Timed Up and Go (TUG)" icon={Timer}>
                <ChoiceGroup
                  columns={4}
                  value={tugCategory}
                  onChange={setTugCategory}
                  options={[
                    { v: "<10", l: "<10 detik" },
                    { v: "10-19", l: "10–19 detik" },
                    { v: "20-29", l: "20–29 detik" },
                    { v: ">=30", l: "≥30 detik" },
                  ]}
                />
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  ≥14 detik berkorelasi dengan peningkatan risiko jatuh.
                </p>
              </AssessmentSection>
            </TabsContent>

            <TabsContent value="sarcopenia" className="mt-0 space-y-4">
              <AssessmentSection title="SARC-F (EWGSOP2 Skrining Sarkopenia)" icon={Shield}>
                <div className="space-y-3">
                  {SARCF_ROWS.map((row) => (
                    <ScoreRow
                      key={row.key}
                      label={row.label}
                      value={sarcfValues[row.key]}
                      onChange={(v) => setSarcfValues((s) => ({ ...s, [row.key]: v }))}
                      options={SARCF_OPTIONS[row.key]}
                    />
                  ))}
                </div>
                <ScoreResult score={`Skor: ${sarcf.score}/10`} label={sarcf.positive ? "Probable Sarcopenia" : "Normal"} color={sarcf.positive ? "rose" : "emerald"} />
              </AssessmentSection>

              <AssessmentSection title="Lingkar Betis (Calf Circumference)" icon={Ruler}>
                <ChoiceGroup
                  columns={2}
                  value={calfCategory}
                  onChange={setCalfCategory}
                  options={[
                    { v: "M_NORMAL", l: "≥34 cm (Pria)" },
                    { v: "M_LOW", l: "<34 cm (Pria)" },
                    { v: "F_NORMAL", l: "≥33 cm (Wanita)" },
                    { v: "F_LOW", l: "<33 cm (Wanita)" },
                  ]}
                />
                {calfCategory && (
                  <ScoreResult
                    score={`SARC-CalF: ${sarcCalf.score}/20`}
                    label={sarcCalf.positive ? "Probable Sarcopenia" : "Normal"}
                    color={sarcCalf.positive ? "rose" : "emerald"}
                  />
                )}
              </AssessmentSection>

              <AssessmentSection title="Hand Grip Strength" icon={Hand}>
                <div>
                  <Label className="text-xs">Kekuatan Genggam (kg)</Label>
                  <Input type="number" value={handGrip} onChange={(e) => setHandGrip(e.target.value)} placeholder="contoh: 25" step="0.1" />
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Sarcopenia: &lt;27kg (Wanita), &lt;35kg (Pria) — EWGSOP2
                  </p>
                </div>
              </AssessmentSection>
            </TabsContent>

            <TabsContent value="clinical" className="mt-0 space-y-4">
              <AssessmentSection title="Input CareLivia Engine" icon={Activity}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Level Aktivitas</Label>
                    <Select value={activity} onValueChange={(v) => setActivity(v as ActivityLevel)}>
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
                    <Select value={stress} onValueChange={(v) => setStress(v as StressLevel)}>
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
              </AssessmentSection>

              <AssessmentSection title="Catatan Klinis" icon={Stethoscope}>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan hasil asesmen..."
                  rows={4}
                />
              </AssessmentSection>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={createMut.isPending}>
            {createMut.isPending ? (
              "Menyimpan..."
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Simpan Asesmen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssessmentSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {title}
      </p>
      {children}
    </div>
  );
}

function ScoreResult({
  score,
  label,
  color,
}: {
  score: string;
  label: string;
  color: "emerald" | "amber" | "rose";
}) {
  const colorMap = {
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    amber: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    rose: "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  };
  return (
    <div className={`mt-2.5 flex items-center justify-between rounded-md border px-3 py-1.5 ${colorMap[color]}`}>
      <span className="text-xs font-bold">{score}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function FrailRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border/40 px-3 py-2 text-xs hover:bg-muted/40">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(!!c)} />
      <span>{label}</span>
    </label>
  );
}
