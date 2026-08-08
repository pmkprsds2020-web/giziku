// =====================================================================
// CareLivia — Food Database Seeder
// TKPI (Daftar Komposisi Bahan Makanan) & DKBM inspired.
// Run with: bun run scripts/seed-foods.ts
// =====================================================================

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface SeedFood {
  name: string;
  category: string;
  energy: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
  potassium: number;
  calcium: number;
  iron: number;
  phosphorus: number;
  zinc: number;
  vitA: number;
  vitC: number;
  vitB1: number;
  gi: number;
  urt?: string;
  urtGram?: number;
  bdd?: number;
  price: number;
  tags?: string;
}

const CATEGORIES = [
  { name: "Serealia & Produk", slug: "serealia", icon: "🌾" },
  { name: "Umbi & Akar", slug: "umbi", icon: "🥔" },
  { name: "Daging & Unggas", slug: "daging", icon: "🍗" },
  { name: "Ikan & Seafood", slug: "ikan", icon: "🐟" },
  { name: "Telur", slug: "telur", icon: "🥚" },
  { name: "Susu & Produk", slug: "susu", icon: "🥛" },
  { name: "Kacang-kacangan", slug: "kacang", icon: "🫘" },
  { name: "Sayuran", slug: "sayur", icon: "🥬" },
  { name: "Buah", slug: "buah", icon: "🍎" },
  { name: "Minyak & Lemak", slug: "lemak", icon: "🫒" },
  { name: "Gula & Manisan", slug: "gula", icon: "🍯" },
  { name: "Bumbu & Rempah", slug: "bumbu", icon: "🧄" },
  { name: "Minuman", slug: "minuman", icon: "🥤" },
];

const FOODS: SeedFood[] = [
  { name: "Beras putih (masak)", category: "Serealia & Produk", energy: 175, protein: 3.5, fat: 0.5, carb: 39, fiber: 0.6, sodium: 5, potassium: 40, calcium: 10, iron: 0.4, phosphorus: 50, zinc: 0.6, vitA: 0, vitC: 0, vitB1: 0.02, gi: 73, urt: "1 mangkuk sedang", urtGram: 150, price: 400, tags: "karbo,tinggi-gi" },
  { name: "Beras merah (masak)", category: "Serealia & Produk", energy: 165, protein: 4.0, fat: 1.2, carb: 35, fiber: 2.8, sodium: 5, potassium: 90, calcium: 10, iron: 0.5, phosphorus: 80, zinc: 0.9, vitA: 0, vitC: 0, vitB1: 0.1, gi: 50, urt: "1 mangkuk sedang", urtGram: 150, price: 800, tags: "karbo,rendah-gi,serat" },
  { name: "Roti putih", category: "Serealia & Produk", energy: 265, protein: 9, fat: 3.2, carb: 49, fiber: 2.7, sodium: 490, potassium: 110, calcium: 80, iron: 3.6, phosphorus: 90, zinc: 0.9, vitA: 0, vitC: 0, vitB1: 0.4, gi: 70, urt: "1 lembar", urtGram: 40, price: 500, tags: "karbo" },
  { name: "Roti gandum utuh", category: "Serealia & Produk", energy: 247, protein: 13, fat: 3.4, carb: 41, fiber: 7, sodium: 400, potassium: 220, calcium: 90, iron: 2.5, phosphorus: 180, zinc: 1.5, vitA: 0, vitC: 0, vitB1: 0.5, gi: 50, urt: "1 lembar", urtGram: 40, price: 700, tags: "karbo,serat,rendah-gi" },
  { name: "Oatmeal (masak)", category: "Serealia & Produk", energy: 71, protein: 2.5, fat: 1.5, carb: 12, fiber: 1.7, sodium: 2, potassium: 70, calcium: 10, iron: 0.9, phosphorus: 80, zinc: 0.7, vitA: 0, vitC: 0, vitB1: 0.1, gi: 55, urt: "1 mangkuk", urtGram: 200, price: 600, tags: "karbo,serat,rendah-gi" },
  { name: "Mi instan", category: "Serealia & Produk", energy: 380, protein: 8, fat: 15, carb: 55, fiber: 2, sodium: 800, potassium: 120, calcium: 30, iron: 2.5, phosphorus: 100, zinc: 0.8, vitA: 0, vitC: 0, vitB1: 0.1, gi: 55, urt: "1 bungkus", urtGram: 85, price: 350, tags: "karbo,tinggi-natrium" },
  { name: "Jagung manis rebus", category: "Serealia & Produk", energy: 96, protein: 3.4, fat: 1.5, carb: 21, fiber: 2.4, sodium: 15, potassium: 270, calcium: 2, iron: 0.5, phosphorus: 90, zinc: 0.5, vitA: 30, vitC: 6, vitB1: 0.2, gi: 52, urt: "1 buah sedang", urtGram: 100, price: 500, tags: "karbo,serat" },
  { name: "Bubur beras", category: "Serealia & Produk", energy: 60, protein: 1.2, fat: 0.2, carb: 13, fiber: 0.3, sodium: 3, potassium: 20, calcium: 5, iron: 0.2, phosphorus: 20, zinc: 0.2, vitA: 0, vitC: 0, vitB1: 0.01, gi: 78, urt: "1 mangkuk", urtGram: 200, price: 300, tags: "karbo,tinggi-gi" },
  { name: "Kentang rebus", category: "Umbi & Akar", energy: 87, protein: 1.9, fat: 0.1, carb: 20, fiber: 1.8, sodium: 5, potassium: 379, calcium: 10, iron: 0.3, phosphorus: 44, zinc: 0.3, vitA: 0, vitC: 13, vitB1: 0.1, gi: 78, urt: "1 buah sedang", urtGram: 150, price: 400, tags: "karbo,tinggi-kalium" },
  { name: "Ubi jalar rebus", category: "Umbi & Akar", energy: 90, protein: 1.6, fat: 0.1, carb: 21, fiber: 2.5, sodium: 18, potassium: 230, calcium: 28, iron: 0.5, phosphorus: 38, zinc: 0.3, vitA: 700, vitC: 15, vitB1: 0.1, gi: 63, urt: "1 buah sedang", urtGram: 130, price: 400, tags: "karbo,vit-a" },
  { name: "Singkong rebus", category: "Umbi & Akar", energy: 112, protein: 0.9, fat: 0.2, carb: 27, fiber: 1.0, sodium: 14, potassium: 220, calcium: 30, iron: 0.4, phosphorus: 28, zinc: 0.3, vitA: 5, vitC: 15, vitB1: 0.05, gi: 46, urt: "1 potong", urtGram: 150, price: 300, tags: "karbo,rendah-gi" },
  { name: "Talas rebus", category: "Umbi & Akar", energy: 142, protein: 1.5, fat: 0.2, carb: 34, fiber: 4, sodium: 11, potassium: 560, calcium: 33, iron: 0.6, phosphorus: 80, zinc: 0.5, vitA: 4, vitC: 8, vitB1: 0.1, gi: 53, urt: "1 potong", urtGram: 100, price: 300, tags: "karbo,serat" },
  { name: "Daging ayam (dada, tanpa kulit)", category: "Daging & Unggas", energy: 165, protein: 31, fat: 3.6, carb: 0, fiber: 0, sodium: 74, potassium: 256, calcium: 15, iron: 1, phosphorus: 210, zinc: 1, vitA: 6, vitC: 0, vitB1: 0.07, gi: 0, urt: "1 potong sedang", urtGram: 100, price: 2500, tags: "protein,lean" },
  { name: "Daging ayam (paha, dengan kulit)", category: "Daging & Unggas", energy: 209, protein: 26, fat: 11, carb: 0, fiber: 0, sodium: 86, potassium: 220, calcium: 14, iron: 0.9, phosphorus: 170, zinc: 1.4, vitA: 22, vitC: 0, vitB1: 0.08, gi: 0, urt: "1 potong", urtGram: 100, price: 2200, tags: "protein" },
  { name: "Daging sapi (tanpa lemak)", category: "Daging & Unggas", energy: 217, protein: 26, fat: 12, carb: 0, fiber: 0, sodium: 56, potassium: 318, calcium: 8, iron: 2.6, phosphorus: 200, zinc: 5, vitA: 0, vitC: 0, vitB1: 0.07, gi: 0, urt: "1 potong sedang", urtGram: 100, price: 3500, tags: "protein,besi,seng" },
  { name: "Daging kambing", category: "Daging & Unggas", energy: 294, protein: 25, fat: 21, carb: 0, fiber: 0, sodium: 82, potassium: 270, calcium: 12, iron: 2.4, phosphorus: 180, zinc: 4, vitA: 0, vitC: 0, vitB1: 0.1, gi: 0, urt: "1 potong", urtGram: 100, price: 4000, tags: "protein" },
  { name: "Hati ayam", category: "Daging & Unggas", energy: 119, protein: 17, fat: 4.5, carb: 0.7, fiber: 0, sodium: 76, potassium: 240, calcium: 10, iron: 9, phosphorus: 220, zinc: 2.5, vitA: 3300, vitC: 18, vitB1: 0.2, gi: 0, urt: "1 potong", urtGram: 40, price: 1500, tags: "protein,vit-a,besi,kolesterol" },
  { name: "Ikan lele (goreng)", category: "Ikan & Seafood", energy: 196, protein: 18, fat: 12, carb: 4, fiber: 0, sodium: 80, potassium: 280, calcium: 50, iron: 1, phosphorus: 200, zinc: 0.7, vitA: 20, vitC: 0, vitB1: 0.1, gi: 0, urt: "1 ekor kecil", urtGram: 100, price: 2000, tags: "protein" },
  { name: "Ikan salmon", category: "Ikan & Seafood", energy: 208, protein: 20, fat: 13, carb: 0, fiber: 0, sodium: 59, potassium: 363, calcium: 9, iron: 0.3, phosphorus: 200, zinc: 0.6, vitA: 12, vitC: 0, vitB1: 0.2, gi: 0, urt: "1 potong", urtGram: 100, price: 15000, tags: "protein,omega-3" },
  { name: "Ikan tuna (segar)", category: "Ikan & Seafood", energy: 132, protein: 28, fat: 1, carb: 0, fiber: 0, sodium: 50, potassium: 350, calcium: 4, iron: 1, phosphorus: 220, zinc: 0.6, vitA: 20, vitC: 0, vitB1: 0.2, gi: 0, urt: "1 potong", urtGram: 100, price: 8000, tags: "protein,lean,omega-3" },
  { name: "Ikan kembung", category: "Ikan & Seafood", energy: 112, protein: 20, fat: 3, carb: 0, fiber: 0, sodium: 70, potassium: 320, calcium: 30, iron: 1, phosphorus: 200, zinc: 0.6, vitA: 30, vitC: 0, vitB1: 0.1, gi: 0, urt: "1 ekor", urtGram: 100, price: 3000, tags: "protein,omega-3" },
  { name: "Udang rebus", category: "Ikan & Seafood", energy: 99, protein: 24, fat: 0.3, carb: 0.2, fiber: 0, sodium: 111, potassium: 260, calcium: 70, iron: 0.5, phosphorus: 200, zinc: 1.3, vitA: 50, vitC: 0, vitB1: 0.03, gi: 0, urt: "5 ekor", urtGram: 80, price: 6000, tags: "protein,lean,kolesterol" },
  { name: "Cumi-cumi", category: "Ikan & Seafood", energy: 92, protein: 16, fat: 1.4, carb: 3, fiber: 0, sodium: 110, potassium: 250, calcium: 32, iron: 0.7, phosphorus: 180, zinc: 1.5, vitA: 20, vitC: 8, vitB1: 0.02, gi: 0, urt: "1 ekor", urtGram: 100, price: 5000, tags: "protein,kolesterol" },
  { name: "Telur ayam (utuh, rebus)", category: "Telur", energy: 155, protein: 13, fat: 11, carb: 1.1, fiber: 0, sodium: 124, potassium: 126, calcium: 50, iron: 1.2, phosphorus: 210, zinc: 1.1, vitA: 180, vitC: 0, vitB1: 0.07, gi: 0, urt: "1 butir", urtGram: 50, price: 600, tags: "protein,kuning" },
  { name: "Putih telur (rebus)", category: "Telur", energy: 52, protein: 11, fat: 0.2, carb: 0.7, fiber: 0, sodium: 166, potassium: 163, calcium: 6, iron: 0.1, phosphorus: 15, zinc: 0.05, vitA: 0, vitC: 0, vitB1: 0, gi: 0, urt: "1 butir", urtGram: 33, price: 400, tags: "protein,lean" },
  { name: "Telur bebek (rebus)", category: "Telur", energy: 185, protein: 13, fat: 14, carb: 1, fiber: 0, sodium: 144, potassium: 145, calcium: 60, iron: 3, phosphorus: 220, zinc: 1.3, vitA: 350, vitC: 0, vitB1: 0.1, gi: 0, urt: "1 butir", urtGram: 70, price: 1200, tags: "protein,kuning" },
  { name: "Susu sapi full cream", category: "Susu & Produk", energy: 61, protein: 3.2, fat: 3.4, carb: 4.8, fiber: 0, sodium: 44, potassium: 150, calcium: 115, iron: 0.1, phosphorus: 90, zinc: 0.4, vitA: 28, vitC: 1, vitB1: 0.04, gi: 31, urt: "1 gelas", urtGram: 250, price: 1000, tags: "protein,kalsium" },
  { name: "Susu skim", category: "Susu & Produk", energy: 34, protein: 3.4, fat: 0.1, carb: 5, fiber: 0, sodium: 50, potassium: 160, calcium: 122, iron: 0.1, phosphorus: 95, zinc: 0.4, vitA: 5, vitC: 1, vitB1: 0.04, gi: 32, urt: "1 gelas", urtGram: 250, price: 1200, tags: "protein,kalsium,lean" },
  { name: "Yogurt plain", category: "Susu & Produk", energy: 59, protein: 10, fat: 0.4, carb: 3.6, fiber: 0, sodium: 36, potassium: 140, calcium: 110, iron: 0.1, phosphorus: 90, zinc: 0.4, vitA: 5, vitC: 1, vitB1: 0.04, gi: 35, urt: "1 cup", urtGram: 150, price: 2000, tags: "probiotik,kalsium" },
  { name: "Keju cheddar", category: "Susu & Produk", energy: 403, protein: 25, fat: 33, carb: 1.3, fiber: 0, sodium: 621, potassium: 98, calcium: 721, iron: 0.7, phosphorus: 510, zinc: 3.1, vitA: 265, vitC: 0, vitB1: 0.03, gi: 0, urt: "1 iris", urtGram: 30, price: 3000, tags: "kalsium,tinggi-natrium,lemak" },
  { name: "Tahu putih", category: "Susu & Produk", energy: 76, protein: 8, fat: 4.8, carb: 1.9, fiber: 0.4, sodium: 7, potassium: 121, calcium: 138, iron: 1.5, phosphorus: 130, zinc: 0.8, vitA: 0, vitC: 0.1, vitB1: 0.04, gi: 15, urt: "1 potong", urtGram: 110, price: 500, tags: "protein,nabati,kalsium" },
  { name: "Tempe", category: "Susu & Produk", energy: 192, protein: 19, fat: 7.6, carb: 9, fiber: 4, sodium: 7, potassium: 230, calcium: 90, iron: 2, phosphorus: 200, zinc: 1.4, vitA: 0, vitC: 0, vitB1: 0.1, gi: 15, urt: "1 potong", urtGram: 100, price: 600, tags: "protein,nabati,serat,probiotik" },
  { name: "Kacang kedelai (kering)", category: "Kacang-kacangan", energy: 446, protein: 36, fat: 20, carb: 30, fiber: 9, sodium: 2, potassium: 1797, calcium: 277, iron: 16, phosphorus: 700, zinc: 4, vitA: 2, vitC: 6, vitB1: 0.9, gi: 18, urt: "1 mangkuk", urtGram: 100, price: 2000, tags: "protein,nabati,besi" },
  { name: "Kacang merah (rebus)", category: "Kacang-kacangan", energy: 127, protein: 9, fat: 0.5, carb: 23, fiber: 6.4, sodium: 1, potassium: 405, calcium: 50, iron: 2.9, phosphorus: 140, zinc: 1, vitA: 0, vitC: 1, vitB1: 0.2, gi: 24, urt: "1 mangkuk", urtGram: 170, price: 1500, tags: "serat,protein,serat-larut" },
  { name: "Kacang hijau (rebus)", category: "Kacang-kacangan", energy: 105, protein: 7, fat: 0.4, carb: 19, fiber: 7.6, sodium: 1, potassium: 387, calcium: 27, iron: 1.4, phosphorus: 100, zinc: 0.8, vitA: 6, vitC: 1, vitB1: 0.1, gi: 31, urt: "1 mangkuk", urtGram: 200, price: 1200, tags: "serat,protein" },
  { name: "Kacang tanah (goreng)", category: "Kacang-kacangan", energy: 585, protein: 24, fat: 50, carb: 16, fiber: 8, sodium: 18, potassium: 690, calcium: 62, iron: 2.3, phosphorus: 350, zinc: 3, vitA: 0, vitC: 0, vitB1: 0.4, gi: 14, urt: "1 genggam", urtGram: 30, price: 800, tags: "lemak,protein" },
  { name: "Almond", category: "Kacang-kacangan", energy: 579, protein: 21, fat: 50, carb: 22, fiber: 12, sodium: 1, potassium: 733, calcium: 269, iron: 3.7, phosphorus: 481, zinc: 3.1, vitA: 0, vitC: 0, vitB1: 0.2, gi: 15, urt: "1 genggam", urtGram: 28, price: 5000, tags: "lemak-sehat,serat,kalsium" },
  { name: "Kacang mete", category: "Kacang-kacangan", energy: 553, protein: 18, fat: 44, carb: 30, fiber: 3.3, sodium: 12, potassium: 660, calcium: 37, iron: 6.7, phosphorus: 593, zinc: 5.8, vitA: 0, vitC: 0.5, vitB1: 0.4, gi: 25, urt: "1 genggam", urtGram: 28, price: 6000, tags: "lemak-sehat,besi" },
  { name: "Bayam (rebus)", category: "Sayuran", energy: 23, protein: 2.9, fat: 0.4, carb: 3.8, fiber: 2.4, sodium: 79, potassium: 466, calcium: 136, iron: 3.6, phosphorus: 49, zinc: 0.5, vitA: 749, vitC: 18, vitB1: 0.06, gi: 15, urt: "1 mangkuk", urtGram: 150, price: 300, tags: "sayur,vit-a,besi,kalium" },
  { name: "Kangkung (rebus)", category: "Sayuran", energy: 19, protein: 2.6, fat: 0.2, carb: 3.1, fiber: 2.1, sodium: 46, potassium: 220, calcium: 80, iron: 2.5, phosphorus: 40, zinc: 0.4, vitA: 600, vitC: 25, vitB1: 0.05, gi: 15, urt: "1 piring", urtGram: 150, price: 300, tags: "sayur,vit-a" },
  { name: "Wortel (rebus)", category: "Sayuran", energy: 35, protein: 0.8, fat: 0.2, carb: 8, fiber: 3, sodium: 58, potassium: 235, calcium: 30, iron: 0.3, phosphorus: 30, zinc: 0.2, vitA: 852, vitC: 5, vitB1: 0.06, gi: 39, urt: "1 buah sedang", urtGram: 80, price: 400, tags: "sayur,vit-a,rendah-gi" },
  { name: "Brokoli (rebus)", category: "Sayuran", energy: 35, protein: 2.4, fat: 0.4, carb: 7, fiber: 3.3, sodium: 41, potassium: 293, calcium: 40, iron: 0.7, phosphorus: 67, zinc: 0.4, vitA: 60, vitC: 64, vitB1: 0.06, gi: 15, urt: "1 mangkuk", urtGram: 150, price: 800, tags: "sayur,vit-c,serat" },
  { name: "Buncis (rebus)", category: "Sayuran", energy: 35, protein: 1.9, fat: 0.3, carb: 8, fiber: 2.7, sodium: 6, potassium: 209, calcium: 37, iron: 1, phosphorus: 39, zinc: 0.2, vitA: 35, vitC: 9, vitB1: 0.08, gi: 15, urt: "1 piring", urtGram: 150, price: 500, tags: "sayur,serat" },
  { name: "Kubis (mentah)", category: "Sayuran", energy: 25, protein: 1.3, fat: 0.1, carb: 6, fiber: 2.5, sodium: 18, potassium: 170, calcium: 40, iron: 0.5, phosphorus: 26, zinc: 0.2, vitA: 5, vitC: 36, vitB1: 0.06, gi: 15, urt: "1 mangkuk", urtGram: 100, price: 400, tags: "sayur,vit-c,rendah-kalium" },
  { name: "Sawi hijau (rebus)", category: "Sayuran", energy: 22, protein: 2.7, fat: 0.3, carb: 3.5, fiber: 2.1, sodium: 46, potassium: 220, calcium: 105, iron: 2.6, phosphorus: 45, zinc: 0.3, vitA: 510, vitC: 50, vitB1: 0.05, gi: 15, urt: "1 piring", urtGram: 150, price: 400, tags: "sayur,vit-a,kalsium" },
  { name: "Tomat (mentah)", category: "Sayuran", energy: 18, protein: 0.9, fat: 0.2, carb: 3.9, fiber: 1.2, sodium: 5, potassium: 237, calcium: 10, iron: 0.3, phosphorus: 24, zinc: 0.2, vitA: 42, vitC: 14, vitB1: 0.04, gi: 30, urt: "1 buah sedang", urtGram: 100, price: 500, tags: "sayur,vit-c,kalium" },
  { name: "Timun (mentah)", category: "Sayuran", energy: 15, protein: 0.7, fat: 0.1, carb: 3.6, fiber: 0.5, sodium: 2, potassium: 147, calcium: 16, iron: 0.3, phosphorus: 24, zinc: 0.2, vitA: 5, vitC: 2.8, vitB1: 0.03, gi: 15, urt: "1 buah sedang", urtGram: 100, price: 400, tags: "sayur,rendah-kalori" },
  { name: "Labu siam (rebus)", category: "Sayuran", energy: 19, protein: 0.8, fat: 0.1, carb: 4.5, fiber: 1.7, sodium: 1, potassium: 120, calcium: 14, iron: 0.3, phosphorus: 18, zinc: 0.2, vitA: 3, vitC: 7, vitB1: 0.03, gi: 15, urt: "1 buah", urtGram: 150, price: 300, tags: "sayur,rendah-kalium" },
  { name: "Terong (rebus)", category: "Sayuran", energy: 25, protein: 1, fat: 0.2, carb: 6, fiber: 2.5, sodium: 1, potassium: 123, calcium: 9, iron: 0.2, phosphorus: 21, zinc: 0.1, vitA: 1, vitC: 2.2, vitB1: 0.04, gi: 15, urt: "1 buah", urtGram: 100, price: 400, tags: "sayur,serat" },
  { name: "Jamur tiram", category: "Sayuran", energy: 34, protein: 3.3, fat: 0.3, carb: 6.2, fiber: 2.1, sodium: 9, potassium: 320, calcium: 4, iron: 0.5, phosphorus: 80, zinc: 0.5, vitA: 0, vitC: 0, vitB1: 0.1, gi: 15, urt: "1 mangkuk", urtGram: 100, price: 800, tags: "sayur,protein" },
  { name: "Pisang ambon", category: "Buah", energy: 89, protein: 1.1, fat: 0.3, carb: 23, fiber: 2.6, sodium: 1, potassium: 358, calcium: 5, iron: 0.3, phosphorus: 22, zinc: 0.2, vitA: 3, vitC: 8.7, vitB1: 0.03, gi: 51, urt: "1 buah sedang", urtGram: 120, price: 500, tags: "buah,tinggi-kalium,karbo" },
  { name: "Apel (mentah)", category: "Buah", energy: 52, protein: 0.3, fat: 0.2, carb: 14, fiber: 2.4, sodium: 1, potassium: 107, calcium: 6, iron: 0.1, phosphorus: 11, zinc: 0.04, vitA: 3, vitC: 4.6, vitB1: 0.02, gi: 38, urt: "1 buah sedang", urtGram: 180, price: 1500, tags: "buah,serat,rendah-kalium" },
  { name: "Jeruk manis", category: "Buah", energy: 47, protein: 0.9, fat: 0.1, carb: 12, fiber: 2.4, sodium: 0, potassium: 181, calcium: 40, iron: 0.1, phosphorus: 14, zinc: 0.1, vitA: 30, vitC: 53, vitB1: 0.1, gi: 40, urt: "1 buah sedang", urtGram: 130, price: 800, tags: "buah,vit-c" },
  { name: "Pepaya matang", category: "Buah", energy: 43, protein: 0.5, fat: 0.3, carb: 11, fiber: 1.7, sodium: 8, potassium: 182, calcium: 20, iron: 0.3, phosphorus: 10, zinc: 0.1, vitA: 1094, vitC: 62, vitB1: 0.04, gi: 60, urt: "1 potong", urtGram: 150, price: 600, tags: "buah,vit-a,vit-c" },
  { name: "Mangga matang", category: "Buah", energy: 60, protein: 0.8, fat: 0.4, carb: 15, fiber: 1.6, sodium: 1, potassium: 168, calcium: 11, iron: 0.2, phosphorus: 14, zinc: 0.1, vitA: 1082, vitC: 36, vitB1: 0.03, gi: 51, urt: "1 buah sedang", urtGram: 200, price: 1500, tags: "buah,vit-a" },
  { name: "Semangka", category: "Buah", energy: 30, protein: 0.6, fat: 0.2, carb: 8, fiber: 0.4, sodium: 1, potassium: 112, calcium: 7, iron: 0.2, phosphorus: 11, zinc: 0.1, vitA: 569, vitC: 8, vitB1: 0.03, gi: 76, urt: "1 irisan", urtGram: 150, price: 600, tags: "buah,rendah-kalori,tinggi-gi" },
  { name: "Melon", category: "Buah", energy: 34, protein: 0.8, fat: 0.2, carb: 8, fiber: 0.9, sodium: 16, potassium: 267, calcium: 9, iron: 0.2, phosphorus: 15, zinc: 0.1, vitA: 3382, vitC: 36, vitB1: 0.04, gi: 70, urt: "1 irisan", urtGram: 150, price: 700, tags: "buah,vit-a" },
  { name: "Alpukat", category: "Buah", energy: 160, protein: 2, fat: 15, carb: 9, fiber: 7, sodium: 7, potassium: 485, calcium: 12, iron: 0.6, phosphorus: 52, zinc: 0.6, vitA: 7, vitC: 10, vitB1: 0.07, gi: 15, urt: "1 buah kecil", urtGram: 150, price: 2500, tags: "buah,lemak-sehat,serat,kalium" },
  { name: "Strawberry", category: "Buah", energy: 32, protein: 0.7, fat: 0.3, carb: 7.7, fiber: 2, sodium: 1, potassium: 153, calcium: 16, iron: 0.4, phosphorus: 24, zinc: 0.1, vitA: 1, vitC: 59, vitB1: 0.02, gi: 41, urt: "1 mangkuk", urtGram: 150, price: 3000, tags: "buah,vit-c" },
  { name: "Nanas", category: "Buah", energy: 50, protein: 0.5, fat: 0.1, carb: 13, fiber: 1.4, sodium: 1, potassium: 109, calcium: 13, iron: 0.3, phosphorus: 8, zinc: 0.1, vitA: 3, vitC: 48, vitB1: 0.08, gi: 59, urt: "1 irisan", urtGram: 150, price: 800, tags: "buah,vit-c" },
  { name: "Minyak kelapa sawit", category: "Minyak & Lemak", energy: 884, protein: 0, fat: 100, carb: 0, fiber: 0, sodium: 0, potassium: 0, calcium: 0, iron: 0, phosphorus: 0, zinc: 0, vitA: 0, vitC: 0, vitB1: 0, gi: 0, urt: "1 sdm", urtGram: 14, price: 200, tags: "lemak-jenuh" },
  { name: "Minyak zaitun", category: "Minyak & Lemak", energy: 884, protein: 0, fat: 100, carb: 0, fiber: 0, sodium: 2, potassium: 1, calcium: 1, iron: 0.6, phosphorus: 0, zinc: 0, vitA: 0, vitC: 0, vitB1: 0, gi: 0, urt: "1 sdm", urtGram: 14, price: 2000, tags: "lemak-tak-jenuh" },
  { name: "Mentega", category: "Minyak & Lemak", energy: 717, protein: 0.9, fat: 81, carb: 0.1, fiber: 0, sodium: 11, potassium: 24, calcium: 24, iron: 0, phosphorus: 24, zinc: 0.1, vitA: 684, vitC: 0, vitB1: 0, gi: 0, urt: "1 sdm", urtGram: 14, price: 1500, tags: "lemak-jenuh" },
  { name: "Kelapa parut", category: "Minyak & Lemak", energy: 354, protein: 3.3, fat: 33, carb: 15, fiber: 9, sodium: 20, potassium: 325, calcium: 14, iron: 2.4, phosphorus: 90, zinc: 1.1, vitA: 0, vitC: 3, vitB1: 0.06, gi: 15, urt: "1 mangkuk", urtGram: 80, price: 500, tags: "lemak,serat" },
  { name: "Gula pasir", category: "Gula & Manisan", energy: 387, protein: 0, fat: 0, carb: 100, fiber: 0, sodium: 1, potassium: 2, calcium: 1, iron: 0, phosphorus: 2, zinc: 0, vitA: 0, vitC: 0, vitB1: 0, gi: 65, urt: "1 sdm", urtGram: 12, price: 100, tags: "gula,tinggi-gi" },
  { name: "Madu", category: "Gula & Manisan", energy: 304, protein: 0.3, fat: 0, carb: 82, fiber: 0.2, sodium: 4, potassium: 52, calcium: 6, iron: 0.4, phosphorus: 4, zinc: 0.2, vitA: 0, vitC: 0.5, vitB1: 0, gi: 58, urt: "1 sdm", urtGram: 21, price: 500, tags: "gula" },
  { name: "Bawang putih", category: "Bumbu & Rempah", energy: 149, protein: 6.4, fat: 0.5, carb: 33, fiber: 2.1, sodium: 17, potassium: 401, calcium: 181, iron: 1.7, phosphorus: 153, zinc: 1.2, vitA: 0, vitC: 31, vitB1: 0.2, gi: 30, urt: "1 siung", urtGram: 5, price: 200, tags: "bumbu" },
  { name: "Bawang merah", category: "Bumbu & Rempah", energy: 40, protein: 1.1, fat: 0.1, carb: 9, fiber: 1.7, sodium: 4, potassium: 146, calcium: 23, iron: 0.2, phosphorus: 29, zinc: 0.2, vitA: 0, vitC: 7, vitB1: 0.04, gi: 30, urt: "1 siung", urtGram: 10, price: 200, tags: "bumbu" },
  { name: "Jahe", category: "Bumbu & Rempah", energy: 80, protein: 1.8, fat: 0.8, carb: 18, fiber: 2, sodium: 13, potassium: 415, calcium: 16, iron: 0.6, phosphorus: 34, zinc: 0.3, vitA: 0, vitC: 5, vitB1: 0.03, gi: 15, urt: "1 ruas", urtGram: 10, price: 200, tags: "bumbu" },
  { name: "Air mineral", category: "Minuman", energy: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 1, potassium: 0, calcium: 0, iron: 0, phosphorus: 0, zinc: 0, vitA: 0, vitC: 0, vitB1: 0, gi: 0, urt: "1 gelas", urtGram: 240, price: 50, tags: "hidrasi" },
  { name: "Teh manis", category: "Minuman", energy: 28, protein: 0, fat: 0, carb: 7, fiber: 0, sodium: 1, potassium: 11, calcium: 0, iron: 0, phosphorus: 0, zinc: 0, vitA: 0, vitC: 0, vitB1: 0, gi: 60, urt: "1 gelas", urtGram: 240, price: 200, tags: "gula" },
  { name: "Kopi hitam", category: "Minuman", energy: 2, protein: 0.3, fat: 0, carb: 0, fiber: 0, sodium: 2, potassium: 49, calcium: 2, iron: 0, phosphorus: 2, zinc: 0, vitA: 0, vitC: 0, vitB1: 0, gi: 0, urt: "1 cangkir", urtGram: 240, price: 300, tags: "kafein" },
  { name: "Jus jeruk (segar)", category: "Minuman", energy: 45, protein: 0.7, fat: 0.2, carb: 10, fiber: 0.2, sodium: 1, potassium: 200, calcium: 11, iron: 0.2, phosphorus: 17, zinc: 0.05, vitA: 10, vitC: 50, vitB1: 0.04, gi: 50, urt: "1 gelas", urtGram: 240, price: 1000, tags: "vit-c,kalium" },
];

async function main() {
  console.log("Seeding CareLivia food database...");

  for (const cat of CATEGORIES) {
    await db.foodCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { name: cat.name, slug: cat.slug, icon: cat.icon },
    });
  }

  const labels = [
    { name: "Halal", slug: "halal", color: "#10b981" },
    { name: "Rendah GI", slug: "rendah-gi", color: "#06b6d4" },
    { name: "Tinggi Serat", slug: "tinggi-serat", color: "#84cc16" },
    { name: "Tinggi Protein", slug: "tinggi-protein", color: "#f59e0b" },
    { name: "Rendah Natrium", slug: "rendah-natrium", color: "#0ea5e9" },
    { name: "Tinggi Kalium", slug: "tinggi-kalium", color: "#8b5cf6" },
    { name: "Lean Protein", slug: "lean-protein", color: "#ec4899" },
    { name: "Vegetarian", slug: "vegetarian", color: "#22c55e" },
  ];
  for (const lbl of labels) {
    await db.foodLabel.upsert({
      where: { slug: lbl.slug },
      update: {},
      create: lbl,
    });
  }

  let count = 0;
  for (const f of FOODS) {
    const category = await db.foodCategory.findFirst({
      where: { name: f.category },
    });
    if (!category) continue;

    await db.food.upsert({
      where: { id: `seed-${f.name}` },
      update: {},
      create: {
        id: `seed-${f.name}`,
        name: f.name,
        categoryId: category.id,
        source: "TKPI",
        energy: f.energy,
        protein: f.protein,
        fat: f.fat,
        carb: f.carb,
        fiber: f.fiber,
        sodium: f.sodium,
        potassium: f.potassium,
        calcium: f.calcium,
        iron: f.iron,
        phosphorus: f.phosphorus,
        zinc: f.zinc,
        vitA: f.vitA,
        vitC: f.vitC,
        vitB1: f.vitB1,
        gi: f.gi,
        urt: f.urt,
        urtGram: f.urtGram,
        bdd: f.bdd ?? 100,
        price: f.price,
        unit: "g",
        tags: f.tags ?? "",
        approved: true,
        version: 1,
      },
    });
    count++;
  }

  console.log(`Seeded ${count} foods, ${CATEGORIES.length} categories, ${labels.length} labels.`);

  // Seed sample patient
  await db.patient.upsert({
    where: { mrn: "RM-001" },
    update: {},
    create: {
      mrn: "RM-001",
      name: "Siti Aminah",
      gender: "FEMALE",
      birthDate: new Date("1968-04-15"),
      phone: "081234567890",
      address: "Jl. Melati No. 12, Jakarta",
      religion: "ISLAM",
      bloodType: "O",
      allergy: "",
      height: 155,
      weight: 62,
      isPregnant: false,
      isLactating: false,
      notes: "Pasien DM tipe 2 + HT",
    },
  });
  const p = await db.patient.findUnique({ where: { mrn: "RM-001" } });
  if (p) {
    await db.diagnosis.create({ data: { patientId: p.id, type: "DM", icd: "E11", active: true } }).catch(() => {});
    await db.diagnosis.create({ data: { patientId: p.id, type: "HT", icd: "I10", active: true } }).catch(() => {});
    await db.nutritionAssessment.create({ data: { patientId: p.id, activity: "LIGHT", stress: "MILD", ecog: "1", barthel: 90 } }).catch(() => {});
    await db.weightRecord.create({ data: { patientId: p.id, weight: 64, date: new Date(Date.now() - 14 * 86400000) } }).catch(() => {});
    await db.weightRecord.create({ data: { patientId: p.id, weight: 63, date: new Date(Date.now() - 7 * 86400000) } }).catch(() => {});
    await db.weightRecord.create({ data: { patientId: p.id, weight: 62, date: new Date() } }).catch(() => {});
  }
  console.log("Seeded sample patient RM-001.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
