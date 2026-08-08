"use client";

import * as React from "react";
import {
  Dna,
  Upload,
  Sparkles,
  Loader2,
  FileText,
  Trash2,
  Download,
  ChevronRight,
  AlertTriangle,
  ClipboardList,
  Pill,
  Dumbbell,
  Activity,
  UtensilsCrossed,
  Ban,
  User,
} from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  PageHeader,
  SectionCard,
  StatCard,
  LoadingState,
  EmptyState,
} from "@/components/carelivia/ui-helpers";
import { NutrigenomicUploadDialog } from "@/components/carelivia/nutrigenomic-upload-dialog";
import { usePatients } from "@/hooks/use-carelivia";
import {
  useGenomicReports,
  useGenomicReportDetail,
  useInterpretGenomicReport,
  useDeleteGenomicReport,
} from "@/hooks/use-nutrigenomic";
import { useCareLiviaStore } from "@/store/carelivia";
import { exportClinicalReportPdf } from "@/lib/pdf/export-clinical-report";
import { useAuth } from "@/lib/supabase/auth-context";

const RISK_COLOR: Record<string, string> = {
  LOW: "bg-emerald-500",
  MODERATE: "bg-amber-500",
  HIGH: "bg-rose-500",
};
const RISK_LABEL: Record<string, string> = { LOW: "Rendah", MODERATE: "Sedang", HIGH: "Tinggi" };
const RISK_SCORE: Record<string, number> = { LOW: 1, MODERATE: 2, HIGH: 3 };

const EVIDENCE_BADGE: Record<string, string> = {
  STRONG: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  MODERATE: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  LIMITED: "border-slate-400/40 text-slate-600 dark:text-slate-400",
  ASSOCIATIVE: "border-slate-400/40 text-slate-500 dark:text-slate-500",
};
const EVIDENCE_LABEL: Record<string, string> = {
  STRONG: "Bukti Kuat",
  MODERATE: "Bukti Sedang",
  LIMITED: "Bukti Terbatas",
  ASSOCIATIVE: "Asosiasi Awal",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  UPLOADED: { label: "Diunggah", className: "bg-slate-500/10 text-slate-600" },
  PROCESSING: { label: "Menunggu Interpretasi", className: "bg-amber-500/10 text-amber-600" },
  ANALYZED: { label: "Dianalisis AI", className: "bg-emerald-500/10 text-emerald-600" },
  NEEDS_REVIEW: { label: "Perlu Tinjauan", className: "bg-rose-500/10 text-rose-600" },
  FAILED: { label: "Gagal", className: "bg-rose-500/10 text-rose-600" },
};

const RISK_SUMMARY_LABELS: Record<string, string> = {
  obesity: "Obesitas",
  diabetes: "Diabetes",
  dyslipidemia: "Dislipidemia",
  hypertension: "Hipertensi",
  inflammation: "Inflamasi",
  vitaminDeficiency: "Defisiensi Vitamin",
  intolerance: "Intoleransi",
};

export function NutrigenomicView() {
  const { user } = useAuth();
  const { data: patients } = usePatients();
  const { activePatientId, setActivePatient, setActiveView } = useCareLiviaStore();
  const [selectedPatientId, setSelectedPatientId] = React.useState(activePatientId || "");
  const [selectedReportId, setSelectedReportId] = React.useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  React.useEffect(() => {
    if (activePatientId && !selectedPatientId) setSelectedPatientId(activePatientId);
  }, [activePatientId, selectedPatientId]);

  const { data: reports, isLoading: loadingReports } = useGenomicReports(selectedPatientId || null);
  const { data: detail, isLoading: loadingDetail } = useGenomicReportDetail(selectedReportId);
  const interpret = useInterpretGenomicReport();
  const del = useDeleteGenomicReport(selectedPatientId);

  const patient = patients?.find((p: any) => p.id === selectedPatientId);

  React.useEffect(() => {
    if (reports && reports.length > 0 && !selectedReportId) {
      setSelectedReportId(reports[0].id);
    }
    if (reports && reports.length === 0) setSelectedReportId(null);
  }, [reports, selectedReportId]);

  const handlePatientChange = (id: string) => {
    setSelectedPatientId(id);
    setActivePatient(id);
    setSelectedReportId(null);
  };

  const handleInterpret = async () => {
    if (!selectedPatientId || !selectedReportId) return;
    try {
      await interpret.mutateAsync({ patientId: selectedPatientId, reportId: selectedReportId });
      toast.success("Interpretasi klinis nutrigenomik berhasil dibuat");
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuat interpretasi");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus laporan nutrigenomik ini? Tindakan ini tidak dapat dibatalkan.")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Laporan dihapus");
      if (selectedReportId === id) setSelectedReportId(null);
    } catch (e: any) {
      toast.error(e?.message || "Gagal menghapus laporan");
    }
  };

  const handleDownloadPdf = async () => {
    const node = document.querySelector<HTMLElement>(".cl-nutrigenomic-report");
    if (!node || !patient) return;
    setIsExporting(true);
    try {
      const doctorName = user?.user_metadata?.name || (user?.email ? user.email.split("@")[0] : null);
      const documentNumber = `CL-GEN/${new Date().getFullYear()}/${(patient.mrn || "").replace(/[^0-9A-Z]/g, "").slice(-6) || "—"}`;
      const fileName = `laporan-nutrigenomik-${(patient.name || "pasien").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
      await exportClinicalReportPdf(node, { documentNumber, patientName: patient.name, patientMrn: patient.mrn, doctorName, fileName });
    } catch (e) {
      console.error("[nutrigenomic export-pdf] failed:", e);
      toast.error("Gagal membuat PDF. Coba lagi.");
    } finally {
      setIsExporting(false);
    }
  };

  const interpretation = detail?.interpretation;
  const findings = detail?.findings || [];

  const radarData = interpretation
    ? Object.entries(interpretation.riskSummary || {})
        .filter(([k, v]) => k !== "exercisePerformance" && v)
        .map(([k, v]) => ({ risk: RISK_SUMMARY_LABELS[k] || k, level: RISK_SCORE[v as string] || 0 }))
    : [];

  return (
    <div>
      <PageHeader
        title="Nutrigenomic AI"
        subtitle="Upload hasil pemeriksaan nutrigenomik, dapatkan interpretasi klinis AI, dan hasilkan meal plan presisi"
        icon={Dna}
        actions={
          selectedPatientId ? (
            <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
              <Upload className="h-4 w-4" /> Upload Laporan
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 max-w-sm">
        <Select value={selectedPatientId} onValueChange={handlePatientChange}>
          <SelectTrigger>
            <User className="mr-1.5 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Pilih pasien…" />
          </SelectTrigger>
          <SelectContent>
            {(patients || []).map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.name} — {p.mrn}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedPatientId && (
        <EmptyState title="Pilih pasien terlebih dahulu" description="Pilih pasien untuk melihat atau mengunggah hasil pemeriksaan nutrigenomik." icon={Dna} />
      )}

      {selectedPatientId && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Laporan" value={reports?.length ?? 0} icon={FileText} color="teal" />
            <StatCard label="Gen Dianalisis" value={detail?.findings?.length ?? 0} icon={Dna} color="violet" />
            <StatCard
              label="Status"
              value={detail?.report ? (STATUS_BADGE[detail.report.status]?.label ?? detail.report.status) : "—"}
              icon={Activity}
              color="primary"
            />
            <StatCard
              label="Terakhir Dianalisis"
              value={detail?.report?.examDate ? new Date(detail.report.examDate).toLocaleDateString("id-ID") : "—"}
              icon={ClipboardList}
              color="amber"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            {/* Report list */}
            <SectionCard title="Riwayat Laporan" description="Pilih laporan untuk melihat detail">
              {loadingReports && <LoadingState count={2} />}
              {!loadingReports && (reports?.length ?? 0) === 0 && (
                <EmptyState title="Belum ada laporan" description="Upload hasil pemeriksaan nutrigenomik pertama pasien ini." icon={Upload} />
              )}
              <div className="space-y-2">
                {(reports || []).map((r: any) => {
                  const badge = STATUS_BADGE[r.status] || STATUS_BADGE.UPLOADED;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedReportId(r.id)}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors ${
                        selectedReportId === r.id ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.laboratoryName || "Laboratorium tidak diketahui"}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.examDate ? new Date(r.examDate).toLocaleDateString("id-ID") : "Tanggal tidak diketahui"} · {r.totalGenes} gen
                        </p>
                        <Badge variant="secondary" className={`mt-1 text-[10px] ${badge.className}`}>{badge.label}</Badge>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* Detail */}
            <div className="space-y-5">
              {!selectedReportId && (
                <EmptyState title="Belum ada laporan dipilih" description="Pilih laporan di sisi kiri, atau unggah laporan baru." icon={FileText} />
              )}

              {selectedReportId && loadingDetail && <LoadingState count={3} />}

              {selectedReportId && detail && (
                <div className="cl-nutrigenomic-report space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{detail.report.laboratoryName || "Laporan Nutrigenomik"}</h3>
                      {detail.report.examType && <Badge variant="outline">{detail.report.examType}</Badge>}
                    </div>
                    <div className="no-print flex flex-wrap gap-2">
                      {!interpretation && (
                        <Button size="sm" onClick={handleInterpret} disabled={interpret.isPending} className="gap-1.5">
                          {interpret.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          {interpret.isPending ? "Menganalisis…" : "Buat Interpretasi Klinis AI"}
                        </Button>
                      )}
                      {interpretation && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setActiveView("meal-plan")} className="gap-1.5">
                            <UtensilsCrossed className="h-3.5 w-3.5" /> Generate Precision Meal Plan
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={isExporting} className="gap-1.5">
                            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            Unduh PDF
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => handleDelete(selectedReportId)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {detail.report.extractionNotes && (
                    <Alert className="border-amber-500/30 bg-amber-500/5">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-sm">Catatan Ekstraksi</AlertTitle>
                      <AlertDescription className="text-xs">{detail.report.extractionNotes}</AlertDescription>
                    </Alert>
                  )}

                  {interpretation && (
                    <SectionCard title="Ringkasan Nutrigenomik">
                      <p className="text-sm leading-relaxed text-foreground">{interpretation.summary}</p>
                    </SectionCard>
                  )}

                  {/* Traffic light + radar */}
                  {interpretation && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <SectionCard title="Ringkasan Risiko" description="Traffic light berdasarkan temuan genetik + data klinis">
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(interpretation.riskSummary || {})
                            .filter(([k]) => k !== "exercisePerformance")
                            .map(([k, v]) => (
                              <div key={k} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs">
                                <span>{RISK_SUMMARY_LABELS[k] || k}</span>
                                {v ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className={`h-2.5 w-2.5 rounded-full ${RISK_COLOR[v as string]}`} />
                                    {RISK_LABEL[v as string]}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </div>
                            ))}
                        </div>
                        {interpretation.riskSummary?.exercisePerformance && (
                          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Dumbbell className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {interpretation.riskSummary.exercisePerformance}
                          </p>
                        )}
                      </SectionCard>

                      <SectionCard title="Radar Risiko Nutrigenomik">
                        {radarData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={220}>
                            <RadarChart data={radarData} outerRadius="75%">
                              <PolarGrid stroke="var(--border)" />
                              <PolarAngleAxis dataKey="risk" tick={{ fontSize: 10 }} />
                              <PolarRadiusAxis domain={[0, 3]} tick={false} axisLine={false} />
                              <Radar name="Tingkat Risiko" dataKey="level" stroke="#0d9488" fill="#0d9488" fillOpacity={0.35} />
                            </RadarChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-xs text-muted-foreground">Data risiko belum tersedia.</p>
                        )}
                      </SectionCard>
                    </div>
                  )}

                  {/* Gene cards */}
                  <SectionCard title={`Detail Per Gen (${findings.length})`} description="Hanya gen yang benar-benar terekstrak dari dokumen">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {findings.map((f: any) => (
                        <div key={f.id} className="rounded-lg border border-border/60 p-3">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <p className="font-mono text-sm font-semibold">{f.geneSymbol}</p>
                            <div className="flex gap-1.5">
                              {f.riskLevel && (
                                <span className={`h-2 w-2 rounded-full ${RISK_COLOR[f.riskLevel]}`} title={RISK_LABEL[f.riskLevel]} />
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {f.rsId || "—"} {f.genotype ? `· Genotipe: ${f.genotype}` : ""}
                          </p>
                          {f.clinicalMeaning && <p className="mt-2 text-xs leading-relaxed">{f.clinicalMeaning}</p>}
                          {f.nutritionImpact && (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              <span className="font-medium text-foreground">Dampak nutrisi: </span>
                              {f.nutritionImpact}
                            </p>
                          )}
                          {f.evidenceLevel && (
                            <Badge variant="outline" className={`mt-2 text-[10px] ${EVIDENCE_BADGE[f.evidenceLevel]}`}>
                              {EVIDENCE_LABEL[f.evidenceLevel]}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  {interpretation && (
                    <>
                      {interpretation.clinicalImplications?.length > 0 && (
                        <SectionCard title="Implikasi Klinis" description="Kaitan temuan genetik dengan diagnosis pasien">
                          <ul className="space-y-2 text-sm">
                            {interpretation.clinicalImplications.map((c: any, i: number) => (
                              <li key={i} className="rounded-md border border-border/50 p-2.5">
                                <span className="font-medium">{c.relatedDiagnosis}</span>
                                <span className="text-muted-foreground"> × {c.relatedGene}</span>
                                <p className="mt-1 text-muted-foreground">{c.implication}</p>
                              </li>
                            ))}
                          </ul>
                        </SectionCard>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <SectionCard title="Makanan Dianjurkan" actions={<UtensilsCrossed className="h-4 w-4 text-emerald-600" />}>
                          <div className="flex flex-wrap gap-1.5">
                            {(interpretation.recommendedFoods || []).map((f: string, i: number) => (
                              <Badge key={i} variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{f}</Badge>
                            ))}
                          </div>
                        </SectionCard>
                        <SectionCard title="Makanan Perlu Dibatasi" actions={<Ban className="h-4 w-4 text-rose-600" />}>
                          <div className="flex flex-wrap gap-1.5">
                            {(interpretation.restrictedFoods || []).map((f: string, i: number) => (
                              <Badge key={i} variant="secondary" className="bg-rose-500/10 text-rose-700 dark:text-rose-400">{f}</Badge>
                            ))}
                          </div>
                        </SectionCard>
                      </div>

                      {interpretation.nutritionImplications && (
                        <SectionCard title="Implikasi Nutrisi">
                          <div className="grid gap-3 sm:grid-cols-2">
                            {Object.entries({
                              Makronutrien: interpretation.nutritionImplications.macronutrients,
                              Mikronutrien: interpretation.nutritionImplications.micronutrients,
                              Antioksidan: interpretation.nutritionImplications.antioxidants,
                              Fitonutrien: interpretation.nutritionImplications.phytonutrients,
                              Serat: interpretation.nutritionImplications.fiber,
                            }).filter(([, v]) => v).map(([k, v]) => (
                              <div key={k} className="text-xs">
                                <p className="font-medium text-foreground">{k}</p>
                                <p className="mt-0.5 text-muted-foreground">{v as string}</p>
                              </div>
                            ))}
                          </div>
                        </SectionCard>
                      )}

                      {interpretation.interventionPriorities?.length > 0 && (
                        <SectionCard title="Prioritas Intervensi" description="Diurutkan berdasarkan kekuatan bukti & relevansi klinis">
                          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                            {interpretation.interventionPriorities.map((p: string, i: number) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ol>
                        </SectionCard>
                      )}

                      {interpretation.supplementation?.length > 0 && (
                        <SectionCard title="Suplementasi" description="Bukan rekomendasi otomatis — berdasarkan kombinasi genetik + data klinis" actions={<Pill className="h-4 w-4 text-violet-600" />}>
                          <div className="space-y-2">
                            {interpretation.supplementation.map((s: any, i: number) => (
                              <div key={i} className="rounded-md border border-border/50 p-2.5 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{s.supplement}</span>
                                  <Badge variant="outline" className={`text-[10px] ${EVIDENCE_BADGE[s.evidenceLevel]}`}>{EVIDENCE_LABEL[s.evidenceLevel]}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{s.reasoning}</p>
                              </div>
                            ))}
                          </div>
                        </SectionCard>
                      )}

                      {interpretation.exerciseRecommendations?.length > 0 && (
                        <SectionCard title="Rekomendasi Olahraga" actions={<Dumbbell className="h-4 w-4 text-amber-600" />}>
                          <div className="space-y-2">
                            {interpretation.exerciseRecommendations.map((e: any, i: number) => (
                              <div key={i} className="rounded-md border border-border/50 p-2.5 text-sm">
                                <span className="font-mono text-xs text-muted-foreground">{e.relatedGene}</span>
                                <p className="font-medium">{e.recommendation}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{e.reasoning}</p>
                              </div>
                            ))}
                          </div>
                        </SectionCard>
                      )}

                      {interpretation.monitoringPlan?.length > 0 && (
                        <SectionCard title="Rencana Monitoring" actions={<ClipboardList className="h-4 w-4 text-primary" />}>
                          <div className="space-y-1.5 text-sm">
                            {interpretation.monitoringPlan.map((m: any, i: number) => (
                              <div key={i} className="flex items-center justify-between border-b border-border/40 pb-1.5 last:border-0">
                                <span>{m.parameter}</span>
                                <span className="text-xs text-muted-foreground">
                                  {m.intervalMonths ? `tiap ${m.intervalMonths} bulan` : ""} {m.reasoning ? `· ${m.reasoning}` : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </SectionCard>
                      )}

                      {interpretation.interpretationCaveats?.length > 0 && (
                        <Alert className="border-slate-400/30 bg-slate-500/5">
                          <AlertTriangle className="h-4 w-4 text-slate-500" />
                          <AlertTitle className="text-sm">Catatan Keterbatasan Interpretasi</AlertTitle>
                          <AlertDescription className="text-xs">
                            <ul className="list-disc space-y-1 pl-4">
                              {interpretation.interpretationCaveats.map((c: string, i: number) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {selectedPatientId && (
        <NutrigenomicUploadDialog
          patientId={selectedPatientId}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onSaved={(reportId) => setSelectedReportId(reportId)}
        />
      )}
    </div>
  );
}
