-- supabase/migrations/20260302120000_user_onboarding.sql
ALTER TABLE users ADD COLUMN onboarding_step text NOT NULL DEFAULT 'welcome';
ALTER TABLE users ADD COLUMN onboarding_completed_at timestamptz;
