"use client";

import * as React from "react";
import {
  Plus,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Scale,
  Trash2,
  Save,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import {
  useWeightRecords,
  useAddWeightRecord,
  useDeleteWeightRecord,
} from "@/hooks/use-carelivia";
import { SectionCard } from "@/components/carelivia/ui-helpers";

const BMI_LABELS: Record<string, string> = {
  SEVERELY_UNDERWEIGHT: "Kurus Berat",
  UNDERWEIGHT: "Kurus",
  NORMAL: "Normal",
  OVERWEIGHT: "Pre-Obesitas",
  OBESE_I: "Obesitas I",
  OBESE_II: "Obesitas II",
  OBESE_III: "Obesitas III",
};

export function WeightTrendPanel({ patientId }: { patientId: string }) {
  const { data, isLoading } = useWeightRecords(patientId);
  const [showInput, setShowInput] = React.useState(false);
  const [period, setPeriod] = React.useState<"all" | "7" | "30" | "90" | "180" | "365">("all");
  const deleteMut = useDeleteWeightRecord();

  const records = data?.records || [];
  const summary = data?.summary;
  const periodChanges = data?.periodChanges || [];
  const alerts = data?.alerts || [];

  // Filter records by period
  const filteredRecords = React.useMemo(() => {
    if (period === "all") return records;
    const days = Number(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return records.filter((r: any) => new Date(r.date) >= cutoff);
  }, [records, period]);

  // Chart data (ascending by date)
  const chartData = filteredRecords
    .slice()
    .reverse()
    .map((r: any) => ({
      date: new Date(r.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      fullDate: new Date(r.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      weight: r.weight,
      bmi: r.bmi,
      change: r.weightChange,
      changePct: r.weightChangePct,
    }));

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus record berat badan ini?")) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Record dihapus");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Color based on trend
  const trendColor = summary
    ? summary.totalChange < -5
      ? "#ef4444" // rose - significant loss
      : summary.totalChange < 0
        ? "#f59e0b" // amber - mild loss
        : summary.totalChange > 5
          ? "#ef4444" // rose - significant gain
          : summary.totalChange > 0
            ? "#f59e0b" // amber - mild gain
            : "#10b981" // emerald - stable
    : "#10b981";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Monitoring Berat Badan</h3>
          {summary && (
            <Badge variant="outline" className="text-[10px]">
              {summary.recordCount} record
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-8" onClick={() => setShowInput(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Input Berat Badan
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Scale className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Belum ada catatan berat badan</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Klik "Input Berat Badan" untuk mulai monitoring.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-card p-2.5">
                <p className="text-[10px] text-muted-foreground">Berat Saat Ini</p>
                <p className="text-xl font-bold text-foreground">{summary.currentWeight}<span className="text-xs font-normal text-muted-foreground"> kg</span></p>
              </div>
              <div className="rounded-lg border border-border/60 p-2.5" style={{ borderColor: `${trendColor}40` }}>
                <p className="text-[10px] text-muted-foreground">Perubahan Total</p>
                <p className="text-xl font-bold" style={{ color: trendColor }}>
                  {summary.totalChange > 0 ? "+" : ""}{summary.totalChange}<span className="text-xs font-normal"> kg</span>
                </p>
              </div>
              <div className="rounded-lg border border-border/60 p-2.5" style={{ borderColor: `${trendColor}40` }}>
                <p className="text-[10px] text-muted-foreground">Persentase</p>
                <p className="text-xl font-bold" style={{ color: trendColor }}>
                  {summary.totalPct > 0 ? "+" : ""}{summary.totalPct}%
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-2.5">
                <p className="text-[10px] text-muted-foreground">Rata-rata</p>
                <p className="text-xl font-bold text-foreground">
                  {summary.avgPerWeek > 0 ? "+" : ""}{summary.avgPerWeek}
                  <span className="text-xs font-normal text-muted-foreground"> kg/mgg</span>
                </p>
              </div>
            </div>
          )}

          {/* Clinical alerts */}
          {alerts.map((alert: any, i: number) => (
            <Alert key={i} variant={alert.level === "danger" ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-xs">
                {alert.level === "danger" ? "⚠ Risiko Tinggi" : "⚠ Perhatian Klinis"}
              </AlertTitle>
              <AlertDescription className="text-xs">{alert.message}</AlertDescription>
            </Alert>
          ))}

          {/* Period change detection */}
          {periodChanges.some((p: any) => p.change !== null) && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Deteksi Perubahan per Periode
              </p>
              <div className="grid grid-cols-5 gap-2 text-center">
                {periodChanges.map((p: any) => (
                  <div key={p.label} className="rounded-md bg-card px-1 py-1.5">
                    <p className="text-[9px] text-muted-foreground">{p.label}</p>
                    <p className={`text-xs font-bold ${p.change === null ? "text-muted-foreground" : p.change < 0 ? "text-rose-600" : p.change > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {p.change === null ? "—" : `${p.change > 0 ? "+" : ""}${p.change} kg`}
                    </p>
                    <p className="text-[8px] text-muted-foreground">
                      {p.pct === null ? "" : `${p.pct > 0 ? "+" : ""}${p.pct}%`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Period filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Periode:</span>
            {[
              { key: "7", label: "7 hari" },
              { key: "30", label: "30 hari" },
              { key: "90", label: "3 bulan" },
              { key: "180", label: "6 bulan" },
              { key: "365", label: "1 tahun" },
              { key: "all", label: "Semua" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key as any)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  period === p.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Line chart */}
          {chartData.length > 0 && (
            <div className="h-56 w-full rounded-lg border border-border/60 bg-card p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    domain={["dataMin - 2", "dataMax + 2"]}
                    tickFormatter={(v) => `${v} kg`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                    }}
                    formatter={(value: any, name: string, props: any) => {
                      const p = props.payload;
                      if (name === "weight") {
                        return [
                          `${value} kg (BMI: ${p.bmi || "—"}, ${p.change !== null ? `${p.change > 0 ? "+" : ""}${p.change} kg` : "awal"})`,
                          "Berat",
                        ];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label, payload) => {
                      const p = payload?.[0]?.payload;
                      return p ? p.fullDate : label;
                    }}
                  />
                  <ReferenceLine y={summary?.firstWeight} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: "Awal", fontSize: 9, fill: "#94a3b8" }} />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke={trendColor}
                    strokeWidth={2}
                    dot={{ fill: trendColor, r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* History table */}
          <div className="overflow-x-auto rounded-md border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">BB (kg)</TableHead>
                  <TableHead className="text-right">BMI</TableHead>
                  <TableHead className="text-right">Δ BB</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.slice(0, 20).map((r: any) => (
                  <TableRow key={r.id} className="hover:bg-muted/40">
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {r.weight}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.bmi ? (
                        <Badge variant="outline" className="text-[10px]">
                          {r.bmi} · {BMI_LABELS[r.bmiCategory] || r.bmiCategory}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className={`text-right text-xs font-medium ${r.weightChange === null ? "text-muted-foreground" : r.weightChange < 0 ? "text-rose-600" : r.weightChange > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {r.weightChange === null ? "—" : `${r.weightChange > 0 ? "+" : ""}${r.weightChange} kg`}
                      {r.weightChangePct !== null && (
                        <span className="ml-1 text-[9px] text-muted-foreground">
                          ({r.weightChangePct > 0 ? "+" : ""}{r.weightChangePct}%)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.note || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-rose-500"
                        onClick={() => handleDelete(r.id)}
                        title="Hapus"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Input Dialog */}
      {showInput && (
        <WeightInputDialog
          patientId={patientId}
          onClose={() => setShowInput(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Weight Input Dialog
// ---------------------------------------------------------------------
function WeightInputDialog({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const addMut = useAddWeightRecord();
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = React.useState(today);
  const [weight, setWeight] = React.useState("");
  const [height, setHeight] = React.useState("");
  const [note, setNote] = React.useState("");

  // Live BMI calculation
  const w = Number(weight) || 0;
  const h = Number(height) || 0;
  const bmi = h > 0 ? Math.round((w / Math.pow(h / 100, 2)) * 10) / 10 : null;
  const bmiLabel = bmi !== null
    ? bmi < 17 ? "Kurus Berat"
      : bmi < 18.5 ? "Kurus"
      : bmi < 23 ? "Normal"
      : bmi < 25 ? "Pre-Obesitas"
      : bmi < 30 ? "Obesitas I"
      : bmi < 35 ? "Obesitas II"
      : "Obesitas III"
    : "";

  const bmiColor = bmi === null
    ? ""
    : bmi < 18.5
      ? "text-sky-600"
      : bmi < 23
        ? "text-emerald-600"
        : bmi < 25
          ? "text-amber-600"
          : "text-rose-600";

  const submit = async () => {
    if (!weight || w <= 0) {
      toast.error("Berat badan wajib diisi");
      return;
    }
    try {
      await addMut.mutateAsync({
        patientId,
        date,
        weight: w,
        height: h > 0 ? h : null,
        note,
      });
      toast.success(`Berat badan ${w} kg tersimpan`);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Input Berat Badan
          </DialogTitle>
          <DialogDescription>
            Setiap input tersimpan sebagai record baru dalam riwayat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tanggal Pemeriksaan</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Berat Badan (kg)</Label>
              <Input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="62.5"
                step="0.1"
                min="1"
                max="500"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Tinggi Badan (cm)</Label>
              <Input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="155"
                step="0.1"
                min="50"
                max="250"
              />
            </div>
          </div>

          {/* Live BMI */}
          {bmi !== null && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5">
              <div>
                <p className="text-[10px] text-muted-foreground">BMI (otomatis)</p>
                <p className={`text-lg font-bold ${bmiColor}`}>{bmi}</p>
              </div>
              <Badge variant="outline" className={`text-[10px] ${bmiColor}`}>
                {bmiLabel}
              </Badge>
            </div>
          )}

          <div>
            <Label className="text-xs">Catatan (opsional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Kontrol rutin, pasien compliant dengan diet..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={addMut.isPending}>
            {addMut.isPending ? "Menyimpan..." : (
              <>
                <Save className="mr-2 h-4 w-4" /> Simpan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
