import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseListFoods,
  supabaseListCategories,
  supabaseUpsertFood,
  getServerClient,
} from "@/lib/supabase/data-layer";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const subcategoryId = searchParams.get("subcategoryId") || undefined;
    const highProtein = searchParams.get("highProtein") === "1";
    const lowGi = searchParams.get("lowGi") === "1";
    const lowSodium = searchParams.get("lowSodium") === "1";
    const highFiber = searchParams.get("highFiber") === "1";
    const limit = Number(searchParams.get("limit") || 200);

    const { data: foods } = await supabaseListFoods({
      search: q,
      limit,
    });

    // Determine source: if Supabase has foods, use Supabase for both foods+categories
    // Otherwise fall back to Prisma for both (so category IDs match)
    let allFoods: any[] = foods;
    let categories: any[] = [];

    if (foods.length > 0) {
      // Supabase mode — categories from Supabase
      categories = await supabaseListCategories();
    } else {
      // Prisma fallback — foods + categories from Prisma (IDs match)
      const prismaFoods = await db.food.findMany({
        where: { deletedAt: null, approved: true, ...(q ? { name: { contains: q } } : {}) },
        include: { category: true },
        take: limit,
      });
      allFoods = prismaFoods;
      categories = await db.foodCategory.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { foods: { where: { deletedAt: null, approved: true } } } } },
      });
    }

    // Apply additional filters in memory
    let filtered = allFoods;
    if (categoryId) filtered = filtered.filter((f: any) => f.categoryId === categoryId);
    if (subcategoryId) filtered = filtered.filter((f: any) => f.subcategoryId === subcategoryId);
    if (highProtein) filtered = filtered.filter((f: any) => f.protein >= 10);
    if (lowGi) filtered = filtered.filter((f: any) => f.gi < 55 && f.gi > 0);
    if (lowSodium) filtered = filtered.filter((f: any) => f.sodium <= 100);
    if (highFiber) filtered = filtered.filter((f: any) => f.fiber >= 3);

    // Add food count per category for UI display
    const foodCountByCategory = new Map<string, number>();
    for (const f of allFoods) {
      const cid = (f as any).categoryId || (f as any).category?.id;
      if (cid) foodCountByCategory.set(cid, (foodCountByCategory.get(cid) || 0) + 1);
    }
    const categoriesWithCount = categories.map((c: any) => ({
      ...c,
      _count: { foods: foodCountByCategory.get(c.id) || 0 },
    }));

    return ok({ foods: filtered, categories: categoriesWithCount });
  } catch (e) {
    return handleZod(e);
  }
}

const CreateFoodSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  englishName: z.string().optional().nullable(),
  alias: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  categoryId: z.string().min(1, "Kategori wajib diisi"),
  subcategoryId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  source: z.enum(["TKPI", "DKBM", "USDA", "CUSTOM"]).optional().default("CUSTOM"),
  // Nutrition
  energy: z.number().min(0),
  protein: z.number().min(0),
  fat: z.number().min(0),
  carb: z.number().min(0),
  fiber: z.number().min(0).optional().default(0),
  water: z.number().min(0).optional().default(0),
  ash: z.number().min(0).optional().default(0),
  sodium: z.number().min(0).optional().default(0),
  potassium: z.number().min(0).optional().default(0),
  calcium: z.number().min(0).optional().default(0),
  magnesium: z.number().min(0).optional().default(0),
  iron: z.number().min(0).optional().default(0),
  phosphorus: z.number().min(0).optional().default(0),
  zinc: z.number().min(0).optional().default(0),
  vitA: z.number().min(0).optional().default(0),
  vitB1: z.number().min(0).optional().default(0),
  vitB2: z.number().min(0).optional().default(0),
  vitB6: z.number().min(0).optional().default(0),
  vitB12: z.number().min(0).optional().default(0),
  vitC: z.number().min(0).optional().default(0),
  vitD: z.number().min(0).optional().default(0),
  vitE: z.number().min(0).optional().default(0),
  vitK: z.number().min(0).optional().default(0),
  cholesterol: z.number().min(0).optional().default(0),
  gi: z.number().min(0).max(100).optional().default(0),
  // URT
  urt: z.string().optional().nullable(),
  urtGram: z.number().optional().nullable(),
  bdd: z.number().min(0).max(100).optional().default(100),
  // Price
  price: z.number().min(0).optional().default(0),
  priceUnit: z.string().optional().default("g"),
  priceLocation: z.string().optional().nullable(),
  priceSource: z.string().optional().nullable(),
  unit: z.string().optional().default("g"),
  imageUrl: z.string().optional().nullable(),
  tags: z.string().optional().default(""),
  approved: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(CreateFoodSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    // Verify category exists
    const { client } = await getServerClient();
    const { data: category } = await client
      .from("food_categories")
      .select("id, name, slug, icon")
      .eq("id", d.categoryId)
      .maybeSingle();
    if (!category) return err("Kategori tidak ditemukan", 404);

    const { data: food, error } = await supabaseUpsertFood({
      ...d,
      subcategoryId: d.subcategoryId || null,
      englishName: d.englishName || null,
      alias: d.alias || null,
      code: d.code || null,
      description: d.description || null,
      urt: d.urt || null,
      urtGram: d.urtGram ?? null,
      priceLocation: d.priceLocation || null,
      priceSource: d.priceSource || null,
      imageUrl: d.imageUrl || null,
      priceUpdatedAt: d.price > 0 ? new Date().toISOString() : null,
      version: 1,
    });

    if (error) {
      if (error.includes("Authentication required")) return err(error, 401);
      return err(error, 500);
    }

    // Log creation
    const { error: logError } = await client.from("food_change_logs").insert({
      food_id: food.id,
      action: "CREATE",
      changes: { food },
      actor: "admin",
    });
    if (logError) {
      console.error("[foods POST] Failed to log change:", logError);
    }

    // Log initial price if provided
    if (d.price > 0) {
      const { error: priceLogError } = await client.from("food_price_history").insert({
        food_id: food.id,
        price: d.price,
        previous_price: null,
        unit: d.priceUnit,
        location: d.priceLocation || null,
        source: d.priceSource || null,
        actor: "admin",
      });
      if (priceLogError) {
        console.error("[foods POST] Failed to log price history:", priceLogError);
      }
    }

    return ok(food, 201);
  } catch (e) {
    return handleZod(e);
  }
}
