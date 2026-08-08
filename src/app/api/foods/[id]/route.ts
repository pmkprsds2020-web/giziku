import { NextRequest } from "next/server";
import { ok, err, handleZod, safeParse } from "@/lib/api-helpers";
import { z } from "zod";
import {
  supabaseGetFood,
  supabaseUpsertFood,
  getServerClient,
  resolveFoodId,
} from "@/lib/supabase/data-layer";

const TRACKED_FIELDS = [
  "name", "englishName", "alias", "code", "description", "source",
  "energy", "protein", "fat", "carb", "fiber", "water", "ash",
  "sodium", "potassium", "calcium", "magnesium", "iron", "phosphorus", "zinc",
  "vitA", "vitB1", "vitB2", "vitB6", "vitB12", "vitC", "vitD", "vitE", "vitK",
  "cholesterol", "gi", "urt", "urtGram", "bdd", "unit", "imageUrl", "tags",
] as const;

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  englishName: z.string().optional().nullable(),
  alias: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  source: z.enum(["TKPI", "DKBM", "USDA", "CUSTOM"]).optional(),
  energy: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  carb: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
  water: z.number().min(0).optional(),
  ash: z.number().min(0).optional(),
  sodium: z.number().min(0).optional(),
  potassium: z.number().min(0).optional(),
  calcium: z.number().min(0).optional(),
  magnesium: z.number().min(0).optional(),
  iron: z.number().min(0).optional(),
  phosphorus: z.number().min(0).optional(),
  zinc: z.number().min(0).optional(),
  vitA: z.number().min(0).optional(),
  vitB1: z.number().min(0).optional(),
  vitB2: z.number().min(0).optional(),
  vitB6: z.number().min(0).optional(),
  vitB12: z.number().min(0).optional(),
  vitC: z.number().min(0).optional(),
  vitD: z.number().min(0).optional(),
  vitE: z.number().min(0).optional(),
  vitK: z.number().min(0).optional(),
  cholesterol: z.number().min(0).optional(),
  gi: z.number().min(0).max(100).optional(),
  urt: z.string().optional().nullable(),
  urtGram: z.number().optional().nullable(),
  bdd: z.number().min(0).max(100).optional(),
  unit: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  tags: z.string().optional(),
  approved: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = safeParse(UpdateSchema, body);
    if (!parsed.success) return handleZod(parsed.error);
    const d = parsed.data;

    // Resolve Prisma cuid → Supabase UUID
    const resolvedId = await resolveFoodId(id);

    // Fetch existing from Supabase
    let existing = await supabaseGetFood(resolvedId);

    // Track changes for audit log
    const changes: Record<string, { from: any; to: any }> = {};
    if (existing) {
      for (const field of TRACKED_FIELDS) {
        if (d[field] !== undefined && d[field] !== (existing as any)[field]) {
          changes[field] = { from: (existing as any)[field], to: d[field] };
        }
      }
    }

    // Build full payload for upsert — supabaseUpsertFood needs ALL required fields
    const payload = existing
      ? { ...existing, ...d, id: resolvedId, version: (existing.version || 1) + 1 }
      : { id: resolvedId, ...d, version: 1 };

    const { data: updated, error: supaErr } = await supabaseUpsertFood(payload);

    if (supaErr || !updated) {
      // Prisma fallback
      console.warn("[foods/[id] PUT] Supabase failed, trying Prisma:", supaErr);
      try {
        const { db } = await import("@/lib/db");
        const prismaExisting = await db.food.findUnique({ where: { id } });
        if (!prismaExisting || prismaExisting.deletedAt) return err("Makanan tidak ditemukan", 404);

        const prismaUpdated = await db.food.update({
          where: { id },
          data: {
            ...d,
            subcategoryId: d.subcategoryId || null,
            englishName: d.englishName ?? undefined,
            alias: d.alias ?? undefined,
            code: d.code ?? undefined,
            description: d.description ?? undefined,
            urt: d.urt ?? undefined,
            urtGram: d.urtGram ?? undefined,
            imageUrl: d.imageUrl ?? undefined,
            version: { increment: 1 },
          },
          include: { category: true, subcategory: true },
        });

        if (Object.keys(changes).length > 0) {
          await db.foodChangeLog.create({
            data: {
              foodId: id,
              action: "UPDATE",
              changes: JSON.stringify(changes),
              actor: "admin",
            },
          });
        }
        return ok(prismaUpdated);
      } catch (prismaErr: any) {
        return err(`Gagal memperbarui makanan: ${supaErr ?? prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    // Write change log to Supabase
    if (Object.keys(changes).length > 0) {
      try {
        const { client, session } = await getServerClient();
        await client.from("food_change_logs").insert({
          food_id: resolvedId,
          action: "UPDATE",
          changes,
          actor: session?.user?.email ?? "admin",
        });
      } catch (e) {
        console.warn("[foods/[id] PUT] Failed to write change log:", e);
      }
    }

    return ok(updated);
  } catch (e) {
    return handleZod(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const resolvedId = await resolveFoodId(id);

    // Check existing in Supabase
    const existing = await supabaseGetFood(resolvedId);
    if (!existing || existing.deletedAt) {
      // Prisma fallback
      try {
        const { db } = await import("@/lib/db");
        const prismaExisting = await db.food.findUnique({ where: { id } });
        if (!prismaExisting || prismaExisting.deletedAt) return err("Makanan tidak ditemukan", 404);

        await db.food.update({ where: { id }, data: { deletedAt: new Date() } });
        await db.foodChangeLog.create({
          data: {
            foodId: id,
            action: "DELETE",
            changes: JSON.stringify({ name: { from: prismaExisting.name, to: null } }),
            actor: "admin",
          },
        });
        return ok({ id, deleted: true });
      } catch (prismaErr: any) {
        return err(`Gagal menghapus makanan: ${prismaErr?.message ?? "unknown"}`, 500);
      }
    }

    // Soft delete via Supabase
    const { client, session } = await getServerClient();
    if (!session) return err("Authentication required", 401);

    const { error: deleteErr } = await client
      .from("foods")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: session.user?.email ?? "admin",
      })
      .eq("id", resolvedId);

    if (deleteErr) {
      return err(`Gagal menghapus makanan: ${deleteErr.message}`, 500);
    }

    // Write change log
    try {
      await client.from("food_change_logs").insert({
        food_id: resolvedId,
        action: "DELETE",
        changes: { name: { from: existing.name, to: null } },
        actor: session.user?.email ?? "admin",
      });
    } catch (e) {
      console.warn("[foods/[id] DELETE] Failed to write change log:", e);
    }

    return ok({ id, deleted: true });
  } catch (e) {
    return handleZod(e);
  }
}
