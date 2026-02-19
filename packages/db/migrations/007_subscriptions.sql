-- Subscription enums
CREATE TYPE subscription_plan AS ENUM ('free', 'advance', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');

-- Extend organizations with billing fields
ALTER TABLE organizations ADD COLUMN plan subscription_plan NOT NULL DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN subscription_status subscription_status NOT NULL DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN stripe_subscription_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN max_seats INTEGER NOT NULL DEFAULT 1;
ALTER TABLE organizations ADD COLUMN billing_cycle TEXT;
ALTER TABLE organizations ADD COLUMN current_period_end TIMESTAMPTZ;
