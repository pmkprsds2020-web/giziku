# Task: migrate-routes-to-supabase

**Agent**: subagent (Z.ai Code)
**Task ID**: migrate-routes-to-supabase
**Scope**: Migrate 22 Prisma-only API routes to Supabase-primary with Prisma fallback.

## What was done

### 1. Extended data-layer.ts with server-side helpers (~870 new lines)

`src/lib/supabase/data-layer.ts` previously had only some CRUD functions. Added the missing ones required by the route migrations (server-side equivalents of `frontend-data.ts` functions, but using the server Supabase client):

- `supabaseGetPreset(id)` — fetch preset + history + meal plan count
- `supabaseUpdatePreset(id, updates)` — full update with macro recompute, version bump, history log
- `supabaseDeletePreset(id)` — soft delete + history log
- `supabaseTogglePresetFavorite(id)` — toggle favorite + history log
- `supabaseClonePreset(sourceId, options)` — clone preset + history log
- `supabaseFetchPresetHistory(presetId)` — list history
- `supabaseGetRecipe(id)` — fetch recipe with items + foods
- `supabaseUpdateRecipe(id, updates)` — replace items + update fields
- `supabaseGetSavedMealPlan(id)` — fetch with items + foods
- `supabaseMarkSavedMealPlanUsed(id)` — increment use_count
- `supabaseListSavedMenus(params)` — list with filter + items
- `supabaseGetSavedMenu(id)` — fetch with items
- `supabaseCreateSavedMenu(data)` — create with items + compute totals
- `supabaseUpdateSavedMenu(id, updates)` — replace items + recompute totals + version bump
- `supabaseMarkSavedMenuUsed(id)` — increment use_count
- `supabaseDeleteSavedMenu(id)` — soft delete
- `supabaseListMealItems(mealPlanId)` — list items with foods
- `supabaseAddMealItem(mealPlanId, data)` — insert item
- `supabaseUpdateMealItem(itemId, data)` — update item
- `supabaseDeleteMealItem(itemId)` — delete item
- `supabaseGetMealPlan(id)` — fetch meal plan with all relations
- `supabaseUpdateMealPlanTotals(id, totals)` — update aggregated totals + compliance

Plus helpers: `computePresetGrams`, `safeJsonParse`, `presetUpdateToSupabase`, `mapRecipeRow`, `mapSavedMealPlanRow`, `mapSavedMenuRow`, `PRESET_TRACKED_FIELDS`.

### 2. Migrated 22 routes (High Priority)

1. `src/app/api/patients/[id]/route.ts` — GET (supabaseGetPatient → resolvePatientId retry → fetchFullPatientProfile from Supabase → Prisma fallback), PUT (supabaseUpdatePatient + auto weight record), DELETE (supabaseSoftDeletePatient)
2. `src/app/api/foods/[id]/route.ts` — PUT (supabaseUpsertFood + change log), DELETE (soft delete via direct query + change log)
3. `src/app/api/foods/[id]/prices/route.ts` — GET (food_price_history query), POST (insert history + update food.price + change log)
4. `src/app/api/foods/[id]/change-logs/route.ts` — GET (food_change_logs query)
5. `src/app/api/presets/[id]/route.ts` — GET/PUT/DELETE (all via supabaseGetPreset/UpdatePreset/DeletePreset)
6. `src/app/api/presets/[id]/favorite/route.ts` — POST (supabaseTogglePresetFavorite)
7. `src/app/api/presets/[id]/clone/route.ts` — POST (supabaseClonePreset)
8. `src/app/api/presets/[id]/history/route.ts` — GET (supabaseFetchPresetHistory)
9. `src/app/api/presets/templates/route.ts` — GET (supabaseListPresets filter isTemplate), POST (idempotent seed via direct insert)
10. `src/app/api/presets/compare/route.ts` — GET (fetch by IDs from Supabase + build comparison rows)

### 3. Migrated 12 routes (Medium Priority)

11. `src/app/api/recipes/[id]/route.ts` — GET/PUT/DELETE (supabaseGetRecipe/UpdateRecipe/DeleteRecipe)
12. `src/app/api/saved-meal-plans/[id]/route.ts` — GET/PATCH/DELETE (supabaseGetSavedMealPlan/MarkSavedMealPlanUsed/DeleteSavedMealPlan)
13. `src/app/api/saved-menus/route.ts` — GET (supabaseListSavedMenus), POST (supabaseCreateSavedMenu)
14. `src/app/api/saved-menus/[id]/route.ts` — GET/PUT/PATCH/DELETE (supabaseGetSavedMenu/UpdateSavedMenu/MarkSavedMenuUsed/DeleteSavedMenu)
15. `src/app/api/shopping/route.ts` — POST (supabaseGetMealPlan → aggregate → delete existing shopping_lists by meal_plan_id → insert + items → fetch with relations)
16. `src/app/api/weight-records/[id]/route.ts` — DELETE (supabaseDeleteWeightRecord)
17. `src/app/api/assessments/[id]/route.ts` — DELETE (supabaseDeleteAssessment)
18. `src/app/api/compliance/weekly/route.ts` — GET (fetch latest meal_plan + 7-day food_records from Supabase + compute compliance per day)
19. `src/app/api/dashboard/route.ts` — GET (fetchFromSupabase → fetchFromPrisma fallback; aggregates patients, meal plans, food records, weight trends, diagnosis distribution)
20. `src/app/api/database-browser/route.ts` — GET (12 tables supported: patients, foods, meal_plans, food_records, weight_records, nutrition_assessments, nutrition_presets, recipes, exercise_plans, saved_meal_plans, shopping_lists, audit_logs)
21. `src/app/api/meal-plan/[id]/items/route.ts` — GET (supabaseListMealItems), POST (resolveFoodId + supabaseGetFood + supabaseAddMealItem + recalcPlanSupabase)
22. `src/app/api/meal-plan/[id]/items/[itemId]/route.ts` — PUT (verify item, compute nutrition, supabaseUpdateMealItem, recalc), DELETE (supabaseDeleteMealItem, recalc)

## Pattern used (consistent across all routes)

1. **Supabase first**: Use `getServerClient()` or dedicated helper from `data-layer.ts`
2. **Prisma fallback**: Wrapped in try/catch, uses `const { db } = await import("@/lib/db")` (dynamic import to avoid module-level Prisma instantiation when not needed)
3. **ID resolution**: `resolvePatientId()` / `resolveFoodId()` for cuid → UUID conversion before any Supabase write
4. **Response shape preserved**: Same JSON envelope `{ success: true, data: ... }` / `{ success: false, error: ... }`
5. **snake_case → camelCase**: All Supabase rows mapped to camelCase for response (frontend expects this)

## Verification

- `bun run lint` → **0 errors** (exit 0)
- `npx tsc --noEmit` → only pre-existing errors (none in migrated files)
- TypeScript fix applied: `patientSummaries: any[]` in dashboard to avoid `never[]` inference

## Notes for downstream agents

- The `data-layer.ts` is now ~2420 lines and contains all server-side Supabase helpers needed
- The frontend `frontend-data.ts` was NOT modified (it has its own client-side versions used by hooks)
- The pattern is symmetric: server routes call server helpers, client hooks call client helpers
- When adding new routes, follow the same pattern: Supabase primary, Prisma fallback, resolveXxxId before writes
