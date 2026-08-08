// Seed sample clinical recipes for demo
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function findFood(name: string) {
  const f = await db.food.findFirst({ where: { name } });
  if (!f) console.warn(`  ! food not found: ${name}`);
  return f;
}

const RECIPES = [
  {
    name: "Nasi Tim Ayam Bayam",
    description: "Nasi tim dengan ayam suwir dan bayam — cocok untuk DM & lansia",
    servings: 1,
    method: "1. Kukus beras merah hingga matang\n2. Rebus ayam dada, suwir-suwir\n3. Tumis bawang, masukkan bayam\n4. Campur nasi, ayam, bayam\n5. Sajikan hangat",
    items: [
      { name: "Beras merah (masak)", amount: 150 },
      { name: "Daging ayam (dada, tanpa kulit)", amount: 80 },
      { name: "Bayam (rebus)", amount: 100 },
    ],
  },
  {
    name: "Sup Ikan Kembung Tomat",
    description: "Sup ikan kembung dengan tomat — tinggi protein, rendah lemak",
    servings: 2,
    method: "1. Rebus air dengan bawang merah & jahe\n2. Masukkan ikan kembung, masak 10 menit\n3. Tambahkan tomat, masak 5 menit\n4. Bumbui garam secukupnya\n5. Sajikan hangat",
    items: [
      { name: "Ikan kembung", amount: 200 },
      { name: "Tomat (mentah)", amount: 100 },
      { name: "Bawang merah", amount: 20 },
    ],
  },
  {
    name: "Tahu Tempe Bumbu Kecap",
    description: "Tahu tempe bumbu kecap — sumber protein nabati tinggi",
    servings: 2,
    method: "1. Potong tahu & tempe dadu\n2. Tumis bumbu (bawang putih, jahe)\n3. Masukkan tahu tempe, aduk\n4. Tambahkan kecap manis, sedikit garam\n5. Masak hingga bumbu meresap",
    items: [
      { name: "Tahu putih", amount: 150 },
      { name: "Tempe", amount: 100 },
      { name: "Bawang putih", amount: 10 },
    ],
  },
  {
    name: "Bubur Oat Pisang",
    description: "Bubur oat dengan pisang — sarapan tinggi serat untuk DM",
    servings: 1,
    method: "1. Masak oatmeal dengan air/susu\n2. Tambahkan pisang potong\n3. Aduk rata, sajikan hangat",
    items: [
      { name: "Oatmeal (masak)", amount: 200 },
      { name: "Pisang ambon", amount: 120 },
    ],
  },
  {
    name: "Sayur Bening Bayam Jagung",
    description: "Sayur bening — rendah kalori, tinggi serat & vitamin",
    servings: 3,
    method: "1. Rebus air dengan bawang merah\n2. Masukkan jagung, masak 10 menit\n3. Tambahkan bayam, masak 2 menit\n4. Bumbui garam secukupnya",
    items: [
      { name: "Bayam (rebus)", amount: 150 },
      { name: "Jagung manis rebus", amount: 100 },
      { name: "Bawang merah", amount: 15 },
    ],
  },
  {
    name: "Salad Apel Alpukat",
    description: "Salad buah sehat — tinggi serat & lemak tak jenuh",
    servings: 1,
    method: "1. Potong apel & alpukat dadu\n2. Campur dengan yogurt\n3. Sajikan dingin",
    items: [
      { name: "Apel (mentah)", amount: 150 },
      { name: "Alpukat", amount: 100 },
      { name: "Yogurt plain", amount: 100 },
    ],
  },
];

async function main() {
  console.log("Seeding sample recipes...");
  let count = 0;
  for (const r of RECIPES) {
    const existing = await db.recipe.findFirst({ where: { name: r.name } });
    if (existing) {
      console.log(`  ✓ exists: ${r.name}`);
      continue;
    }
    // Resolve food IDs
    const items: { foodId: string; amount: number }[] = [];
    for (const it of r.items) {
      const food = await findFood(it.name);
      if (!food) break;
      items.push({ foodId: food.id, amount: it.amount });
    }
    if (items.length !== r.items.length) {
      console.log(`  ! skipping ${r.name} (missing foods)`);
      continue;
    }
    await db.recipe.create({
      data: {
        name: r.name,
        description: r.description,
        servings: r.servings,
        method: r.method,
        items: { create: items },
      },
    });
    count++;
    console.log(`  + created: ${r.name}`);
  }
  console.log(`Done. Seeded ${count} recipes.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
