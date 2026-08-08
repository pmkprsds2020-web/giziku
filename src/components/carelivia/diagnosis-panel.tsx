"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Stethoscope,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useDiagnoses,
  useAddDiagnosis,
  useUpdateDiagnosis,
  useDeleteDiagnosis,
} from "@/hooks/use-carelivia";
import { SectionCard } from "@/components/carelivia/ui-helpers";
import { DIAGNOSIS_ADJUSTMENTS } from "@/lib/clinical/constants";
import type { DiagnosisType } from "@prisma/client";

const ALL_DIAGNOSES = Object.keys(DIAGNOSIS_ADJUSTMENTS) as DiagnosisType[];

const CLASSIFICATION_LABELS: Record<string, string> = {
  UTAMA: "Diagnosis Utama",
  SEKUNDER: "Diagnosis Sekunder",
  KOMORBID: "Komorbid",
  KOMPLIKASI: "Komplikasi",
};

const STATUS_LABELS: Record<string, string> = {
  AKTIF: "Aktif",
  REMISI: "Remisi",
  SEMBUH: "Sembuh",
  KRONIS: "Kronis",
  EVALUASI: "Dalam Evaluasi",
};

const PRIORITY_STYLE: Record<string, string> = {
  TINGGI: "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  SEDANG: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  RENDAH: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
};

const STATUS_STYLE: Record<string, string> = {
  AKTIF: "border-primary/40 bg-primary/10 text-primary",
  KRONIS: "border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  EVALUASI: "border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
  REMISI: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  SEMBUH: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
};

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const emptyForm = {
  type: "" as DiagnosisType | "",
  icd: "",
  classification: "UTAMA",
  status: "AKTIF",
  priority: "SEDANG",
  diagnosedAt: new Date().toISOString().slice(0, 10),
  doctor: "",
  target: "",
  notes: "",
};

export function DiagnosisPanel({ patientId }: { patientId: string }) {
  const { data: diagnoses, isLoading } = useDiagnoses(patientId);
  const addDiagnosis = useAddDiagnosis();
  const updateDiagnosis = useUpdateDiagnosis(patientId);
  const deleteDiagnosis = useDeleteDiagnosis(patientId);

  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<any | null>(null);
  const [deleting, setDeleting] = React.useState<any | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      type: d.type,
      icd: d.icd || DIAGNOSIS_ADJUSTMENTS[d.type as DiagnosisType]?.icd || "",
      classification: d.classification || "UTAMA",
      status: d.status || "AKTIF",
      priority: d.priority || "SEDANG",
      diagnosedAt: d.diagnosedAt ? String(d.diagnosedAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
      doctor: d.doctor || "",
      target: d.target || "",
      notes: d.notes || "",
    });
    setShowForm(true);
  };

  const handleTypeChange = (type: string) => {
    const adj = DIAGNOSIS_ADJUSTMENTS[type as DiagnosisType];
    setForm((f) => ({ ...f, type: type as DiagnosisType, icd: adj?.icd || f.icd }));
  };

  const handleSubmit = () => {
    if (!form.type) {
      toast.error("Pilih diagnosis terlebih dahulu");
      return;
    }
    if (editing) {
      updateDiagnosis.mutate(
        {
          id: editing.id,
          icd: form.icd,
          classification: form.classification,
          status: form.status,
          priority: form.priority,
          diagnosedAt: form.diagnosedAt,
          doctor: form.doctor,
          target: form.target,
          notes: form.notes,
        },
        {
          onSuccess: () => {
            toast.success("Diagnosis diperbarui");
            setShowForm(false);
          },
          onError: (e: any) => toast.error(e?.message || "Gagal memperbarui diagnosis"),
        },
      );
    } else {
      addDiagnosis.mutate(
        { patientId, ...form, type: form.type as string },
        {
          onSuccess: () => {
            toast.success("Diagnosis ditambahkan");
            setShowForm(false);
          },
          onError: (e: any) => toast.error(e?.message || "Gagal menambah diagnosis"),
        },
      );
    }
  };

  const handleDelete = () => {
    if (!deleting) return;
    deleteDiagnosis.mutate(deleting.id, {
      onSuccess: () => {
        toast.success("Diagnosis dihapus");
        setDeleting(null);
      },
      onError: (e: any) => toast.error(e?.message || "Gagal menghapus diagnosis"),
    });
  };

  const list = diagnoses || [];
  const busy = addDiagnosis.isPending || updateDiagnosis.isPending;

  return (
    <SectionCard
      title="Diagnosis Aktif"
      description="Pasien dapat memiliki lebih dari satu diagnosis aktif secara bersamaan"
      actions={
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Tambah Diagnosis
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada diagnosis tercatat untuk pasien ini.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Diagnosis</TableHead>
                <TableHead>ICD</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Prioritas</TableHead>
                <TableHead>Dokter</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((d: any) => {
                const adj = DIAGNOSIS_ADJUSTMENTS[d.type as DiagnosisType];
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{adj?.label || d.type}</p>
                      {d.classification && (
                        <p className="text-[11px] text-muted-foreground">
                          {CLASSIFICATION_LABELS[d.classification] || d.classification}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.icd || adj?.icd || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[d.status] || ""}`}>
                        {STATUS_LABELS[d.status] || d.status || "Aktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(d.diagnosedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLE[d.priority] || ""}`}>
                        {d.priority === "TINGGI" ? "Tinggi" : d.priority === "RENDAH" ? "Rendah" : "Sedang"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.doctor || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-600 hover:text-rose-700"
                          onClick={() => setDeleting(d)}
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
      )}

      {/* Add/Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Diagnosis" : "Tambah Diagnosis"}</DialogTitle>
            <DialogDescription>
              Diagnosis menjadi sumber utama perhitungan AI Meal Plan, Exercise Plan, dan Evaluasi AI CareLivia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Diagnosis</Label>
              <Select value={form.type} onValueChange={handleTypeChange} disabled={!!editing}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih diagnosis..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_DIAGNOSES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {DIAGNOSIS_ADJUSTMENTS[d].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editing && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Jenis diagnosis tidak dapat diubah — hapus dan tambah baru bila salah pilih.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kode ICD-10</Label>
                <Input value={form.icd} onChange={(e) => setForm((f) => ({ ...f, icd: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Tanggal Diagnosis</Label>
                <Input
                  type="date"
                  value={form.diagnosedAt}
                  onChange={(e) => setForm((f) => ({ ...f, diagnosedAt: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Jenis Diagnosis</Label>
                <Select value={form.classification} onValueChange={(v) => setForm((f) => ({ ...f, classification: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLASSIFICATION_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioritas</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TINGGI">Tinggi</SelectItem>
                    <SelectItem value="SEDANG">Sedang</SelectItem>
                    <SelectItem value="RENDAH">Rendah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dokter Penegak Diagnosis</Label>
                <Input value={form.doctor} onChange={(e) => setForm((f) => ({ ...f, doctor: e.target.value }))} className="mt-1" placeholder="dr. ..." />
              </div>
            </div>

            <div>
              <Label>Target Terapi</Label>
              <Textarea
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                className="mt-1"
                rows={2}
                placeholder="mis. HbA1c <7%, TD <130/80 mmHg"
              />
            </div>

            <div>
              <Label>Catatan Klinis</Label>
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
              {busy ? "Menyimpan…" : editing ? "Simpan Perubahan" : "Tambah Diagnosis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" /> Hapus Diagnosis?
            </DialogTitle>
            <DialogDescription>
              {deleting && (DIAGNOSIS_ADJUSTMENTS[deleting.type as DiagnosisType]?.label || deleting.type)} akan
              dihapus dari daftar diagnosis aktif pasien. Riwayat perubahan tetap tersimpan untuk audit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteDiagnosis.isPending}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
