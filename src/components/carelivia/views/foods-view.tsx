"use client";

import * as React from "react";
import {
  Apple,
  Search,
  Filter,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Gauge,
  DollarSign,
  Leaf,
  X,
  Plus,
  Pencil,
  Trash2,
  Save,
  ChevronDown,
  Upload,
  Download,
  FileSpreadsheet,
  History,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  PageHeader,
  SectionCard,
  EmptyState,
} from "@/components/carelivia/ui-helpers";
import {
  useFoods,
  useCreateFood,
  useUpdateFood,
  useDeleteFood,
  useExportFoods,
} from "@/hooks/use-carelivia";
import { ImportFoodsDialog } from "@/components/carelivia/food-import-dialog";
import { FoodImportHistoryDialog } from "@/components/carelivia/food-import-history-dialog";
import { downloadFoodTemplate, downloadFoodDatabaseExport } from "@/lib/food-import";

export function FoodsView() {
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [filters, setFilters] = React.useState({
    highProtein: false,
    lowGi: false,
    lowSodium: false,
    highFiber: false,
  });
  const [selected, setSelected] = React.useState<any | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editingFood, setEditingFood] = React.useState<any | null>(null);
  const [showImport, setShowImport] = React.useState(false);
  const [showImportHistory, setShowImportHistory] = React.useState(false);
  const deleteMut = useDeleteFood();
  const exportMut = useExportFoods();

  const handleExport = async () => {
    try {
      const rows = await exportMut.mutateAsync();
      if (!rows || rows.length === 0) {
        toast.info("Belum ada data untuk diekspor");
        return;
      }
      downloadFoodDatabaseExport(rows);
      toast.success(`${rows.length} bahan makanan diekspor`);
    } catch (e: any) {
      toast.error(e.message || "Gagal mengekspor database");
    }
  };

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useFoods({
    q: debouncedQ,
    categoryId: categoryId || undefined,
    ...filters,
  });

  const foods = data?.foods || [];
  const categories = data?.categories || [];

  return (
    <div>
      <PageHeader
        title="Database Bahan Makanan"
        subtitle="73 bahan TKPI/DKBM dengan nutrisi lengkap per 100g — tambah/edit/hapus"
        icon={Apple}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportHistory(true)}>
              <History className="mr-2 h-4 w-4" /> Riwayat Import
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Tambah Makanan <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingFood(null);
                    setShowForm(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Tambah Manual
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImport(true)}>
                  <Upload className="mr-2 h-4 w-4" /> Import Excel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => downloadFoodTemplate()}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport} disabled={exportMut.isPending}>
                  <Download className="mr-2 h-4 w-4" /> {exportMut.isPending ? "Mengekspor…" : "Export Database"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <ImportFoodsDialog open={showImport} onOpenChange={setShowImport} />
      <FoodImportHistoryDialog open={showImportHistory} onOpenChange={setShowImportHistory} />

      {/* Search & filter bar */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari bahan makanan... (debounced)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-52">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Semua kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon} {c.name} ({c._count?.foods ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filter diet:
          </span>
          <FilterChip
            label="Tinggi Protein"
            active={filters.highProtein}
            onClick={() => setFilters({ ...filters, highProtein: !filters.highProtein })}
          />
          <FilterChip
            label="Rendah GI (<55)"
            active={filters.lowGi}
            onClick={() => setFilters({ ...filters, lowGi: !filters.lowGi })}
          />
          <FilterChip
            label="Rendah Natrium"
            active={filters.lowSodium}
            onClick={() => setFilters({ ...filters, lowSodium: !filters.lowSodium })}
          />
          <FilterChip
            label="Tinggi Serat"
            active={filters.highFiber}
            onClick={() => setFilters({ ...filters, highFiber: !filters.highFiber })}
          />
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : foods.length === 0 ? (
        <EmptyState
          title="Tidak ada bahan ditemukan"
          description="Coba ubah kata kunci atau filter pencarian."
          icon={Apple}
        />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Menampilkan <strong className="text-foreground">{foods.length}</strong> bahan
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {foods.map((f: any) => (
              <FoodCard key={f.id} food={f} onClick={() => setSelected(f)} />
            ))}
          </div>
        </>
      )}

      <FoodDetailDialog food={selected} onClose={() => setSelected(null)} />

      {/* Add/Edit Food Dialog */}
      <FoodFormDialog
        open={showForm}
        onOpenChange={(o) => {
          setShowForm(o);
          if (!o) setEditingFood(null);
        }}
        editing={editingFood}
        categories={categories}
      />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function FoodCard({ food, onClick }: { food: any; onClick: () => void }) {
  const deleteMut = useDeleteFood();
  const giColor =
    food.gi === 0
      ? "text-muted-foreground"
      : food.gi < 55
        ? "text-emerald-600"
        : food.gi < 70
          ? "text-amber-600"
          : "text-rose-600";

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Hapus "${food.name}"? (soft delete — tidak hilang dari riwayat)`)) return;
    try {
      await deleteMut.mutateAsync(food.id);
      toast.success(`${food.name} dihapus`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className="group flex cursor-pointer flex-col rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{food.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {food.category.icon} {food.category.name}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
          {Math.round(food.energy)} kcal
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
        <div className="rounded bg-rose-500/10 py-1">
          <p className="font-bold text-rose-600 dark:text-rose-400">{food.protein}g</p>
          <p className="text-muted-foreground">Protein</p>
        </div>
        <div className="rounded bg-amber-500/10 py-1">
          <p className="font-bold text-amber-600 dark:text-amber-400">{food.carb}g</p>
          <p className="text-muted-foreground">Karbo</p>
        </div>
        <div className="rounded bg-violet-500/10 py-1">
          <p className="font-bold text-violet-600 dark:text-violet-400">{food.fat}g</p>
          <p className="text-muted-foreground">Lemak</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
        <span className={`flex items-center gap-1 font-medium ${giColor}`}>
          <Gauge className="h-3 w-3" />
          GI {food.gi || "—"}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <DollarSign className="h-3 w-3" />
          Rp{Math.round(food.price).toLocaleString("id-ID")}
        </span>
      </div>

      {food.urt && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">URT: {food.urt}</p>
      )}

      {/* Edit/Delete actions */}
      <div className="mt-2 flex gap-1 border-t border-border/40 pt-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 flex-1 text-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <Pencil className="mr-1 h-3 w-3" /> Detail
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-7 text-rose-500 hover:text-rose-600"
          onClick={handleDelete}
          title="Hapus"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function FoodDetailDialog({ food, onClose }: { food: any; onClose: () => void }) {
  if (!food) return null;
  return (
    <Dialog open={!!food} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {food.category?.icon} {food.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <NutBox label="Energi" value={food.energy} unit="kcal" icon={Flame} color="text-primary" />
            <NutBox label="Protein" value={food.protein} unit="g" icon={Beef} color="text-rose-500" />
            <NutBox label="Karbo" value={food.carb} unit="g" icon={Wheat} color="text-amber-500" />
            <NutBox label="Lemak" value={food.fat} unit="g" icon={Droplet} color="text-violet-500" />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <NutSmall label="Serat" value={`${food.fiber} g`} />
            <NutSmall label="Natrium" value={`${food.sodium} mg`} />
            <NutSmall label="Kalium" value={`${food.potassium} mg`} />
            <NutSmall label="Kalsium" value={`${food.calcium} mg`} />
            <NutSmall label="Zat Besi" value={`${food.iron} mg`} />
            <NutSmall label="Fosfor" value={`${food.phosphorus} mg`} />
            <NutSmall label="Vit A" value={`${food.vitA} RE`} />
            <NutSmall label="Vit C" value={`${food.vitC} mg`} />
            <NutSmall label="Vit B1" value={`${food.vitB1} mg`} />
            <NutSmall label="Seng" value={`${food.zinc} mg`} />
            <NutSmall label="Indeks Glikemik" value={`${food.gi}`} />
            <NutSmall label="BDD" value={`${food.bdd}%`} />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-semibold text-foreground">Informasi Porsi</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">URT (Unit Rumah Tangga)</p>
                <p className="font-medium">{food.urt || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Berat URT</p>
                <p className="font-medium">{food.urtGram ? `${food.urtGram} g` : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Harga (per 100g)</p>
                <p className="font-medium">Rp{Math.round(food.price).toLocaleString("id-ID")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sumber Data</p>
                <p className="font-medium">{food.source}</p>
              </div>
            </div>
          </div>

          {food.tags && (
            <div className="flex flex-wrap gap-1">
              {food.tags.split(",").map((t: string) => (
                <Badge key={t} variant="secondary" className="text-[10px]">
                  <Leaf className="mr-1 h-2.5 w-2.5" />
                  {t.trim()}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NutBox({
  label,
  value,
  unit,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-2.5 text-center">
      <Icon className={`mx-auto mb-1 h-4 w-4 ${color}`} />
      <p className="text-base font-bold cl-stat-num text-foreground">
        {value}
        <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{unit}</span>
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function NutSmall({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-card px-2.5 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Food Form Dialog — Add / Edit food with full nutrition
// ---------------------------------------------------------------------
function FoodFormDialog({
  open,
  onOpenChange,
  editing,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: any | null;
  categories: any[];
}) {
  const createMut = useCreateFood();
  const updateMut = useUpdateFood();
  const [form, setForm] = React.useState<any>({
    name: "",
    englishName: "",
    alias: "",
    code: "",
    categoryId: "",
    source: "CUSTOM",
    description: "",
    energy: 0,
    protein: 0,
    fat: 0,
    carb: 0,
    fiber: 0,
    water: 0,
    ash: 0,
    sodium: 0,
    potassium: 0,
    calcium: 0,
    magnesium: 0,
    iron: 0,
    phosphorus: 0,
    zinc: 0,
    vitA: 0,
    vitB1: 0,
    vitB2: 0,
    vitB6: 0,
    vitB12: 0,
    vitC: 0,
    vitD: 0,
    vitE: 0,
    vitK: 0,
    cholesterol: 0,
    gi: 0,
    urt: "",
    urtGram: 0,
    bdd: 100,
    price: 0,
    priceUnit: "g",
    priceLocation: "",
    priceSource: "",
    tags: "",
  });

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        ...editing,
        priceLocation: editing.priceLocation || "",
        priceSource: editing.priceSource || "",
        urt: editing.urt || "",
        englishName: editing.englishName || "",
        alias: editing.alias || "",
        code: editing.code || "",
        description: editing.description || "",
        tags: editing.tags || "",
      });
    } else {
      setForm({
        name: "", englishName: "", alias: "", code: "",
        categoryId: categories[0]?.id || "",
        source: "CUSTOM", description: "",
        energy: 0, protein: 0, fat: 0, carb: 0, fiber: 0, water: 0, ash: 0,
        sodium: 0, potassium: 0, calcium: 0, magnesium: 0, iron: 0, phosphorus: 0, zinc: 0,
        vitA: 0, vitB1: 0, vitB2: 0, vitB6: 0, vitB12: 0, vitC: 0, vitD: 0, vitE: 0, vitK: 0,
        cholesterol: 0, gi: 0, urt: "", urtGram: 0, bdd: 100,
        price: 0, priceUnit: "g", priceLocation: "", priceSource: "", tags: "",
      });
    }
  }, [open, editing, categories]);

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Nama makanan wajib diisi");
      return;
    }
    if (!form.categoryId) {
      toast.error("Kategori wajib diisi");
      return;
    }
    try {
      const data = {
        ...form,
        energy: Number(form.energy) || 0,
        protein: Number(form.protein) || 0,
        fat: Number(form.fat) || 0,
        carb: Number(form.carb) || 0,
        fiber: Number(form.fiber) || 0,
        sodium: Number(form.sodium) || 0,
        potassium: Number(form.potassium) || 0,
        calcium: Number(form.calcium) || 0,
        iron: Number(form.iron) || 0,
        gi: Number(form.gi) || 0,
        bdd: Number(form.bdd) || 100,
        price: Number(form.price) || 0,
        urtGram: form.urtGram ? Number(form.urtGram) : null,
      };
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...data });
        toast.success("Makanan diperbarui");
      } else {
        await createMut.mutateAsync(data);
        toast.success("Makanan ditambahkan");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan");
    }
  };

  const numFields = [
    { key: "energy", label: "Energi (kcal)" },
    { key: "protein", label: "Protein (g)" },
    { key: "fat", label: "Lemak (g)" },
    { key: "carb", label: "Karbohidrat (g)" },
    { key: "fiber", label: "Serat (g)" },
    { key: "sodium", label: "Natrium (mg)" },
    { key: "potassium", label: "Kalium (mg)" },
    { key: "calcium", label: "Kalsium (mg)" },
    { key: "iron", label: "Besi (mg)" },
    { key: "gi", label: "Indeks Glikemik (0-100)" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-hidden p-0 sm:max-w-[680px]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            {editing ? "Edit Makanan" : "Tambah Makanan Baru"}
          </DialogTitle>
          <DialogDescription>
            Lengkapi informasi umum, komposisi gizi per 100g, dan harga.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-6 grid grid-cols-3">
            <TabsTrigger value="info">Informasi Umum</TabsTrigger>
            <TabsTrigger value="nutrition">Komposisi Gizi</TabsTrigger>
            <TabsTrigger value="price">Harga & Porsi</TabsTrigger>
          </TabsList>

          <ScrollArea className="max-h-[58vh] px-6 py-4">
            <TabsContent value="info" className="mt-0 space-y-3">
              <div>
                <Label className="text-xs">Nama Makanan *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Nasi Merah" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nama Inggris</Label>
                  <Input value={form.englishName} onChange={(e) => setForm({ ...form, englishName: e.target.value })} placeholder="Brown Rice" />
                </div>
                <div>
                  <Label className="text-xs">Alias</Label>
                  <Input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} placeholder="Beras coklat" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Kategori *</Label>
                  <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Sumber Data</Label>
                  <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TKPI">TKPI</SelectItem>
                      <SelectItem value="DKBM">DKBM</SelectItem>
                      <SelectItem value="USDA">USDA</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Deskripsi</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Deskripsi singkat..." />
              </div>
            </TabsContent>

            <TabsContent value="nutrition" className="mt-0 space-y-3">
              <p className="text-xs text-muted-foreground">Komposisi gizi per 100 gram (edible portion)</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {numFields.map((f) => (
                  <div key={f.key}>
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type="number"
                      value={form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      step="0.1"
                      min="0"
                    />
                  </div>
                ))}
              </div>
              <details className="rounded-lg border border-border/60 p-3">
                <summary className="cursor-pointer text-xs font-medium">Mikronutrien Lanjutan</summary>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { key: "water", label: "Air (g)" },
                    { key: "ash", label: "Abu (g)" },
                    { key: "magnesium", label: "Magnesium (mg)" },
                    { key: "phosphorus", label: "Fosfor (mg)" },
                    { key: "zinc", label: "Zinc (mg)" },
                    { key: "vitA", label: "Vit A (RE)" },
                    { key: "vitB1", label: "Vit B1 (mg)" },
                    { key: "vitB2", label: "Vit B2 (mg)" },
                    { key: "vitB6", label: "Vit B6 (mg)" },
                    { key: "vitB12", label: "Vit B12 (mcg)" },
                    { key: "vitC", label: "Vit C (mg)" },
                    { key: "vitD", label: "Vit D (mcg)" },
                    { key: "vitE", label: "Vit E (mg)" },
                    { key: "vitK", label: "Vit K (mcg)" },
                    { key: "cholesterol", label: "Kolesterol (mg)" },
                  ].map((f) => (
                    <div key={f.key}>
                      <Label className="text-[10px]">{f.label}</Label>
                      <Input
                        type="number"
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        step="0.1"
                        min="0"
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </details>
            </TabsContent>

            <TabsContent value="price" className="mt-0 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Harga (IDR per 100g)</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">Satuan Harga</Label>
                  <Input value={form.priceUnit} onChange={(e) => setForm({ ...form, priceUnit: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Lokasi (opsional)</Label>
                  <Input value={form.priceLocation} onChange={(e) => setForm({ ...form, priceLocation: e.target.value })} placeholder="Jakarta" />
                </div>
                <div>
                  <Label className="text-xs">Sumber Harga</Label>
                  <Select value={form.priceSource} onValueChange={(v) => setForm({ ...form, priceSource: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih sumber" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pasar Tradisional">Pasar Tradisional</SelectItem>
                      <SelectItem value="Supermarket">Supermarket</SelectItem>
                      <SelectItem value="Marketplace">Marketplace</SelectItem>
                      <SelectItem value="Distributor">Distributor</SelectItem>
                      <SelectItem value="Supplier">Supplier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">URT (Unit Rumah Tangga)</Label>
                  <Input value={form.urt} onChange={(e) => setForm({ ...form, urt: e.target.value })} placeholder="1 mangkuk sedang" />
                </div>
                <div>
                  <Label className="text-xs">Berat URT (gram)</Label>
                  <Input type="number" value={form.urtGram} onChange={(e) => setForm({ ...form, urtGram: e.target.value })} placeholder="150" min="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">BDD (%)</Label>
                  <Input type="number" value={form.bdd} onChange={(e) => setForm({ ...form, bdd: e.target.value })} min="0" max="100" />
                </div>
                <div>
                  <Label className="text-xs">Tags (pisahkan koma)</Label>
                  <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="karbo,rendah-gi" />
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="border-t px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
            {createMut.isPending || updateMut.isPending ? "Menyimpan..." : (
              <>
                <Save className="mr-2 h-4 w-4" /> {editing ? "Simpan Perubahan" : "Tambah Makanan"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
