"use client";

import * as React from "react";
import {
  Brain,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ListChecks,
  Target,
  Utensils,
  Dumbbell,
  ClipboardCheck,
  HeartPulse,
  Stethoscope,
  User,
  ShieldAlert,
  Scale,
  Activity,
  ChefHat,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useClinicalAssessment,
  useGenerateClinicalAssessment,
} from "@/hooks/use-carelivia";

// ---------------------------------------------------------------------
// Visual indicator dot: 🟢 BAIK · 🟡 PERHATIAN · 🟠 RISIKO_SEDANG · 🔴 RISIKO_TINGGI
// ---------------------------------------------------------------------
const STATUS_STYLE: Record<string, { dot: string; label: string; badge: string }> = {
  BAIK: { dot: "bg-emerald-500", label: "Baik", badge: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
  PERHATIAN: { dot: "bg-amber-400", label: "Perlu Perhatian", badge: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  RISIKO_SEDANG: { dot: "bg-orange-500", label: "Risiko Sedang", badge: "border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400" },
  RISIKO_TINGGI: { dot: "bg-rose-500", label: "Risiko Tinggi", badge: "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400" },
};

const URGENCY_STYLE: Record<string, string> = {
  RENDAH: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  SEDANG: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  TINGGI: "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
};

const RISK_LEVEL_STYLE: Record<string, string> = {
  LOW: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  MODERATE: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  HIGH: "border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  CRITICAL: "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
};

const RISK_LEVEL_LABEL: Record<string, string> = {
  LOW: "Risiko Rendah",
  MODERATE: "Risiko Sedang",
  HIGH: "Risiko Tinggi",
  CRITICAL: "Risiko Kritis",
};

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">{title}</h4>
      </div>
      {children}
    </div>
  );
}

export function AIClinicalAssessmentDashboard({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const { data: assessment, isLoading } = useClinicalAssessment(patientId);
  const generate = useGenerateClinicalAssessment();

  const handleGenerate = () => {
    generate.mutate(
      { patientId },
      {
        onError: (e: any) => toast.error(e?.message || "Gagal membuat evaluasi AI"),
        onSuccess: () => toast.success("Evaluasi AI CareLivia berhasil dibuat"),
      },
    );
  };

  const current = generate.data || assessment;
  const busy = generate.isPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Clinical Decision Support System berbasis seluruh data pasien di CareLivia.
        </p>
        <Button size="sm" variant="outline" onClick={handleGenerate} disabled={busy} className="gap-1.5 print:hidden">
          {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {current ? "Perbarui Evaluasi" : "Buat Evaluasi AI"}
        </Button>
      </div>

      {isLoading && !current && (
        <p className="text-sm text-muted-foreground">Memuat evaluasi AI…</p>
      )}

      {!isLoading && !current && !busy && (
        <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-4 text-center text-sm text-muted-foreground">
          Belum ada Evaluasi AI untuk {patientName}. Klik &quot;Buat Evaluasi AI&quot; untuk menghasilkan Clinical
          Nutrition Assessment komprehensif berbasis seluruh data pasien (diagnosis, antropometri, skrining gizi,
          meal plan, food record, dan rencana latihan).
        </div>
      )}

      {current && (
        <div className="space-y-3">
          {/* Fallback notice — shown only when the AI Engine was unreachable and
              CareLivia's rule-based clinical engine produced this evaluation
              instead. The data is still complete, but lacks the deeper
              narrative reasoning the full AI would provide. */}
          {current.isFallback && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 print:hidden">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Evaluasi dari Mesin Aturan (Rule-Based Fallback)</p>
                <p className="mt-0.5 leading-relaxed">
                  AI Engine sedang tidak dapat diakses, sehingga evaluasi ini dihasilkan otomatis oleh mesin aturan
                  klinis CareLivia berdasarkan data pasien yang sama. Klik &quot;Perbarui Evaluasi&quot; untuk mencoba
                  mendapatkan analisis AI penuh begitu layanan kembali normal.
                </p>
              </div>
            </div>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {current.aiModel && (
              <Badge variant="outline" className="text-[10px]">
                {current.isFallback ? "Mesin Aturan (Fallback)" : current.aiModel}
              </Badge>
            )}
            {current.generatedAt && (
              <span>Dibuat: {new Date(current.generatedAt).toLocaleString("id-ID")}</span>
            )}
            {current.overall_risk_level && (
              <Badge className={`text-[10px] ${RISK_LEVEL_STYLE[current.overall_risk_level] || ""}`} variant="outline">
                {RISK_LEVEL_LABEL[current.overall_risk_level] || current.overall_risk_level}
              </Badge>
            )}
          </div>

          {/* 1. Ringkasan Klinis */}
          <Card title="1. Ringkasan Klinis" icon={Stethoscope}>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Diagnosis Utama</p>
                <p className="font-medium text-foreground">{current.ringkasan_klinis?.diagnosis_utama || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Status Gizi</p>
                <p className="font-medium text-foreground">{current.ringkasan_klinis?.status_gizi || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Target Kalori</p>
                <p className="font-medium text-foreground">{current.ringkasan_klinis?.target_kalori_kcal || 0} kkal</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Target Protein</p>
                <p className="font-medium text-foreground">{current.ringkasan_klinis?.target_protein_g || 0} g</p>
              </div>
            </div>
            {current.ringkasan_klinis?.diagnosis_penyerta?.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Diagnosis penyerta: {current.ringkasan_klinis.diagnosis_penyerta.join(", ")}
              </p>
            )}
          </Card>

          {/* 2. Analisis Antropometri */}
          <Card title="2. Analisis Antropometri" icon={Scale}>
            <p className="text-xs text-foreground">
              <span className="font-semibold">Metode berat badan: </span>
              {current.analisis_antropometri?.metode_berat_badan || "—"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {current.analisis_antropometri?.alasan || current.analisis_antropometri?.alasan_klinis || "—"}
            </p>
          </Card>

          {/* 3. Analisis Diagnosis */}
          {current.analisis_diagnosis?.length > 0 && (
            <Card title="3. Analisis Diagnosis" icon={Activity}>
              <div className="space-y-1.5">
                {current.analisis_diagnosis.map((d: any, i: number) => (
                  <div key={i} className="rounded-md border border-border/50 bg-muted/20 p-2">
                    <p className="text-xs font-semibold text-foreground">{d.diagnosis}</p>
                    <p className="text-[11px] text-muted-foreground">{d.dampak_intervensi}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 4. Temuan Penting */}
          <Card title="4. Temuan Penting" icon={ListChecks}>
            <ul className="space-y-1 text-xs text-foreground">
              {(current.temuan_penting || []).map((t: string, i: number) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-primary">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* 5. Prioritas Intervensi */}
          <Card title="5. Prioritas Intervensi" icon={AlertTriangle}>
            <div className="space-y-1.5">
              {(current.prioritas_intervensi || [])
                .slice()
                .sort((a: any, b: any) => a.rank - b.rank)
                .map((p: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/20 p-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {p.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xs font-semibold text-foreground">{p.masalah}</p>
                        <Badge variant="outline" className={`text-[9px] ${URGENCY_STYLE[p.urgensi] || ""}`}>
                          {p.urgensi}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{p.alasan_klinis}</p>
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          {/* 6. Rekomendasi Nutrisi */}
          <Card title="6. Rekomendasi Nutrisi" icon={Utensils}>
            <div className="space-y-1.5">
              {(current.rekomendasi_nutrisi || []).map((r: any, i: number) => (
                <div key={i} className="rounded-md border border-border/50 bg-muted/20 p-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-semibold text-foreground">{r.area}</p>
                    <Badge variant="outline" className="text-[9px]">
                      {r.guideline_based ? "Berbasis Pedoman" : "Penilaian Klinis Individual"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-foreground">{r.rekomendasi}</p>
                  <p className="text-[11px] italic text-muted-foreground">{r.alasan_klinis}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* 7. Mengapa Menu Ini Dipilih */}
          {current.alasan_pemilihan_menu?.length > 0 && (
            <Card title="7. Mengapa Menu Ini Dipilih" icon={ChefHat}>
              <div className="space-y-1.5">
                {current.alasan_pemilihan_menu.map((m: any, i: number) => (
                  <div key={i} className="rounded-md border border-border/50 bg-muted/20 p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-semibold text-foreground">{m.item}</p>
                      <Badge variant="outline" className="text-[9px]">{m.kelompok}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{m.alasan}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 8. Makanan Dianjurkan / Dibatasi */}
          {(current.makanan_dianjurkan?.length > 0 || current.makanan_dibatasi?.length > 0) && (
            <Card title="8. Makanan Dianjurkan & Dibatasi" icon={Utensils}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Dianjurkan
                  </p>
                  <ul className="space-y-1">
                    {(current.makanan_dianjurkan || []).map((f: any, i: number) => (
                      <li key={i} className="text-[11px] text-foreground">
                        <span className="font-medium">{f.item}</span>
                        <span className="text-muted-foreground"> — {f.alasan}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                    <XCircle className="h-3 w-3" /> Dibatasi
                  </p>
                  <ul className="space-y-1">
                    {(current.makanan_dibatasi || []).map((f: any, i: number) => (
                      <li key={i} className="text-[11px] text-foreground">
                        <span className="font-medium">{f.item}</span>
                        <span className="text-muted-foreground"> — {f.alasan}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* 9. Rekomendasi Aktivitas Fisik */}
          <Card title="9. Rekomendasi Aktivitas Fisik" icon={Dumbbell}>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Field label="Frekuensi" value={current.rekomendasi_aktivitas_fisik?.frekuensi} />
              <Field label="Durasi" value={current.rekomendasi_aktivitas_fisik?.durasi} />
              <Field label="Intensitas" value={current.rekomendasi_aktivitas_fisik?.intensitas} />
              <Field label="Jenis" value={current.rekomendasi_aktivitas_fisik?.jenis} />
            </div>
            {current.rekomendasi_aktivitas_fisik?.kontraindikasi?.length > 0 && (
              <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400">
                Kontraindikasi: {current.rekomendasi_aktivitas_fisik.kontraindikasi.join(", ")}
              </p>
            )}
            {current.rekomendasi_aktivitas_fisik?.catatan_keamanan && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {current.rekomendasi_aktivitas_fisik.catatan_keamanan}
              </p>
            )}
          </Card>

          {/* 6. Target Terapi */}
          <Card title="10. Target Terapi" icon={Target}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-left text-[10px] uppercase text-muted-foreground">
                    <th className="py-1 pr-2">Parameter</th>
                    <th className="px-2">Saat Ini</th>
                    <th className="px-2">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(current.target_terapi || []).map((t: any, i: number) => (
                    <tr key={i}>
                      <td className="py-1 pr-2 font-medium text-foreground">{t.parameter}</td>
                      <td className="px-2 text-muted-foreground">{t.nilai_saat_ini || "—"}</td>
                      <td className="px-2 font-semibold text-primary">{t.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 7. Monitoring */}
          <Card title="11. Monitoring" icon={ClipboardCheck}>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <MonitorList label="Harian" items={current.monitoring?.harian} />
              <MonitorList label="Mingguan" items={current.monitoring?.mingguan} />
              <MonitorList label="Bulanan" items={current.monitoring?.bulanan} />
            </div>
          </Card>

          {/* Indikator Visual */}
          {current.indikator_visual?.length > 0 && (
            <Card title="Indikator Visual" icon={HeartPulse}>
              <div className="flex flex-wrap gap-2">
                {current.indikator_visual.map((ind: any, i: number) => {
                  const s = STATUS_STYLE[ind.status] || STATUS_STYLE.BAIK;
                  return (
                    <div key={i} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${s.badge}`}>
                      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                      <span className="font-medium">{ind.parameter}</span>
                      {ind.nilai && <span className="opacity-70">({ind.nilai})</span>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* 8. Edukasi Pasien */}
          <Card title="12. Edukasi Pasien" icon={User}>
            <p className="text-xs leading-relaxed text-foreground">{current.ringkasan_pasien}</p>
          </Card>

          {/* 9. Risiko Komplikasi + Red Flags */}
          <Card title="13. Risiko Komplikasi" icon={ShieldAlert}>
            <div className="flex flex-wrap gap-2">
              {(current.risiko_komplikasi || []).map((r: any, i: number) => (
                <div key={i} className={`rounded-md border px-2 py-1 text-[11px] ${URGENCY_STYLE[r.level === "TINGGI" ? "TINGGI" : r.level === "SEDANG" ? "SEDANG" : "RENDAH"]}`}>
                  <span className="font-semibold">{r.nama}</span>
                  <span className="ml-1 opacity-70">({r.level})</span>
                  {r.alasan && <p className="mt-0.5 max-w-[220px] font-normal opacity-80">{r.alasan}</p>}
                </div>
              ))}
            </div>
            {current.red_flags?.length > 0 && (
              <div className="mt-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                <p className="mb-1 font-bold uppercase">Segera ke dokter jika:</p>
                <ul className="space-y-0.5">
                  {current.red_flags.map((f: string, i: number) => (
                    <li key={i}>• {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* 10. Kesimpulan AI + Ringkasan Dokter */}
          <Card title="14. Kesimpulan AI" icon={Brain}>
            <p className="text-xs leading-relaxed text-foreground">{current.kesimpulan_ai}</p>
            {current.ringkasan_dokter && (
              <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2">
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Ringkasan untuk Dokter
                </p>
                <p className="text-[11px] leading-relaxed text-foreground">{current.ringkasan_dokter}</p>
              </div>
            )}
            {current.guideline_references?.length > 0 && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Rujukan: {current.guideline_references.join(" · ")}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function MonitorList({ label, items }: { label: string; items?: string[] }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 p-2">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      {!items || items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-0.5 text-[11px] text-foreground">
          {items.map((it, i) => (
            <li key={i}>• {it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
