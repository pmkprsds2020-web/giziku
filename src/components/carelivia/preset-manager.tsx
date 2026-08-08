"use client";

import * as React from "react";
import {
  Save,
  Star,
  Copy,
  Pencil,
  Trash2,
  GitCompare,
  History,
  Plus,
  Bookmark,
  X,
  AlertTriangle,
  Utensils,
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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  usePresets,
  useCreatePreset,
  useUpdatePreset,
  useDeletePreset,
  useClonePreset,
  useToggleFavorite,
  usePresetHistory,
  useComparePresets,
} from "@/hooks/use-carelivia";
import { DIAGNOSIS_ADJUSTMENTS } from "@/lib/clinical/constants";
import type { DiagnosisType, PresetGoal } from "@prisma/client";

const KCAL_PER_GRAM = { protein: 4, carb: 4, fat: 9 };
function gramsFromPct(cal: number, pct: number, macro: keyof typeof KCAL_PER_GRAM) {
  return Math.round(((cal * pct) / 100 / KCAL_PER_GRAM[macro]) * 10) / 10;
}

const GOAL_LABELS: Record<PresetGoal, string> = {
  WEIGHT_LOSS: "Penurunan BB",
  WEIGHT_MAINTAIN: "Pemeliharaan BB",
  WEIGHT_GAIN: "Peningkatan BB",
  HIGH_PROTEIN: "Diet Tinggi Protein",
  LOW_CARB: "Diet Rendah Karbo",
  LOW_FAT: "Diet Rendah Lemak",
  CKD_DIET: "Diet CKD",
  DIABETES_DIET: "Diet Diabetes",
  HYPERTENSION_DIET: "Diet Hipertensi",
  GENERAL: "Umum",
};

const COLOR_OPTIONS = [
  "#10b981", "#06b6d4", "#0ea5e9", "#8b5cf6",
  "#ec4899", "#ef4444", "#f59e0b", "#f97316",
  "#22c55e", "#64748b",
];

const PRESET_COLORS = [
  "#10b981", "#06b6d4", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444",
];

interface PresetManagerProps {
  patientId?: string;
  activePresetId?: string | null;
  onSelectPreset?: (preset: any) => void;
  // For "save as preset" from calorie calculator
  currentResult?: {
    targetCalorie: number;
    macros: { proteinG: number; fatG: number; carbG: number; proteinPct: number; fatPct: number; carbPct: number };
    fiberTarget: number;
    sodiumMax: number;
    waterMl: number;
    primaryDiagnosis: any;
  };
  currentDiagnoses?: DiagnosisType[];
}

export function PresetManagerPanel({
  patientId,
  activePresetId,
  onSelectPreset,
  currentResult,
  currentDiagnoses = [],
}: PresetManagerProps) {
  const { data: presets, isLoading } = usePresets(patientId);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<any | null>(null);
  const [showCompare, setShowCompare] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState<string | null>(null);
  const [compareIds, setCompareIds] = React.useState<string[]>([]);

  const createMut = useCreatePreset();
  const updateMut = useUpdatePreset();
  const deleteMut = useDeletePreset();
  const cloneMut = useClonePreset();
  const favMut = useToggleFavorite();

  const patientPresets = (presets || []).filter((p: any) => !p.isTemplate);
  const templates = (presets || []).filter((p: any) => p.isTemplate);

  const handleSaveCurrent = () => {
    if (!currentResult) {
      toast.error("Hitung kalori terlebih dahulu sebelum menyimpan preset");
      return;
    }
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (preset: any) => {
    setEditing(preset);
    setShowForm(true);
  };

  const handleClone = async (preset: any) => {
    try {
      await cloneMut.mutateAsync({
        id: preset.id,
        patientId: patientId,
      });
      toast.success(`Preset "${preset.name}" diduplikasi`);
    } catch (e: any) {
      toast.error(e.message || "Gagal menduplikasi preset");
    }
  };

  const handleDelete = async (preset: any) => {
    if (!confirm(`Hapus preset "${preset.name}"?`)) return;
    try {
      await deleteMut.mutateAsync(preset.id);
      toast.success("Preset dihapus");
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus preset");
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) {
        toast.error("Maksimal 4 preset untuk dibandingkan");
        return prev;
      }
      return [...prev, id];
    });
  };

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Nutrition Preset</h3>
          <Badge variant="outline" className="text-[10px]">
            {patientPresets.length} tersimpan
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {currentResult && (
            <Button size="sm" variant="default" className="h-8" onClick={handleSaveCurrent}>
              <Save className="mr-1.5 h-3.5 w-3.5" /> Simpan sebagai Preset
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setShowCompare(true)}
            disabled={compareIds.length < 2}
          >
            <GitCompare className="mr-1.5 h-3.5 w-3.5" /> Bandingkan
            {compareIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                {compareIds.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Patient presets (Save 1/2/3 + unlimited) */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : patientPresets.length === 0 && templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Bookmark className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Belum ada preset tersimpan</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Hitung kalori lalu klik "Simpan sebagai Preset" untuk membuat Save 1, Save 2, dst.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {patientPresets.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Preset Pasien
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {patientPresets.map((preset: any, idx: number) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    index={idx}
                    active={activePresetId === preset.id}
                    selected={compareIds.includes(preset.id)}
                    onSelect={() => onSelectPreset?.(preset)}
                    onToggleCompare={() => toggleCompare(preset.id)}
                    onEdit={() => handleEdit(preset)}
                    onClone={() => handleClone(preset)}
                    onDelete={() => handleDelete(preset)}
                    onToggleFav={async () => {
                      try {
                        await favMut.mutateAsync(preset.id);
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                    onHistory={() => setShowHistory(preset.id)}
                  />
                ))}
              </div>
            </>
          )}

          {templates.length > 0 && (
            <>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Template Klinis
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {templates.map((preset: any) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    isTemplate
                    active={activePresetId === preset.id}
                    selected={compareIds.includes(preset.id)}
                    onSelect={() => onSelectPreset?.(preset)}
                    onToggleCompare={() => toggleCompare(preset.id)}
                    onClone={() => handleClone(preset)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Preset Form Dialog (create / edit) */}
      <PresetFormDialog
        open={showForm}
        onOpenChange={(o) => {
          setShowForm(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        patientId={patientId}
        currentResult={currentResult}
        currentDiagnoses={currentDiagnoses}
        onSubmit={async (data) => {
          try {
            if (editing) {
              await updateMut.mutateAsync({ id: editing.id, ...data });
              toast.success("Preset diperbarui");
            } else {
              await createMut.mutateAsync(data);
              toast.success("Preset disimpan");
            }
            setShowForm(false);
            setEditing(null);
          } catch (e: any) {
            toast.error(e.message || "Gagal menyimpan preset");
          }
        }}
      />

      {/* Compare Dialog */}
      <PresetCompareDialog
        open={showCompare}
        onOpenChange={setShowCompare}
        presetIds={compareIds}
        onClear={() => setCompareIds([])}
      />

      {/* History Dialog */}
      <PresetHistoryDialog
        presetId={showHistory}
        onOpenChange={(o) => !o && setShowHistory(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Preset Card
// ---------------------------------------------------------------------
function PresetCard({
  preset,
  index,
  active,
  selected,
  isTemplate,
  onSelect,
  onToggleCompare,
  onEdit,
  onClone,
  onDelete,
  onToggleFav,
  onHistory,
}: {
  preset: any;
  index?: number;
  active?: boolean;
  selected?: boolean;
  isTemplate?: boolean;
  onSelect?: () => void;
  onToggleCompare?: () => void;
  onEdit?: () => void;
  onClone?: () => void;
  onDelete?: () => void;
  onToggleFav?: () => void;
  onHistory?: () => void;
}) {
  const saveLabel = index !== undefined ? `Save ${index + 1}` : null;
  return (
    <div
      className={`group relative rounded-lg border p-3 transition-all ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : selected
            ? "border-primary/50 bg-primary/5"
            : "border-border/60 bg-card hover:border-primary/30"
      }`}
    >
      {/* Compare checkbox */}
      {onToggleCompare && (
        <div className="absolute right-2 top-2">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleCompare}
            aria-label="Pilih untuk perbandingan"
          />
        </div>
      )}

      <div className="flex items-start gap-2 pr-7">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{ backgroundColor: preset.color }}
        >
          {saveLabel || <Bookmark className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{preset.name}</p>
            {preset.isFavorite && (
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            )}
            {isTemplate && (
              <Badge variant="secondary" className="text-[9px]">Template</Badge>
            )}
          </div>
          {preset.description && (
            <p className="truncate text-[11px] text-muted-foreground">
              {preset.description}
            </p>
          )}
        </div>
      </div>

      {/* Nutrition summary */}
      <div className="mt-2.5 grid grid-cols-4 gap-1 text-center text-[10px]">
        <div className="rounded bg-primary/10 py-1">
          <p className="font-bold text-primary">{Math.round(preset.totalCal)}</p>
          <p className="text-muted-foreground">kcal</p>
        </div>
        <div className="rounded bg-rose-500/10 py-1">
          <p className="font-bold text-rose-600 dark:text-rose-400">{Math.round(preset.proteinG)}g</p>
          <p className="text-muted-foreground">P {preset.proteinPct}%</p>
        </div>
        <div className="rounded bg-amber-500/10 py-1">
          <p className="font-bold text-amber-600 dark:text-amber-400">{Math.round(preset.carbG)}g</p>
          <p className="text-muted-foreground">K {preset.carbPct}%</p>
        </div>
        <div className="rounded bg-violet-500/10 py-1">
          <p className="font-bold text-violet-600 dark:text-violet-400">{Math.round(preset.fatG)}g</p>
          <p className="text-muted-foreground">L {preset.fatPct}%</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-2.5 flex items-center gap-1">
        {onSelect && (
          <Button
            size="sm"
            variant={active ? "default" : "outline"}
            className="h-7 flex-1 text-[11px]"
            onClick={onSelect}
          >
            {active ? "Aktif" : "Pilih"}
          </Button>
        )}
        {onToggleFav && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onToggleFav}
            title={preset.isFavorite ? "Hapus favorit" : "Jadikan favorit"}
          >
            <Star className={`h-3.5 w-3.5 ${preset.isFavorite ? "fill-amber-400 text-amber-400" : ""}`} />
          </Button>
        )}
        {onHistory && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onHistory}
            title="Riwayat perubahan"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
        )}
        {onEdit && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onEdit}
            title="Edit preset"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {onClone && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onClone}
            title="Duplikat preset"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
        {onDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-rose-500 hover:text-rose-600"
            onClick={onDelete}
            title="Hapus preset"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Preset Form Dialog — create / edit
// ---------------------------------------------------------------------
function PresetFormDialog({
  open,
  onOpenChange,
  editing,
  patientId,
  currentResult,
  currentDiagnoses,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: any | null;
  patientId?: string;
  currentResult?: any;
  currentDiagnoses?: DiagnosisType[];
  onSubmit: (data: any) => Promise<void>;
}) {
  const [form, setForm] = React.useState({
    name: "",
    description: "",
    color: PRESET_COLORS[0],
    totalCal: "1800",
    proteinPct: 20,
    carbPct: 50,
    fatPct: 30,
    fiberG: "25",
    sodiumMg: "2300",
    potassiumMg: "",
    fluidMl: "",
    goal: "GENERAL" as PresetGoal,
    diagnoses: [] as string[],
  });
  const [warning, setWarning] = React.useState<string | null>(null);

  // Initialize form
  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description || "",
        color: editing.color,
        totalCal: String(editing.totalCal),
        proteinPct: editing.proteinPct,
        carbPct: editing.carbPct,
        fatPct: editing.fatPct,
        fiberG: String(editing.fiberG),
        sodiumMg: String(editing.sodiumMg),
        potassiumMg: editing.potassiumMg ? String(editing.potassiumMg) : "",
        fluidMl: editing.fluidMl ? String(editing.fluidMl) : "",
        goal: editing.goal,
        diagnoses: editing.diagnoses ? editing.diagnoses.split(",").filter(Boolean) : [],
      });
    } else if (currentResult) {
      // Pre-fill from calorie result
      setForm({
        name: `Save ${(currentDiagnoses || [])[0] || "Preset"}`,
        description: currentResult.primaryDiagnosis?.notes || "",
        color: PRESET_COLORS[0],
        totalCal: String(currentResult.targetCalorie),
        proteinPct: Math.round(currentResult.macros.proteinPct),
        carbPct: Math.round(currentResult.macros.carbPct),
        fatPct: Math.round(currentResult.macros.fatPct),
        fiberG: String(currentResult.fiberTarget),
        sodiumMg: String(currentResult.sodiumMax),
        potassiumMg: currentResult.potassiumMax ? String(currentResult.potassiumMax) : "",
        fluidMl: String(currentResult.waterMl),
        goal: "GENERAL",
        diagnoses: currentDiagnoses || [],
      });
    }
  }, [open, editing, currentResult, currentDiagnoses]);

  const calNum = Number(form.totalCal) || 0;
  const macroSum = form.proteinPct + form.carbPct + form.fatPct;
  const proteinG = gramsFromPct(calNum, form.proteinPct, "protein");
  const carbG = gramsFromPct(calNum, form.carbPct, "carb");
  const fatG = gramsFromPct(calNum, form.fatPct, "fat");

  // AI-style recommendation warnings
  React.useEffect(() => {
    const warnings: string[] = [];
    if (form.proteinPct >= 35) {
      warnings.push("Protein ≥35% sangat tinggi — kontraindikasi pada CKD stadium 4-5.");
    }
    if (form.proteinPct >= 30 && form.diagnoses.includes("CKD")) {
      warnings.push(`Protein ${form.proteinPct}% melebihi rekomendasi untuk pasien CKD (KDIGO: 10-15%).`);
    }
    if (form.fatPct >= 40) {
      warnings.push("Lemak ≥40% tinggi — pertimbangkan untuk dislipidemia/CHF.");
    }
    if (form.carbPct < 30) {
      warnings.push("Karbohidrat <30% sangat rendah — risiko ketoasidosis pada DM tipe 1.");
    }
    if (Number(form.sodiumMg) > 3000) {
      warnings.push("Natrium >3000mg tinggi — kontraindikasi HT/CHF/CKD.");
    }
    if (Number(form.sodiumMg) < 1000) {
      warnings.push("Natrium <1000mg sangat rendah — risiko hiponatremia.");
    }
    setWarning(warnings.length > 0 ? warnings.join(" ") : null);
  }, [form.proteinPct, form.fatPct, form.carbPct, form.sodiumMg, form.diagnoses]);

  const handleMacroSlider = (macro: "proteinPct" | "carbPct" | "fatPct", value: number) => {
    const others = macro === "proteinPct"
      ? { a: "carbPct" as const, b: "fatPct" as const }
      : macro === "carbPct"
        ? { a: "proteinPct" as const, b: "fatPct" as const }
        : { a: "proteinPct" as const, b: "carbPct" as const };
    const remaining = 100 - value;
    const aVal = form[others.a];
    const bVal = form[others.b];
    const sum = aVal + bVal;
    if (sum === 0) {
      setForm({ ...form, [macro]: value, [others.a]: remaining / 2, [others.b]: remaining / 2 });
    } else {
      setForm({
        ...form,
        [macro]: value,
        [others.a]: Math.round((aVal / sum) * remaining * 10) / 10,
        [others.b]: Math.round((bVal / sum) * remaining * 10) / 10,
      });
    }
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Nama preset wajib diisi");
      return;
    }
    if (Math.abs(macroSum - 100) > 5) {
      toast.error(`Total makronutrien harus ~100% (saat ini ${macroSum}%)`);
      return;
    }
    await onSubmit({
      patientId: patientId || null,
      name: form.name,
      description: form.description,
      color: form.color,
      totalCal: calNum,
      proteinPct: form.proteinPct,
      carbPct: form.carbPct,
      fatPct: form.fatPct,
      proteinG,
      carbG,
      fatG,
      fiberG: Number(form.fiberG) || 25,
      sodiumMg: Number(form.sodiumMg) || 2300,
      potassiumMg: form.potassiumMg ? Number(form.potassiumMg) : null,
      fluidMl: form.fluidMl ? Number(form.fluidMl) : null,
      goal: form.goal,
      diagnoses: form.diagnoses.join(","),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? (
              <>
                <Pencil className="h-4 w-4 text-primary" /> Edit Preset
              </>
            ) : (
              <>
                <Save className="h-4 w-4 text-primary" /> Simpan sebagai Preset
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Simpan konfigurasi gizi untuk digunakan kembali pada Meal Plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Identity */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Nama Preset</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Save 1 / Diet Diabetes 1800"
              />
            </div>
            <div>
              <Label className="text-xs">Tujuan Diet</Label>
              <Select
                value={form.goal}
                onValueChange={(v) => setForm({ ...form, goal: v as PresetGoal })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Deskripsi</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Catatan klinis untuk preset ini..."
              rows={2}
            />
          </div>

          <div>
            <Label className="text-xs">Warna Label</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-7 w-7 rounded-full transition-all ${
                    form.color === c ? "ring-2 ring-offset-2 ring-offset-background ring-foreground" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Warna ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Energy */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Total Kalori (kcal)</Label>
              <Input
                type="number"
                value={form.totalCal}
                onChange={(e) => setForm({ ...form, totalCal: e.target.value })}
                min={500}
                max={6000}
              />
            </div>
            <div>
              <Label className="text-xs">Cairan (ml) — opsional</Label>
              <Input
                type="number"
                value={form.fluidMl}
                onChange={(e) => setForm({ ...form, fluidMl: e.target.value })}
                placeholder={String(Math.round(calNum * 1.2))}
              />
            </div>
          </div>

          {/* Macros with sliders */}
          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs font-semibold">Distribusi Makronutrien</Label>
              <Badge
                variant={macroSum === 100 ? "outline" : "destructive"}
                className={`text-[10px] ${
                  macroSum === 100
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950"
                    : ""
                }`}
              >
                Total: {macroSum}%
              </Badge>
            </div>

            <div className="space-y-3">
              <MacroSlider
                label="Protein"
                pct={form.proteinPct}
                grams={proteinG}
                color="text-rose-600 dark:text-rose-400"
                barClass="bg-rose-500"
                onChange={(v) => handleMacroSlider("proteinPct", v)}
              />
              <MacroSlider
                label="Karbohidrat"
                pct={form.carbPct}
                grams={carbG}
                color="text-amber-600 dark:text-amber-400"
                barClass="bg-amber-500"
                onChange={(v) => handleMacroSlider("carbPct", v)}
              />
              <MacroSlider
                label="Lemak"
                pct={form.fatPct}
                grams={fatG}
                color="text-violet-600 dark:text-violet-400"
                barClass="bg-violet-500"
                onChange={(v) => handleMacroSlider("fatPct", v)}
              />
            </div>
          </div>

          {/* AI Warning */}
          {warning && (
            <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/40">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Peringatan AI CareLivia
                </p>
                <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400/90">
                  {warning}
                </p>
              </div>
            </div>
          )}

          {/* Micronutrients */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Serat (g)</Label>
              <Input
                type="number"
                value={form.fiberG}
                onChange={(e) => setForm({ ...form, fiberG: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Natrium max (mg)</Label>
              <Input
                type="number"
                value={form.sodiumMg}
                onChange={(e) => setForm({ ...form, sodiumMg: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Kalium (mg)</Label>
              <Input
                type="number"
                value={form.potassiumMg}
                onChange={(e) => setForm({ ...form, potassiumMg: e.target.value })}
                placeholder="opsional"
              />
            </div>
          </div>

          {/* Diagnoses */}
          <div>
            <Label className="text-xs">Diagnosis Terkait</Label>
            <ScrollArea className="h-24 rounded-md border border-border p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(DIAGNOSIS_ADJUSTMENTS) as DiagnosisType[]).map((d) => (
                  <label key={d} className="flex cursor-pointer items-center gap-1.5 text-[11px]">
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
                    <span className="leading-tight">
                      {DIAGNOSIS_ADJUSTMENTS[d].label.split("(")[0].trim()}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={createMutPending(editing)}>
            {editing ? "Simpan Perubahan" : "Simpan Preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function createMutPending(editing: any) {
  return false; // managed by parent via toast
}

function MacroSlider({
  label,
  pct,
  grams,
  color,
  barClass,
  onChange,
}: {
  label: string;
  pct: number;
  grams: number;
  color: string;
  barClass: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={`font-medium ${color}`}>{label}</span>
        <span className="font-mono text-muted-foreground">
          {pct}% · <strong className={color}>{grams}g</strong>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Slider
          value={[pct]}
          onValueChange={(v) => onChange(v[0])}
          min={5}
          max={70}
          step={1}
          className="flex-1"
        />
        <Input
          type="number"
          value={pct}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-7 w-14 text-xs"
          min={5}
          max={70}
        />
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Preset Compare Dialog
// ---------------------------------------------------------------------
function PresetCompareDialog({
  open,
  onOpenChange,
  presetIds,
  onClear,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetIds: string[];
  onClear: () => void;
}) {
  const compareMut = useComparePresets();
  const [result, setResult] = React.useState<any>(null);

  React.useEffect(() => {
    if (open && presetIds.length >= 2) {
      setResult(null);
      compareMut.mutate(presetIds, {
        onSuccess: (data) => setResult(data),
        onError: (e: any) => toast.error(e.message || "Gagal membandingkan"),
      });
    }
  }, [open, presetIds.join(",")]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" /> Perbandingan Preset
          </DialogTitle>
          <DialogDescription>
            Bandingkan {presetIds.length} preset secara side-by-side.
          </DialogDescription>
        </DialogHeader>

        {compareMut.isPending || !result ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Memuat perbandingan...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 pr-3 text-left text-xs font-medium text-muted-foreground">
                    Komponen
                  </th>
                  {result.presets.map((p: any) => (
                    <th key={p.id} className="pb-2 px-2 text-right text-xs font-semibold">
                      <div className="flex flex-col items-end">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="mt-0.5">{p.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row: any) => (
                  <tr key={row.key} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{row.label}</td>
                    {row.values.map((v: any, i: number) => (
                      <td
                        key={i}
                        className="py-2 px-2 text-right text-xs font-medium tabular-nums"
                      >
                        {typeof v === "number" ? Math.round(v * 10) / 10 : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClear}>Bersihkan Pilihan</Button>
          <Button onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Preset History Dialog
// ---------------------------------------------------------------------
function PresetHistoryDialog({
  presetId,
  onOpenChange,
}: {
  presetId: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: history, isLoading } = usePresetHistory(presetId);

  return (
    <Dialog open={!!presetId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Riwayat Perubahan Preset
          </DialogTitle>
          <DialogDescription>
            Audit trail lengkap dengan versioning.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Memuat riwayat...
          </div>
        ) : !history || history.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Belum ada riwayat perubahan.
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-2">
              {history.map((h: any) => {
                const changes = typeof h.changes === "string" ? JSON.parse(h.changes) : h.changes;
                return (
                  <div
                    key={h.id}
                    className="rounded-lg border border-border/60 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          v{h.version}
                        </Badge>
                        <span className="text-xs font-medium text-foreground">
                          {h.reason || h.actor}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(h.createdAt).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    {changes && typeof changes === "object" && !changes.action && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(changes).slice(0, 5).map(([field, val]: [string, any]) => (
                          <div key={field} className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-mono text-muted-foreground">{field}:</span>
                            <span className="text-rose-500 line-through">
                              {String(val.from).slice(0, 30)}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium text-emerald-600">
                              {String(val.to).slice(0, 30)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {changes?.action === "CREATE" && (
                      <p className="mt-1 text-[11px] text-muted-foreground">Preset dibuat</p>
                    )}
                    {changes?.action === "CLONE" && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Duplikat dari "{changes.sourceName}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
