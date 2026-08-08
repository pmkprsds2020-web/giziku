-- =====================================================================
-- 020_meal_plan_transactional_save.sql
-- Purpose: Draft -> Preview -> Save mechanism for the meal plan editor.
--          All writes (update/insert/delete meal_plan_items, recompute
--          totals, write history snapshot) happen inside a single
--          Postgres function call, which Postgres already runs as one
--          atomic transaction: if any statement raises, everything is
--          rolled back automatically (no partial saves).
-- Dependencies: 007_meal_plan.sql (meal_plans, meal_plan_items, meal_plan_history)
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_save_meal_plan_draft
-- Applies a full draft (updates + inserts + deletes) to meal_plan_items,
-- recomputes meal_plans totals, and writes one meal_plan_history snapshot.
--
-- p_items: JSONB array of items to keep/create, each shaped like:
--   { "id": "<uuid or null>", "slot": "BREAKFAST", "foodId": "<uuid>",
--     "amount": 150, "cal": 200, "protein": 5, "fat": 2, "carb": 30,
--     "fiber": 1, "sodium": 10 }
--   Items WITHOUT an "id" (null/empty) are treated as new rows.
-- p_deleted_item_ids: existing item ids to remove.
-- p_name: optional display name for this save, stored in history.changes
--         (used later by the "Riwayat Meal Plan" list).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_save_meal_plan_draft(
  p_meal_plan_id UUID,
  p_items JSONB,
  p_deleted_item_ids UUID[] DEFAULT '{}',
  p_name TEXT DEFAULT NULL,
  p_actor TEXT DEFAULT 'system'
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_item JSONB;
  v_item_id UUID;
  v_totals RECORD;
  v_snapshot JSONB;
  v_plan JSONB;
BEGIN
  PERFORM 1 FROM meal_plans WHERE id = p_meal_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meal plan % tidak ditemukan', p_meal_plan_id;
  END IF;

  -- 1) Delete items removed in the draft
  IF p_deleted_item_ids IS NOT NULL AND array_length(p_deleted_item_ids, 1) IS NOT NULL THEN
    DELETE FROM meal_plan_items
    WHERE meal_plan_id = p_meal_plan_id
      AND id = ANY(p_deleted_item_ids);
  END IF;

  -- 2) Upsert items: update existing rows, insert new ones
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_item_id := NULLIF(v_item->>'id', '')::UUID;

    IF v_item_id IS NOT NULL THEN
      UPDATE meal_plan_items SET
        slot        = (v_item->>'slot')::meal_slot_enum,
        food_id     = (v_item->>'foodId')::UUID,
        amount      = (v_item->>'amount')::DOUBLE PRECISION,
        cal         = COALESCE((v_item->>'cal')::DOUBLE PRECISION, 0),
        protein     = COALESCE((v_item->>'protein')::DOUBLE PRECISION, 0),
        fat         = COALESCE((v_item->>'fat')::DOUBLE PRECISION, 0),
        carb        = COALESCE((v_item->>'carb')::DOUBLE PRECISION, 0),
        fiber       = COALESCE((v_item->>'fiber')::DOUBLE PRECISION, 0),
        sodium      = COALESCE((v_item->>'sodium')::DOUBLE PRECISION, 0),
        updated_at  = now()
      WHERE id = v_item_id AND meal_plan_id = p_meal_plan_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % tidak ditemukan pada meal plan ini', v_item_id;
      END IF;
    ELSE
      INSERT INTO meal_plan_items (
        meal_plan_id, slot, food_id, amount, cal, protein, fat, carb, fiber, sodium
      ) VALUES (
        p_meal_plan_id,
        (v_item->>'slot')::meal_slot_enum,
        (v_item->>'foodId')::UUID,
        (v_item->>'amount')::DOUBLE PRECISION,
        COALESCE((v_item->>'cal')::DOUBLE PRECISION, 0),
        COALESCE((v_item->>'protein')::DOUBLE PRECISION, 0),
        COALESCE((v_item->>'fat')::DOUBLE PRECISION, 0),
        COALESCE((v_item->>'carb')::DOUBLE PRECISION, 0),
        COALESCE((v_item->>'fiber')::DOUBLE PRECISION, 0),
        COALESCE((v_item->>'sodium')::DOUBLE PRECISION, 0)
      );
    END IF;
  END LOOP;

  -- 3) Recompute totals from the now-current set of items
  SELECT
    COALESCE(SUM(cal), 0)     AS cal,
    COALESCE(SUM(protein), 0) AS protein,
    COALESCE(SUM(fat), 0)     AS fat,
    COALESCE(SUM(carb), 0)    AS carb,
    COALESCE(SUM(fiber), 0)   AS fiber,
    COALESCE(SUM(sodium), 0)  AS sodium
  INTO v_totals
  FROM meal_plan_items
  WHERE meal_plan_id = p_meal_plan_id;

  UPDATE meal_plans SET
    total_cal     = v_totals.cal,
    total_protein = v_totals.protein,
    total_fat     = v_totals.fat,
    total_carb    = v_totals.carb,
    total_fiber   = v_totals.fiber,
    total_sodium  = v_totals.sodium,
    status        = 'SAVED',
    updated_at    = now()
  WHERE id = p_meal_plan_id;

  -- 4) Build a full snapshot (with food names) for the history record
  SELECT jsonb_agg(jsonb_build_object(
    'id', mi.id,
    'slot', mi.slot,
    'foodId', mi.food_id,
    'foodName', f.name,
    'amount', mi.amount,
    'cal', mi.cal,
    'protein', mi.protein,
    'fat', mi.fat,
    'carb', mi.carb,
    'fiber', mi.fiber,
    'sodium', mi.sodium
  ))
  INTO v_snapshot
  FROM meal_plan_items mi
  JOIN foods f ON f.id = mi.food_id
  WHERE mi.meal_plan_id = p_meal_plan_id;

  v_snapshot := COALESCE(v_snapshot, '[]'::jsonb);

  -- 5) Write one history snapshot for this save
  INSERT INTO meal_plan_history (meal_plan_id, action, changes, snapshot, actor)
  VALUES (
    p_meal_plan_id,
    'SAVE_DRAFT',
    jsonb_build_object('name', p_name),
    jsonb_build_object(
      'name', p_name,
      'items', v_snapshot,
      'totals', jsonb_build_object(
        'cal', v_totals.cal, 'protein', v_totals.protein, 'fat', v_totals.fat,
        'carb', v_totals.carb, 'fiber', v_totals.fiber, 'sodium', v_totals.sodium
      )
    ),
    p_actor
  );

  SELECT to_jsonb(mp) INTO v_plan FROM meal_plans mp WHERE id = p_meal_plan_id;

  RETURN jsonb_build_object('plan', v_plan, 'items', v_snapshot);
END;
$$;

-- ---------------------------------------------------------------------
-- fn_apply_meal_plan_history
-- "Gunakan Meal Plan": replaces meal_plan_items of a live meal plan with
-- the snapshot stored in a meal_plan_history row. Atomic, and writes a
-- new 'RESTORE' history entry so the restore itself is auditable.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_apply_meal_plan_history(
  p_meal_plan_id UUID,
  p_history_id UUID,
  p_actor TEXT DEFAULT 'system'
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot JSONB;
  v_items JSONB;
  v_item JSONB;
  v_totals RECORD;
  v_plan JSONB;
BEGIN
  SELECT snapshot INTO v_snapshot
  FROM meal_plan_history
  WHERE id = p_history_id AND meal_plan_id = p_meal_plan_id;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Riwayat meal plan % tidak ditemukan untuk meal plan ini', p_history_id;
  END IF;

  v_items := COALESCE(v_snapshot->'items', '[]'::jsonb);

  DELETE FROM meal_plan_items WHERE meal_plan_id = p_meal_plan_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    INSERT INTO meal_plan_items (
      meal_plan_id, slot, food_id, amount, cal, protein, fat, carb, fiber, sodium
    ) VALUES (
      p_meal_plan_id,
      (v_item->>'slot')::meal_slot_enum,
      (v_item->>'foodId')::UUID,
      (v_item->>'amount')::DOUBLE PRECISION,
      COALESCE((v_item->>'cal')::DOUBLE PRECISION, 0),
      COALESCE((v_item->>'protein')::DOUBLE PRECISION, 0),
      COALESCE((v_item->>'fat')::DOUBLE PRECISION, 0),
      COALESCE((v_item->>'carb')::DOUBLE PRECISION, 0),
      COALESCE((v_item->>'fiber')::DOUBLE PRECISION, 0),
      COALESCE((v_item->>'sodium')::DOUBLE PRECISION, 0)
    );
  END LOOP;

  SELECT
    COALESCE(SUM(cal), 0)     AS cal,
    COALESCE(SUM(protein), 0) AS protein,
    COALESCE(SUM(fat), 0)     AS fat,
    COALESCE(SUM(carb), 0)    AS carb,
    COALESCE(SUM(fiber), 0)   AS fiber,
    COALESCE(SUM(sodium), 0)  AS sodium
  INTO v_totals
  FROM meal_plan_items
  WHERE meal_plan_id = p_meal_plan_id;

  UPDATE meal_plans SET
    total_cal     = v_totals.cal,
    total_protein = v_totals.protein,
    total_fat     = v_totals.fat,
    total_carb    = v_totals.carb,
    total_fiber   = v_totals.fiber,
    total_sodium  = v_totals.sodium,
    status        = 'SAVED',
    updated_at    = now()
  WHERE id = p_meal_plan_id;

  INSERT INTO meal_plan_history (meal_plan_id, action, changes, snapshot, actor)
  VALUES (
    p_meal_plan_id,
    'RESTORE',
    jsonb_build_object('restoredFromHistoryId', p_history_id),
    v_snapshot,
    p_actor
  );

  SELECT to_jsonb(mp) INTO v_plan FROM meal_plans mp WHERE id = p_meal_plan_id;

  RETURN jsonb_build_object('plan', v_plan, 'items', v_items);
END;
$$;

CREATE INDEX IF NOT EXISTS idx_meal_plan_history_plan_created
  ON meal_plan_history (meal_plan_id, created_at DESC);

GRANT EXECUTE ON FUNCTION fn_save_meal_plan_draft(UUID, JSONB, UUID[], TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_apply_meal_plan_history(UUID, UUID, TEXT) TO authenticated;
