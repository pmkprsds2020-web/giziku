import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------
// POST /api/supabase-seed
// Pushes ALL data from SQLite (Prisma) to Supabase PostgreSQL.
// Uses slug/name as conflict key (NOT Prisma cuid IDs, which aren't UUIDs).
// Supabase generates new UUIDs for each row.
// ---------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return err("Authentication required. Please log in first, then run seed.", 401);
    }

    const results: any = {
      categories: { inserted: 0, errors: [] },
      foods: { inserted: 0, errors: [] },
      patients: { inserted: 0, errors: [] },
      diagnoses: { inserted: 0, errors: [] },
      presets: { inserted: 0, errors: [] },
      recipes: { inserted: 0, errors: [] },
    };

    // Map Prisma category ID → Supabase category UUID
    const categoryIdMap = new Map<string, string>();

    // 1. Seed food_categories — use slug as conflict key, let Supabase generate UUID
    const categories = await db.foodCategory.findMany();
    for (const cat of categories) {
      // Check if category already exists by slug
      const { data: existing } = await supabase
        .from("food_categories")
        .select("id")
        .eq("slug", cat.slug)
        .maybeSingle();

      if (existing) {
        categoryIdMap.set(cat.id, existing.id);
        results.categories.inserted++;
        continue;
      }

      const { data: newCat, error } = await supabase
        .from("food_categories")
        .insert({
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
        })
        .select()
        .single();

      if (error) {
        results.categories.errors.push(`${cat.name}: ${error.message}`);
      } else {
        categoryIdMap.set(cat.id, newCat.id);
        results.categories.inserted++;
      }
    }

    // 2. Seed foods — map Prisma categoryId → Supabase UUID, don't pass Prisma id
    const foods = await db.food.findMany({ where: { deletedAt: null }, include: { category: true } });
    for (const food of foods) {
      const supabaseCategoryId = categoryIdMap.get(food.categoryId);
      if (!supabaseCategoryId) {
        results.foods.errors.push(`${food.name}: category not found in map`);
        continue;
      }

      // Check if food already exists by name
      const { data: existingFood } = await supabase
        .from("foods")
        .select("id")
        .eq("name", food.name)
        .maybeSingle();

      if (existingFood) {
        results.foods.inserted++;
        continue;
      }

      const payload: any = {
        name: food.name,
        english_name: food.englishName,
        alias: food.alias,
        code: food.code,
        category_id: supabaseCategoryId,
        source: food.source,
        description: food.description,
        energy: food.energy,
        protein: food.protein,
        fat: food.fat,
        carb: food.carb,
        fiber: food.fiber,
        water: food.water,
        ash: food.ash,
        sodium: food.sodium,
        potassium: food.potassium,
        calcium: food.calcium,
        magnesium: food.magnesium,
        iron: food.iron,
        phosphorus: food.phosphorus,
        zinc: food.zinc,
        vit_a: food.vitA,
        vit_b1: food.vitB1,
        vit_b2: food.vitB2,
        vit_b6: food.vitB6,
        vit_b12: food.vitB12,
        vit_c: food.vitC,
        vit_d: food.vitD,
        vit_e: food.vitE,
        vit_k: food.vitK,
        cholesterol: food.cholesterol,
        gi: food.gi,
        urt: food.urt,
        urt_gram: food.urtGram,
        bdd: food.bdd,
        price: food.price,
        price_unit: food.priceUnit,
        price_location: food.priceLocation,
        price_source: food.priceSource,
        price_updated_at: food.priceUpdatedAt,
        price_is_estimate: food.priceIsEstimate,
        unit: food.unit,
        image_url: food.imageUrl,
        tags: food.tags,
        approved: food.approved,
        version: food.version,
      };

      const { error } = await supabase.from("foods").insert(payload);
      if (error) results.foods.errors.push(`${food.name}: ${error.message}`);
      else results.foods.inserted++;
    }

    // 3. Seed patients + diagnoses — don't pass Prisma id
    const patients = await db.patient.findMany({
      where: { deletedAt: null },
      include: { diagnoses: true },
    });
    for (const patient of patients) {
      // Check if patient already exists by MRN
      const { data: existingPatient } = await supabase
        .from("patients")
        .select("id")
        .eq("mrn", patient.mrn)
        .maybeSingle();

      if (existingPatient) {
        results.patients.inserted++;
        continue;
      }

      const payload: any = {
        mrn: patient.mrn,
        name: patient.name,
        gender: patient.gender,
        birth_date: patient.birthDate,
        phone: patient.phone,
        address: patient.address,
        religion: patient.religion,
        blood_type: patient.bloodType,
        allergy: patient.allergy,
        height: patient.height,
        weight: patient.weight,
        is_pregnant: patient.isPregnant,
        pregnancy_trimester: patient.pregnancyTrimester,
        is_lactating: patient.isLactating,
        lactation_month: patient.lactationMonth,
        notes: patient.notes,
      };

      const { data: newPatient, error } = await supabase
        .from("patients")
        .insert(payload)
        .select()
        .single();

      if (error) {
        results.patients.errors.push(`${patient.name}: ${error.message}`);
        continue;
      }

      results.patients.inserted++;

      // Seed diagnoses for this patient
      for (const d of patient.diagnoses) {
        const { error: dError } = await supabase.from("diagnoses").insert({
          patient_id: newPatient.id,
          type: d.type,
          icd: d.icd,
          severity: d.severity,
          notes: d.notes,
          active: d.active,
        });
        if (dError) results.diagnoses.errors.push(`${d.type}: ${dError.message}`);
        else results.diagnoses.inserted++;
      }
    }

    // 4. Seed nutrition_presets — don't pass Prisma id
    const presets = await db.nutritionPreset.findMany({ where: { deletedAt: null } });
    for (const p of presets) {
      // Check if preset already exists by name
      const { data: existingPreset } = await supabase
        .from("nutrition_presets")
        .select("id")
        .eq("name", p.name)
        .maybeSingle();

      if (existingPreset) {
        results.presets.inserted++;
        continue;
      }

      const { error } = await supabase.from("nutrition_presets").insert({
        patient_id: null, // Templates don't have patient_id
        name: p.name,
        description: p.description ?? "",
        color: p.color ?? "#10b981",
        icon: p.icon ?? "utensils",
        is_template: p.isTemplate,
        is_favorite: p.isFavorite,
        total_cal: p.totalCal,
        target_weight: p.targetWeight,
        bmr: p.bmr,
        tdee: p.tdee,
        protein_pct: p.proteinPct,
        carb_pct: p.carbPct,
        fat_pct: p.fatPct,
        protein_g: p.proteinG,
        carb_g: p.carbG,
        fat_g: p.fatG,
        fiber_g: p.fiberG,
        sodium_mg: p.sodiumMg,
        potassium_mg: p.potassiumMg,
        fluid_ml: p.fluidMl,
        goal: p.goal,
        diagnoses: p.diagnoses ?? "",
        created_by: session.user?.email ?? "system",
        updated_by: session.user?.email ?? "system",
      });
      if (error) results.presets.errors.push(`${p.name}: ${error.message}`);
      else results.presets.inserted++;
    }

    // 5. Seed recipes — don't pass Prisma id
    const recipes = await db.recipe.findMany({
      where: { deletedAt: null },
      include: { items: true },
    });

    // Build food name → Supabase UUID map
    const { data: supabaseFoods } = await supabase
      .from("foods")
      .select("id, name")
      .limit(200);
    const foodIdMap = new Map<string, string>();
    for (const f of (supabaseFoods || [])) {
      foodIdMap.set(f.name, f.id);
    }

    for (const r of recipes) {
      // Check if recipe already exists by name
      const { data: existingRecipe } = await supabase
        .from("recipes")
        .select("id")
        .eq("name", r.name)
        .maybeSingle();

      if (existingRecipe) {
        results.recipes.inserted++;
        continue;
      }

      const { data: newRecipe, error: rError } = await supabase
        .from("recipes")
        .insert({
          name: r.name,
          description: r.description,
          servings: r.servings,
          method: r.method,
          image_url: r.imageUrl,
        })
        .select()
        .single();

      if (rError) {
        results.recipes.errors.push(`${r.name}: ${rError.message}`);
        continue;
      }
      results.recipes.inserted++;

      // Seed recipe items — map Prisma foodId → Supabase food UUID by name
      for (const item of r.items) {
        // Get food name from Prisma
        const prismaFood = await db.food.findUnique({ where: { id: item.foodId } });
        if (!prismaFood) continue;

        const supabaseFoodId = foodIdMap.get(prismaFood.name);
        if (!supabaseFoodId) {
          results.recipes.errors.push(`${r.name}: food "${prismaFood.name}" not found in Supabase`);
          continue;
        }

        await supabase.from("recipe_items").insert({
          recipe_id: newRecipe.id,
          food_id: supabaseFoodId,
          amount: item.amount,
        });
      }
    }

    const totalInserted =
      results.categories.inserted +
      results.foods.inserted +
      results.patients.inserted +
      results.diagnoses.inserted +
      results.presets.inserted +
      results.recipes.inserted;

    const totalErrors =
      results.categories.errors.length +
      results.foods.errors.length +
      results.patients.errors.length +
      results.diagnoses.errors.length +
      results.presets.errors.length +
      results.recipes.errors.length;

    return ok({
      success: totalErrors === 0,
      totalInserted,
      totalErrors,
      results,
      message: totalErrors === 0
        ? `Seeded ${totalInserted} records to Supabase PostgreSQL successfully.`
        : `Seeded ${totalInserted} records with ${totalErrors} errors.`,
    });
  } catch (e: any) {
    console.error("[supabase-seed] error:", e);
    return err(e.message || "Seed failed", 500);
  }
}
