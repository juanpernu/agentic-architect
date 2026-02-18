-- Bank Accounts table
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  cbu TEXT,
  alias TEXT,
  currency TEXT NOT NULL DEFAULT 'ARS',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bank_accounts_org_id ON bank_accounts(organization_id);

CREATE TRIGGER set_updated_at_bank_accounts
  BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for bank_accounts
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view bank accounts"
  ON bank_accounts FOR SELECT
  USING (organization_id = public.get_org_id());

CREATE POLICY "Admin can insert bank accounts"
  ON bank_accounts FOR INSERT
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "Admin can update bank accounts"
  ON bank_accounts FOR UPDATE
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "Admin can delete bank accounts"
  ON bank_accounts FOR DELETE
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() = 'admin'
  );

-- Add bank_account_id to receipts
ALTER TABLE receipts ADD COLUMN bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;
CREATE INDEX idx_receipts_bank_account_id ON receipts(bank_account_id);
