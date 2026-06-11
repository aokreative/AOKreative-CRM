// ============================================================
// src/services/storage.service.ts
// File upload, download, and deletion via Supabase Storage
// ============================================================
import { supabase, STORAGE_BUCKETS, getSignedUrl } from '../lib/supabase';
import type { Attachment } from '../types/database';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
export type EntityType = 'client' | 'lead' | 'invoice' | 'task' | 'proposal';

export interface UploadResult {
  attachment: Attachment | null;
  signedUrl: string | null;
  error: string | null;
}

// Allowed MIME types for attachments
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ────────────────────────────────────────────────────────────
// Upload a file attachment linked to a CRM entity
// ────────────────────────────────────────────────────────────
export async function uploadAttachment(
  file: File,
  entityType: EntityType,
  entityId: string,
  uploadedBy: string
): Promise<UploadResult> {
  // Validate
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { attachment: null, signedUrl: null, error: `File type "${file.type}" is not allowed.` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { attachment: null, signedUrl: null, error: `File exceeds the 50 MB limit.` };
  }

  // Build storage path:  entity_type/entity_id/timestamp_filename
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${entityType}/${entityId}/${Date.now()}_${safeName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.ATTACHMENTS)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return { attachment: null, signedUrl: null, error: uploadError.message };
  }

  // Record in DB
  const { data: attachment, error: dbError } = await supabase
    .from('attachments')
    .insert({
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      entity_type: entityType,
      entity_id: entityId,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();

  if (dbError) {
    // Clean up orphaned file
    await supabase.storage.from(STORAGE_BUCKETS.ATTACHMENTS).remove([storagePath]);
    return { attachment: null, signedUrl: null, error: dbError.message };
  }

  // Return signed URL so the uploader can preview immediately
  const signedUrl = await getSignedUrl(STORAGE_BUCKETS.ATTACHMENTS, storagePath);

  return { attachment: attachment as Attachment, signedUrl, error: null };
}

// ────────────────────────────────────────────────────────────
// Upload a profile avatar (public bucket)
// ────────────────────────────────────────────────────────────
export async function uploadAvatar(
  file: File,
  userId: string
): Promise<{ publicUrl: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) {
    return { publicUrl: null, error: 'Only image files are allowed for avatars.' };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { publicUrl: null, error: 'Avatar must be under 2 MB.' };
  }

  const ext = file.name.split('.').pop();
  const storagePath = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.AVATARS)
    .upload(storagePath, file, { upsert: true, contentType: file.type });

  if (error) return { publicUrl: null, error: error.message };

  const { data } = supabase.storage
    .from(STORAGE_BUCKETS.AVATARS)
    .getPublicUrl(storagePath);

  return { publicUrl: data.publicUrl, error: null };
}

// ────────────────────────────────────────────────────────────
// Get all attachments for an entity
// ────────────────────────────────────────────────────────────
export async function getAttachments(
  entityType: EntityType,
  entityId: string
): Promise<Array<Attachment & { signedUrl: string | null }>> {
  const { data, error } = await supabase
    .from('attachments')
    .select(`*, uploader:profiles!attachments_uploaded_by_fkey(full_name)`)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  // Enrich with signed URLs (parallel)
  const enriched = await Promise.all(
    (data as Attachment[]).map(async (a) => ({
      ...a,
      signedUrl: await getSignedUrl(STORAGE_BUCKETS.ATTACHMENTS, a.storage_path),
    }))
  );

  return enriched;
}

// ────────────────────────────────────────────────────────────
// Delete an attachment
// ────────────────────────────────────────────────────────────
export async function deleteAttachment(
  attachmentId: string,
  storagePath: string
): Promise<{ error: string | null }> {
  // Remove from storage first
  const { error: storageErr } = await supabase.storage
    .from(STORAGE_BUCKETS.ATTACHMENTS)
    .remove([storagePath]);

  if (storageErr) return { error: storageErr.message };

  // Remove DB record
  const { error: dbErr } = await supabase
    .from('attachments')
    .delete()
    .eq('id', attachmentId);

  return { error: dbErr?.message ?? null };
}

// ────────────────────────────────────────────────────────────
// Format file size for display
// ────────────────────────────────────────────────────────────
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ────────────────────────────────────────────────────────────
// Get icon by MIME type (for attachment list UI)
// ────────────────────────────────────────────────────────────
export function getFileIcon(mimeType: string | null): string {
  if (!mimeType) return '📎';
  if (mimeType.startsWith('image/')) return '🖼';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.startsWith('text/')) return '📃';
  return '📎';
}
