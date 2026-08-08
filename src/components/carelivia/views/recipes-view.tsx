"use client";

import * as React from "react";
import {
  ChefHat,
  Plus,
  Search,
  Trash2,
  Pencil,
  X,
  Users,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Clock,
  Utensils,
  Save,
  Copy,
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
  useRecipes,
  useCreateRecipe,
  useUpdateRecipe,
  useDeleteRecipe,
  useFoods,
} from "@/hooks/use-carelivia";

const KCAL_PER_GRAM = { protein: 4, carb: 4, fat: 9 };

interface RecipeItemDraft {
  foodId: string;
  foodName: string;
  amount: number;
  energy: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
  category?: string;
}

function computeRecipeNutrition(items: RecipeItemDraft[], servings: number) {
  const total = items.reduce(
    (acc, i) => {
      const ratio = i.amount / 100;
      return {
        cal: acc.cal + i.energy * ratio,
        protein: acc.protein + i.protein * ratio,
        fat: acc.fat + i.fat * ratio,
        carb: acc.carb + i.carb * ratio,
        fiber: acc.fiber + i.fiber * ratio,
        sodium: acc.sodium + i.sodium * ratio,
      };
    },
    { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0 },
  );
  const perServing = {
    cal: total.cal / Math.max(servings, 1),
    protein: total.protein / Math.max(servings, 1),
    fat: total.fat / Math.max(servings, 1),
    carb: total.carb / Math.max(servings, 1),
    fiber: total.fiber / Math.max(servings, 1),
    sodium: total.sodium / Math.max(servings, 1),
  };
  return { total, perServing };
}

export function RecipesView() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<any | null>(null);
  const [selectedRecipe, setSelectedRecipe] = React.useState<any | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: recipes, isLoading } = useRecipes(debounced || undefined);
  const deleteMut = useDeleteRecipe();

  const handleDelete = async (recipe: any) => {
    if (!confirm(`Hapus resep "${recipe.name}"?`)) return;
    try {
      await deleteMut.mutateAsync(recipe.id);
      toast.success("Resep dihapus");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Manajemen Resep & Menu"
        subtitle="Buat resep dari database bahan TKPI/DKBM — nutrisi dihitung otomatis per porsi"
        icon={ChefHat}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Resep Baru
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari resep..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Badge variant="outline" className="w-fit">
          {recipes?.length || 0} resep
        </Badge>
      </div>

      {/* Recipe grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : !recipes || recipes.length === 0 ? (
        <EmptyState
          title="Belum ada resep"
          description="Buat resep pertama Anda dari database bahan TKPI/DKBM. Nutrisi per porsi dihitung otomatis."
          icon={ChefHat}
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Buat Resep
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {recipes.map((recipe: any) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onOpen={() => setSelectedRecipe(recipe)}
              onEdit={() => {
                setEditing(recipe);
                setShowForm(true);
              }}
              onDelete={() => handleDelete(recipe)}
            />
          ))}
        </div>
      )}

      {/* Recipe Detail Dialog */}
      <RecipeDetailDialog
        recipe={selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
      />

      {/* Recipe Form Dialog */}
      <RecipeFormDialog
        open={showForm}
        onOpenChange={(o) => {
          setShowForm(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Recipe Card
// ---------------------------------------------------------------------
function RecipeCard({
  recipe,
  onOpen,
  onEdit,
  onDelete,
}: {
  recipe: any;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const nutrition = computeRecipeNutrition(
    recipe.items.map((i: any) => ({
      foodId: i.foodId,
      foodName: i.food.name,
      amount: i.amount,
      energy: i.food.energy,
      protein: i.food.protein,
      fat: i.food.fat,
      carb: i.food.carb,
      fiber: i.food.fiber,
      sodium: i.food.sodium,
    })),
    recipe.servings,
  );

  return (
    <Card className="group flex flex-col overflow-hidden border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* Header band */}
      <div
        className="relative h-20 bg-gradient-to-br from-primary/20 to-chart-2/20 px-4 py-3"
        onClick={onOpen}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/80 backdrop-blur">
            <ChefHat className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 bg-background/60 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 bg-background/60 text-rose-500 opacity-0 backdrop-blur transition-opacity hover:text-rose-600 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col p-4" onClick={onOpen} role="button" tabIndex={0}>
        <p className="line-clamp-1 text-sm font-semibold text-foreground">
          {recipe.name}
        </p>
        {recipe.description && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
            {recipe.description}
          </p>
        )}

        {/* Meta */}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Users className="h-3 w-3" />
            {recipe.servings} porsi
          </span>
          <span className="flex items-center gap-0.5">
            <Utensils className="h-3 w-3" />
            {recipe.items.length} bahan
          </span>
        </div>

        {/* Nutrition per serving */}
        <div className="mt-2.5 grid grid-cols-4 gap-1 text-center text-[10px]">
          <div className="rounded bg-primary/10 py-1">
            <p className="font-bold text-primary">{Math.round(nutrition.perServing.cal)}</p>
            <p className="text-muted-foreground">kcal</p>
          </div>
          <div className="rounded bg-rose-500/10 py-1">
            <p className="font-bold text-rose-600 dark:text-rose-400">{Math.round(nutrition.perServing.protein)}g</p>
            <p className="text-muted-foreground">P</p>
          </div>
          <div className="rounded bg-amber-500/10 py-1">
            <p className="font-bold text-amber-600 dark:text-amber-400">{Math.round(nutrition.perServing.carb)}g</p>
            <p className="text-muted-foreground">K</p>
          </div>
          <div className="rounded bg-violet-500/10 py-1">
            <p className="font-bold text-violet-600 dark:text-violet-400">{Math.round(nutrition.perServing.fat)}g</p>
            <p className="text-muted-foreground">L</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Recipe Detail Dialog
// ---------------------------------------------------------------------
function RecipeDetailDialog({
  recipe,
  onClose,
}: {
  recipe: any | null;
  onClose: () => void;
}) {
  if (!recipe) return null;
  const nutrition = computeRecipeNutrition(
    recipe.items.map((i: any) => ({
      foodId: i.foodId,
      foodName: i.food.name,
      amount: i.amount,
      energy: i.food.energy,
      protein: i.food.protein,
      fat: i.food.fat,
      carb: i.food.carb,
      fiber: i.food.fiber,
      sodium: i.food.sodium,
    })),
    recipe.servings,
  );

  return (
    <Dialog open={!!recipe} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            {recipe.name}
          </DialogTitle>
          <DialogDescription>
            {recipe.description || "Detail resep & analisis nutrisi"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap gap-3 text-xs">
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" /> {recipe.servings} porsi
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Utensils className="h-3 w-3" /> {recipe.items.length} bahan
            </Badge>
          </div>

          {/* Nutrition summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NutBox label="Energi" value={Math.round(nutrition.perServing.cal)} unit="kcal" icon={Flame} color="text-primary" />
            <NutBox label="Protein" value={Math.round(nutrition.perServing.protein)} unit="g" icon={Beef} color="text-rose-500" />
            <NutBox label="Karbo" value={Math.round(nutrition.perServing.carb)} unit="g" icon={Wheat} color="text-amber-500" />
            <NutBox label="Lemak" value={Math.round(nutrition.perServing.fat)} unit="g" icon={Droplet} color="text-violet-500" />
          </div>

          {/* Per serving vs total */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Per Porsi vs Total Resep
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Per porsi ({recipe.servings} porsi)</p>
                <p className="font-semibold text-foreground">
                  {Math.round(nutrition.perServing.cal)} kcal · P{Math.round(nutrition.perServing.protein)}g · K{Math.round(nutrition.perServing.carb)}g · L{Math.round(nutrition.perServing.fat)}g
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total resep</p>
                <p className="font-semibold text-foreground">
                  {Math.round(nutrition.total.cal)} kcal · P{Math.round(nutrition.total.protein)}g · K{Math.round(nutrition.total.carb)}g · L{Math.round(nutrition.total.fat)}g
                </p>
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <Utensils className="h-3.5 w-3.5 text-primary" />
              Bahan ({recipe.items.length})
            </p>
            <ScrollArea className="max-h-48 rounded-md border border-border/60">
              <div className="divide-y divide-border/40">
                {recipe.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.food.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.food.category?.icon} {item.food.category?.name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-[10px]">
                      <span className="font-mono font-medium">{item.amount}g</span>
                      <span className="text-muted-foreground">
                        {Math.round((item.food.energy * item.amount) / 100)} kcal
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Method */}
          {recipe.method && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Cara Membuat
              </p>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="whitespace-pre-wrap text-xs text-foreground/90">
                  {recipe.method}
                </p>
              </div>
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

// ---------------------------------------------------------------------
// Recipe Form Dialog — create / edit with food picker
// ---------------------------------------------------------------------
function RecipeFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: any | null;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [servings, setServings] = React.useState("1");
  const [method, setMethod] = React.useState("");
  const [items, setItems] = React.useState<RecipeItemDraft[]>([]);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const createMut = useCreateRecipe();
  const updateMut = useUpdateRecipe();

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Initialize form when opening
  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description || "");
      setServings(String(editing.servings));
      setMethod(editing.method || "");
      setItems(
        editing.items.map((i: any) => ({
          foodId: i.foodId,
          foodName: i.food.name,
          amount: i.amount,
          energy: i.food.energy,
          protein: i.food.protein,
          fat: i.food.fat,
          carb: i.food.carb,
          fiber: i.food.fiber,
          sodium: i.food.sodium,
          category: i.food.category?.name,
        })),
      );
    } else {
      setName("");
      setDescription("");
      setServings("1");
      setMethod("");
      setItems([]);
    }
    setSearch("");
  }, [open, editing]);

  const { data: foodData, isLoading: foodLoading } = useFoods({ q: debounced });
  const foods = foodData?.foods || [];

  const nutrition = computeRecipeNutrition(items, Number(servings) || 1);

  const addFood = (food: any) => {
    const existing = items.find((i) => i.foodId === food.id);
    if (existing) {
      setItems(items.map((i) =>
        i.foodId === food.id ? { ...i, amount: i.amount + 100 } : i,
      ));
      toast.success(`${food.name} ditambahkan (jumlah +100g)`);
    } else {
      setItems([
        ...items,
        {
          foodId: food.id,
          foodName: food.name,
          amount: 100,
          energy: food.energy,
          protein: food.protein,
          fat: food.fat,
          carb: food.carb,
          fiber: food.fiber,
          sodium: food.sodium,
          category: food.category?.name,
        },
      ]);
      toast.success(`${food.name} ditambahkan`);
    }
  };

  const updateAmount = (foodId: string, amount: number) => {
    setItems(items.map((i) => (i.foodId === foodId ? { ...i, amount } : i)));
  };

  const removeItem = (foodId: string) => {
    setItems(items.filter((i) => i.foodId !== foodId));
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Nama resep wajib diisi");
      return;
    }
    if (items.length === 0) {
      toast.error("Minimal 1 bahan diperlukan");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name,
        description,
        servings: Number(servings) || 1,
        method,
        items: items.map((i) => ({ foodId: i.foodId, amount: i.amount })),
      };
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...payload });
        toast.success("Resep diperbarui");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Resep dibuat");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan resep");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            {editing ? "Edit Resep" : "Resep Baru"}
          </DialogTitle>
          <DialogDescription>
            Pilih bahan dari database TKPI/DKBM — nutrisi dihitung otomatis per porsi.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] px-6 py-3">
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Nama Resep</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nasi Goreng Sayur"
                />
              </div>
              <div>
                <Label className="text-xs">Jumlah Porsi</Label>
                <Input
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  min={1}
                  max={50}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Deskripsi (opsional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Resep sehat untuk DM, tinggi serat..."
              />
            </div>

            {/* Live nutrition preview */}
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  Nutrisi per Porsi ({servings || 1} porsi)
                </p>
                <Badge variant="outline" className="text-[10px]">
                  Total: {Math.round(nutrition.total.cal)} kcal
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                <div className="rounded bg-background/60 py-1.5">
                  <p className="text-base font-bold text-primary">{Math.round(nutrition.perServing.cal)}</p>
                  <p className="text-[10px] text-muted-foreground">kcal</p>
                </div>
                <div className="rounded bg-background/60 py-1.5">
                  <p className="text-base font-bold text-rose-600 dark:text-rose-400">{Math.round(nutrition.perServing.protein)}g</p>
                  <p className="text-[10px] text-muted-foreground">Protein</p>
                </div>
                <div className="rounded bg-background/60 py-1.5">
                  <p className="text-base font-bold text-amber-600 dark:text-amber-400">{Math.round(nutrition.perServing.carb)}g</p>
                  <p className="text-[10px] text-muted-foreground">Karbo</p>
                </div>
                <div className="rounded bg-background/60 py-1.5">
                  <p className="text-base font-bold text-violet-600 dark:text-violet-400">{Math.round(nutrition.perServing.fat)}g</p>
                  <p className="text-[10px] text-muted-foreground">Lemak</p>
                </div>
              </div>
            </div>

            {/* Food search */}
            <div>
              <Label className="text-xs">Tambah Bahan</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari bahan makanan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {debounced && (
                <ScrollArea className="mt-1.5 max-h-40 rounded-md border border-border">
                  {foodLoading ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      Mencari...
                    </div>
                  ) : foods.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      Tidak ada hasil untuk "{debounced}"
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {foods.slice(0, 8).map((f: any) => {
                        const alreadyAdded = items.find((i) => i.foodId === f.id);
                        return (
                          <button
                            key={f.id}
                            onClick={() => addFood(f)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground">{f.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {f.category?.icon} {Math.round(f.energy)} kcal/100g · P{f.protein} K{f.carb} L{f.fat}
                              </p>
                            </div>
                            {alreadyAdded ? (
                              <Badge variant="secondary" className="text-[9px]">Ditambahkan</Badge>
                            ) : (
                              <Plus className="h-3.5 w-3.5 text-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>

            {/* Items list */}
            {items.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-xs">Bahan ({items.length})</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] text-rose-500"
                    onClick={() => setItems([])}
                  >
                    Hapus Semua
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <div
                      key={item.foodId}
                      className="flex items-center gap-2 rounded-md border border-border/60 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {item.foodName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {Math.round((item.energy * item.amount) / 100)} kcal ·
                          P{Math.round((item.protein * item.amount) / 100)}g ·
                          K{Math.round((item.carb * item.amount) / 100)}g
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={item.amount}
                          onChange={(e) => updateAmount(item.foodId, Number(e.target.value))}
                          className="h-7 w-16 text-xs"
                          min={1}
                          max={5000}
                        />
                        <span className="text-[10px] text-muted-foreground">g</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-rose-500"
                          onClick={() => removeItem(item.foodId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Method */}
            <div>
              <Label className="text-xs">Cara Membuat (opsional)</Label>
              <Textarea
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="1. Tumis bumbu...&#10;2. Masukkan sayur...&#10;3. Sajikan hangat."
                rows={4}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? (
              "Menyimpan..."
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {editing ? "Simpan Perubahan" : "Buat Resep"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
