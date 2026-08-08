"use client";

import * as React from "react";
import { History, Eye, RotateCcw, Trash2, User, Download } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageHeader, SectionCard, EmptyState } from "@/components/carelivia/ui-helpers";
import {
  usePatients,
  useMealPlans,
  useMealPlanHistory,
  useMealPlanHistoryDetail,
  useMealPlanHistoryComparison,
  useDeleteMealPlanHistory,
  useApplyMealPlanHistory,
} from "@/hooks/use-carelivia";
import { useCareLiviaStore } from "@/store/carelivia";

const SLOT_LABELS: Record<string, string> = {
  BREAKFAST: "Sarapan",
  MORNING_SNACK: "Snack Pagi",
  LUNCH: "Makan Siang",
  AFTERNOON_SNACK: "Snack Sore",
  DINNER: "Makan Malam",
  EVENING_SNACK: "Snack Malam",
};

const ACTION_LABEL: Record<string, string> = {
  SAVE_DRAFT: "Disimpan",
  RESTORE: "Dipulihkan",
};

export function MealPlanHistoryView() {
  const { data: patients } = usePatients();
  const { activePatientId } = useCareLiviaStore();
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>(
    activePatientId || "",
  );

  React.useEffect(() => {
    if (activePatientId && !selectedPatientId) {
      setSelectedPatientId(activePatientId);
    }
  }, [activePatientId, selectedPatientId]);

  const { data: history, isLoading } = useMealPlanHistory(selectedPatientId || undefined);
  const { data: plans } = useMealPlans(selectedPatientId || undefined);
  const latestPlan = plans?.[0];

  const [viewHistoryId, setViewHistoryId] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [confirmUseId, setConfirmUseId] = React.useState<string | null>(null);

  const deleteMut = useDeleteMealPlanHistory();
  const applyMut = useApplyMealPlanHistory();

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Riwayat meal plan dihapus");
      setConfirmDeleteId(null);
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus riwayat");
    }
  };

  const handleUse = async (historyId: string) => {
    if (!latestPlan?.id) {
      toast.error("Tidak ada meal plan aktif untuk pasien ini");
      return;
    }
    try {
      await applyMut.mutateAsync({ historyId, mealPlanId: latestPlan.id });
      toast.success("Meal plan aktif diperbarui dari riwayat ini");
      setConfirmUseId(null);
    } catch (e: any) {
      toast.error(e.message || "Gagal menerapkan riwayat");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Meal Plan"
        subtitle="Semua snapshot meal plan yang pernah disimpan — lihat, gunakan kembali, atau hapus"
        icon={History}
      />

      <SectionCard title="Pilih Pasien" description="Riwayat ditampilkan per pasien">
        <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
          <SelectTrigger className="max-w-sm">
            <User className="mr-1.5 h-3.5 w-3.5 opacity-60" />
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
      </SectionCard>

      {!selectedPatientId ? (
        <EmptyState
          icon={History}
          title="Pilih pasien terlebih dahulu"
          description="Riwayat meal plan akan muncul di sini setelah pasien dipilih."
        />
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !history || history.length === 0 ? (
        <EmptyState
          icon={History}
          title="Belum ada riwayat"
          description='Riwayat akan tercatat otomatis setiap kali "Simpan Meal Plan" ditekan di halaman AI Meal Plan.'
        />
      ) : (
        <SectionCard title="Snapshot Meal Plan" description={`${history.length} riwayat tercatat`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama Meal Plan</TableHead>
                <TableHead className="text-right">Energi</TableHead>
                <TableHead className="text-right">Protein</TableHead>
                <TableHead className="text-right">Karbohidrat</TableHead>
                <TableHead className="text-right">Lemak</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(h.createdAt).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {h.name || "Meal Plan (tanpa nama)"}
                      </span>
                      <Badge variant="outline" className="text-[9px]">
                        {ACTION_LABEL[h.action] || h.action}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {h.itemCount} item
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {h.totals ? `${Math.round(h.totals.cal)} kcal` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {h.totals ? `${Math.round(h.totals.protein)}g` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {h.totals ? `${Math.round(h.totals.carb)}g` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {h.totals ? `${Math.round(h.totals.fat)}g` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setViewHistoryId(h.id)}
                        title="Lihat"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
                        onClick={() => setConfirmUseId(h.id)}
                        title="Gunakan Meal Plan"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
                        onClick={() => setConfirmDeleteId(h.id)}
                        title="Hapus"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      {/* LIHAT dialog */}
      <HistoryDetailDialog historyId={viewHistoryId} onOpenChange={(open) => !open && setViewHistoryId(null)} />

      {/* GUNAKAN confirm */}
      <Dialog open={!!confirmUseId} onOpenChange={(open) => !open && setConfirmUseId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gunakan Meal Plan Ini?</DialogTitle>
            <DialogDescription>
              Meal plan aktif pasien akan diganti dengan isi dari snapshot ini. Kondisi
              sebelumnya tetap tercatat sebagai riwayat baru, jadi ini bisa dibatalkan
              dengan memilih riwayat lain nanti.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUseId(null)}>
              Batal
            </Button>
            <Button
              onClick={() => confirmUseId && handleUse(confirmUseId)}
              disabled={applyMut.isPending}
            >
              {applyMut.isPending ? "Menerapkan…" : "Ya, Gunakan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HAPUS confirm */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Riwayat Ini?</DialogTitle>
            <DialogDescription>
              Hanya snapshot riwayat ini yang dihapus — meal plan aktif pasien tidak
              terpengaruh.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Menghapus…" : "Ya, Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const INDICATOR_DOT: Record<string, string> = {
  GREEN: "🟢",
  YELLOW: "🟡",
  RED: "🔴",
};

const INDICATOR_LABEL: Record<string, string> = {
  GREEN: "Sesuai target",
  YELLOW: "Mendekati target",
  RED: "Jauh dari target",
};

function groupBySlot(items: any[]): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  for (const item of items || []) {
    (out[item.slot] ||= []).push(item);
  }
  return out;
}

function HistoryDetailDialog({
  historyId,
  onOpenChange,
}: {
  historyId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  // Full comparison payload (Meal Plan + Food Record + analysis + AI
  // Evaluation). Falls back to the lighter snapshot-only detail if the
  // comparison endpoint has nothing (e.g. history predates this feature).
  const { data: detail, isLoading } = useMealPlanHistoryComparison(historyId);
  const { data: basicDetail } = useMealPlanHistoryDetail(historyId);

  const planBySlot = groupBySlot(detail?.items || []);
  const recordBySlot = groupBySlot(detail?.foodRecords || []);

  const chartData = React.useMemo(() => {
    if (!detail?.comparison) return [];
    return detail.comparison
      .filter((c: any) => ["cal", "protein", "fat", "carb"].includes(c.key))
      .map((c: any) => ({
        name: c.label,
        "Meal Plan": Math.round(c.plan),
        "Food Record": Math.round(c.actual),
      }));
  }, [detail]);

  return (
    <Dialog open={!!historyId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{detail?.name || basicDetail?.name || "Detail Meal Plan"}</DialogTitle>
          <DialogDescription>
            {detail && new Date(detail.createdAt).toLocaleString("id-ID")}
            {detail?.patient?.name ? ` · ${detail.patient.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {/* A. Informasi Meal Plan */}
            {detail.targets && (
              <SectionCard title="Target Meal Plan" description="Ditetapkan saat meal plan ini dibuat">
                <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-4">
                  <span>Target Kalori: <strong className="text-foreground">{Math.round(detail.targets.targetCal)} kcal</strong></span>
                  <span>Target Protein: <strong className="text-foreground">{Math.round(detail.targets.targetProtein)}g</strong></span>
                  <span>Target Lemak: <strong className="text-foreground">{Math.round(detail.targets.targetFat)}g</strong></span>
                  <span>Target Karbo: <strong className="text-foreground">{Math.round(detail.targets.targetCarb)}g</strong></span>
                </div>
              </SectionCard>
            )}

            {/* B. Detail Meal Plan */}
            <SectionCard title="Detail Meal Plan" description={`${detail.compareDate ? new Date(detail.compareDate).toLocaleDateString("id-ID") : ""}`}>
              {Object.keys(planBySlot).length === 0 ? (
                <p className="text-xs text-muted-foreground">Tidak ada item.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-md border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Slot</TableHead>
                        <TableHead>Makanan</TableHead>
                        <TableHead className="text-right">Gram</TableHead>
                        <TableHead className="text-right">Kalori</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(planBySlot).map(([slot, items]) =>
                        items.map((item: any, idx: number) => (
                          <TableRow key={`${slot}-${idx}`}>
                            <TableCell className="text-xs">{SLOT_LABELS[slot] || slot}</TableCell>
                            <TableCell className="text-xs">{item.foodName}</TableCell>
                            <TableCell className="text-right text-xs">{item.amount}g</TableCell>
                            <TableCell className="text-right text-xs">{Math.round(item.cal)}</TableCell>
                          </TableRow>
                        )),
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </SectionCard>

            {/* C. Food Record */}
            <SectionCard title="Food Record" description="Konsumsi aktual pada tanggal yang sama">
              {Object.keys(recordBySlot).length === 0 ? (
                <p className="text-xs text-muted-foreground">Tidak ada Food Record pada tanggal ini.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-md border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Slot</TableHead>
                        <TableHead>Makanan</TableHead>
                        <TableHead className="text-right">Gram</TableHead>
                        <TableHead className="text-right">Kalori</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(recordBySlot).map(([slot, items]) =>
                        items.map((item: any, idx: number) => (
                          <TableRow key={`${slot}-${idx}`}>
                            <TableCell className="text-xs">{SLOT_LABELS[slot] || slot}</TableCell>
                            <TableCell className="text-xs">{item.foodName}</TableCell>
                            <TableCell className="text-right text-xs">{item.amount}g</TableCell>
                            <TableCell className="text-right text-xs">{Math.round(item.cal)}</TableCell>
                          </TableRow>
                        )),
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </SectionCard>

            {/* D. Analisis Perbandingan */}
            <SectionCard title="Analisis Perbandingan" description="Meal Plan vs Food Record">
              <div className="overflow-x-auto rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Komponen</TableHead>
                      <TableHead className="text-right">Meal Plan</TableHead>
                      <TableHead className="text-right">Food Record</TableHead>
                      <TableHead className="text-right">Selisih</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.comparison || []).map((row: any) => (
                      <TableRow key={row.key}>
                        <TableCell className="text-xs font-medium">{row.label}</TableCell>
                        <TableCell className="text-right text-xs">{Math.round(row.plan)} {row.unit}</TableCell>
                        <TableCell className="text-right text-xs">{Math.round(row.actual)} {row.unit}</TableCell>
                        <TableCell className="text-right text-xs">
                          {row.diff >= 0 ? "+" : ""}{Math.round(row.diff)} {row.unit}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span title={INDICATOR_LABEL[row.indicator]}>
                            {INDICATOR_DOT[row.indicator]} {INDICATOR_LABEL[row.indicator]}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {detail.sugarNote && (
                <p className="mt-2 text-[10px] italic text-muted-foreground">{detail.sugarNote}</p>
              )}
            </SectionCard>

            {/* E. Grafik */}
            {chartData.length > 0 && (
              <SectionCard title="Grafik" description="Meal Plan vs Food Record">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          fontSize: 12,
                          background: "var(--popover)",
                          color: "var(--popover-foreground)",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Meal Plan" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Food Record" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            )}

            {/* F. AI Evaluation */}
            <SectionCard title="AI Evaluation" description={`Kepatuhan terhadap Meal Plan: ${Math.round(detail.compliance)}%`}>
              <p className="text-sm leading-relaxed text-foreground">{detail.aiEvaluation}</p>
            </SectionCard>

            <div className="flex justify-end">
              <Button asChild size="sm" variant="outline">
                <a href={`/api/meal-plan-history/${historyId}/export-pdf`} target="_blank" rel="noreferrer">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download PDF
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Riwayat tidak ditemukan.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
