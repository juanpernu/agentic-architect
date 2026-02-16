-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's org_id from JWT
CREATE OR REPLACE FUNCTION auth.get_org_id()
RETURNS TEXT AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id';
$$ LANGUAGE sql STABLE;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE clerk_user_id = auth.uid()::TEXT;
$$ LANGUAGE sql STABLE;

-- Organizations: users can only see their own org
CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT
  USING (id = auth.get_org_id());

-- Users: can see users in same org
CREATE POLICY "Users can view org members"
  ON users FOR SELECT
  USING (organization_id = auth.get_org_id());

-- Users: only admin can insert/update/delete
CREATE POLICY "Admin can manage users"
  ON users FOR ALL
  USING (
    organization_id = auth.get_org_id()
    AND auth.get_user_role() = 'admin'
  );

-- Projects: org-scoped read (admin/supervisor see all, architect sees assigned)
CREATE POLICY "View projects by role"
  ON projects FOR SELECT
  USING (
    organization_id = auth.get_org_id()
    AND (
      auth.get_user_role() IN ('admin', 'supervisor')
      OR architect_id = (SELECT id FROM users WHERE clerk_user_id = auth.uid()::TEXT)
    )
  );

-- Projects: admin and supervisor can create
CREATE POLICY "Admin and supervisor can create projects"
  ON projects FOR INSERT
  WITH CHECK (
    organization_id = auth.get_org_id()
    AND auth.get_user_role() IN ('admin', 'supervisor')
  );

-- Projects: admin can update any, supervisor can update own
CREATE POLICY "Update projects by role"
  ON projects FOR UPDATE
  USING (
    organization_id = auth.get_org_id()
    AND (
      auth.get_user_role() = 'admin'
      OR (auth.get_user_role() = 'supervisor'
          AND architect_id = (SELECT id FROM users WHERE clerk_user_id = auth.uid()::TEXT))
    )
  );

-- Projects: only admin can delete
CREATE POLICY "Admin can delete projects"
  ON projects FOR DELETE
  USING (
    organization_id = auth.get_org_id()
    AND auth.get_user_role() = 'admin'
  );

-- Receipts: org-scoped via project
CREATE POLICY "View receipts by role"
  ON receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = receipts.project_id
      AND projects.organization_id = auth.get_org_id()
    )
    AND (
      auth.get_user_role() IN ('admin', 'supervisor')
      OR uploaded_by = (SELECT id FROM users WHERE clerk_user_id = auth.uid()::TEXT)
    )
  );

-- Receipts: any authenticated user in org can insert
CREATE POLICY "Org members can upload receipts"
  ON receipts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = receipts.project_id
      AND projects.organization_id = auth.get_org_id()
    )
  );

-- Receipts: admin/supervisor can update any in org, architect can update own
CREATE POLICY "Update receipts by role"
  ON receipts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = receipts.project_id
      AND projects.organization_id = auth.get_org_id()
    )
    AND (
      auth.get_user_role() IN ('admin', 'supervisor')
      OR uploaded_by = (SELECT id FROM users WHERE clerk_user_id = auth.uid()::TEXT)
    )
  );

-- Receipts: only admin can delete
CREATE POLICY "Admin can delete receipts"
  ON receipts FOR DELETE
  USING (
    auth.get_user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = receipts.project_id
      AND projects.organization_id = auth.get_org_id()
    )
  );

-- Receipt Items: org-scoped via receipt → project chain
CREATE POLICY "View receipt items via receipt access"
  ON receipt_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM receipts
      JOIN projects ON projects.id = receipts.project_id
      WHERE receipts.id = receipt_items.receipt_id
      AND projects.organization_id = auth.get_org_id()
    )
  );

CREATE POLICY "Insert receipt items with receipt"
  ON receipt_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receipts
      JOIN projects ON projects.id = receipts.project_id
      WHERE receipts.id = receipt_items.receipt_id
      AND projects.organization_id = auth.get_org_id()
    )
  );

CREATE POLICY "Update receipt items via receipt access"
  ON receipt_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM receipts
      JOIN projects ON projects.id = receipts.project_id
      WHERE receipts.id = receipt_items.receipt_id
      AND projects.organization_id = auth.get_org_id()
    )
  );

CREATE POLICY "Delete receipt items via receipt access"
  ON receipt_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM receipts
      JOIN projects ON projects.id = receipts.project_id
      WHERE receipts.id = receipt_items.receipt_id
      AND projects.organization_id = auth.get_org_id()
    )
    AND auth.get_user_role() = 'admin'
  );

-- Supabase Storage bucket for receipt images
-- Run in Supabase dashboard:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);
