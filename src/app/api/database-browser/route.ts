import { NextRequest } from "next/server";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { getServerClient } from "@/lib/supabase/data-layer";

// GET /api/database-browser?table=patients&page=1&limit=10&q=search
// Supabase primary, Prisma fallback.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table") || "patients";
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);
    const q = searchParams.get("q") || "";
    const offset = (page - 1) * limit;

    const { client } = await getServerClient();

    let data: any[] = [];
    let total = 0;

    try {
      const supa = await fetchFromSupabase(client, table, q, limit, offset);
      if (supa) {
        data = supa.data;
        total = supa.total;
      } else {
        // Unknown table to Supabase mapping — fall through to Prisma
        throw new Error("no mapping");
      }
    } catch (supaErr: any) {
      console.warn(`[database-browser] Supabase failed for ${table}, trying Prisma:`, supaErr?.message);
      const prismaResult = await fetchFromPrisma(table, q, limit, offset);
      if (!prismaResult) return err("Table not supported", 400);
      data = prismaResult.data;
      total = prismaResult.total;
    }

    const totalPages = Math.ceil(total / limit);

    return ok({
      table,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (e) {
    return handleZod(e);
  }
}

// Returns null if table not supported by Supabase mapping
async function fetchFromSupabase(
  client: any,
  table: string,
  q: string,
  limit: number,
  offset: number,
): Promise<{ data: any[]; total: number } | null> {
  const range = `${offset},${offset + limit - 1}`;

  switch (table) {
    case "patients": {
      let query = client
        .from("patients")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(range);
      if (q) query = query.ilike("name", `%${q}%`);
      const { data, count, error } = await query;
      if (error) throw error;
      return { data: data || [], total: count ?? 0 };
    }

    case "foods": {
      let query = client
        .from("foods")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .range(range);
      if (q) query = query.ilike("name", `%${q}%`);
      const { data, count, error } = await query;
      if (error) throw error;
      return { data: data || [], total: count ?? 0 };
    }

    case "meal_plans": {
      const { data, count, error } = await client
        .from("meal_plans")
        .select("*, patients(name, mrn)", { count: "exact" })
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .range(range);
      if (error) throw error;
      return { data: data || [], total: count ?? 0 };
    }

    case "food_records": {
      const { data, count, error } = await client
        .from("food_records")
        .select("*, patients(name), foods(name)", { count: "exact" })
        .order("date", { ascending: false })
        .range(range);
      if (error) throw error;
      return { data: data || [], total: count ?? 0 };
    }

    case "weight_records": {
      const { data, count, error } = await client
        .from("weight_records")
        .select("*, patients(name)", { count: "exact" })
        .order("date", { ascending: false })
        .range(range);
      if (error) throw error;
      return { data: data || [], total: count ?? 0 };
    }

    case "nutrition_assessments": {
      const { data, count, error } = await client
        .from("nutrition_assessments")
        .select("*, patients(name)", { count: "exact" })
        .order("recorded_at", { ascending: false })
        .range(range);
      if (error) throw error;
      return { data: data || [], total: count ?? 0 };
    }

    case "nutrition_presets": {
      const { data, count, error } = await client
        .from("nutrition_presets")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(range);
      if (error) throw error;
      return { data: data || [], total: count ?? 0 };
    }

    case "recipes": {
      const { data, count, error } = await client
        .from("recipes")
        .select("*, recipe_items(id)", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(range);
      if (error) throw error;
      // Map _count.items like Prisma does
      const mapped = (data || []).map((r: any) => ({
        ...r,
        _count: { items: (r.recipe_items || []).length },
      }));
      return { data: mapped, total: count ?? 0 };
    }

    case "exercise_plans": {
      const { data, count, error } = await client
        .from("exercise_plans")
        .select("*, patients(name), exercise_items(id)", { count: "exact" })
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .range(range);
      if (error) throw error;
      const mapped = (data || []).map((e: any) => ({
        ...e,
        _count: { items: (e.exercise_items || []).length },
      }));
      return { data: mapped, total: count ?? 0 };
    }

    case "saved_meal_plans": {
      const { data, count, error } = await client
        .from("saved_meal_plans")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(range);
      if (error) throw error;
      return { data: data || [], total: count ?? 0 };
    }

    case "shopping_lists": {
      const { data, count, error } = await client
        .from("shopping_lists")
        .select("*, patients(name)", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(range);
      if (error) throw error;
      return { data: data || [], total: count ?? 0 };
    }

    case "audit_logs": {
      const { data, count, error } = await client
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(range);
      if (error) throw error;
      return { data: data || [], total: count ?? 0 };
    }

    default:
      return null;
  }
}

async function fetchFromPrisma(
  table: string,
  q: string,
  limit: number,
  offset: number,
): Promise<{ data: any[]; total: number } | null> {
  const { db } = await import("@/lib/db");

  switch (table) {
    case "patients": {
      const where = { deletedAt: null, ...(q ? { name: { contains: q } } : {}) };
      const [total, data] = await Promise.all([
        db.patient.count({ where }),
        db.patient.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit }),
      ]);
      return { data, total };
    }

    case "foods": {
      const where = { deletedAt: null, ...(q ? { name: { contains: q } } : {}) };
      const [total, data] = await Promise.all([
        db.food.count({ where }),
        db.food.findMany({ where, orderBy: { name: "asc" }, skip: offset, take: limit }),
      ]);
      return { data, total };
    }

    case "meal_plans": {
      const where = { deletedAt: null };
      const [total, data] = await Promise.all([
        db.mealPlan.count({ where }),
        db.mealPlan.findMany({
          where, orderBy: { date: "desc" }, skip: offset, take: limit,
          include: { patient: { select: { name: true, mrn: true } } },
        }),
      ]);
      return { data, total };
    }

    case "food_records": {
      const [total, data] = await Promise.all([
        db.foodRecord.count(),
        db.foodRecord.findMany({
          orderBy: { date: "desc" }, skip: offset, take: limit,
          include: { patient: { select: { name: true } }, food: { select: { name: true } } },
        }),
      ]);
      return { data, total };
    }

    case "weight_records": {
      const [total, data] = await Promise.all([
        db.weightRecord.count(),
        db.weightRecord.findMany({
          orderBy: { date: "desc" }, skip: offset, take: limit,
          include: { patient: { select: { name: true } } },
        }),
      ]);
      return { data, total };
    }

    case "nutrition_assessments": {
      const [total, data] = await Promise.all([
        db.nutritionAssessment.count(),
        db.nutritionAssessment.findMany({
          orderBy: { recordedAt: "desc" }, skip: offset, take: limit,
          include: { patient: { select: { name: true } } },
        }),
      ]);
      return { data, total };
    }

    case "nutrition_presets": {
      const where = { deletedAt: null };
      const [total, data] = await Promise.all([
        db.nutritionPreset.count({ where }),
        db.nutritionPreset.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit }),
      ]);
      return { data, total };
    }

    case "recipes": {
      const where = { deletedAt: null };
      const [total, data] = await Promise.all([
        db.recipe.count({ where }),
        db.recipe.findMany({
          where, orderBy: { createdAt: "desc" }, skip: offset, take: limit,
          include: { _count: { select: { items: true } } },
        }),
      ]);
      return { data, total };
    }

    case "exercise_plans": {
      const where = { deletedAt: null };
      const [total, data] = await Promise.all([
        db.exercisePlan.count({ where }),
        db.exercisePlan.findMany({
          where, orderBy: { date: "desc" }, skip: offset, take: limit,
          include: { patient: { select: { name: true } }, _count: { select: { items: true } } },
        }),
      ]);
      return { data, total };
    }

    case "saved_meal_plans": {
      const where = { deletedAt: null };
      const [total, data] = await Promise.all([
        db.savedMealPlan.count({ where }),
        db.savedMealPlan.findMany({ where, orderBy: { createdAt: "desc" }, skip: offset, take: limit }),
      ]);
      return { data, total };
    }

    case "shopping_lists": {
      const where = { deletedAt: null };
      const [total, data] = await Promise.all([
        db.shoppingList.count({ where }),
        db.shoppingList.findMany({
          where, orderBy: { createdAt: "desc" }, skip: offset, take: limit,
          include: { patient: { select: { name: true } } },
        }),
      ]);
      return { data, total };
    }

    case "audit_logs": {
      const [total, data] = await Promise.all([
        db.auditLog.count(),
        db.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: offset, take: limit }),
      ]);
      return { data, total };
    }

    default:
      return null;
  }
}
