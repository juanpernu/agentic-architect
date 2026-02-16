-- Suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  responsible_person TEXT,
  cuit TEXT,
  iibb TEXT,
  street TEXT,
  locality TEXT,
  province TEXT,
  postal_code TEXT,
  activity_start_date DATE,
  fiscal_condition TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_suppliers_org_cuit ON suppliers(organization_id, cuit);
CREATE INDEX idx_suppliers_org_id ON suppliers(organization_id);

CREATE TRIGGER set_updated_at_suppliers
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Expand receipts table
ALTER TABLE receipts
  ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN receipt_type TEXT,
  ADD COLUMN receipt_code TEXT,
  ADD COLUMN receipt_number TEXT,
  ADD COLUMN receipt_time TIME,
  ADD COLUMN net_amount DECIMAL(12,2),
  ADD COLUMN iva_rate DECIMAL(5,2),
  ADD COLUMN iva_amount DECIMAL(12,2);

CREATE INDEX idx_receipts_supplier_id ON receipts(supplier_id);

-- RLS policies for suppliers (matches pattern from 002_rls_policies.sql)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view suppliers"
  ON suppliers FOR SELECT
  USING (organization_id = public.get_org_id());

CREATE POLICY "Org members can insert suppliers"
  ON suppliers FOR INSERT
  WITH CHECK (organization_id = public.get_org_id());

CREATE POLICY "Org members can update suppliers"
  ON suppliers FOR UPDATE
  USING (organization_id = public.get_org_id());

CREATE POLICY "Admin can delete suppliers"
  ON suppliers FOR DELETE
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() = 'admin'
  );
