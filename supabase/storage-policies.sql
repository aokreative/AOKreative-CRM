-- ============================================================
-- supabase/storage-policies.sql
-- Run this in Supabase SQL Editor AFTER creating buckets.
--
-- First, create buckets via Dashboard > Storage > New Bucket:
--   1. Name: crm-attachments  | Public: OFF | File size limit: 50MB
--   2. Name: avatars          | Public: ON  | File size limit: 2MB
--      Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
-- ============================================================

-- ── crm-attachments (private) ─────────────────────────────

-- Authenticated users can upload
CREATE POLICY "attach_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'crm-attachments');

-- Authenticated users can read (private = requires signed URL)
CREATE POLICY "attach_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'crm-attachments');

-- Owner or admin can delete
CREATE POLICY "attach_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'crm-attachments'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- ── avatars (public) ──────────────────────────────────────

-- Anyone can read avatars (public bucket)
CREATE POLICY "avatar_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can only upload/replace their own avatar
CREATE POLICY "avatar_insert_own" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatar_update_own" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatar_delete_own" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
