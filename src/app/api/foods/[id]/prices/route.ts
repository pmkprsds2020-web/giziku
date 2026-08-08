import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import { getServerClient, resolveFoodId, supabaseGetFood } from "@/lib/supabase/data-layer";

const UpdatePriceSchema = z.object({
  price: z.number().min(0),
  unit: z.string().optional().default("g"),
  location: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function mapPriceHistory(row: any): any {
  return {
    id: row.id,
    foodId: row.food_id,
    price: row.price,
    previousPrice: row.previous_price,
    unit: row.unit,
    location: row.location,
    source: row.source,
    notes: row.notes,
    actor: row.actor,
    createdAt: row.created_at,
  };
}

// GET price history for a food
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const resolvedId = await resolveFoodId(id);

    const { client } = await getServerClient();
    const { data, error } = await client
      .from("food_price_history")
      .select("*")
      .eq("food_id", resolvedId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      // Prisma fallback
      console.warn("[foods/[id]/prices GET] Supabase failed, trying Prisma:", error.message);
      try {
        const { db } = await import("@/lib/db");
        const history = await db.foodPriceHistory.findMany({
          where: { foodId: id },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        return ok(history);
      } catch (e) {
        return err(`Gagal memuat riwayat harga: ${error.message}`, 500);
      }
    }

    return ok((data || []).map(mapPriceHistory));
  } catch (e) {
    return handleZod(e);
  }
}

// POST — update price (creates history entry + updates food.price)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = safeParse(UpdatePriceSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    const resolvedId = await resolveFoodId(id);

    // Fetch existing food from Supabase
    const food = await supabaseGetFood(resolvedId);
    if (!food || food.deletedAt) {
      // Prisma fallback
      try {
        const { db } = await import("@/lib/db");
        const prismaFood = await db.food.findUnique({ where: { id } });
        if (!prismaFood || prismaFood.deletedAt) return err("Makanan tidak ditemukan", 404);

        const previousPrice = prismaFood.price;
        const priceChange = d.price - previousPrice;
        const priceChangePct = previousPrice > 0 ? Math.round((priceChange / previousPrice) * 100) : 0;

        const history = await db.foodPriceHistory.create({
          data: {
            foodId: id,
            price: d.price,
            previousPrice,
            unit: d.unit,
            location: d.location || null,
            source: d.source || null,
            notes: d.notes || null,
            actor: "admin",
          },
        });

        await db.food.update({
          where: { id },
          data: {
            price: d.price,
            priceUnit: d.unit,
            priceLocation: d.location || null,
            priceSource: d.source || null,
            priceUpdatedAt: new Date(),
            priceIsEstimate: false,
          },
        });

        await db.foodChangeLog.create({
          data: {
            foodId: id,
            action: "UPDATE",
            changes: JSON.stringify({
              price: { from: previousPrice, to: d.price },
              priceChangePct,
            }),
            actor: "admin",
          },
        });

        return ok({
          history,
          previousPrice,
          newPrice: d.price,
          priceChange,
          priceChangePct,
          alert: priceChangePct > 20 ? `Harga naik ${priceChangePct}%` : priceChangePct < -20 ? `Harga turun ${Math.abs(priceChangePct)}%` : null,
        });
      } catch (prismaErr: any) {
        return err(`Gagal memperbarui harga: ${prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    const previousPrice = food.price ?? 0;
    const priceChange = d.price - previousPrice;
    const priceChangePct = previousPrice > 0 ? Math.round((priceChange / previousPrice) * 100) : 0;

    const { client, session } = await getServerClient();
    if (!session) return err("Authentication required", 401);
    const actor = session.user?.email ?? "admin";

    // Insert price history
    const { data: historyRow, error: histErr } = await client
      .from("food_price_history")
      .insert({
        food_id: resolvedId,
        price: d.price,
        previous_price: previousPrice,
        unit: d.unit,
        location: d.location || null,
        source: d.source || null,
        notes: d.notes || null,
        actor,
      })
      .select("*")
      .single();

    if (histErr) {
      return err(`Gagal menyimpan riwayat harga: ${histErr.message}`, 500);
    }

    // Update food's current price
    const { error: foodUpdateErr } = await client
      .from("foods")
      .update({
        price: d.price,
        price_unit: d.unit,
        price_location: d.location || null,
        price_source: d.source || null,
        price_updated_at: new Date().toISOString(),
        price_is_estimate: false,
      })
      .eq("id", resolvedId);

    if (foodUpdateErr) {
      console.warn("[foods/[id]/prices POST] Food price update failed:", foodUpdateErr.message);
    }

    // Log change
    try {
      await client.from("food_change_logs").insert({
        food_id: resolvedId,
        action: "UPDATE",
        changes: { price: { from: previousPrice, to: d.price }, priceChangePct },
        actor,
      });
    } catch (e) {
      console.warn("[foods/[id]/prices POST] change log insert failed:", e);
    }

    return ok({
      history: mapPriceHistory(historyRow),
      previousPrice,
      newPrice: d.price,
      priceChange,
      priceChangePct,
      alert: priceChangePct > 20 ? `Harga naik ${priceChangePct}%` : priceChangePct < -20 ? `Harga turun ${Math.abs(priceChangePct)}%` : null,
    });
  } catch (e) {
    return handleZod(e);
  }
}
