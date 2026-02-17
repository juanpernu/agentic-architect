-- Cost Centers table
CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cost_centers_org_id ON cost_centers(organization_id);

CREATE TRIGGER set_updated_at_cost_centers
  BEFORE UPDATE ON cost_centers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for cost_centers
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view cost centers"
  ON cost_centers FOR SELECT
  USING (organization_id = public.get_org_id());

CREATE POLICY "Admin and supervisor can insert cost centers"
  ON cost_centers FOR INSERT
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

CREATE POLICY "Admin and supervisor can update cost centers"
  ON cost_centers FOR UPDATE
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

CREATE POLICY "Admin and supervisor can delete cost centers"
  ON cost_centers FOR DELETE
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

-- Add cost_center_id to receipts (nullable for legacy receipts)
ALTER TABLE receipts ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL;
CREATE INDEX idx_receipts_cost_center_id ON receipts(cost_center_id);
