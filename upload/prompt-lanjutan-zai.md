Saya upload file `carelivia-openai-refactor.tar` — ini adalah workspace project CareLivia (Clinical Nutrition Management System) yang SUDAH melalui refactor tahap 1 untuk production-ready dengan Next.js + Supabase + OpenAI API. Ekstrak dulu file ini, baca `PRODUCTION_REFACTOR_NOTES.md` di root project untuk konteks lengkap, lalu lanjutkan pekerjaan berikut.

=========================================================
KONTEKS: APA YANG SUDAH SELESAI (JANGAN DIULANG DARI NOL)
=========================================================

Infrastruktur AI berbasis OpenAI sudah lengkap di `src/lib/ai/`:
- `client.ts` — wrapper OpenAI resmi, server-only, tidak pernah dipanggil dari client component
- `models.ts` — konfigurasi model terpusat (ubah model tanpa sentuh kode lain)
- `prompts/*.ts` — system prompt terpisah per fitur
- `schemas/*.ts` — Zod schema untuk validasi output AI
- `validator/validate.ts` — generateStructured() dengan auto-retry jika output tidak sesuai schema
- `parser/json-parser.ts` — parser JSON toleran terhadap markdown fence
- `cache.ts` — cache Supabase (tabel ai_cache) agar request identik tidak memanggil OpenAI dua kali
- `logging.ts` — logging token/biaya/response time ke tabel ai_usage_logs
- `rate-limit.ts` — rate limiting per-IP di setiap route AI
- `sanitize.ts` — sanitasi input & error

9 API route AI sudah ada dan berfungsi di `src/app/api/ai/`:
meal-plan, exercise-plan, shopping-planner, nutrition-analysis, food-record,
alternative-food, patient-summary, reasoning, chat (streaming)

`z-ai-web-dev-sdk` SUDAH DIHAPUS dari semua pemanggilan AI (meal-generator.ts,
comparisons/route.ts) dan diganti OpenAI resmi. Meal Plan generator
(`src/lib/ai/meal-generator.ts`) TETAP memakai optimizer gram deterministik
yang sudah ada sebelumnya (presisi ±2% kalori/±2g protein&lemak/±3g karbo) —
JANGAN diubah logika matematisnya, AI hanya menambah lapisan narasi klinis
(reasoning/alternatives/warnings) di atasnya.

Migrasi Supabase baru: `supabase/migrations/019_ai_infrastructure.sql`
(tabel ai_usage_logs, ai_cache, nutrition_analysis, food_record_analysis + RLS).

`package.json` sudah ditambah dependency `openai@^7.2.0` dan `server-only`.
`.env.example` sudah berisi daftar environment variable yang dibutuhkan.

TypeScript typecheck untuk semua file AI baru SUDAH BERSIH (0 error). Sisa
error TS di project ini murni pre-existing (belum jalankan `prisma generate`,
dan proyek masih dalam proses migrasi Prisma → Supabase yang sebagian sudah
berjalan sebelum refactor AI ini dimulai) — bukan bagian dari scope refactor AI.

=========================================================
TUGAS LANJUTAN YANG PERLU DIKERJAKAN SEKARANG
=========================================================

1. WIRING FRONTEND KE ENDPOINT AI BARU
   Hook-hook di `src/hooks/use-carelivia.ts` saat ini masih memanggil route
   lama (`/api/meal-plan`, `/api/exercise`, `/api/shopping`, dst — beberapa
   di antaranya rule-based tanpa AI). Buat/perbarui hook React Query untuk
   memanggil endpoint baru di `/api/ai/*` (exercise-plan, shopping-planner,
   alternative-food, food-record, patient-summary, chat) dan sambungkan ke
   komponen UI terkait di `src/components/carelivia/views/`. Untuk AI Chat,
   implementasikan konsumsi streaming response (bukan JSON biasa) di sisi
   client.

2. BERESKAN MIGRASI PRISMA → SUPABASE
   Banyak file masih import type dari `@prisma/client` (DiagnosisType,
   MealSlot, Gender, ActivityLevel, StressLevel, ExerciseType,
   ExerciseIntensity, ShoppingPeriod, PresetGoal, BMICategory) padahal data
   sudah/akan pindah ke Supabase sepenuhnya. Ganti seluruh import ini dengan
   enum/type lokal (definisikan di `src/lib/types.ts` atau file constants
   yang sesuai), supaya project tidak lagi bergantung pada Prisma Client
   untuk types di production. File yang perlu dicek (hasil `tsc --noEmit`):
   src/lib/types.ts, src/lib/clinical/constants.ts, src/lib/clinical/calorie-engine.ts,
   src/lib/clinical/isi-piringku.ts, src/lib/ai/meal-generator.ts,
   src/hooks/use-carelivia.ts, src/lib/repositories/*.ts, dan seluruh file di
   src/components/carelivia/**.

3. HAPUS/AMANKAN DEPENDENSI LAMA
   Cek apakah `z-ai-web-dev-sdk` dan Prisma masih dipakai untuk hal lain di
   luar AI (mis. akses database langsung). Jika sudah 100% pindah ke
   Supabase, hapus dependency `z-ai-web-dev-sdk`, `@prisma/client`, `prisma`
   dari `package.json` dan hapus folder `prisma/`. Jika masih dipakai
   sebagai fallback data-access, biarkan tapi dokumentasikan dengan jelas.

4. AKTIFKAN STRICT TYPE CHECKING
   Setelah migrasi Prisma selesai dan build bersih, ubah
   `next.config.ts` → `typescript: { ignoreBuildErrors: false }` supaya
   error tipe tidak lolos ke production tanpa disadari.

5. VALIDASI ACCEPTANCE TEST
   Jalankan checklist berikut dan pastikan semua ✓ (butuh env var OpenAI +
   Supabase asli yang sudah di-set):
   - Deploy berhasil di Vercel
   - Login berhasil, Supabase terhubung, OpenAI API terhubung
   - Meal Plan, Exercise Plan, Shopping Planner, Food Record Analysis, AI Chat berhasil
   - Output JSON valid di semua endpoint /api/ai/*
   - Tidak ada mock AI / dummy data / local AI tersisa di codebase
   - Semua data tersimpan di Supabase, semua modul sinkron

6. RATE LIMITING PRODUCTION-GRADE (opsional, jika traffic tinggi)
   Rate limiter saat ini (`src/lib/ai/rate-limit.ts`) in-memory per-instance
   Vercel — cukup untuk traffic rendah-menengah tapi reset saat cold start
   dan tidak konsisten lintas region. Jika dibutuhkan, ganti implementasinya
   dengan Upstash Redis (interface/fungsi tetap sama: checkRateLimit()),
   tanpa mengubah pemanggilan di setiap route.

=========================================================
ATURAN WAJIB (SAMA DENGAN SPEK AWAL — TETAP BERLAKU)
=========================================================
✓ Semua AI HARUS lewat OpenAI API resmi, tidak ada mock/dummy/local AI
✓ Seluruh request AI hanya lewat API Route server-side, API key TIDAK PERNAH ke browser
✓ Gunakan process.env.OPENAI_API_KEY, jangan pernah hardcode key di source code
✓ Chat AI pakai streaming, fitur JSON lain pakai JSON biasa
✓ Retry maksimal 2x, timeout 30 detik, jika gagal tampilkan
  "AI sedang tidak tersedia. Silakan coba beberapa saat lagi." — jangan crash aplikasi
✓ Seluruh hasil AI otomatis tersimpan ke Supabase
✓ Runtime Node untuk API Route yang butuh (export const runtime = "nodejs")
✓ Rate limit, request validation, input sanitization, error sanitization tetap aktif

Mulai dengan mengekstrak file, membaca PRODUCTION_REFACTOR_NOTES.md dan struktur
src/lib/ai/ + src/app/api/ai/ secara menyeluruh dulu sebelum membuat perubahan apa pun,
supaya konsisten dengan pola yang sudah dibangun.
