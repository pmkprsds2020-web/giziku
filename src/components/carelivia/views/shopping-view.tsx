"use client";

import * as React from "react";
import {
  ShoppingCart,
  User,
  Sparkles,
  Wallet,
  ListChecks,
  Tag,
  TrendingDown,
  Package,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
  LoadingState,
} from "@/components/carelivia/ui-helpers";
import {
  usePatients,
  useMealPlans,
  useGenerateShopping,
  useShoppingList,
} from "@/hooks/use-carelivia";
import { useCareLiviaStore } from "@/store/carelivia";
import type { ShoppingPeriod } from "@prisma/client";

interface ShoppingItem {
  id?: string;
  foodId: string;
  food: { id: string; name: string; price?: number };
  amount: number;
  unit: string;
  estPrice: number;
  checked: boolean;
}

interface ShoppingList {
  id: string;
  patientId: string;
  mealPlanId: string;
  period: string;
  multiplier: number;
  totalEstimate: number;
  savedTotalEstimate?: number;
  currency: string;
  checkedCount: number;
  createdAt: string;
  items: ShoppingItem[];
}

interface Alternative {
  foodId: string;
  foodName: string;
  currentPrice: number;
  altName?: string;
  altPrice?: number;
}

const PERIOD_LABELS: Record<string, string> = {
  DAILY: "Harian (1 hari)",
  WEEKLY: "Mingguan (7 hari)",
  MONTHLY: "Bulanan (30 hari)",
};

function formatIDR(n: number): string {
  return "Rp" + Math.round(n || 0).toLocaleString("id-ID");
}

export function ShoppingView() {
  const { data: patients } = usePatients();
  const { activePatientId, setActivePatient } = useCareLiviaStore();
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>(
    activePatientId || "",
  );
  const [period, setPeriod] = React.useState<ShoppingPeriod>("WEEKLY");
  const [alternatives, setAlternatives] = React.useState<Alternative[]>([]);

  React.useEffect(() => {
    if (activePatientId && !selectedPatientId) {
      setSelectedPatientId(activePatientId);
    }
  }, [activePatientId, selectedPatientId]);

  const { data: mealPlans } = useMealPlans(selectedPatientId || undefined);
  const generateMut = useGenerateShopping();

  // Single source of truth: use the plan explicitly flagged as
  // "Meal Plan Aktif" (set via Simpan ke Database / Simpan Meal Plan).
  // Falls back to the most recent plan for patients saved before this
  // flag existed.
  const latestMealPlan =
    mealPlans?.find((p: any) => p.isActive) ?? mealPlans?.[0];

  // Live-priced shopping list — always re-joined against the CURRENT
  // foods.price (Manajemen Harga), never a locally-cached snapshot.
  // Auto-invalidated whenever a price is edited elsewhere in the app.
  const {
    data: shoppingListData,
    isLoading: isListLoading,
    isFetching: isListFetching,
    refetch: refetchShoppingList,
  } = useShoppingList(latestMealPlan?.id);
  const shoppingList = (shoppingListData?.shoppingList as ShoppingList | undefined) ?? null;

  // Reset state when patient changes
  const prevPatientRef = React.useRef<string>("");
  React.useEffect(() => {
    if (selectedPatientId !== prevPatientRef.current) {
      prevPatientRef.current = selectedPatientId;
      setAlternatives([]);
    }
  }, [selectedPatientId]);

  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id);
    setActivePatient(id);
  };

  const handleGenerate = async () => {
    if (!latestMealPlan) {
      toast.error("Pasien belum memiliki meal plan");
      return;
    }
    try {
      const res = await generateMut.mutateAsync({
        mealPlanId: latestMealPlan.id,
        period,
      });
      if (res?.alternatives) {
        setAlternatives(res.alternatives);
      }
      toast.success(`Shopping list ${PERIOD_LABELS[period] || period} berhasil dibuat`);
    } catch (e: any) {
      toast.error(e.message || "Gagal membuat shopping list");
    }
  };

  // "Refresh Harga" — cheap re-price against current foods.price, no
  // meal-plan regeneration needed (this is what keeps the planner in
  // sync when someone edits a price on Manajemen Harga).
  const handleRefreshPrices = async () => {
    try {
      await refetchShoppingList();
      toast.success("Harga diperbarui ke harga terbaru");
    } catch (e: any) {
      toast.error(e.message || "Gagal memperbarui harga");
    }
  };

  // Auto-generate when meal plan exists and no shopping list yet (only once per patient)
  const autoGenRef = React.useRef<string>("");
  React.useEffect(() => {
    // Only auto-generate if:
    // 1. We have a meal plan
    // 2. We haven't already auto-generated for this meal plan
    // 3. We're not currently generating
    // 4. The live list query has settled and found nothing (no shopping list yet)
    if (
      latestMealPlan?.id &&
      autoGenRef.current !== latestMealPlan.id &&
      !generateMut.isPending &&
      !isListLoading &&
      !shoppingList
    ) {
      autoGenRef.current = latestMealPlan.id;
      generateMut.mutateAsync({ mealPlanId: latestMealPlan.id, period })
        .then((res) => {
          if (res?.alternatives) setAlternatives(res.alternatives);
        })
        .catch(() => {
          // Silent fail for auto-generate — user can click manually
        });
    }
  }, [latestMealPlan?.id, isListLoading, shoppingList]);

  const totalItems = shoppingList?.items?.length || 0;
  const totalEstimate = shoppingList?.totalEstimate || 0;
  const checkedCount = shoppingList?.items?.filter((i) => i.checked).length || 0;

  const isLoading = generateMut.isPending || isListLoading;

  return (
    <div>
      <PageHeader
        title="Shopping Planner"
        subtitle="Agregasi bahan makanan dari meal plan + estimasi harga"
        icon={ShoppingCart}
      />

      {/* Patient selector */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Pasien:</span>
        </div>
        <Select value={selectedPatientId} onValueChange={handleSelectPatient}>
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
          title="Pilih pasien untuk memulai"
          description="Sistem akan mengagregasi bahan makanan dari meal plan terbaru pasien."
          icon={ShoppingCart}
        />
      ) : !latestMealPlan ? (
        <EmptyState
          title="Pasien belum memiliki meal plan"
          description="Buat meal plan AI terlebih dahulu di modul 'AI Meal Plan' sebelum membuat shopping list."
          icon={Sparkles}
        />
      ) : isLoading && !shoppingList ? (
        <LoadingState count={3} />
      ) : (
        <div className="space-y-4">
          {/* Generate section */}
          <SectionCard
            title="Generate Shopping List"
            description={`Berdasarkan meal plan ${latestMealPlan.date ? new Date(latestMealPlan.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""} (${latestMealPlan.items?.length || 0} item)`}
            actions={
              <div className="flex items-center gap-2">
                <Select
                  value={period}
                  onValueChange={(v) => setPeriod(v as ShoppingPeriod)}
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <Calendar className="mr-1 h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Harian</SelectItem>
                    <SelectItem value="WEEKLY">Mingguan</SelectItem>
                    <SelectItem value="MONTHLY">Bulanan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Pilih periode pembelian lalu klik <b>Generate</b> untuk menghitung kebutuhan agregat & estimasi harga.
              </p>
              {shoppingList && (
                <Button
                  onClick={handleRefreshPrices}
                  disabled={isListFetching || generateMut.isPending}
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  title="Sinkronkan dengan harga terbaru di Manajemen Harga, tanpa membuat ulang daftar"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isListFetching ? "animate-spin" : ""}`} />
                  Refresh Harga
                </Button>
              )}
              <Button
                onClick={handleGenerate}
                disabled={isLoading}
                size="sm"
                className="shrink-0"
              >
                {isLoading ? (
                  <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Memproses...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Generate</>
                )}
              </Button>
            </div>
          </SectionCard>

          {/* KPI cards */}
          {shoppingList && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Total Estimasi"
                value={formatIDR(totalEstimate)}
                icon={Wallet}
                color="emerald"
                sublabel={`Periode ${PERIOD_LABELS[shoppingList.period] || shoppingList.period}`}
              />
              <StatCard
                label="Jumlah Item"
                value={totalItems}
                unit="bahan"
                icon={ListChecks}
                color="teal"
                sublabel={`${checkedCount} sudah dibeli`}
              />
              <StatCard
                label="Alternatif Murah"
                value={alternatives.length}
                unit="opsi"
                icon={TrendingDown}
                color="amber"
                sublabel="Lihat detail di bawah"
              />
            </div>
          )}

          {/* Shopping list table */}
          {shoppingList ? (
            shoppingList.items.length === 0 ? (
              <EmptyState
                title="Shopping list kosong"
                description="Belum ada bahan yang teragregasi. Coba generate ulang."
                icon={Package}
              />
            ) : (
              <SectionCard
                title="Daftar Belanja"
                description={`${totalItems} bahan · periode ${PERIOD_LABELS[shoppingList.period] || shoppingList.period} · multiplier ${shoppingList.multiplier}x`}
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="min-w-[180px]">Bahan Makanan</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                        <TableHead className="text-right">Harga Estimasi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shoppingList.items.map((item, idx) => (
                        <TableRow key={`${item.foodId}-${idx}`} data-state={item.checked ? "selected" : undefined}>
                          <TableCell>
                            <Checkbox checked={item.checked} aria-label={`Tandai ${item.food?.name || "item"}`} />
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {item.food?.name || "Unknown"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Math.round(item.amount)}
                            <span className="ml-0.5 text-xs text-muted-foreground">
                              {item.unit || "g"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-primary">
                            {formatIDR(item.estPrice)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="border-t-2 bg-muted/30">
                        <TableCell colSpan={3} className="text-right font-bold">
                          Total Estimasi
                        </TableCell>
                        <TableCell className="text-right text-lg font-bold tabular-nums text-primary">
                          {formatIDR(shoppingList.totalEstimate)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Dibuat {shoppingList.createdAt ? new Date(shoppingList.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {shoppingList.currency || "IDR"}
                  </Badge>
                </div>
              </SectionCard>
            )
          ) : (
            <EmptyState
              title="Belum ada shopping list"
              description="Klik 'Generate' untuk membuat daftar belanja dari meal plan terbaru."
              icon={ShoppingCart}
              action={
                <Button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  size="sm"
                >
                  <Sparkles className="mr-2 h-4 w-4" /> Generate Sekarang
                </Button>
              }
            />
          )}

          {/* Alternatives */}
          {alternatives.length > 0 && (
            <SectionCard
              title="Alternatif Lebih Murah"
              description="Bahan dengan protein setara namun harga lebih rendah"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {alternatives.map((alt, idx) => {
                  const saving = (alt.currentPrice || 0) - (alt.altPrice || 0);
                  const savingPct =
                    alt.currentPrice > 0
                      ? Math.round((saving / alt.currentPrice) * 100)
                      : 0;
                  return (
                    <Card
                      key={`${alt.foodId}-${idx}`}
                      className="border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                          <Tag className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {alt.foodName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatIDR(alt.currentPrice)} / 100g
                            </p>
                            <div className="mt-2 flex items-center gap-1 text-xs">
                              <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                Ganti dengan
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                              {alt.altName || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatIDR(alt.altPrice || 0)} / 100g
                            </p>
                            <Badge
                              variant="outline"
                              className="mt-2 border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            >
                              Hemat {formatIDR(saving)} ({savingPct}%)
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
