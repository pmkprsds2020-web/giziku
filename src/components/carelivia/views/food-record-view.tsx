"use client";

import * as React from "react";
import {
  ClipboardList,
  User,
  Plus,
  Search,
  Trash2,
  Calendar,
  Flame,
  Beef,
  Droplet,
  Wheat,
  Leaf,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { toast } from "sonner";
import {
  PageHeader,
  SectionCard,
  EmptyState,
} from "@/components/carelivia/ui-helpers";
import {
  usePatients,
  useFoods,
  useFoodRecords,
  useAddFoodRecord,
  useDeleteFoodRecord,
  useMealPlans,
  useWeeklyCompliance,
} from "@/hooks/use-carelivia";
import { useCareLiviaStore } from "@/store/carelivia";
import type { MealSlot } from "@prisma/client";

const SLOT_LABELS: Record<MealSlot, string> = {
  BREAKFAST: "Sarapan",
  MORNING_SNACK: "Snack Pagi",
  LUNCH: "Makan Siang",
  AFTERNOON_SNACK: "Snack Sore",
  DINNER: "Makan Malam",
  EVENING_SNACK: "Snack Malam",
};

const SLOT_ORDER: MealSlot[] = [
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "EVENING_SNACK",
];

const SLOT_COLORS: Record<MealSlot, string> = {
  BREAKFAST: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  MORNING_SNACK: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  LUNCH: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  AFTERNOON_SNACK: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  DINNER: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  EVENING_SNACK: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

interface FoodItem {
  id: string;
  name: string;
  energy: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
  urt?: string | null;
  price?: number;
}

interface FoodRecord {
  id: string;
  date: string | Date;
  slot: MealSlot;
  foodId: string;
  food: FoodItem;
  amount: number;
  consumed: number;
  cal: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
}

function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

export function FoodRecordView() {
  const { data: patients } = usePatients();
  const { activePatientId, setActivePatient } = useCareLiviaStore();
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>(
    activePatientId || "",
  );
  const [date, setDate] = React.useState<string>(todayStr());
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (activePatientId && !selectedPatientId) {
      setSelectedPatientId(activePatientId);
    }
  }, [activePatientId, selectedPatientId]);

  const { data: records, isLoading } = useFoodRecords(
    selectedPatientId || null,
    date,
  );

  // Fetch latest meal plan for compliance comparison
  const { data: mealPlans } = useMealPlans(selectedPatientId || undefined);
  const latestPlan = mealPlans?.[0];

  // Fetch weekly compliance trend
  const { data: weeklyData } = useWeeklyCompliance(selectedPatientId || null);

  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id);
    setActivePatient(id);
  };

  // Summary totals
  const totals = React.useMemo(() => {
    const t = { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0 };
    (records || []).forEach((r: FoodRecord) => {
      t.cal += r.cal || 0;
      t.protein += r.protein || 0;
      t.fat += r.fat || 0;
      t.carb += r.carb || 0;
      t.fiber += r.fiber || 0;
      t.sodium += r.sodium || 0;
    });
    return t;
  }, [records]);

  // Group by slot
  const bySlot = React.useMemo(() => {
    const map: Record<MealSlot, FoodRecord[]> = {
      BREAKFAST: [],
      MORNING_SNACK: [],
      LUNCH: [],
      AFTERNOON_SNACK: [],
      DINNER: [],
      EVENING_SNACK: [],
    };
    (records || []).forEach((r: FoodRecord) => {
      if (map[r.slot]) map[r.slot].push(r);
    });
    return map;
  }, [records]);

  return (
    <div>
      <PageHeader
        title="Catatan Asupan Harian"
        subtitle="Food record harian — pantau kalori & gizi aktual yang dikonsumsi"
        icon={ClipboardList}
        actions={
          <Button
            onClick={() => setDialogOpen(true)}
            disabled={!selectedPatientId}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" /> Tambah Asupan
          </Button>
        }
      />

      {/* Patient selector + date */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-1 items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="hidden text-sm font-medium sm:inline">Pasien:</span>
          <Select
            value={selectedPatientId}
            onValueChange={handleSelectPatient}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Pilih pasien..." />
            </SelectTrigger>
            <SelectContent>
              {(patients || []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.mrn})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {!selectedPatientId ? (
        <EmptyState
          title="Pilih pasien untuk memulai"
          description="Catat asupan makanan harian untuk pemantauan gizi klinis."
          icon={ClipboardList}
        />
      ) : isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : (records || []).length === 0 ? (
        <EmptyState
          title="Belum ada catatan asupan"
          description={`Tidak ada catatan untuk tanggal ${new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.`}
          icon={ClipboardList}
          action={
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" /> Tambah Asupan
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Summary bar */}
          <Card className="overflow-hidden border-border/60 shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <SummaryStat
                  label="Kalori"
                  value={Math.round(totals.cal)}
                  unit="kcal"
                  icon={Flame}
                  color="text-rose-500"
                />
                <SummaryStat
                  label="Protein"
                  value={Math.round(totals.protein)}
                  unit="g"
                  icon={Beef}
                  color="text-emerald-600"
                />
                <SummaryStat
                  label="Lemak"
                  value={Math.round(totals.fat)}
                  unit="g"
                  icon={Droplet}
                  color="text-amber-500"
                />
                <SummaryStat
                  label="Karbo"
                  value={Math.round(totals.carb)}
                  unit="g"
                  icon={Wheat}
                  color="text-orange-500"
                />
                <SummaryStat
                  label="Serat"
                  value={Math.round(totals.fiber)}
                  unit="g"
                  icon={Leaf}
                  color="text-teal-600"
                />
                <SummaryStat
                  label="Natrium"
                  value={Math.round(totals.sodium)}
                  unit="mg"
                  icon={Leaf}
                  color="text-violet-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Compliance vs Meal Plan Target */}
          {latestPlan && (
            <ComplianceComparison
              totals={totals}
              plan={latestPlan}
              recordCount={(records || []).length}
            />
          )}

          {/* Weekly compliance trend */}
          {weeklyData?.hasPlan && (
            <WeeklyComplianceChart data={weeklyData} />
          )}

          {/* Records by slot */}
          <SectionCard
            title="Asupan per Waktu Makan"
            description={`${(records || []).length} item pada ${new Date(date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
          >
            <div className="space-y-3">
              {SLOT_ORDER.map((slot) => {
                const items = bySlot[slot];
                if (items.length === 0) return null;
                const slotCal = items.reduce((s, i) => s + i.cal, 0);
                return (
                  <div
                    key={slot}
                    className="overflow-hidden rounded-lg border border-border/60"
                  >
                    <div
                      className={`flex items-center justify-between px-3 py-2 ${SLOT_COLORS[slot]}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Clock className="h-3.5 w-3.5" />
                        {SLOT_LABELS[slot]}
                      </span>
                      <span className="text-xs font-bold">
                        {Math.round(slotCal)} kcal
                      </span>
                    </div>
                    <div className="divide-y divide-border/40">
                      {items.map((r) => (
                        <RecordRow key={r.id} record={r} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      <AddFoodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patientId={selectedPatientId}
        date={date}
      />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  unit,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-base font-bold tabular-nums text-foreground">
          {value}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        </p>
      </div>
    </div>
  );
}

function RecordRow({ record }: { record: FoodRecord }) {
  const deleteMut = useDeleteFoodRecord();
  const [confirming, setConfirming] = React.useState(false);

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync(record.id);
      toast.success("Asupan dihapus");
      setConfirming(false);
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus");
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {record.food.name}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {record.amount}g
          {record.food.urt ? ` · URT ${record.food.urt}` : ""}
          {record.consumed < 100 ? ` · dikonsumsi ${record.consumed}%` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[11px]">
        <span className="text-emerald-600">P {Math.round(record.protein)}g</span>
        <span className="font-bold text-primary">{Math.round(record.cal)}</span>
        {confirming ? (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-[11px]"
              onClick={handleDelete}
              disabled={deleteMut.isPending}
            >
              Ya
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={() => setConfirming(false)}
            >
              Batal
            </Button>
          </div>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-rose-600"
            onClick={() => setConfirming(true)}
            aria-label="Hapus"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function AddFoodDialog({
  open,
  onOpenChange,
  patientId,
  date,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientId: string;
  date: string;
}) {
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [selectedFood, setSelectedFood] = React.useState<FoodItem | null>(null);
  const [slot, setSlot] = React.useState<MealSlot>("BREAKFAST");
  const [amount, setAmount] = React.useState("100");
  const [consumed, setConsumed] = React.useState("100");

  // Debounce query
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: foodData, isFetching } = useFoods({
    q: debounced.length >= 2 ? debounced : undefined,
  });

  const addMut = useAddFoodRecord();

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
      setSelectedFood(null);
      setSlot("BREAKFAST");
      setAmount("100");
      setConsumed("100");
    }
  }, [open]);

  const submit = async () => {
    if (!patientId || !selectedFood) {
      toast.error("Pilih makanan terlebih dahulu");
      return;
    }
    const amt = Number(amount);
    const con = Number(consumed);
    if (!amt || amt < 1) {
      toast.error("Jumlah (gram) harus > 0");
      return;
    }
    if (isNaN(con) || con < 0 || con > 100) {
      toast.error("% dikonsumsi harus antara 0–100");
      return;
    }
    try {
      await addMut.mutateAsync({
        patientId,
        foodId: selectedFood.id,
        slot,
        amount: amt,
        consumed: con,
        date,
      });
      toast.success(`${selectedFood.name} ditambahkan ke ${SLOT_LABELS[slot]}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Gagal menambah asupan");
    }
  };

  const foods: FoodItem[] = foodData?.foods || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Tambah Asupan Makanan</DialogTitle>
          <DialogDescription>
            Cari bahan makanan dari database TKPI/DKBM, lalu tentukan waktu, jumlah & persentase konsumsi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Food search */}
          <div className="space-y-2">
            <Label>Cari Makanan</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ketik minimal 2 huruf (cth: nasi, ayam, bayam)..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedFood(null);
                }}
                className="pl-9"
              />
            </div>

            {/* Selected food chip */}
            {selectedFood && (
              <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 dark:bg-emerald-950/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {selectedFood.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedFood.energy} kcal · P {selectedFood.protein}g · K {selectedFood.carb}g · L {selectedFood.fat}g / 100g
                  </p>
                </div>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              </div>
            )}

            {/* Search results */}
            {!selectedFood && debounced.length >= 2 && (
              <ScrollArea className="h-56 rounded-md border border-border">
                {isFetching ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-md" />
                    ))}
                  </div>
                ) : foods.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    Tidak ada hasil untuk &quot;{debounced}&quot;.
                  </p>
                ) : (
                  <div className="divide-y divide-border/40">
                    {foods.slice(0, 50).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFood(f)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {f.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {f.energy} kcal · P {f.protein}g · K {f.carb}g
                            {f.urt ? ` · URT ${f.urt}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {Math.round(f.energy)} kcal
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>

          {/* Slot + amount + consumed */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Waktu Makan</Label>
              <Select value={slot} onValueChange={(v) => setSlot(v as MealSlot)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLOT_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SLOT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jumlah (g)</Label>
              <Input
                type="number"
                min={1}
                max={2000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dikonsumsi (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={consumed}
                onChange={(e) => setConsumed(e.target.value)}
                placeholder="100"
              />
            </div>
          </div>

          {selectedFood && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
              <p className="font-medium text-foreground">Estimasi Gizi</p>
              <div className="mt-1 grid grid-cols-3 gap-2 text-muted-foreground">
                <span>Kalori: <b className="text-foreground">{Math.round((selectedFood.energy * Number(amount || 0) * Number(consumed || 0)) / 10000)}</b> kcal</span>
                <span>Protein: <b className="text-foreground">{(selectedFood.protein * Number(amount || 0) * Number(consumed || 0) / 10000).toFixed(1)}</b> g</span>
                <span>Karbo: <b className="text-foreground">{(selectedFood.carb * Number(amount || 0) * Number(consumed || 0) / 10000).toFixed(1)}</b> g</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={submit}
            disabled={addMut.isPending || !selectedFood}
          >
            {addMut.isPending ? "Menyimpan..." : "Tambah Asupan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Compliance Comparison — actual intake vs meal plan target
// ---------------------------------------------------------------------
function ComplianceComparison({
  totals,
  plan,
  recordCount,
}: {
  totals: { cal: number; protein: number; fat: number; carb: number; fiber: number; sodium: number };
  plan: any;
  recordCount: number;
}) {
  const target = {
    cal: plan.targetCal,
    protein: plan.targetProtein,
    fat: plan.targetFat,
    carb: plan.targetCarb,
    fiber: plan.targetFiber,
    sodium: plan.targetSodium,
  };

  const items = [
    { label: "Kalori", actual: totals.cal, target: target.cal, unit: "kcal", inverted: false },
    { label: "Protein", actual: totals.protein, target: target.protein, unit: "g", inverted: false },
    { label: "Karbohidrat", actual: totals.carb, target: target.carb, unit: "g", inverted: false },
    { label: "Lemak", actual: totals.fat, target: target.fat, unit: "g", inverted: false },
    { label: "Serat", actual: totals.fiber, target: target.fiber, unit: "g", inverted: false },
    { label: "Natrium", actual: totals.sodium, target: target.sodium, unit: "mg", inverted: true },
  ];

  // Overall compliance score
  const complianceScore = Math.round(
    (items.reduce((sum, it) => {
      const pct = it.target > 0 ? Math.min(it.actual, it.target) / it.target : 0;
      const sodiumOk = it.inverted ? (it.actual <= it.target ? 1 : it.target / Math.max(it.actual, 1)) : pct;
      return sum + (it.inverted ? sodiumOk : pct);
    }, 0) / items.length) * 100,
  );

  const complianceColor =
    complianceScore >= 80 ? "emerald" : complianceScore >= 60 ? "amber" : "rose";
  const complianceLabel =
    complianceScore >= 80 ? "Sangat Baik" : complianceScore >= 60 ? "Cukup" : "Perlu Perhatian";

  const colorMap: Record<string, string> = {
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    amber: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    rose: "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  };

  return (
    <Card className="overflow-hidden border-primary/30 shadow-sm">
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Compliance Asupan vs Meal Plan</h3>
            {plan.preset && (
              <Badge variant="outline" className="text-[10px]">
                Preset: {plan.preset.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {new Date(plan.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-bold ${colorMap[complianceColor]}`}
            >
              {complianceScore}% — {complianceLabel}
            </span>
          </div>
        </div>

        {recordCount === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Belum ada catatan asupan hari ini. Tambahkan asupan untuk melihat compliance.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => {
              const pct = it.target > 0 ? (it.actual / it.target) * 100 : 0;
              const cappedPct = Math.min(100, pct);
              // For sodium (inverted), good = under target
              const isGood = it.inverted ? it.actual <= it.target : pct >= 85 && pct <= 110;
              const isWarn = it.inverted ? it.actual > it.target : pct < 85 || pct > 110;
              const barColor = isGood ? "bg-emerald-500" : isWarn ? "bg-rose-500" : "bg-amber-500";
              const statusLabel = it.inverted
                ? it.actual <= it.target
                  ? "Aman"
                  : "Melebihi Batas"
                : pct >= 85 && pct <= 110
                  ? "Tercapai"
                  : pct < 85
                    ? "Kurang"
                    : "Berlebih";

              return (
                <div key={it.label} className="rounded-lg border border-border/60 p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground">{it.label}</span>
                    <span
                      className={`text-[9px] font-medium ${
                        isGood ? "text-emerald-600 dark:text-emerald-400" : isWarn ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-base font-bold cl-stat-num text-foreground">
                      {Math.round(it.actual)}
                      <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{it.unit}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      / {Math.round(it.target)} {it.unit}
                    </span>
                  </div>
                  <div className="mb-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${cappedPct}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    {Math.round(pct)}% dari target
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Weekly Compliance Chart — 7-day compliance trend
// ---------------------------------------------------------------------
function WeeklyComplianceChart({ data }: { data: any }) {
  const { days, weeklyAvg, plan } = data;

  const chartData = days.map((d: any) => ({
    day: d.dayLabel,
    date: d.dateLabel,
    compliance: d.compliance,
    cal: Math.round(d.totals.cal),
    recordCount: d.recordCount,
  }));

  const barColor = (compliance: number) => {
    if (compliance >= 80) return "#10b981";
    if (compliance >= 60) return "#f59e0b";
    if (compliance > 0) return "#ef4444";
    return "#94a3b8";
  };

  const avgColor =
    weeklyAvg.compliance >= 80 ? "#10b981" : weeklyAvg.compliance >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Tren Compliance 7 Hari</h3>
            {plan?.presetName && (
              <Badge variant="outline" className="text-[10px]">
                {plan.presetName}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Rata-rata mingguan</p>
              <p className="text-lg font-bold cl-stat-num" style={{ color: avgColor }}>
                {weeklyAvg.compliance}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Avg kalori/hari</p>
              <p className="text-lg font-bold cl-stat-num text-foreground">
                {weeklyAvg.cal}
                <span className="text-[10px] font-normal text-muted-foreground"> kcal</span>
              </p>
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
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
                  if (name === "compliance") {
                    return [`${value}% (${props.payload.cal} kcal)`, "Compliance"];
                  }
                  return [value, name];
                }}
                labelFormatter={(label, payload) => {
                  const p = payload?.[0]?.payload;
                  return p ? `${p.date} · ${p.recordCount} record` : label;
                }}
              />
              <Bar dataKey="compliance" radius={[4, 4, 0, 0]} maxBarSize={50}>
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={barColor(entry.compliance)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> ≥80% (Baik)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> 60-79% (Cukup)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> &lt;60% (Kurang)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" /> Kosong
          </span>
        </div>

        {/* Daily breakdown */}
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {days.map((d: any, i: number) => (
            <div key={i} className="rounded-md border border-border/40 p-1.5">
              <p className="text-[9px] font-medium text-muted-foreground">{d.dayLabel}</p>
              <p className="text-[10px] font-bold" style={{ color: barColor(d.compliance) }}>
                {d.compliance > 0 ? `${d.compliance}%` : "—"}
              </p>
              <p className="text-[8px] text-muted-foreground">
                {d.totals.cal > 0 ? Math.round(d.totals.cal) : "0"}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
