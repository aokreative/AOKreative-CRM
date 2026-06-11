// ============================================================
// src/lib/supabase.ts
// Typed Supabase client — single instance for the app
// ============================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Environment variables (Vite / Next.js / plain JS compatible) ───────────
const supabaseUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
    'Copy .env.example to .env.local and fill in your project credentials.'
  );
}

// ── Typed database schema (generated via `supabase gen types typescript`) ──
// For now we use a generic typed client; swap in generated types when ready.
export type Database = any; // TODO: replace with generated Supabase types

export const supabase: SupabaseClient<Database> = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'x-application-name': 'ao-kreative-crm',
      },
    },
  }
);

// ── Storage bucket names ───────────────────────────────────────────────────
export const STORAGE_BUCKETS = {
  ATTACHMENTS: 'crm-attachments',
  AVATARS: 'avatars',
} as const;

// ── Convenience helpers ────────────────────────────────────────────────────

/** Returns the public URL for a file in a PRIVATE bucket (signed URL, 1h) */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.error('[Storage] getSignedUrl error:', error.message);
    return null;
  }
  return data.signedUrl;
}

/** Returns the public URL for a file in a PUBLIC bucket */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export default supabase;
