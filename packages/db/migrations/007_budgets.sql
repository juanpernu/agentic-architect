-- Budgets table (one per project)
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  current_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT budgets_project_id_unique UNIQUE (project_id)
);

CREATE INDEX idx_budgets_org_id ON budgets(organization_id);
CREATE INDEX idx_budgets_project_id ON budgets(project_id);

CREATE TRIGGER set_updated_at_budgets
  BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for budgets
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view budgets"
  ON budgets FOR SELECT
  USING (organization_id = public.get_org_id());

CREATE POLICY "Admin and supervisor can insert budgets"
  ON budgets FOR INSERT
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

CREATE POLICY "Admin and supervisor can update budgets"
  ON budgets FOR UPDATE
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

-- Budget versions table (immutable snapshots)
CREATE TABLE budget_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  snapshot JSONB NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT budget_versions_budget_version_unique UNIQUE (budget_id, version_number)
);

CREATE INDEX idx_budget_versions_budget_id ON budget_versions(budget_id);

-- RLS for budget_versions
ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view budget versions"
  ON budget_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = budget_versions.budget_id
      AND budgets.organization_id = public.get_org_id()
    )
  );

CREATE POLICY "Admin and supervisor can insert budget versions"
  ON budget_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = budget_versions.budget_id
      AND budgets.organization_id = public.get_org_id()
    )
    AND public.get_user_role() IN ('admin', 'supervisor')
  );
