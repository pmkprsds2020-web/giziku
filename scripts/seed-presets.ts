// Seed Nutrition Preset Templates directly via Prisma
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const KCAL_PER_GRAM = { protein: 4, carb: 4, fat: 9 };
function computeGrams(totalCal: number, p: number, c: number, f: number) {
  return {
    proteinG: Math.round(((totalCal * p) / 100 / KCAL_PER_GRAM.protein) * 10) / 10,
    carbG: Math.round(((totalCal * c) / 100 / KCAL_PER_GRAM.carb) * 10) / 10,
    fatG: Math.round(((totalCal * f) / 100 / KCAL_PER_GRAM.fat) * 10) / 10,
  };
}

const TEMPLATES = [
  { name: "Diabetes 1500 kcal", desc: "PERKENI standar 1500 kcal, karbo 50%", cal: 1500, p: 20, c: 50, f: 30, fiber: 25, na: 2300, k: 3500, color: "#10b981", goal: "DIABETES_DIET", dx: "DM", icon: "utensils" },
  { name: "Diabetes 1800 kcal", desc: "PERKENI standar 1800 kcal", cal: 1800, p: 20, c: 50, f: 30, fiber: 25, na: 2300, k: 3500, color: "#10b981", goal: "DIABETES_DIET", dx: "DM", icon: "utensils" },
  { name: "Diabetes 2000 kcal", desc: "PERKENI standar 2000 kcal", cal: 2000, p: 20, c: 50, f: 30, fiber: 25, na: 2300, k: 3500, color: "#10b981", goal: "DIABETES_DIET", dx: "DM", icon: "utensils" },
  { name: "Hipertensi (DASH)", desc: "DASH diet, natrium <1500mg, kalium tinggi", cal: 2000, p: 18, c: 55, f: 27, fiber: 30, na: 1500, k: 4700, color: "#06b6d4", goal: "HYPERTENSION_DIET", dx: "HT", icon: "heart" },
  { name: "CKD Non-Dialisis", desc: "KDIGO protein 0.6 g/kg, batas K & P", cal: 2000, p: 12, c: 60, f: 28, fiber: 20, na: 2000, k: 2000, color: "#8b5cf6", goal: "CKD_DIET", dx: "CKD_ND", icon: "droplet" },
  { name: "CKD Dialisis (HD)", desc: "HD protein 1.2 g/kg, pantau cairan", cal: 2200, p: 18, c: 50, f: 32, fiber: 20, na: 2000, k: 2500, color: "#8b5cf6", goal: "CKD_DIET", dx: "CKD_HD", icon: "droplet" },
  { name: "CHF (Gagal Jantung)", desc: "ESPEN: batasi natrium & cairan", cal: 1800, p: 20, c: 55, f: 25, fiber: 25, na: 2000, k: 3500, color: "#ef4444", goal: "GENERAL", dx: "CHF", icon: "heart" },
  { name: "Obesitas (Defisit)", desc: "Defisit 500-750 kcal, protein tinggi", cal: 1500, p: 25, c: 45, f: 30, fiber: 30, na: 2300, k: 3500, color: "#f59e0b", goal: "WEIGHT_LOSS", dx: "OBESITY", icon: "trending-down" },
  { name: "Malnutrisi (Refeeding)", desc: "ESPEN: naikkan bertahap, thiamin", cal: 1800, p: 20, c: 55, f: 25, fiber: 20, na: 2300, k: 3500, color: "#f97316", goal: "WEIGHT_GAIN", dx: "MALNUTRITION", icon: "trending-up" },
  { name: "Paliatif", desc: "Nutrisi simtomatik, kualitas hidup", cal: 1600, p: 18, c: 55, f: 27, fiber: 20, na: 2300, k: 3000, color: "#64748b", goal: "GENERAL", dx: "OTHER", icon: "heart" },
  { name: "Geriatrik", desc: "ESPEN Older: protein 1.2 g/kg, vitD", cal: 1800, p: 22, c: 50, f: 28, fiber: 25, na: 2000, k: 3500, color: "#0ea5e9", goal: "GENERAL", dx: "GERIATRIC", icon: "user" },
  { name: "Kehamilan T2-T3", desc: "WHO: +340-450 kcal, folat, Fe, Ca", cal: 2200, p: 20, c: 55, f: 25, fiber: 28, na: 2300, k: 4700, color: "#ec4899", goal: "WEIGHT_GAIN", dx: "PREGNANCY", icon: "baby" },
  { name: "Laktasi", desc: "WHO: +500 kcal, cairan ≥3L, DHA", cal: 2500, p: 20, c: 55, f: 25, fiber: 28, na: 2300, k: 4700, color: "#ec4899", goal: "GENERAL", dx: "LACTATION", icon: "baby" },
  { name: "Atlet", desc: "Tinggi karbo 60%, protein 1.6 g/kg", cal: 3000, p: 20, c: 60, f: 20, fiber: 30, na: 2300, k: 4000, color: "#22c55e", goal: "GENERAL", dx: "OTHER", icon: "activity" },
];

async function main() {
  console.log("Seeding nutrition preset templates...");
  let count = 0;
  for (const t of TEMPLATES) {
    const existing = await db.nutritionPreset.findFirst({
      where: { name: t.name, isTemplate: true },
    });
    if (existing) {
      console.log(`  ✓ exists: ${t.name}`);
      continue;
    }
    const grams = computeGrams(t.cal, t.p, t.c, t.f);
    await db.nutritionPreset.create({
      data: {
        name: t.name,
        description: t.desc,
        color: t.color,
        icon: t.icon,
        isTemplate: true,
        totalCal: t.cal,
        proteinPct: t.p,
        carbPct: t.c,
        fatPct: t.f,
        proteinG: grams.proteinG,
        carbG: grams.carbG,
        fatG: grams.fatG,
        fiberG: t.fiber,
        sodiumMg: t.na,
        potassiumMg: t.k,
        fluidMl: t.cal * 1.2,
        goal: t.goal as any,
        diagnoses: t.dx,
        version: 1,
        createdBy: "system",
        updatedBy: "system",
      },
    });
    count++;
    console.log(`  + created: ${t.name}`);
  }
  console.log(`Done. Seeded ${count} new templates.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
