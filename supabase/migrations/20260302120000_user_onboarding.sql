-- supabase/migrations/20260302120000_user_onboarding.sql
ALTER TABLE users ADD COLUMN onboarding_step text NOT NULL DEFAULT 'welcome'
  CHECK (onboarding_step IN ('welcome','tour-1','tour-2','tour-3','tour-4','tour-5','tour-6','summary','completed'));
ALTER TABLE users ADD COLUMN onboarding_completed_at timestamptz;
