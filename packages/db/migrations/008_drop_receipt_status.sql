-- Drop the unused receipt status column, index, and enum type
ALTER TABLE receipts DROP COLUMN status;
DROP INDEX IF EXISTS idx_receipts_status;
DROP TYPE IF EXISTS receipt_status;
