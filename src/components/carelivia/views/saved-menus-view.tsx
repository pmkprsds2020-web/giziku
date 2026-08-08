"use client";

import * as React from "react";
import {
  ChefHat,
  Search,
  Trash2,
  Eye,
  GitCompare,
  Bookmark,
  Save,
  X,
  Brain,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Upload,
  FileDown,
  Download,
} from "lucide-react";
import {
  Card,
  CardContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { toast } from "sonner";
import {
  PageHeader,
  SectionCard,
  EmptyState,
} from "@/components/carelivia/ui-helpers";
import {
  usePatients,
  useSavedMealPlans,
  useDeleteSavedMealPlan,
  useMarkSavedMealPlanUsed,
  useMealPlans,
  useComparisons,
  useRunComparison,
  useAddMealItem,
  useDeleteMealItem,
} from "@/hooks/use-carelivia";
import { useCareLiviaStore } from "@/store/carelivia";
import type { MealSlot } from "@prisma/client";

const SLOT_LABELS: Record<string, string> = {
  BREAKFAST: "Sarapan",
  MORNING_SNACK: "Snack Pagi",
  LUNCH: "Makan Siang",
  AFTERNOON_SNACK: "Snack Sore",
  DINNER: "Makan Malam",
  EVENING_SNACK: "Snack Malam",
};

const SLOT_COLORS: Record<string, string> = {
  BREAKFAST: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  MORNING_SNACK: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  LUNCH: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  AFTERNOON_SNACK: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  DINNER: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  EVENING_SNACK: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
};

const ALL_SLOTS = Object.keys(SLOT_LABELS) as MealSlot[];

export function SavedMenusView() {
  const { data: patients } = usePatients();
  const { activePatientId, setActivePatient } = useCareLiviaStore();
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>(
    activePatientId || "",
  );
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [detailPlan, setDetailPlan] = React.useState<any | null>(null);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [loadTargetPlanId, setLoadTargetPlanId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activePatientId && !selectedPatientId) {
      setSelectedPatientId(activePatientId);
    }
  }, [activePatientId, selectedPatientId]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: plans, isLoading } = useSavedMealPlans(
    selectedPatientId || undefined,
    debounced || undefined,
  );
  const deleteMut = useDeleteSavedMealPlan();

  const handleDelete = async (plan: any) => {
    if (!confirm(`Hapus meal plan "${plan.name}"?`)) return;
    try {
      await deleteMut.mutateAsync(plan.id);
      toast.success("Meal plan dihapus");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Saved Meal Library"
        subtitle="Template meal plan harian utuh + perbandingan dengan Food Record"
        icon={ChefHat}
        actions={
          <Button
            size="sm"
            onClick={() => setCompareOpen(true)}
            disabled={!selectedPatientId}
          >
            <GitCompare className="mr-2 h-4 w-4" /> Bandingkan dengan Food Record
          </Button>
        }
      />

      {/* Patient selector */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Pasien:</span>
        </div>
        <Select
          value={selectedPatientId}
          onValueChange={(v) => {
            setSelectedPatientId(v);
            setActivePatient(v);
          }}
        >
          <SelectTrigger className="w-full sm:w-72">
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

      {!selectedPatientId ? (
        <EmptyState
          title="Pilih pasien untuk melihat saved meal plans"
          description="Meal plan tersimpan adalah template harian utuh yang dapat digunakan ulang."
          icon={ChefHat}
        />
      ) : (
        <>
          {/* Search */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama meal plan... (contoh: Diet DM, Menu Senin)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="outline" className="w-fit">
              {plans?.length || 0} meal plan
            </Badge>
          </div>

          {/* Meal plan table */}
          {isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : !plans || plans.length === 0 ? (
            <EmptyState
              title="Belum ada meal plan tersimpan"
              description="Buka Meal Plan, lalu klik 'Simpan Semua Menu' untuk menyimpan 1 meal plan utuh."
              icon={ChefHat}
            />
          ) : (
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Meal Plan</TableHead>
                        <TableHead className="text-right">Kalori</TableHead>
                        <TableHead className="text-right">Protein</TableHead>
                        <TableHead className="text-right">Bahan</TableHead>
                        <TableHead className="text-right">Waktu Makan</TableHead>
                        <TableHead>Terakhir Dipakai</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan: any) => (
                        <TableRow key={plan.id} className="hover:bg-muted/40">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ChefHat className="h-3.5 w-3.5 text-primary" />
                              <div>
                                <p className="text-sm font-medium text-foreground">{plan.name}</p>
                                {plan.description && (
                                  <p className="text-[10px] text-muted-foreground line-clamp-1">{plan.description}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                            {Math.round(plan.totalCal)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {Math.round(plan.totalProtein)}g
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {plan.items.length}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {ALL_SLOTS.filter((s) => plan.items.some((i: any) => i.slot === s)).length}/6
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {plan.lastUsedAt
                              ? new Date(plan.lastUsedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
                              : "—"}
                            {plan.useCount > 0 && (
                              <span className="ml-1 text-[9px]">({plan.useCount}x)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-0.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setDetailPlan(plan)}
                                title="Lihat detail"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setLoadTargetPlanId(plan.id)}
                                title="Gunakan meal plan"
                              >
                                <Upload className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-rose-500 hover:text-rose-600"
                                onClick={() => handleDelete(plan)}
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
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comparison History */}
          {selectedPatientId && <ComparisonHistorySection patientId={selectedPatientId} />}
        </>
      )}

      {/* Detail Dialog */}
      <MealPlanDetailDialog plan={detailPlan} onClose={() => setDetailPlan(null)} />

      {/* Load Dialog */}
      {loadTargetPlanId && selectedPatientId && (
        <LoadMealPlanDialog
          savedPlanId={loadTargetPlanId}
          patientId={selectedPatientId}
          onClose={() => setLoadTargetPlanId(null)}
        />
      )}

      {/* Compare Dialog */}
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        patientId={selectedPatientId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Meal Plan Detail Dialog — shows all 6 slots
// ---------------------------------------------------------------------
function MealPlanDetailDialog({ plan, onClose }: { plan: any | null; onClose: () => void }) {
  if (!plan) return null;

  const itemsBySlot = (plan.items || []).reduce(
    (acc: Record<string, any[]>, item: any) => {
      (acc[item.slot] = acc[item.slot] || []).push(item);
      return acc;
    },
    {} as Record<string, any[]>,
  );

  return (
    <Dialog open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            {plan.name}
          </DialogTitle>
          <DialogDescription>
            {plan.description || "Detail meal plan utuh"} · {plan.items.length} bahan total
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Daily nutrition summary */}
          <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
            <div className="rounded bg-primary/10 py-1.5">
              <p className="text-base font-bold text-primary">{Math.round(plan.totalCal)}</p>
              <p className="text-muted-foreground">kcal</p>
            </div>
            <div className="rounded bg-rose-500/10 py-1.5">
              <p className="text-base font-bold text-rose-600 dark:text-rose-400">{Math.round(plan.totalProtein)}g</p>
              <p className="text-muted-foreground">Protein</p>
            </div>
            <div className="rounded bg-amber-500/10 py-1.5">
              <p className="text-base font-bold text-amber-600 dark:text-amber-400">{Math.round(plan.totalCarb)}g</p>
              <p className="text-muted-foreground">Karbo</p>
            </div>
            <div className="rounded bg-violet-500/10 py-1.5">
              <p className="text-base font-bold text-violet-600 dark:text-violet-400">{Math.round(plan.totalFat)}g</p>
              <p className="text-muted-foreground">Lemak</p>
            </div>
          </div>

          {/* All 6 slots */}
          {ALL_SLOTS.map((slot) => {
            const items = itemsBySlot[slot] || [];
            const slotCal = items.reduce((s, i) => s + i.cal, 0);
            return (
              <div key={slot} className="rounded-lg border border-border/60 overflow-hidden">
                <div className={`flex items-center justify-between px-3 py-2 ${SLOT_COLORS[slot]}`}>
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="h-3.5 w-3.5" />
                    {SLOT_LABELS[slot]}
                  </span>
                  <span className="text-xs font-bold">
                    {items.length > 0 ? `${Math.round(slotCal)} kcal · ${items.length} bahan` : "Kosong"}
                  </span>
                </div>
                {items.length > 0 && (
                  <div className="divide-y divide-border/40">
                    {items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{item.foodName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.urt ? `URT: ${item.urt} · ` : ""}{item.amount}g
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2 text-[10px] text-muted-foreground">
                          <span className="text-rose-500">P{Math.round(item.protein)}g</span>
                          <span className="text-amber-500">K{Math.round(item.carb)}g</span>
                          <span className="text-violet-500">L{Math.round(item.fat)}g</span>
                          <span className="font-mono font-semibold text-primary">{Math.round(item.cal)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Meta */}
          {plan.notes && (
            <div className="rounded-md border border-border/40 bg-muted/20 p-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground">Catatan</p>
              <p className="text-xs text-foreground/90">{plan.notes}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            <span>Dibuat: {new Date(plan.createdAt).toLocaleDateString("id-ID")}</span>
            <span>·</span>
            <span>Versi: {plan.version}</span>
            {plan.useCount > 0 && (
              <>
                <span>·</span>
                <span>Dipakai: {plan.useCount}x</span>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Load Meal Plan Dialog — load all 6 slots into current meal plan
// ---------------------------------------------------------------------
function LoadMealPlanDialog({
  savedPlanId,
  patientId,
  onClose,
}: {
  savedPlanId: string;
  patientId: string;
  onClose: () => void;
}) {
  const { data: mealPlans } = useMealPlans(patientId);
  const { data: savedPlans } = useSavedMealPlans(patientId);
  const [targetMealPlanId, setTargetMealPlanId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const addMut = useAddMealItem("");
  const deleteMut = useDeleteMealItem("");
  const markUsedMut = useMarkSavedMealPlanUsed();

  const savedPlan = (savedPlans || []).find((p: any) => p.id === savedPlanId);
  const latestMealPlan = (mealPlans || [])[0];

  React.useEffect(() => {
    if (latestMealPlan && !targetMealPlanId) {
      setTargetMealPlanId(latestMealPlan.id);
    }
  }, [latestMealPlan, targetMealPlanId]);

  const handleLoad = async () => {
    if (!targetMealPlanId || !savedPlan) return;
    setLoading(true);
    try {
      // Step 1: Delete all existing items in ONE bulk request via direct Supabase
      const targetPlan = (mealPlans || []).find((p: any) => p.id === targetMealPlanId);
      if (targetPlan?.items && targetPlan.items.length > 0) {
        // Delete all items at once using the delete endpoint with all item IDs
        await Promise.all(
          targetPlan.items.map((item: any) =>
            fetch(`/api/meal-plan/${targetMealPlanId}/items/${item.id}`, { method: "DELETE" }).catch(() => {})
          )
        );
      }

      // Step 2: Add all items from saved meal plan in PARALLEL (not sequential)
      await Promise.all(
        savedPlan.items.map((item: any) =>
          fetch(`/api/meal-plan/${targetMealPlanId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slot: item.slot,
              foodId: item.foodId,
              amount: item.amount,
            }),
          }).catch(() => {})
        )
      );

      // Step 3: Mark saved plan as used
      await markUsedMut.mutateAsync(savedPlanId);

      toast.success(`Meal Plan "${savedPlan.name}" dimuat (${savedPlan.items.length} bahan)`);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat meal plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Gunakan Meal Plan
          </DialogTitle>
          <DialogDescription>
            Muat "{savedPlan?.name}" ({savedPlan?.items.length} bahan) ke meal plan aktif.
            Semua menu saat ini akan diganti.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Target Meal Plan</Label>
            <Select value={targetMealPlanId} onValueChange={setTargetMealPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih meal plan target..." />
              </SelectTrigger>
              <SelectContent>
                {(mealPlans || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.preset?.name || `Meal Plan ${new Date(p.date).toLocaleDateString("id-ID")}`} · {Math.round(p.targetCal)} kcal
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 dark:bg-amber-950/30">
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              ⚠️ Peringatan: Memuat meal plan akan mengganti semua menu yang ada di target meal plan.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleLoad} disabled={loading || !targetMealPlanId}>
            {loading ? "Memuat..." : (
              <>
                <Upload className="mr-2 h-4 w-4" /> Muat Meal Plan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Compare Dialog — Saved Meal Plan vs Food Record
// ---------------------------------------------------------------------
function CompareDialog({
  open,
  onOpenChange,
  patientId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientId: string;
}) {
  const { data: savedPlans } = useSavedMealPlans(patientId);
  const { data: mealPlans } = useMealPlans(patientId);
  const runMut = useRunComparison();

  const [compareType, setCompareType] = React.useState<"saved-meal-plan" | "meal-plan">("saved-meal-plan");
  const [selectedSavedPlanId, setSelectedSavedPlanId] = React.useState<string>("");
  const [selectedMealPlanId, setSelectedMealPlanId] = React.useState<string>("");
  const [date, setDate] = React.useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
  });
  const [result, setResult] = React.useState<any | null>(null);

  const handleCompare = async () => {
    if (!patientId) {
      toast.error("Pilih pasien dulu");
      return;
    }
    if (compareType === "saved-meal-plan" && !selectedSavedPlanId) {
      toast.error("Pilih saved meal plan");
      return;
    }
    if (compareType === "meal-plan" && !selectedMealPlanId) {
      toast.error("Pilih meal plan");
      return;
    }
    try {
      const res = await runMut.mutateAsync({
        patientId,
        date,
        mealPlanId: compareType === "meal-plan" ? selectedMealPlanId : undefined,
        savedMealPlanId: compareType === "saved-meal-plan" ? selectedSavedPlanId : undefined,
      });
      setResult(res);
      toast.success(`Compliance: ${res.complianceScore}%`);
    } catch (e: any) {
      toast.error(e.message || "Gagal menjalankan perbandingan");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setResult(null); }}>
      <DialogContent className="max-h-[94vh] overflow-hidden p-0 sm:max-w-[780px]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Bandingkan Meal Plan vs Food Record
          </DialogTitle>
          <DialogDescription>
            Pilih saved meal plan atau meal plan aktif, lalu pilih tanggal food record untuk perbandingan.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[72vh] px-6 py-3">
          {/* Inputs */}
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Sumber Rencana</Label>
                <Select value={compareType} onValueChange={(v) => setCompareType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saved-meal-plan">Saved Meal Plan (template)</SelectItem>
                    <SelectItem value="meal-plan">Meal Plan Aktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tanggal Food Record</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {compareType === "saved-meal-plan" ? (
              <div>
                <Label className="text-xs">Pilih Saved Meal Plan</Label>
                <Select value={selectedSavedPlanId} onValueChange={setSelectedSavedPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih saved meal plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(savedPlans || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {Math.round(p.totalCal)} kcal · {p.items.length} bahan
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-xs">Pilih Meal Plan Aktif</Label>
                <Select value={selectedMealPlanId} onValueChange={setSelectedMealPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih meal plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(mealPlans || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.preset?.name || `Meal Plan ${new Date(p.date).toLocaleDateString("id-ID")}`} · {Math.round(p.targetCal)} kcal
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleCompare}
              disabled={runMut.isPending}
              className="w-full"
            >
              {runMut.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Menganalisis...
                </>
              ) : (
                <>
                  <GitCompare className="mr-2 h-4 w-4" /> Jalankan Perbandingan
                </>
              )}
            </Button>
          </div>

          {/* Results */}
          {result && (
            <ComparisonResultsView
              complianceScore={result.complianceScore}
              planName={result.results.planName}
              recordCount={result.results.recordCount}
              nutrientComparison={result.nutrientComparison}
              foodComparison={result.foodComparison}
              aiInsight={result.aiInsight}
            />
          )}
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-3">
          <Button variant="outline" onClick={() => { onOpenChange(false); setResult(null); }}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Shared results renderer — identical view used by the "Jalankan
// Perbandingan" flow and the "View" (👁) modal on Riwayat Perbandingan.
// ---------------------------------------------------------------------
function ComparisonResultsView({
  complianceScore,
  planName,
  recordCount,
  nutrientComparison,
  foodComparison,
  aiInsight,
}: {
  complianceScore: number;
  planName?: string;
  recordCount?: number;
  nutrientComparison: any[];
  foodComparison: { matched: any[]; replaced: any[]; removed: any[]; added: any[] };
  aiInsight?: string | null;
}) {
  const complianceColor =
    complianceScore >= 80 ? "#10b981" : complianceScore >= 60 ? "#f59e0b" : "#ef4444";

  const radarData = (nutrientComparison || []).map((n: any) => ({
    nutrient: n.label,
    target: 100,
    actual: Math.min(150, n.pct),
  }));

  return (
    <div className="mt-4 space-y-4">
      {/* Compliance gauge */}
      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 text-center">
        <p className="text-xs font-semibold text-muted-foreground">Kesesuaian Meal Plan</p>
        <p className="text-5xl font-bold cl-stat-num" style={{ color: complianceColor }}>
          {complianceScore}%
        </p>
        <div className="mx-auto mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${complianceScore}%`, backgroundColor: complianceColor }}
          />
        </div>
        {(planName || recordCount !== undefined) && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            {planName} {recordCount !== undefined ? `vs ${recordCount} food record` : ""}
          </p>
        )}
      </div>

      {/* Nutrient comparison */}
      <div>
        <p className="mb-2 text-xs font-semibold">Perbandingan Nutrisi: Target vs Aktual</p>
        <div className="space-y-2">
          {(nutrientComparison || []).map((n: any) => {
            const pct = n.pct;
            const isGood = n.label === "Natrium" ? n.actual <= n.target : pct >= 85 && pct <= 110;
            const barColor = isGood ? "bg-emerald-500" : "bg-rose-500";
            return (
              <div key={n.label} className="rounded-md border border-border/60 p-2">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{n.label}</span>
                  <span className="font-mono text-muted-foreground">
                    {Math.round(n.actual)} / {Math.round(n.target)} {n.unit}
                    <span className={`ml-1.5 font-bold ${isGood ? "text-emerald-600" : "text-rose-600"}`}>
                      ({pct}%)
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Radar Chart */}
      {radarData.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold">Radar Chart: Target vs Aktual</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="nutrient" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 150]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
                <Radar name="Target" dataKey="target" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} />
                <Radar name="Aktual" dataKey="actual" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Food comparison */}
      <div>
        <p className="mb-2 text-xs font-semibold">Perbandingan Makanan</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-center dark:bg-emerald-950/30">
            <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
            <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-400">{foodComparison?.matched?.length ?? 0}</p>
            <p className="text-[9px] text-muted-foreground">Cocok</p>
          </div>
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-center dark:bg-amber-950/30">
            <RefreshCw className="mx-auto h-4 w-4 text-amber-600" />
            <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-400">{foodComparison?.replaced?.length ?? 0}</p>
            <p className="text-[9px] text-muted-foreground">Diganti</p>
          </div>
          <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-center dark:bg-rose-950/30">
            <XCircle className="mx-auto h-4 w-4 text-rose-600" />
            <p className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-400">{foodComparison?.removed?.length ?? 0}</p>
            <p className="text-[9px] text-muted-foreground">Dihapus</p>
          </div>
          <div className="rounded-md border border-violet-300 bg-violet-50 p-2 text-center dark:bg-violet-950/30">
            <GitCompare className="mx-auto h-4 w-4 text-violet-600" />
            <p className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-400">{foodComparison?.added?.length ?? 0}</p>
            <p className="text-[9px] text-muted-foreground">Tambahan</p>
          </div>
        </div>
      </div>

      {/* AI Insight */}
      {aiInsight && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
            <Brain className="h-3.5 w-3.5 text-primary" />
            AI Insight CareLivia
          </p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
            {aiInsight}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// View Comparison Dialog — reopens a saved comparison from Riwayat
// Perbandingan, reading straight from the stored comparison_json
// (h.results) without recomputing anything.
// ---------------------------------------------------------------------
function ViewComparisonDialog({
  history,
  onClose,
}: {
  history: any | null;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = React.useState(false);

  if (!history) return null;
  const r = history.results;

  const handleExportPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/comparisons/${history.id}/export-pdf`);
      if (!res.ok) throw new Error("Gagal membuat PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `perbandingan-${history.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message || "Gagal mengunduh PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={!!history} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-hidden p-0 sm:max-w-[780px]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Bandingkan Meal Plan vs Food Record
          </DialogTitle>
          <DialogDescription>
            Hasil perbandingan tersimpan · {r?.planName || history.savedMenuName || "—"} ·{" "}
            Compare {new Date(history.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
            Food Record {new Date(history.foodRecordDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[72vh] px-6 py-3">
          <ComparisonResultsView
            complianceScore={history.complianceScore}
            planName={r?.planName || history.savedMenuName}
            recordCount={r?.recordCount}
            nutrientComparison={r?.nutrientComparison || []}
            foodComparison={r?.foodComparison || { matched: [], replaced: [], removed: [], added: [] }}
            aiInsight={history.aiInsight}
          />
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-3">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
          <Button onClick={handleExportPdf} disabled={downloading}>
            {downloading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Membuat PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> Export PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Comparison History Section
// ---------------------------------------------------------------------
function ComparisonHistorySection({ patientId }: { patientId: string }) {
  const { data: history, isLoading } = useComparisons(patientId);
  const [viewHistory, setViewHistory] = React.useState<any | null>(null);

  if (isLoading) return <Skeleton className="mt-4 h-32 rounded-xl" />;
  if (!history || history.length === 0) return null;

  return (
    <div className="mt-6">
      <SectionCard
        title="Riwayat Perbandingan"
        description="Histori hasil perbandingan meal plan vs food record"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Meal Plan</TableHead>
                <TableHead>Food Record</TableHead>
                <TableHead className="text-right">Skor</TableHead>
                <TableHead className="text-right">Kalori</TableHead>
                <TableHead className="text-right">Protein</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h: any) => {
                const r = h.results;
                const scoreColor =
                  h.complianceScore >= 80 ? "text-emerald-600" : h.complianceScore >= 60 ? "text-amber-600" : "text-rose-600";
                return (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(h.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {r?.planName || h.savedMenuName || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(h.foodRecordDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${scoreColor}`}>
                      {h.complianceScore}%
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {r?.actualTotals ? Math.round(r.actualTotals.cal) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {r?.actualTotals ? `${Math.round(r.actualTotals.protein)}g` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setViewHistory(h)}
                        title="Lihat hasil lengkap"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <ViewComparisonDialog history={viewHistory} onClose={() => setViewHistory(null)} />
    </div>
  );
}
