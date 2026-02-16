-- Iteration 2: Organization settings + User deactivation

-- Organization profile fields
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_locality TEXT,
  ADD COLUMN IF NOT EXISTS address_province TEXT,
  ADD COLUMN IF NOT EXISTS address_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS social_instagram TEXT,
  ADD COLUMN IF NOT EXISTS social_linkedin TEXT;

-- User active/inactive flag (defaults to true for existing users)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create org-assets storage bucket for logos (public-read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-assets', 'org-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read from org-assets
CREATE POLICY IF NOT EXISTS "Authenticated users can read org-assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'org-assets');

-- Allow admins to upload/delete org-assets scoped to their org
CREATE POLICY IF NOT EXISTS "Admins can manage org-assets"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND (storage.foldername(name))[1] = 'org-logos'
    AND (storage.foldername(name))[2] = public.get_org_id()
    AND public.get_user_role() = 'admin'
  );
