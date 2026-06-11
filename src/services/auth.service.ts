// ============================================================
// src/services/auth.service.ts
// Authentication — wraps Supabase Auth with typed helpers
// ============================================================
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../types/database';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
export interface AuthUser {
  user: User;
  profile: Profile;
  session: Session;
}

export interface SignInResult {
  data: AuthUser | null;
  error: string | null;
}

export interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

// ────────────────────────────────────────────────────────────
// Sign In with email + password
// ────────────────────────────────────────────────────────────
export async function signIn(
  email: string,
  password: string
): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user || !data.session) {
    return {
      data: null,
      error: humaniseAuthError(error),
    };
  }

  const profile = await fetchProfile(data.user.id);
  if (!profile) {
    return { data: null, error: 'Profile not found. Contact your administrator.' };
  }

  return {
    data: { user: data.user, profile, session: data.session },
    error: null,
  };
}

// ────────────────────────────────────────────────────────────
// Sign Up (admin creates new team member)
// ────────────────────────────────────────────────────────────
export async function signUp(payload: SignUpPayload): Promise<{
  error: string | null;
}> {
  const { data, error } = await supabase.auth.signUp({
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    options: {
      data: {
        full_name: payload.fullName,
        role: payload.role ?? 'creative',
      },
    },
  });

  if (error) return { error: humaniseAuthError(error) };
  if (!data.user) return { error: 'Sign-up failed — no user returned.' };

  return { error: null };
}

// ────────────────────────────────────────────────────────────
// Sign Out
// ────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ────────────────────────────────────────────────────────────
// Get current session (on app load)
// ────────────────────────────────────────────────────────────
export async function getCurrentSession(): Promise<AuthUser | null> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) return null;

  const profile = await fetchProfile(session.user.id);
  if (!profile) return null;

  return { user: session.user, profile, session };
}

// ────────────────────────────────────────────────────────────
// Listen for auth state changes
// ────────────────────────────────────────────────────────────
export function onAuthStateChange(
  callback: (authUser: AuthUser | null) => void
) {
  return supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session) {
      callback(null);
      return;
    }
    const profile = await fetchProfile(session.user.id);
    if (!profile) {
      callback(null);
      return;
    }
    callback({ user: session.user, profile, session });
  });
}

// ────────────────────────────────────────────────────────────
// Request password reset email
// ────────────────────────────────────────────────────────────
export async function requestPasswordReset(email: string): Promise<{
  error: string | null;
}> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    }
  );
  return { error: error ? humaniseAuthError(error) : null };
}

// ────────────────────────────────────────────────────────────
// Update password (after clicking reset link)
// ────────────────────────────────────────────────────────────
export async function updatePassword(newPassword: string): Promise<{
  error: string | null;
}> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error ? humaniseAuthError(error) : null };
}

// ────────────────────────────────────────────────────────────
// Update profile
// ────────────────────────────────────────────────────────────
export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_color' | 'role'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error?.message ?? null };
}

// ────────────────────────────────────────────────────────────
// Fetch a single profile by user ID
// ────────────────────────────────────────────────────────────
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

// ────────────────────────────────────────────────────────────
// Fetch all team profiles (for assignee selectors)
// ────────────────────────────────────────────────────────────
export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name');

  if (error) {
    console.error('[Auth] fetchAllProfiles:', error.message);
    return [];
  }
  return data as Profile[];
}

// ────────────────────────────────────────────────────────────
// Internal: humanise Supabase auth errors
// ────────────────────────────────────────────────────────────
function humaniseAuthError(error: AuthError | null): string {
  if (!error) return 'An unknown error occurred.';
  const msg = error.message.toLowerCase();

  if (msg.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (msg.includes('email not confirmed')) return 'Please verify your email before signing in.';
  if (msg.includes('user already registered')) return 'An account with this email already exists.';
  if (msg.includes('rate limit')) return 'Too many attempts. Please wait a moment.';
  if (msg.includes('network')) return 'Network error — check your connection.';

  return error.message;
}
