-- Migration: Replace income_type_id / expense_type_id FKs with free-text category column

-- 1. Add category columns
ALTER TABLE incomes ADD COLUMN category text;
ALTER TABLE expenses ADD COLUMN category text;

-- 2. Migrate data from type tables
UPDATE incomes SET category = t.name FROM income_types t WHERE t.id = incomes.income_type_id;
UPDATE expenses SET category = t.name FROM expense_types t WHERE t.id = expenses.expense_type_id;

-- 3. Set NOT NULL after migration
ALTER TABLE incomes ALTER COLUMN category SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN category SET NOT NULL;

-- 4. Drop FK columns
ALTER TABLE incomes DROP COLUMN income_type_id;
ALTER TABLE expenses DROP COLUMN expense_type_id;

-- 5. Drop seed trigger
DROP TRIGGER IF EXISTS seed_income_types_on_org ON organizations;
DROP FUNCTION IF EXISTS seed_default_income_types();

-- 6. Drop type tables (RLS policies drop with tables)
DROP TABLE IF EXISTS income_types CASCADE;
DROP TABLE IF EXISTS expense_types CASCADE;
