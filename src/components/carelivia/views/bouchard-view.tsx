"use client";

import * as React from "react";
import {
  Activity,
  Bed,
  Flame,
  Gauge,
  Timer,
  Save,
  Trash2,
  Sparkles,
  History,
  User,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
  LoadingState,
} from "@/components/carelivia/ui-helpers";
import { usePatients, usePatient } from "@/hooks/use-carelivia";
import {
  useBouchardAssessments,
  useSaveBouchardAssessment,
  useDeleteBouchardAssessment,
  useAIBouchardInsight,
} from "@/hooks/use-carelivia";
import { useCareLiviaStore } from "@/store/carelivia";
import {
  BOUCHARD_CATEGORIES,
  BOUCHARD_CATEGORY_MAP,
  BOUCHARD_DAY_LABELS,
  BOUCHARD_HOURS,
  BOUCHARD_INTERVALS,
  BUCKET_COLORS,
  BUCKET_LABELS,
  PAL_CATEGORY_LABELS,
  cellIndex,
  computeAssessmentResult,
  emptyDay,
  type BouchardCode,
  type BouchardDayCodes,
} from "@/lib/clinical/bouchard";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const PAL_BADGE_COLOR: Record<string, string> = {
  Sedentary: "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "Low Active": "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Active: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "Very Active": "border-teal-300 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
};

// ---------------------------------------------------------------------
// Grid cell / grid component
// ---------------------------------------------------------------------

function ActivityGrid({
  codes,
  onChange,
  brush,
}: {
  codes: BouchardDayCodes;
  onChange: (next: BouchardDayCodes) => void;
  brush: BouchardCode | null | "erase";
}) {
  const paintingRef = React.useRef(false);

  const paintCell = React.useCallback(
    (idx: number) => {
      if (brush === null) return; // no brush selected -> read-only click
      const next = [...codes];
      next[idx] = brush === "erase" ? null : brush;
      onChange(next);
    },
    [brush, codes, onChange],
  );

  return (
    <div
      className="select-none overflow-x-auto rounded-lg border border-border/60"
      onMouseUp={() => (paintingRef.current = false)}
      onMouseLeave={() => (paintingRef.current = false)}
    >
      <table className="w-full min-w-[420px] border-collapse text-xs">
        <thead>
          <tr className="bg-muted/40">
            <th className="w-14 border-b border-border/60 px-2 py-1.5 text-left font-medium text-muted-foreground">
              Jam
            </th>
            {BOUCHARD_INTERVALS.map((label) => (
              <th
                key={label}
                className="border-b border-border/60 px-2 py-1.5 text-center font-medium text-muted-foreground"
              >
                {label}&apos;
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BOUCHARD_HOURS.map((hour) => (
            <tr key={hour} className="border-b border-border/30 last:border-b-0">
              <td className="px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {String(hour).padStart(2, "0")}:00
              </td>
              {BOUCHARD_INTERVALS.map((_, intervalIdx) => {
                const idx = cellIndex(hour, intervalIdx);
                const code = codes[idx];
                const cat = code ? BOUCHARD_CATEGORY_MAP[code] : null;
                return (
                  <td key={idx} className="p-0.5">
                    <button
                      type="button"
                      title={cat ? `${code} — ${cat.nama}` : "Kosong"}
                      onMouseDown={() => {
                        paintingRef.current = true;
                        paintCell(idx);
                      }}
                      onMouseEnter={() => {
                        if (paintingRef.current) paintCell(idx);
                      }}
                      className="flex h-6 w-full min-w-[26px] items-center justify-center rounded text-[10px] font-semibold text-white transition-transform hover:scale-105"
                      style={{
                        backgroundColor: cat ? BUCKET_COLORS[cat.bucket] : "#e2e8f0",
                        color: cat ? "#fff" : "#94a3b8",
                      }}
                    >
                      {code ?? ""}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------

export function BouchardView() {
  const { activePatientId, setActivePatient } = useCareLiviaStore();
  const { data: patients, isLoading: loadingPatients } = usePatients();
  const { data: patient } = usePatient(activePatientId);

  const [weightKg, setWeightKg] = React.useState<number>(0);
  const [days, setDays] = React.useState<[BouchardDayCodes, BouchardDayCodes, BouchardDayCodes]>([
    emptyDay(),
    emptyDay(),
    emptyDay(),
  ]);
  const [dayDates, setDayDates] = React.useState<[string, string, string]>([
    todayISO(-2),
    todayISO(-1),
    todayISO(0),
  ]);
  const [activeDay, setActiveDay] = React.useState("0");
  const [brush, setBrush] = React.useState<BouchardCode | null | "erase">(null);
  const [notes, setNotes] = React.useState("");
  const [aiInsight, setAiInsight] = React.useState<any>(null);
  const [savedAssessmentId, setSavedAssessmentId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (patient?.weight) setWeightKg(patient.weight);
  }, [patient?.id, patient?.weight]);

  const { data: history, isLoading: loadingHistory } = useBouchardAssessments(activePatientId);
  const saveMutation = useSaveBouchardAssessment();
  const deleteMutation = useDeleteBouchardAssessment();
  const aiMutation = useAIBouchardInsight();

  const result = React.useMemo(
    () => computeAssessmentResult(days, weightKg || 1),
    [days, weightKg],
  );

  const pieData = React.useMemo(
    () =>
      (Object.keys(result.minutesByBucketAvg) as (keyof typeof result.minutesByBucketAvg)[])
        .filter((k) => result.minutesByBucketAvg[k] > 0)
        .map((k) => ({
          name: BUCKET_LABELS[k],
          value: result.minutesByBucketAvg[k],
          color: BUCKET_COLORS[k],
        })),
    [result.minutesByBucketAvg],
  );

  const barData = React.useMemo(
    () =>
      result.days.map((d, i) => ({
        hari: BOUCHARD_DAY_LABELS[i],
        Ringan: d.minutesByBucket.ringan,
        Sedang: d.minutesByBucket.sedang,
        Berat: d.minutesByBucket.berat,
      })),
    [result.days],
  );

  function updateDay(dayIdx: number, next: BouchardDayCodes) {
    setDays((prev) => {
      const copy = [...prev] as [BouchardDayCodes, BouchardDayCodes, BouchardDayCodes];
      copy[dayIdx] = next;
      return copy;
    });
  }

  async function handleSave() {
    if (!activePatientId) {
      toast.error("Pilih pasien terlebih dahulu");
      return;
    }
    if (!weightKg || weightKg <= 0) {
      toast.error("Berat badan pasien wajib diisi");
      return;
    }
    try {
      const res = await saveMutation.mutateAsync({
        patientId: activePatientId,
        weightKg,
        day1Date: dayDates[0],
        day1Codes: days[0],
        day2Date: dayDates[1],
        day2Codes: days[1],
        day3Date: dayDates[2],
        day3Codes: days[2],
        notes,
      });
      setSavedAssessmentId(res?.assessment?.id ?? null);
      setAiInsight(null);
      toast.success("Bouchard Activity Record tersimpan");
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan assessment");
    }
  }

  async function handleAIInsight() {
    if (!savedAssessmentId) {
      toast.error("Simpan assessment terlebih dahulu sebelum meminta AI Insight");
      return;
    }
    try {
      const ageYears = patient?.birthDate
        ? Math.floor(
            (Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000),
          )
        : 0;
      const res = await aiMutation.mutateAsync({
        assessmentId: savedAssessmentId,
        patientId: activePatientId!,
        patientName: patient?.name ?? "Pasien",
        ageYears,
        gender: patient?.gender ?? "",
        diagnoses: (patient?.diagnoses || [])
          .filter((d: any) => d.active !== false)
          .map((d: any) => d.type),
        weightKg,
        avgEnergyExpenditure: result.avgEnergyExpenditure,
        avgMet: result.avgMet,
        avgPal: result.avgPal,
        palCategory: result.palCategory,
        minutesByBucket: result.minutesByBucketAvg,
        whoMinutesPerWeek: result.aerobicModerateEquivalentMinutesPerWeek,
      });
      setAiInsight(res);
      toast.success("AI Insight berhasil dibuat");
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuat AI Insight");
    }
  }

  function loadFromHistory(item: any) {
    setWeightKg(item.weightKg ?? weightKg);
    setDays([
      (item.day1Codes?.length ? item.day1Codes : emptyDay()) as BouchardDayCodes,
      (item.day2Codes?.length ? item.day2Codes : emptyDay()) as BouchardDayCodes,
      (item.day3Codes?.length ? item.day3Codes : emptyDay()) as BouchardDayCodes,
    ]);
    setDayDates([
      item.day1Date ?? todayISO(-2),
      item.day2Date ?? todayISO(-1),
      item.day3Date ?? todayISO(0),
    ]);
    setSavedAssessmentId(item.id);
    setNotes(item.notes ?? "");
    setAiInsight(
      item.aiSummary
        ? {
            summary: item.aiSummary,
            findings: item.aiFindings ?? [],
            recommendations: item.aiRecommendations ?? [],
            risk_level: item.aiRiskLevel ?? "LOW",
          }
        : null,
    );
    toast.success("Assessment dimuat dari riwayat");
  }

  const currentDayIdx = Number(activeDay);
  const currentDayResult = result.days[currentDayIdx];

  return (
    <div>
      <PageHeader
        title="Bouchard Activity Record"
        subtitle="Physical Activity Log 3 hari (96 kotak/hari) — Energy Expenditure, MET & Physical Activity Level (PAL)"
        icon={Activity}
      />

      {/* Patient & weight */}
      <SectionCard title="Pasien & Berat Badan" description="Pilih pasien dan pastikan berat badan terkini" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="mb-1.5 block text-xs">Pasien</Label>
            <Select
              value={activePatientId ?? undefined}
              onValueChange={(v) => setActivePatient(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingPatients ? "Memuat..." : "Pilih pasien"} />
              </SelectTrigger>
              <SelectContent>
                {(patients || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Berat Badan (kg)</Label>
            <Input
              type="number"
              min={1}
              step={0.1}
              value={weightKg || ""}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              placeholder="cth. 70"
            />
          </div>
          <div className="flex items-end">
            {patient && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {patient.gender === "MALE" ? "Laki-laki" : patient.gender === "FEMALE" ? "Perempuan" : patient.gender}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {!activePatientId ? (
        <EmptyState
          icon={User}
          title="Pilih pasien terlebih dahulu"
          description="Bouchard Activity Record memerlukan data pasien (berat badan) untuk menghitung Energy Expenditure."
        />
      ) : (
        <>
          {/* Dashboard summary */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Energy Expenditure"
              value={result.avgEnergyExpenditure || 0}
              unit="kkal/hari"
              icon={Flame}
              color="amber"
              sublabel="Rerata hari terisi"
            />
            <StatCard
              label="MET"
              value={result.avgMet || 0}
              icon={Gauge}
              color="violet"
              sublabel="Metabolic Equivalent"
            />
            <StatCard
              label="PAL"
              value={result.avgPal || 0}
              icon={Timer}
              color="teal"
              sublabel={PAL_CATEGORY_LABELS[result.palCategory]}
            />
            <StatCard
              label="Estimasi Aerobik/Minggu"
              value={result.aerobicModerateEquivalentMinutesPerWeek}
              unit="menit"
              icon={Activity}
              color="emerald"
              sublabel="Setara intensitas moderat"
            />
          </div>

          {/* WHO status banner */}
          <div
            className={`mb-6 flex items-start gap-3 rounded-lg border p-4 text-sm ${
              result.whoStatus.meetsWhoMinimum
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
            }`}
          >
            {result.whoStatus.meetsWhoMinimum ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p>{result.whoStatus.message}</p>
          </div>

          {/* Grid input */}
          <SectionCard
            title="Formulir Pencatatan Aktivitas (96 kotak/hari)"
            description="Pilih kode aktivitas pada palet, lalu klik atau seret (drag) pada kotak untuk mengisi. Satu kotak = 15 menit."
            className="mb-6"
          >
            {/* Palette */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {BOUCHARD_CATEGORIES.map((cat) => (
                <button
                  key={cat.code}
                  type="button"
                  onClick={() => setBrush(cat.code)}
                  title={`${cat.nama} — ${cat.contohAktivitas.slice(0, 3).join(", ")}`}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-all ${
                    brush === cat.code ? "ring-2 ring-offset-1" : "opacity-80 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: `${BUCKET_COLORS[cat.bucket]}1A`,
                    borderColor: BUCKET_COLORS[cat.bucket],
                    color: BUCKET_COLORS[cat.bucket],
                  }}
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: BUCKET_COLORS[cat.bucket] }}
                  >
                    {cat.code}
                  </span>
                  {cat.nama}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setBrush("erase")}
                className={`rounded-md border border-dashed px-2 py-1 text-[11px] font-medium text-muted-foreground transition-all ${
                  brush === "erase" ? "ring-2 ring-offset-1" : "opacity-80 hover:opacity-100"
                }`}
              >
                Hapus
              </button>
              {brush && (
                <Badge variant="outline" className="ml-auto">
                  Mode isi:{" "}
                  {brush === "erase" ? "Hapus" : `${brush} — ${BOUCHARD_CATEGORY_MAP[brush as BouchardCode].nama}`}
                </Badge>
              )}
            </div>

            <Tabs value={activeDay} onValueChange={setActiveDay}>
              <TabsList>
                {BOUCHARD_DAY_LABELS.map((label, i) => (
                  <TabsTrigger key={i} value={String(i)}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {BOUCHARD_DAY_LABELS.map((label, i) => (
                <TabsContent key={i} value={String(i)} className="mt-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Label className="text-xs">Tanggal {label}</Label>
                    <Input
                      type="date"
                      className="h-8 w-40 text-xs"
                      value={dayDates[i]}
                      onChange={(e) => {
                        const next = [...dayDates] as [string, string, string];
                        next[i] = e.target.value;
                        setDayDates(next);
                      }}
                    />
                    <Badge variant="secondary" className="ml-auto">
                      {result.days[i].filledBoxes}/96 kotak terisi
                    </Badge>
                  </div>
                  <ActivityGrid
                    codes={days[i]}
                    onChange={(next) => updateDay(i, next)}
                    brush={brush}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </SectionCard>

          {/* Per-day results */}
          <SectionCard title="Ringkasan Per Hari" className="mb-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {result.days.map((d, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-3">
                  <p className="mb-1 text-xs font-semibold text-foreground">{BOUCHARD_DAY_LABELS[i]}</p>
                  <p className="text-[11px] text-muted-foreground">{dayDates[i]}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Energy Expenditure</span>
                      <span className="font-medium">{d.energyExpenditure} kkal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">MET / PAL</span>
                      <span className="font-medium">{d.met}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kotak terisi</span>
                      <span className={d.isComplete ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
                        {d.filledBoxes}/96
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Visualizations */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <SectionCard title="Distribusi Intensitas (rerata menit/hari)">
              {pieData.length === 0 ? (
                <EmptyState icon={Info} title="Belum ada data" description="Isi grid aktivitas untuk melihat distribusi." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `${v} menit`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
            <SectionCard title="Menit Aktivitas Sedang/Berat per Hari">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hari" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Ringan" fill={BUCKET_COLORS.ringan} />
                    <Bar dataKey="Sedang" fill={BUCKET_COLORS.sedang} />
                    <Bar dataKey="Berat" fill={BUCKET_COLORS.berat} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          {/* Notes + Save */}
          <SectionCard title="Catatan & Simpan" className="mb-6">
            <Textarea
              placeholder="Catatan tambahan (opsional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mb-3"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? "Menyimpan..." : "Simpan Assessment"}
              </Button>
              <Button
                variant="outline"
                onClick={handleAIInsight}
                disabled={aiMutation.isPending || !savedAssessmentId}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {aiMutation.isPending ? "Menganalisis..." : "AI Insight"}
              </Button>
            </div>
          </SectionCard>

          {/* AI Insight */}
          {aiInsight && (
            <SectionCard
              title="AI Insight — Aktivitas Fisik"
              description="Dihasilkan berdasarkan hasil perhitungan Bouchard, standar WHO & ACSM"
              className="mb-6"
              actions={
                <Badge
                  variant="outline"
                  className={
                    aiInsight.risk_level === "HIGH"
                      ? "border-rose-300 text-rose-700"
                      : aiInsight.risk_level === "MODERATE"
                        ? "border-amber-300 text-amber-700"
                        : "border-emerald-300 text-emerald-700"
                  }
                >
                  Risiko {aiInsight.risk_level}
                </Badge>
              }
            >
              <p className="mb-3 text-sm text-foreground">{aiInsight.summary}</p>
              {aiInsight.findings?.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Temuan</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-foreground">
                    {aiInsight.findings.map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiInsight.who_recommendation && (
                <p className="mb-2 text-xs">
                  <span className="font-semibold text-muted-foreground">WHO: </span>
                  {aiInsight.who_recommendation}
                </p>
              )}
              {aiInsight.acsm_recommendation && (
                <p className="mb-2 text-xs">
                  <span className="font-semibold text-muted-foreground">ACSM: </span>
                  {aiInsight.acsm_recommendation}
                </p>
              )}
              {aiInsight.exercise_prescription?.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Resep Aktivitas Fisik</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-foreground">
                    {aiInsight.exercise_prescription.map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiInsight.recommendations?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Rekomendasi</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-foreground">
                    {aiInsight.recommendations.map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          )}

          {/* History */}
          <SectionCard title="Riwayat Assessment" description="Klik untuk memuat kembali ke formulir">
            {loadingHistory ? (
              <LoadingState count={2} />
            ) : !history || history.length === 0 ? (
              <EmptyState icon={History} title="Belum ada riwayat" description="Assessment yang tersimpan akan muncul di sini." />
            ) : (
              <div className="space-y-2">
                {history.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3 text-sm hover:bg-muted/30"
                  >
                    <button className="flex-1 text-left" onClick={() => loadFromHistory(item)}>
                      <span className="font-medium">{item.assessmentDate}</span>
                      <span className="ml-3 text-xs text-muted-foreground">
                        EE {item.avgEnergyExpenditure} kkal · MET {item.avgMet} · PAL {item.avgPal}
                      </span>
                    </button>
                    <Badge variant="outline" className={PAL_BADGE_COLOR[item.palCategory] || ""}>
                      {item.palCategory}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
