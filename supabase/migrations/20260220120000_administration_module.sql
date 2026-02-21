-- Administration module: income_types, expense_types, incomes, expenses
-- T-01 + T-04

-- ============================================================
-- 1. income_types
-- ============================================================
CREATE TABLE income_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE income_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_types_select" ON income_types
  FOR SELECT USING (org_id = public.get_org_id());

CREATE POLICY "income_types_insert" ON income_types
  FOR INSERT WITH CHECK (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin')
  );

CREATE POLICY "income_types_update" ON income_types
  FOR UPDATE USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin')
  );

CREATE POLICY "income_types_delete" ON income_types
  FOR DELETE USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin')
  );

-- ============================================================
-- 2. expense_types
-- ============================================================
CREATE TABLE expense_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expense_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_types_select" ON expense_types
  FOR SELECT USING (org_id = public.get_org_id());

CREATE POLICY "expense_types_insert" ON expense_types
  FOR INSERT WITH CHECK (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin')
  );

CREATE POLICY "expense_types_update" ON expense_types
  FOR UPDATE USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin')
  );

CREATE POLICY "expense_types_delete" ON expense_types
  FOR DELETE USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin')
  );

-- ============================================================
-- 3. incomes
-- ============================================================
CREATE TABLE incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  date date NOT NULL,
  income_type_id uuid NOT NULL REFERENCES income_types(id),
  description text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incomes_select" ON incomes
  FOR SELECT USING (org_id = public.get_org_id());

CREATE POLICY "incomes_insert" ON incomes
  FOR INSERT WITH CHECK (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

CREATE POLICY "incomes_update" ON incomes
  FOR UPDATE USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

CREATE POLICY "incomes_delete" ON incomes
  FOR DELETE USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

-- ============================================================
-- 4. expenses
-- ============================================================
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  date date NOT NULL,
  expense_type_id uuid NOT NULL REFERENCES expense_types(id),
  rubro_id uuid REFERENCES rubros(id),
  receipt_id uuid REFERENCES receipts(id),
  description text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (org_id = public.get_org_id());

CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_income_types_org ON income_types(org_id);
CREATE INDEX idx_expense_types_org ON expense_types(org_id);
CREATE INDEX idx_incomes_org ON incomes(org_id);
CREATE INDEX idx_incomes_project ON incomes(project_id);
CREATE INDEX idx_expenses_org ON expenses(org_id);
CREATE INDEX idx_expenses_project ON expenses(project_id);
