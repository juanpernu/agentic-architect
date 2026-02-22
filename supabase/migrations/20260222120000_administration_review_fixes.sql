-- Code review fixes for administration module
-- Issues: #1 (WITH CHECK), #5 (amount CHECK), #7 (updated_at trigger), #13 (seed search_path)

-- ============================================================
-- 1. Add WITH CHECK to all UPDATE policies (Issue #1)
-- ============================================================

-- income_types
DROP POLICY IF EXISTS "income_types_update" ON income_types;
CREATE POLICY "income_types_update" ON income_types
  FOR UPDATE
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin')
  )
  WITH CHECK (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin')
  );

-- expense_types
DROP POLICY IF EXISTS "expense_types_update" ON expense_types;
CREATE POLICY "expense_types_update" ON expense_types
  FOR UPDATE
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin')
  )
  WITH CHECK (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin')
  );

-- incomes
DROP POLICY IF EXISTS "incomes_update" ON incomes;
CREATE POLICY "incomes_update" ON incomes
  FOR UPDATE
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  )
  WITH CHECK (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

-- expenses
DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  )
  WITH CHECK (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

-- ============================================================
-- 2. Add CHECK constraint on amount (Issue #5)
-- ============================================================
ALTER TABLE incomes ADD CONSTRAINT incomes_amount_positive CHECK (amount > 0);
ALTER TABLE expenses ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0);

-- ============================================================
-- 3. Add updated_at trigger (Issue #7)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incomes_updated_at
  BEFORE UPDATE ON incomes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. Fix seed trigger search_path (Issue #13)
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_default_income_types()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO income_types (org_id, name) VALUES
    (NEW.id, 'Anticipo'),
    (NEW.id, 'Cuota'),
    (NEW.id, 'Pago final'),
    (NEW.id, 'Otros');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_catalog;
