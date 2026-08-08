# Task: build-patient-mealplan-features

**Agent**: subagent (Z.ai Code)
**Task ID**: build-patient-mealplan-features
**Scope**: Add patient edit/delete + meal plan food add/edit/delete with realtime recalculation

## What was done

### 1. Backend (Supabase data layer) — `src/lib/supabase/frontend-data.ts`

**`supabaseUpdatePatient(id, data)`** — extended to accept all patient fields:
- `name`, `mrn`, `gender`, `birthDate`, `phone`, `address`, `allergy`, `height`, `weight`, `notes`, `isPregnant`, `pregnancyTrimester`, `isLactating`, `lactationMonth`
- Uses conditional `updateData` assembly so only provided fields are written.

**`supabaseAddMealItem(mealPlanId, data)`** — now computes nutrition snapshot from food:
- Added `fetchFoodById(foodId)` helper to fetch per-100g nutrient values from `foods` table.
- Added `computeItemNutrition(food, grams)` helper to compute `{cal, protein, fat, carb, fiber, sodium}` for a given gram amount.
- The insert now includes computed `cal`, `protein`, `fat`, `carb`, `fiber`, `sodium` (rounded to 1 decimal) so the new item shows correct nutrition in the UI without requiring a refetch.

**`supabaseUpdateMealItem(mealPlanId, itemId, data)`** — recomputes nutrition on every update:
- If `foodId` or `amount` changes, fetches the effective food + amount (falling back to existing row if only one of them is provided) and recomputes the snapshot.
- This ensures the meal plan list (via `useMealPlans`) shows correct nutrition after every edit.

### 2. Patient Management — `src/components/carelivia/views/patients-view.tsx`

- Imported `useDeletePatient` hook, `Textarea` from shadcn/ui.
- Added `editPatient` and `deletePatient` local state to `PatientsView`.
- Extended `PatientCard` to accept `onEdit` and `onDelete` callbacks. Added an action row at the bottom of each card with:
  - **Edit** button (Pencil icon) — calls `onEdit`, stops propagation so it doesn't trigger the card's "open detail" click.
  - **Delete** button (Trash2 icon, rose-tinted) — calls `onDelete`, stops propagation.
  - The action row is faded by default and becomes fully opaque on hover (subtle UX hint).

- **`EditPatientDialog`** — pre-filled form for editing existing patient:
  - Opens when `editPatient` is non-null.
  - Calls `useUpdatePatient(patient.id)`.
  - Pre-fills on open via `useEffect` watching `patient` — converts `birthDate` to `yyyy-mm-dd` for the date input.
  - Fields: MRN, Name, Gender (Select), Birth Date (date input), Phone, Height, Weight, Allergy, Notes (Textarea).
  - Validation: Name required, MRN required, Height > 0 if provided, Weight > 0 if provided. Shows inline error message.
  - On success: toast, close dialog. Hook invalidates `["patients"]` and `["patient", id]` queries automatically.

- **`DeletePatientDialog`** — soft-delete confirmation:
  - Shows patient name + MRN prominently.
  - Lists what data will be soft-deleted (profil, diagnosis, meal plan, asupan, catatan berat badan, asesmen, rencana olahraga).
  - Note that data is recoverable via admin database tools.
  - Calls `useDeletePatient().mutateAsync(patient.id)`. On success: toast, clears `activePatient` (in case user was viewing detail), closes dialog.

### 3. Meal Plan Food Editing — `src/components/carelivia/views/meal-plan-view.tsx`

Added new section `LatestMealPlanEditor` (rendered when `latestPlan` exists and a patient is selected). This operates on the **latest persisted meal plan from `useMealPlans`**, NOT on the preview (`previewData`).

- **`LatestMealPlanEditor({ plan })`** — wraps the editor:
  - Groups items by slot via `useMemo`.
  - Recomputes totals (cal, protein, fat, carb, fiber, sodium) from item snapshots — updates in realtime after every edit since the `useMealPlans` query refetches.
  - Shows summary header: plan date, total energy + % of target, macros (P/L/K), fiber + sodium.
  - Iterates over all 6 MealSlot values, rendering an `EditableSlotItemsCard` for each.

- **`EditableSlotItemsCard({ slot, items, mealPlanId })`** — slot card with add button:
  - Collapsible header with slot label, distribution %, item count, slot calorie total.
  - Lists items via `EditableMealItemRow`.
  - **"+ Tambah Makanan" button** at the bottom — opens `FoodPickerDialog`. On select: `useAddMealItem(mealPlanId).mutateAsync({ slot, foodId, amount })`. Excludes already-added food IDs.
  - Toast on success/error.

- **`EditableMealItemRow({ item, mealPlanId })`** — inline editable row:
  - Shows food name + apple icon.
  - **Inline gram input** (number Input, h-6 w-16):
    - 300ms debounce before calling `useUpdateMealItem(mealPlanId).mutateAsync({ itemId, amount })`.
    - Realtime nutrition preview using `computeFoodNutrition` (derived per-100g values from snapshot, then computed for the new gram amount).
    - Shows "preview" or "menyimpan…" badge while dirty.
    - Reverts on error.
    - `lastSavedRef` prevents stale-cache overwrites when React Query refetches mid-typing.
    - Cleanup debounce timer on unmount.
  - **Edit Food button** (Pencil icon) — opens `FoodPickerDialog` with `defaultAmount = item.amount`. On select: `useUpdateMealItem(mealPlanId).mutateAsync({ itemId, foodId, amount })`.
  - **Delete Food button** (Trash2 icon, rose-tinted):
    - Click reveals inline "Hapus? Ya/Tidak" confirmation.
    - On "Ya": `useDeleteMealItem(mealPlanId).mutateAsync(item.id)`.
  - Tooltips on both edit/delete buttons.

## Stage Summary

- **Backend**: `supabaseUpdatePatient` now supports all 14 patient fields; `supabaseAddMealItem`/`supabaseUpdateMealItem` now compute the nutrition snapshot from the foods table so the UI always shows accurate cal/protein/fat/carb/fiber/sodium.
- **Patient management**: each patient card has Edit + Delete buttons; `EditPatientDialog` pre-fills the form and validates (Name, MRN required; Height/Weight > 0); `DeletePatientDialog` shows a confirmation with patient identity + list of affected data; soft-delete via `supabaseSoftDeletePatient`.
- **Meal plan editing**: new `LatestMealPlanEditor` section renders below the preview, editing the latest persisted plan from `useMealPlans`. Per-slot cards with "+ Tambah Makanan" button. Per-item rows with inline gram input (300ms debounce + `computeFoodNutrition` realtime preview), edit-food picker (via `FoodPickerDialog`), and inline delete confirmation.
- **Quality**: `bun run lint` passes with 0 errors/warnings. No new TypeScript errors introduced in the modified files (existing pre-existing TS errors in `GroupCoverageCard` PlateGroup literals and other untouched files are unrelated).
