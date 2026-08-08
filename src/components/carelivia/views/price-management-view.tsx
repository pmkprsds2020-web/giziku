"use client";

import * as React from "react";
import {
  DollarSign,
  Search,
  Pencil,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  History,
  X,
  Save,
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
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import {
  PageHeader,
  SectionCard,
  EmptyState,
} from "@/components/carelivia/ui-helpers";
import {
  useFoods,
  useUpdateFoodPrice,
  useFoodPriceHistory,
} from "@/hooks/use-carelivia";

const PRICE_SOURCES = [
  "Pasar Tradisional",
  "Supermarket",
  "Marketplace",
  "Distributor",
  "Supplier",
];

export function PriceManagementView() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [editingFood, setEditingFood] = React.useState<any | null>(null);
  const [historyFood, setHistoryFood] = React.useState<any | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(0);
  const PAGE_SIZE = 25;

  const { data, isLoading } = useFoods({
    q: debounced,
    categoryId: categoryId || undefined,
  });

  // Every food in the database shows up here — including ones without a
  // price yet — so this page is a complete Single Source of Truth admins
  // can fill in, not a filtered subset.
  const allFoods = data?.foods || [];
  const categories = data?.categories || [];

  const sortedFoods = React.useMemo(() => {
    const arr = [...allFoods];
    arr.sort((a: any, b: any) =>
      sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    );
    return arr;
  }, [allFoods, sortDir]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, categoryId, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedFoods.length / PAGE_SIZE));
  const pagedFoods = sortedFoods.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const pricedFoods = allFoods.filter((f: any) => f.price > 0);

  // Calculate price stats (only over foods that actually have a price set)
  const totalPrice = pricedFoods.reduce((s: number, f: any) => s + f.price, 0);
  const avgPrice = pricedFoods.length > 0 ? totalPrice / pricedFoods.length : 0;

  // Find price alerts (foods with recent price updates >20%)
  const alerts = pricedFoods.filter((f: any) => {
    if (!f.priceUpdatedAt) return false;
    const daysSinceUpdate = (Date.now() - new Date(f.priceUpdatedAt).getTime()) / 86400000;
    return daysSinceUpdate < 7; // recently updated
  });

  return (
    <div>
      <PageHeader
        title="Manajemen Harga Belanja"
        subtitle="Kelola harga bahan makanan — estimasi belanja otomatis pakai harga terbaru"
        icon={DollarSign}
      />

      {/* Stats cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Bahan dengan Harga</p>
                <p className="text-2xl font-bold text-foreground">{pricedFoods.length}</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Rata-rata Harga/100g</p>
                <p className="text-2xl font-bold text-foreground">
                  Rp{Math.round(avgPrice).toLocaleString("id-ID")}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Update Terbaru (7 hari)</p>
                <p className="text-2xl font-bold text-foreground">{alerts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & filter */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari bahan makanan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryId} onValueChange={(v) => setCategoryId(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Semua kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {categories.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Price table */}
      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : allFoods.length === 0 ? (
        <EmptyState
          title="Tidak ada bahan makanan ditemukan"
          description="Coba ubah kata kunci pencarian atau filter kategori."
          icon={DollarSign}
        />
      ) : (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                        title="Urutkan berdasarkan nama"
                      >
                        Nama Bahan {sortDir === "asc" ? "↑" : "↓"}
                      </button>
                    </TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Harga/100g</TableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Update</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedFoods.map((food: any) => (
                    <TableRow key={food.id} className="hover:bg-muted/40">
                      <TableCell>
                        <p className="text-sm font-medium text-foreground">{food.name}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {food.category?.icon} {food.category?.name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                        {food.price > 0 ? (
                          `Rp${Math.round(food.price).toLocaleString("id-ID")}`
                        ) : (
                          <span className="font-sans font-normal text-muted-foreground">Belum diset</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {food.priceSource ? (
                          <Badge variant="outline" className="text-[10px]">{food.priceSource}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {food.priceLocation || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {food.priceUpdatedAt
                          ? new Date(food.priceUpdatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {food.priceIsEstimate ? (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] dark:bg-amber-950">
                            Estimasi
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] dark:bg-emerald-950">
                            Aktual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingFood(food)}
                            title="Edit harga"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setHistoryFood(food)}
                            title="Riwayat harga"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Halaman {page + 1} dari {totalPages} · {sortedFoods.length} bahan
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Price Dialog */}
      {editingFood && (
        <EditPriceDialog food={editingFood} onClose={() => setEditingFood(null)} />
      )}

      {/* Price History Dialog */}
      {historyFood && (
        <PriceHistoryDialog food={historyFood} onClose={() => setHistoryFood(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Edit Price Dialog
// ---------------------------------------------------------------------
function EditPriceDialog({ food, onClose }: { food: any; onClose: () => void }) {
  const updatePriceMut = useUpdateFoodPrice();
  const [price, setPrice] = React.useState(String(food.price || ""));
  const [unit, setUnit] = React.useState(food.priceUnit || "g");
  const [location, setLocation] = React.useState(food.priceLocation || "");
  const [source, setSource] = React.useState(food.priceSource || "");
  const [notes, setNotes] = React.useState("");

  const previousPrice = food.price || 0;
  const newPrice = Number(price) || 0;
  const change = newPrice - previousPrice;
  const changePct = previousPrice > 0 ? Math.round((change / previousPrice) * 100) : 0;
  const isAlert = Math.abs(changePct) > 20;

  const handleSave = async () => {
    if (newPrice <= 0) {
      toast.error("Harga harus lebih dari 0");
      return;
    }
    try {
      const res = await updatePriceMut.mutateAsync({
        id: food.id,
        price: newPrice,
        unit,
        location: location || null,
        source: source || null,
        notes: notes || null,
      });
      if (res.alert) {
        toast.warning(`${food.name}: ${res.alert}`, { duration: 6000 });
      } else {
        toast.success(`Harga ${food.name} diperbarui ke Rp${newPrice.toLocaleString("id-ID")}`);
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Gagal memperbarui harga");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Edit Harga — {food.name}
          </DialogTitle>
          <DialogDescription>
            Harga saat ini: Rp{Math.round(previousPrice).toLocaleString("id-ID")}/{unit}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Harga Baru (per 100g)</Label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>

          {/* Change preview */}
          {newPrice > 0 && previousPrice > 0 && change !== 0 && (
            <div className={`rounded-lg border p-2.5 text-xs ${
              isAlert
                ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                : change > 0
                  ? "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                  : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
            }`}>
              <div className="flex items-center gap-2">
                {change > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span className="font-semibold">
                  {change > 0 ? "+" : ""}Rp{Math.round(change).toLocaleString("id-ID")} ({changePct}%)
                </span>
                {isAlert && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-bold">
                    <AlertTriangle className="h-3 w-3" /> ALERT
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Satuan</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Sumber</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih sumber" />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Lokasi (opsional)</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Contoh: Jakarta, Bandung"
            />
          </div>

          <div>
            <Label className="text-xs">Catatan (opsional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Harga naik karena musim"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={updatePriceMut.isPending}>
            {updatePriceMut.isPending ? "Menyimpan..." : (
              <>
                <Save className="mr-2 h-4 w-4" /> Simpan Harga
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Price History Dialog with chart
// ---------------------------------------------------------------------
function PriceHistoryDialog({ food, onClose }: { food: any; onClose: () => void }) {
  const { data: history, isLoading } = useFoodPriceHistory(food.id);

  const chartData = (history || [])
    .slice()
    .reverse()
    .map((h: any) => ({
      date: new Date(h.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      price: h.price,
      fullDate: new Date(h.createdAt).toLocaleDateString("id-ID"),
    }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Riwayat Harga — {food.name}
          </DialogTitle>
          <DialogDescription>
            Harga saat ini: Rp{Math.round(food.price).toLocaleString("id-ID")}/100g
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-48 rounded-lg" />
        ) : !history || history.length === 0 ? (
          <EmptyState title="Belum ada riwayat harga" icon={History} />
        ) : (
          <div className="space-y-3">
            {/* Chart */}
            {chartData.length > 1 && (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        fontSize: 12,
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                      }}
                      formatter={(v: any) => [`Rp${Number(v).toLocaleString("id-ID")}`, "Harga"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: "#10b981", r: 4 }}
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
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">Selisih</TableHead>
                    <TableHead>Sumber</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h: any) => {
                    const diff = h.previousPrice ? h.price - h.previousPrice : 0;
                    const pct = h.previousPrice ? Math.round((diff / h.previousPrice) * 100) : 0;
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(h.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          Rp{Math.round(h.price).toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className={`text-right text-xs font-medium ${diff > 0 ? "text-rose-600" : diff < 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {diff !== 0 ? `${diff > 0 ? "+" : ""}Rp${Math.round(Math.abs(diff)).toLocaleString("id-ID")} (${pct}%)` : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {h.source ? <Badge variant="outline" className="text-[10px]">{h.source}</Badge> : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
