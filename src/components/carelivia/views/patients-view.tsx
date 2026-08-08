"use client";

import * as React from "react";
import {
  Users,
  Plus,
  Search,
  Trash2,
  Phone,
  MapPin,
  Calendar,
  Activity,
  Pencil,
  X,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  PageHeader,
  StatCard,
  SectionCard,
  EmptyState,
} from "@/components/carelivia/ui-helpers";
import { AssessmentPanel } from "@/components/carelivia/assessment-panel";
import { WeightTrendPanel } from "@/components/carelivia/weight-trend-panel";
import { DiagnosisPanel } from "@/components/carelivia/diagnosis-panel";
import { LaboratoryPanel } from "@/components/carelivia/laboratory-panel";
import {
  usePatients,
  usePatient,
  useCreatePatient,
  useUpdatePatient,
  useDeletePatient,
} from "@/hooks/use-carelivia";
import { useCareLiviaStore } from "@/store/carelivia";
import { DIAGNOSIS_ADJUSTMENTS } from "@/lib/clinical/constants";
import type { DiagnosisType, Gender } from "@prisma/client";

const ALL_DIAGNOSES = Object.keys(DIAGNOSIS_ADJUSTMENTS) as DiagnosisType[];

export function PatientsView() {
  const { data: patients, isLoading } = usePatients();
  const { activePatientId, setActivePatient } = useCareLiviaStore();
  const [showForm, setShowForm] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [editPatient, setEditPatient] = React.useState<any | null>(null);
  const [deletePatient, setDeletePatient] = React.useState<any | null>(null);

  const filtered = (patients || []).filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.mrn.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Manajemen Pasien"
        subtitle="Data demografi, antropometri & diagnosis pasien"
        icon={Users}
        actions={
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" /> Pasien Baru
          </Button>
        }
      />

      {activePatientId ? (
        <PatientDetail id={activePatientId} />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau MRN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="outline" className="w-fit">
              {filtered.length} pasien
            </Badge>
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Belum ada pasien"
              description="Tambahkan pasien pertama Anda untuk mulai mengelola nutrisi."
              icon={User}
              action={
                <Button onClick={() => setShowForm(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Tambah Pasien
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  onOpen={() => setActivePatient(p.id)}
                  onEdit={() => setEditPatient(p)}
                  onDelete={() => setDeletePatient(p)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <PatientFormDialog open={showForm} onOpenChange={setShowForm} />
      <EditPatientDialog patient={editPatient} onOpenChange={(o) => !o && setEditPatient(null)} />
      <DeletePatientDialog patient={deletePatient} onOpenChange={(o) => !o && setDeletePatient(null)} />
    </div>
  );
}

function PatientCard({
  patient,
  onOpen,
  onEdit,
  onDelete,
}: {
  patient: any;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const bmiColor =
    patient.bmi == null
      ? ""
      : patient.bmi < 18.5
        ? "border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-950"
        : patient.bmi < 23
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950"
          : patient.bmi < 25
            ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950"
            : "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950";

  return (
    <Card
      className="group cursor-pointer border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-md"
      onClick={onOpen}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-chart-2/15 text-sm font-bold text-primary">
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-foreground">{patient.name}</p>
              <p className="text-xs text-muted-foreground">{patient.mrn}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {patient.bmi != null && (
              <Badge variant="outline" className={bmiColor}>
                BMI {patient.bmi}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {patient.ageYears} thn · {patient.gender === "MALE" ? "L" : "P"}
          </div>
          {patient.height && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              {patient.height}cm / {patient.weight}kg
            </div>
          )}
          {patient.phone && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {patient.phone}
            </div>
          )}
        </div>

        {Array.isArray(patient.diagnoses) && patient.diagnoses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {patient.diagnoses.slice(0, 3).map((raw: any, i: number) => {
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

        {/* Edit / Delete actions — stop propagation so they don't trigger card open */}
        <div className="mt-3 flex justify-end gap-1 border-t border-border/40 pt-2 opacity-70 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Hapus
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PatientDetail({ id }: { id: string }) {
  const { data: patient, isLoading } = usePatient(id);
  const { setActivePatient, setActiveView } = useCareLiviaStore();

  if (isLoading || !patient) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  const bmi =
    patient.height && patient.weight
      ? patient.weight / Math.pow(patient.height / 100, 2)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setActivePatient(null)}>
          <X className="mr-2 h-4 w-4" /> Kembali ke daftar
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="cl-gradient-primary px-6 py-5 text-primary-foreground">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">{patient.name}</h3>
                <p className="text-sm text-primary-foreground/80">
                  {patient.mrn} · {patient.gender === "MALE" ? "Laki-laki" : "Perempuan"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-primary-foreground/80">Usia</p>
                <p className="text-2xl font-bold">
                  {Math.floor(
                    (Date.now() - new Date(patient.birthDate).getTime()) /
                      (365.25 * 86400000),
                  )}{" "}
                  <span className="text-sm font-normal">thn</span>
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-4">
            <DetailCell label="Tinggi" value={`${patient.height ?? "—"} cm`} />
            <DetailCell label="Berat" value={`${patient.weight ?? "—"} kg`} />
            <DetailCell
              label="BMI"
              value={bmi ? (Math.round(bmi * 10) / 10).toString() : "—"}
            />
            <DetailCell label="Gol. Darah" value={patient.bloodType} />
          </div>
        </CardContent>
      </Card>

      {/* Diagnosis Aktif — standalone CRUD, single source of truth for
          AI Meal Plan / Exercise Plan / Evaluasi AI / Laporan Klinis */}
      <DiagnosisPanel patientId={id} />

      {/* Hasil Laboratorium */}
      <LaboratoryPanel patientId={id} />

      <SectionCard title="Monitoring Berat Badan">
        <WeightTrendPanel patientId={id} />
      </SectionCard>

      {/* Assessment Panel */}
      <SectionCard
        title="Asesmen Gizi & Fungsional"
        description="MUST, NRS-2002, SGA, MNA, ECOG, Barthel, Frailty, Fall Risk"
      >
        <AssessmentPanel patientId={id} />
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setActiveView("meal-plan");
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Buat Meal Plan
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveView("calorie")}
        >
          <Activity className="mr-2 h-4 w-4" /> Hitung Kalori
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveView("food-record")}
        >
          <Plus className="mr-2 h-4 w-4" /> Catat Asupan
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveView("report")}
        >
          <Activity className="mr-2 h-4 w-4" /> Lihat Laporan
        </Button>
      </div>
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function PatientFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const createMut = useCreatePatient();
  const [form, setForm] = React.useState({
    mrn: "",
    name: "",
    gender: "MALE" as Gender,
    birthDate: "",
    phone: "",
    address: "",
    height: "",
    weight: "",
    allergy: "",
    diagnoses: [] as string[],
    isPregnant: false,
    pregnancyTrimester: "1",
    isLactating: false,
  });

  const submit = async () => {
    if (!form.mrn || !form.name || !form.birthDate) {
      toast.error("MRN, Nama, dan Tanggal Lahir wajib diisi");
      return;
    }
    try {
      await createMut.mutateAsync({
        mrn: form.mrn,
        name: form.name,
        gender: form.gender,
        birthDate: form.birthDate,
        phone: form.phone,
        address: form.address,
        allergy: form.allergy,
        height: form.height ? Number(form.height) : null,
        weight: form.weight ? Number(form.weight) : null,
        diagnoses: form.diagnoses,
        isPregnant: form.isPregnant,
        pregnancyTrimester: Number(form.pregnancyTrimester),
        isLactating: form.isLactating,
      });
      toast.success("Pasien berhasil ditambahkan");
      onOpenChange(false);
      setForm({
        mrn: "",
        name: "",
        gender: "MALE",
        birthDate: "",
        phone: "",
        address: "",
        height: "",
        weight: "",
        allergy: "",
        diagnoses: [],
        isPregnant: false,
        pregnancyTrimester: "1",
        isLactating: false,
      });
    } catch (e: any) {
      toast.error(e.message || "Gagal menambah pasien");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Pasien Baru</DialogTitle>
          <DialogDescription>
            Lengkapi data demografi & klinis pasien.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>No. Rekam Medis (MRN)</Label>
              <Input
                value={form.mrn}
                onChange={(e) => setForm({ ...form, mrn: e.target.value })}
                placeholder="RM-002"
              />
            </div>
            <div>
              <Label>Nama Lengkap</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama pasien"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Jenis Kelamin</Label>
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
              <Label>Tanggal Lahir</Label>
              <Input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>
            <div>
              <Label>No. Telepon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tinggi Badan (cm)</Label>
              <Input
                type="number"
                value={form.height}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
                placeholder="165"
              />
            </div>
            <div>
              <Label>Berat Badan (kg)</Label>
              <Input
                type="number"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                placeholder="62"
              />
            </div>
          </div>

          <div>
            <Label>Alergi</Label>
            <Input
              value={form.allergy}
              onChange={(e) => setForm({ ...form, allergy: e.target.value })}
              placeholder="Contoh: kacang, seafood"
            />
          </div>

          <div>
            <Label>Diagnosis (pilih satu atau lebih)</Label>
            <ScrollArea className="h-32 rounded-md border border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                {ALL_DIAGNOSES.map((d) => (
                  <label
                    key={d}
                    className="flex cursor-pointer items-center gap-2 text-xs"
                  >
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
                    <span>
                      {DIAGNOSIS_ADJUSTMENTS[d].label.split("(")[0].trim()}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          {form.gender === "FEMALE" && (
            <div className="flex items-center gap-4 rounded-lg border border-border p-3">
              <label className="flex items-center gap-2 text-xs">
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
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Trimester 1</SelectItem>
                    <SelectItem value="2">Trimester 2</SelectItem>
                    <SelectItem value="3">Trimester 3</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={form.isLactating}
                  onCheckedChange={(c) => setForm({ ...form, isLactating: !!c })}
                />
                Menyusui
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={submit} disabled={createMut.isPending}>
            {createMut.isPending ? "Menyimpan..." : "Simpan Pasien"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// EditPatientDialog — pre-filled form for editing existing patient
// ---------------------------------------------------------------------
function toDateInputValue(d: any): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function EditPatientDialog({
  patient,
  onOpenChange,
}: {
  patient: any | null;
  onOpenChange: (o: boolean) => void;
}) {
  const open = !!patient;
  const updateMut = useUpdatePatient(patient?.id ?? "");
  const [form, setForm] = React.useState<any>({
    mrn: "",
    name: "",
    gender: "MALE" as Gender,
    birthDate: "",
    phone: "",
    height: "",
    weight: "",
    allergy: "",
    notes: "",
  });
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Pre-fill the form whenever a new patient is opened
  React.useEffect(() => {
    if (patient) {
      setForm({
        mrn: patient.mrn ?? "",
        name: patient.name ?? "",
        gender: (patient.gender ?? "MALE") as Gender,
        birthDate: toDateInputValue(patient.birthDate),
        phone: patient.phone ?? "",
        height: patient.height != null ? String(patient.height) : "",
        weight: patient.weight != null ? String(patient.weight) : "",
        allergy: patient.allergy ?? "",
        notes: patient.notes ?? "",
      });
      setValidationError(null);
    }
  }, [patient]);

  const submit = async () => {
    if (!patient) return;
    if (!form.name || !form.name.trim()) {
      setValidationError("Nama wajib diisi");
      return;
    }
    if (!form.mrn || !form.mrn.trim()) {
      setValidationError("MRN wajib diisi");
      return;
    }
    const heightNum = form.height ? Number(form.height) : null;
    const weightNum = form.weight ? Number(form.weight) : null;
    if (form.height !== "" && (heightNum === null || Number.isNaN(heightNum) || heightNum <= 0)) {
      setValidationError("Tinggi badan harus > 0");
      return;
    }
    if (form.weight !== "" && (weightNum === null || Number.isNaN(weightNum) || weightNum <= 0)) {
      setValidationError("Berat badan harus > 0");
      return;
    }
    setValidationError(null);
    try {
      await updateMut.mutateAsync({
        mrn: form.mrn.trim(),
        name: form.name.trim(),
        gender: form.gender,
        birthDate: form.birthDate || undefined,
        phone: form.phone,
        allergy: form.allergy,
        height: heightNum,
        weight: weightNum,
        notes: form.notes,
      });
      toast.success(`Data pasien "${form.name}" berhasil diperbarui`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Gagal memperbarui pasien");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Pasien</DialogTitle>
          <DialogDescription>
            Perbarui data demografi & klinis pasien.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>No. Rekam Medis (MRN)</Label>
              <Input
                value={form.mrn}
                onChange={(e) => setForm({ ...form, mrn: e.target.value })}
                placeholder="RM-002"
              />
            </div>
            <div>
              <Label>Nama Lengkap</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama pasien"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Jenis Kelamin</Label>
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
              <Label>Tanggal Lahir</Label>
              <Input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>
            <div>
              <Label>No. Telepon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tinggi Badan (cm)</Label>
              <Input
                type="number"
                value={form.height}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
                placeholder="165"
                min={1}
              />
            </div>
            <div>
              <Label>Berat Badan (kg)</Label>
              <Input
                type="number"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                placeholder="62"
                min={1}
              />
            </div>
          </div>

          <div>
            <Label>Alergi</Label>
            <Input
              value={form.allergy}
              onChange={(e) => setForm({ ...form, allergy: e.target.value })}
              placeholder="Contoh: kacang, seafood"
            />
          </div>

          <div>
            <Label>Catatan Klinis</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Catatan tambahan untuk pasien ini..."
              rows={3}
            />
          </div>

          {validationError && (
            <p className="text-sm text-rose-600">{validationError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={submit} disabled={updateMut.isPending}>
            {updateMut.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// DeletePatientDialog — soft-delete confirmation
// ---------------------------------------------------------------------
function DeletePatientDialog({
  patient,
  onOpenChange,
}: {
  patient: any | null;
  onOpenChange: (o: boolean) => void;
}) {
  const open = !!patient;
  const deleteMut = useDeletePatient();
  const { setActivePatient } = useCareLiviaStore();

  const handleConfirm = async () => {
    if (!patient) return;
    try {
      await deleteMut.mutateAsync(patient.id);
      toast.success(`Pasien "${patient.name}" dihapus (soft delete)`);
      setActivePatient(null);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus pasien");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <Trash2 className="h-5 w-5" />
            Konfirmasi Hapus Pasien
          </DialogTitle>
          <DialogDescription>
            Tindakan ini akan menandai pasien sebagai terhapus (soft delete). Data masih tersimpan di database namun tidak akan tampil di daftar pasien aktif.
          </DialogDescription>
        </DialogHeader>

        {patient && (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-chart-2/15 text-sm font-bold text-primary">
                  {patient.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{patient.name}</p>
                  <p className="text-xs text-muted-foreground">MRN: {patient.mrn}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                Data yang akan ditandai terhapus:
              </p>
              <ul className="space-y-1 text-xs text-rose-800 dark:text-rose-300">
                <li className="flex items-start gap-1.5">
                  <span>•</span>
                  <span>Profil pasien (demografi, antropometri, alergi, catatan)</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>•</span>
                  <span>Diagnosis aktif terkait pasien</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>•</span>
                  <span>Riwayat meal plan, asupan, dan catatan berat badan</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>•</span>
                  <span>Asesmen gizi & rencana olahraga</span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              <MapPin className="mr-1 inline h-3 w-3" />
              Data dapat dipulihkan oleh admin database jika diperlukan.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending ? "Menghapus..." : "Ya, Hapus Pasien"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
