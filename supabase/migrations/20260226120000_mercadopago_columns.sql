-- Add 'paused' to subscription_status enum
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'paused';

-- Add provider-agnostic columns alongside existing stripe columns
ALTER TABLE organizations ADD COLUMN payment_customer_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN payment_subscription_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN subscription_seats INTEGER;

-- Backfill from existing stripe columns for any active subscriptions
UPDATE organizations SET
  payment_customer_id = stripe_customer_id,
  payment_subscription_id = stripe_subscription_id,
  subscription_seats = max_seats
WHERE plan != 'free' AND stripe_subscription_id IS NOT NULL;
