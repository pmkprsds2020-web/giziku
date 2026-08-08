import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseListRecipes,
  supabaseCreateRecipe,
} from "@/lib/supabase/data-layer";
import { db } from "@/lib/db";

const RecipeItemSchema = z.object({
  foodId: z.string().min(1),
  amount: z.number().min(0.1).max(5000),
});

const CreateSchema = z.object({
  name: z.string().min(1, "Nama resep wajib diisi"),
  description: z.string().optional().default(""),
  servings: z.number().min(1).max(50).optional().default(1),
  method: z.string().optional().default(""),
  imageUrl: z.string().optional().nullable(),
  items: z.array(RecipeItemSchema).min(1, "Minimal 1 bahan"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || undefined;

    let recipes = await supabaseListRecipes();

    // Fall back to Prisma if Supabase is empty
    if (recipes.length === 0) {
      recipes = await db.recipe.findMany({
        where: { deletedAt: null },
        include: { items: { include: { food: { include: { category: true } } } } },
        orderBy: { createdAt: "desc" },
      }) as any;
    }

    // Apply search filter in memory
    const filtered = q
      ? recipes.filter((r: any) =>
          r.name?.toLowerCase().includes(q.toLowerCase()),
        )
      : recipes;

    return ok(filtered);
  } catch (e) {
    return handleZod(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = safeParse(CreateSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    const { data: recipe, error } = await supabaseCreateRecipe({
      name: d.name,
      description: d.description,
      servings: d.servings,
      method: d.method,
      imageUrl: d.imageUrl ?? null,
      items: d.items.map((it) => ({
        foodId: it.foodId,
        amount: it.amount,
      })),
    });

    if (error) {
      if (error.includes("Authentication required")) return err(error, 401);
      return err(error, 500);
    }

    return ok(recipe, 201);
  } catch (e) {
    return handleZod(e);
  }
}
