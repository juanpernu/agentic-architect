-- Phase 3: Remove Stripe-specific columns (data already migrated to payment_* columns in Phase 1)
ALTER TABLE organizations DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE organizations DROP COLUMN IF EXISTS stripe_subscription_id;
