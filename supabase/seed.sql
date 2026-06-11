-- ============================================================
-- supabase/seed.sql
-- Initial seed data for A&O Kreative CRM
-- Run AFTER the schema migration via:
--   supabase db seed   OR   paste in Supabase SQL Editor
--
-- IMPORTANT: The profile rows are created automatically when
-- auth.users are created (via the handle_new_user trigger).
-- This seed manually creates the auth.users entries for local
-- dev. In PRODUCTION, use Supabase Dashboard > Authentication
-- > Users > Invite User to create each team member.
-- ============================================================

-- ── Local dev only: create team members ────────────────────
-- (Supabase local dev accepts direct inserts into auth.users)
-- In production, use the Dashboard or Admin API.

DO $$
DECLARE
  andy_id    UUID := 'a0000000-0000-0000-0000-000000000001';
  kafa_id    UUID := 'a0000000-0000-0000-0000-000000000002';
  barbara_id UUID := 'a0000000-0000-0000-0000-000000000003';
  ricky_id   UUID := 'a0000000-0000-0000-0000-000000000004';
BEGIN
  -- Insert into auth.users (local dev only)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES
    (andy_id,    'andy@ao-kreative.co.ke',    crypt('change_me_andy',    gen_salt('bf')), NOW(), '{"full_name":"Andy","role":"admin"}',    NOW(), NOW()),
    (kafa_id,    'kafa@ao-kreative.co.ke',    crypt('change_me_kafa',    gen_salt('bf')), NOW(), '{"full_name":"Kafa","role":"creative"}', NOW(), NOW()),
    (barbara_id, 'barbara@ao-kreative.co.ke', crypt('change_me_barbara', gen_salt('bf')), NOW(), '{"full_name":"Barbara","role":"creative"}', NOW(), NOW()),
    (ricky_id,   'ricky@ao-kreative.co.ke',   crypt('change_me_ricky',   gen_salt('bf')), NOW(), '{"full_name":"Ricky","role":"sales"}',   NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Profiles are auto-created by trigger, but upsert in case seed runs twice
  INSERT INTO profiles (id, full_name, email, role, avatar_color)
  VALUES
    (andy_id,    'Andy',    'andy@ao-kreative.co.ke',    'admin',    '#60A5FA'),
    (kafa_id,    'Kafa',    'kafa@ao-kreative.co.ke',    'creative', '#A78BFA'),
    (barbara_id, 'Barbara', 'barbara@ao-kreative.co.ke', 'creative', '#F472B6'),
    (ricky_id,   'Ricky',   'ricky@ao-kreative.co.ke',   'sales',    '#2DD4BF')
  ON CONFLICT (id) DO UPDATE SET
    full_name    = EXCLUDED.full_name,
    role         = EXCLUDED.role,
    avatar_color = EXCLUDED.avatar_color;

END $$;

-- ── Sample client (for smoke-testing) ──────────────────────
INSERT INTO clients (
  company_name, primary_contact, email, industry, status,
  avatar_color, services, created_by
)
SELECT
  'AdoFresh Kenya', 'Andy Mwangi', 'hello@adofreshkenya.co.ke',
  'Agriculture & Food', 'Active', '#10B981',
  ARRAY['Social Media','Content Creation','Brand Strategy'],
  p.id
FROM profiles p WHERE p.email = 'andy@ao-kreative.co.ke'
ON CONFLICT DO NOTHING;
