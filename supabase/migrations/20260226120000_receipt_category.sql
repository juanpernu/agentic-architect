-- Receipt category (income/expense classification)
ALTER TABLE receipts ADD COLUMN category text
  CHECK (category IN ('income', 'expense'));

-- Who actually paid this expense (org member)
ALTER TABLE expenses ADD COLUMN paid_by uuid REFERENCES users(id);

-- Link incomes to receipts (expenses already have receipt_id)
ALTER TABLE incomes ADD COLUMN receipt_id uuid REFERENCES receipts(id);
CREATE INDEX idx_incomes_receipt ON incomes(receipt_id);

-- Make type IDs nullable so receipt-flow can skip type selection
ALTER TABLE expenses ALTER COLUMN expense_type_id DROP NOT NULL;
ALTER TABLE incomes ALTER COLUMN income_type_id DROP NOT NULL;
