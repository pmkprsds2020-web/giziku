"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  FlaskConical,
  AlertTriangle,
  LineChart as LineChartIcon,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import {
  useLabResults,
  useAddLabResult,
  useUpdateLabResult,
  useDeleteLabResult,
  useLabCriticalThresholds,
} from "@/hooks/use-carelivia";
import { SectionCard } from "@/components/carelivia/ui-helpers";
import { LabOcrDialog } from "@/components/carelivia/lab-ocr-dialog";
import {
  LAB_CATALOG,
  LAB_CATEGORY_LABELS,
  LAB_TREND_PARAMETERS,
  LAB_STATUS_LABELS,
  findLabTest,
  computeLabStatus,
  type LabCategory,
} from "@/lib/clinical/lab-catalog";

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const emptyForm = {
  category: "GLUKOSA" as LabCategory,
  testName: "",
  value: "",
  unit: "",
  referenceMin: "",
  referenceMax: "",
  labDate: new Date().toISOString().slice(0, 10),
  laboratoryName: "",
  notes: "",
};

export function LaboratoryPanel({ patientId }: { patientId: string }) {
  const { data: results, isLoading } = useLabResults(patientId);
  const { data: thresholds } = useLabCriticalThresholds();
  const addLab = useAddLabResult();
  const updateLab = useUpdateLabResult(patientId);
  const deleteLab = useDeleteLabResult(patientId);

  const [showForm, setShowForm] = React.useState(false);
  const [showOcr, setShowOcr] = React.useState(false);
  const [editing, setEditing] = React.useState<any | null>(null);
  const [deleting, setDeleting] = React.useState<any | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [trendParam, setTrendParam] = React.useState(LAB_TREND_PARAMETERS[0]);

  const list = results || [];

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      category: r.category,
      testName: r.testName,
      value: String(r.value),
      unit: r.unit || "",
      referenceMin: r.referenceMin != null ? String(r.referenceMin) : "",
      referenceMax: r.referenceMax != null ? String(r.referenceMax) : "",
      labDate: r.labDate ? String(r.labDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      laboratoryName: r.laboratoryName || "",
      notes: r.notes || "",
    });
    setShowForm(true);
  };

  const handleCategoryChange = (category: string) => {
    setForm((f) => ({ ...f, category: category as LabCategory, testName: "" }));
  };

  const handleTestChange = (testName: string) => {
    const test = findLabTest(form.category, testName);
    setForm((f) => ({
      ...f,
      testName,
      unit: test?.unit ?? f.unit,
      referenceMin: test?.refMin != null ? String(test.refMin) : f.referenceMin,
      referenceMax: test?.refMax != null ? String(test.refMax) : f.referenceMax,
    }));
  };

  const handleSubmit = () => {
    const value = parseFloat(form.value);
    if (!form.testName || Number.isNaN(value)) {
      toast.error("Nama pemeriksaan dan nilai wajib diisi");
      return;
    }
    const payload = {
      category: form.category,
      testName: form.testName,
      value,
      unit: form.unit || undefined,
      referenceMin: form.referenceMin !== "" ? parseFloat(form.referenceMin) : null,
      referenceMax: form.referenceMax !== "" ? parseFloat(form.referenceMax) : null,
      labDate: form.labDate,
      laboratoryName: form.laboratoryName || undefined,
      notes: form.notes || undefined,
    };

    if (editing) {
      updateLab.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast.success("Hasil laboratorium diperbarui");
            setShowForm(false);
          },
          onError: (e: any) => toast.error(e?.message || "Gagal memperbarui hasil lab"),
        },
      );
    } else {
      addLab.mutate(
        { patientId, ...payload },
        {
          onSuccess: () => {
            toast.success("Hasil laboratorium ditambahkan");
            setShowForm(false);
          },
          onError: (e: any) => toast.error(e?.message || "Gagal menambah hasil lab"),
        },
      );
    }
  };

  const handleDelete = () => {
    if (!deleting) return;
    deleteLab.mutate(deleting.id, {
      onSuccess: () => {
        toast.success("Hasil laboratorium dihapus");
        setDeleting(null);
      },
      onError: (e: any) => toast.error(e?.message || "Gagal menghapus hasil lab"),
    });
  };

  // Clinical alerts — critical values among the latest result per test.
  const alerts = React.useMemo(() => {
    if (!thresholds || thresholds.length === 0) return [];
    const latestByTest = new Map<string, any>();
    for (const r of list) {
      if (!latestByTest.has(r.testName)) latestByTest.set(r.testName, r);
    }
    const out: { test: string; message: string }[] = [];
    for (const t of thresholds) {
      const r = latestByTest.get(t.testName);
      if (!r) continue;
      if (
        (t.criticalLow != null && r.value < t.criticalLow) ||
        (t.criticalHigh != null && r.value > t.criticalHigh)
      ) {
        out.push({ test: t.testName, message: t.message });
      }
    }
    return out;
  }, [thresholds, list]);

  // Trend data for the selected parameter — oldest to newest.
  const trendData = React.useMemo(() => {
    return list
      .filter((r: any) => r.testName === trendParam)
      .slice()
      .sort((a: any, b: any) => new Date(a.labDate).getTime() - new Date(b.labDate).getTime())
      .map((r: any) => ({
        date: fmtDate(r.labDate),
        value: r.value,
        refMin: r.referenceMin,
        refMax: r.referenceMax,
      }));
  }, [list, trendParam]);

  const busy = addLab.isPending || updateLab.isPending;
  const availableTests = LAB_CATALOG[form.category] || [];

  return (
    <SectionCard
      title="Hasil Laboratorium"
      description="Digunakan otomatis oleh AI Meal Plan, Exercise Plan, Evaluasi AI, dan Laporan Klinis PDF"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowOcr(true)} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Upload PDF/Gambar
          </Button>
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Input Laboratorium
          </Button>
        </div>
      }
    >
      {alerts.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span><b>{a.test}:</b> {a.message}</span>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada hasil laboratorium tercatat untuk pasien ini.</p>
      ) : (
        <Tabs defaultValue="table">
          <TabsList className="mb-3">
            <TabsTrigger value="table">Daftar Hasil</TabsTrigger>
            <TabsTrigger value="trend" className="gap-1.5">
              <LineChartIcon className="h-3.5 w-3.5" /> Grafik Tren
            </TabsTrigger>
          </TabsList>

          <TabsContent value="table">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pemeriksaan</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Nilai</TableHead>
                    <TableHead>Rujukan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((r: any) => {
                    const s = LAB_STATUS_LABELS[r.status] || LAB_STATUS_LABELS.NORMAL;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-foreground">{r.testName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {LAB_CATEGORY_LABELS[r.category as LabCategory] || r.category}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {r.value} {r.unit}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.referenceMin != null || r.referenceMax != null
                            ? `${r.referenceMin ?? "—"} – ${r.referenceMax ?? "—"}`
                            : "—"}
                        </TableCell>
                        <TableCell className={`text-xs font-medium ${s.className}`}>
                          {s.emoji} {s.label}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(r.labDate)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-600 hover:text-rose-700"
                              onClick={() => setDeleting(r)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="trend">
            <div className="mb-3 flex items-center gap-2">
              <Label className="text-xs">Parameter:</Label>
              <Select value={trendParam} onValueChange={setTrendParam}>
                <SelectTrigger className="h-8 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAB_TREND_PARAMETERS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data {trendParam} untuk pasien ini.</p>
            ) : trendData.length === 1 ? (
              <p className="text-sm text-muted-foreground">
                Hanya ada 1 data {trendParam} ({trendData[0].value}) — perlu minimal 2 titik untuk grafik tren.
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                    <RechartsTooltip />
                    {trendData[0]?.refMax != null && (
                      <ReferenceLine y={trendData[0].refMax} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Batas atas", fontSize: 10 }} />
                    )}
                    {trendData[0]?.refMin != null && (
                      <ReferenceLine y={trendData[0].refMin} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Batas bawah", fontSize: 10 }} />
                    )}
                    <Line type="monotone" dataKey="value" stroke="var(--color-primary, #10b981)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Hasil Laboratorium" : "Input Laboratorium"}</DialogTitle>
            <DialogDescription>
              Status (Normal/Borderline/Tinggi/Rendah) dihitung otomatis dari nilai rujukan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={handleCategoryChange} disabled={!!editing}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LAB_CATEGORY_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nama Pemeriksaan</Label>
                {editing ? (
                  <Input value={form.testName} disabled className="mt-1" />
                ) : (
                  <Select value={form.testName} onValueChange={handleTestChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Pilih..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTests.map((t) => (
                        <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nilai</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Satuan</Label>
                <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nilai Normal — Min</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.referenceMin}
                  onChange={(e) => setForm((f) => ({ ...f, referenceMin: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Nilai Normal — Maks</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.referenceMax}
                  onChange={(e) => setForm((f) => ({ ...f, referenceMax: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            {form.value !== "" && !Number.isNaN(parseFloat(form.value)) && (
              <div className="text-xs text-muted-foreground">
                Status otomatis:{" "}
                {(() => {
                  const s = LAB_STATUS_LABELS[
                    computeLabStatus(
                      parseFloat(form.value),
                      form.referenceMin !== "" ? parseFloat(form.referenceMin) : null,
                      form.referenceMax !== "" ? parseFloat(form.referenceMax) : null,
                    )
                  ];
                  return <span className={`font-medium ${s.className}`}>{s.emoji} {s.label}</span>;
                })()}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tanggal Pemeriksaan</Label>
                <Input
                  type="date"
                  value={form.labDate}
                  onChange={(e) => setForm((f) => ({ ...f, labDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Laboratorium</Label>
                <Input
                  value={form.laboratoryName}
                  onChange={(e) => setForm((f) => ({ ...f, laboratoryName: e.target.value }))}
                  className="mt-1"
                  placeholder="mis. Lab Klinik Prodia"
                />
              </div>
            </div>

            <div>
              <Label>Catatan</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={busy}>
              {busy ? "Menyimpan…" : editing ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" /> Hapus Hasil Laboratorium?
            </DialogTitle>
            <DialogDescription>
              {deleting && `${deleting.testName} (${fmtDate(deleting.labDate)})`} akan dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLab.isPending}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LabOcrDialog patientId={patientId} open={showOcr} onOpenChange={setShowOcr} />
    </SectionCard>
  );
}
