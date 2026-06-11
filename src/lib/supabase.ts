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

// If environment variables are missing at build time, avoid throwing
// so the bundler can complete the build. We create the real client at
// runtime when credentials are available; during build we export a
// lightweight placeholder to avoid module-evaluation errors.
export type Database = any; // TODO: replace with generated Supabase types

let _supabase: SupabaseClient<Database> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
  });
} else {
  // Warn during build or runtime if credentials are missing
  // This avoids failing the build but gives a clear runtime message.
  // Consumers should ensure env vars are provided for production.
  // eslint-disable-next-line no-console
  console.warn(
    '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. Supabase client will be a noop.'
  );
}

// Export either the real client or a noop proxy that throws on use.
const noopHandler: ProxyHandler<any> = {
  get() {
    return () => {
      throw new Error(
        '[Supabase] Client not configured. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    };
  },
};

export const supabase: SupabaseClient<Database> =
  (_supabase as any) || new Proxy({}, noopHandler);

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
