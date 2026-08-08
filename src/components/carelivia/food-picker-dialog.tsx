"use client";

import * as React from "react";
import { Search, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFoods } from "@/hooks/use-carelivia";
import { computeFoodNutrition } from "@/lib/clinical/calorie-engine";

export interface FoodPickerResult {
  foodId: string;
  foodName: string;
  amount: number;
  cal: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
  potassium: number;
  calcium: number;
  iron: number;
  cholesterol: number;
  urt: string | null;
  urtGram: number | null;
  categorySlug: string;
}

interface FoodPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (result: FoodPickerResult) => void;
  title?: string;
  defaultAmount?: number;
  excludeFoodIds?: string[];
}

export function FoodPickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = "Pilih Makanan",
  defaultAmount = 100,
  excludeFoodIds = [],
}: FoodPickerDialogProps) {
  const [search, setSearch] = React.useState("");
  const [selectedFood, setSelectedFood] = React.useState<any>(null);
  const [grams, setGrams] = React.useState(defaultAmount);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  const { data: foodData, isLoading } = useFoods({ q: search || undefined });

  // Debounce search
  const handleSearch = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 300);
  };

  const foods = React.useMemo(() => {
    let list = foodData?.foods || [];
    if (excludeFoodIds.length > 0) {
      list = list.filter((f: any) => !excludeFoodIds.includes(f.id));
    }
    return list;
  }, [foodData, excludeFoodIds]);

  const handleSelectFood = (food: any) => {
    setSelectedFood(food);
    setGrams(defaultAmount);
  };

  const handleConfirm = () => {
    if (!selectedFood) return;
    const nut = computeFoodNutrition(selectedFood, grams);
    const result: FoodPickerResult = {
      foodId: selectedFood.id,
      foodName: selectedFood.name,
      amount: grams,
      cal: Math.round(nut.cal),
      protein: Math.round(nut.protein * 10) / 10,
      fat: Math.round(nut.fat * 10) / 10,
      carb: Math.round(nut.carb * 10) / 10,
      fiber: Math.round(nut.fiber * 10) / 10,
      sodium: Math.round(nut.sodium),
      potassium: Math.round(nut.potassium),
      calcium: Math.round((selectedFood.calcium || 0) * (grams / 100)),
      iron: Math.round((selectedFood.iron || 0) * (grams / 100) * 10) / 10,
      cholesterol: Math.round((selectedFood.cholesterol || 0) * (grams / 100)),
      urt: selectedFood.urt || null,
      urtGram: selectedFood.urtGram || null,
      categorySlug: selectedFood.category?.slug || "",
    };
    onSelect(result);
    setSelectedFood(null);
    setSearch("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedFood(null);
    setSearch("");
    onOpenChange(false);
  };

  // Compute preview nutrition for selected food
  const previewNut = React.useMemo(() => {
    if (!selectedFood) return null;
    return computeFoodNutrition(selectedFood, grams);
  }, [selectedFood, grams]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Cari makanan dari database TKPI/DKBM</DialogDescription>
        </DialogHeader>

        {!selectedFood ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari makanan... (cth: nasi, ayam, bayam)"
                className="pl-10"
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
            </div>

            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-1">
                {isLoading && (
                  <p className="py-4 text-center text-sm text-muted-foreground">Memuat...</p>
                )}
                {!isLoading && foods.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Makanan tidak ditemukan. Coba kata kunci lain.
                  </p>
                )}
                {foods.map((food: any) => (
                  <button
                    key={food.id}
                    onClick={() => handleSelectFood(food)}
                    className="flex w-full items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{food.name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {food.category && (
                          <Badge variant="outline" className="text-[9px]">
                            {food.category.icon} {food.category.name}
                          </Badge>
                        )}
                        <span>{food.energy} kcal/100g</span>
                        <span>· P {food.protein}g</span>
                        {food.urt && <span>· {food.urt}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">{selectedFood.name}</h3>
                {selectedFood.category && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {selectedFood.category.icon} {selectedFood.category.name}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFood(null)}>
                <X className="h-4 w-4" /> Ganti
              </Button>
            </div>

            {/* Gram input */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-foreground">Gram:</label>
              <Input
                type="number"
                value={grams}
                onChange={(e) => setGrams(Math.max(1, Number(e.target.value)))}
                className="w-24"
                min={1}
                max={2000}
              />
              <span className="text-sm text-muted-foreground">gram</span>
              {selectedFood.urtGram && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGrams(Math.round(selectedFood.urtGram))}
                >
                  1 URT ({selectedFood.urtGram}g)
                </Button>
              )}
            </div>

            {/* Nutrition preview */}
            {previewNut && (
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/40 bg-muted/20 p-3">
                <NutItem label="Energi" value={`${Math.round(previewNut.cal)} kcal`} />
                <NutItem label="Protein" value={`${Math.round(previewNut.protein * 10) / 10} g`} />
                <NutItem label="Lemak" value={`${Math.round(previewNut.fat * 10) / 10} g`} />
                <NutItem label="Karbo" value={`${Math.round(previewNut.carb * 10) / 10} g`} />
                <NutItem label="Serat" value={`${Math.round(previewNut.fiber * 10) / 10} g`} />
                <NutItem label="Natrium" value={`${Math.round(previewNut.sodium)} mg`} />
                <NutItem label="Kalium" value={`${Math.round(previewNut.potassium)} mg`} />
                <NutItem label="Kalsium" value={`${Math.round((selectedFood.calcium || 0) * (grams / 100))} mg`} />
                <NutItem label="Zat Besi" value={`${Math.round((selectedFood.iron || 0) * (grams / 100) * 10) / 10} mg`} />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Batal</Button>
              <Button onClick={handleConfirm}>
                <Check className="mr-1.5 h-4 w-4" /> Pilih Makanan
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NutItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

// Import Button here to avoid circular deps
import { Button } from "@/components/ui/button";
