// ============================================================
// src/services/activity.service.ts
// Activity / audit log — records every meaningful CRM action
// ============================================================
import { supabase } from '../lib/supabase';
import type { ActivityLog } from '../types/database';

export async function logActivity(
  actorId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata: metadata ?? null,
  });
  if (error) console.warn('[Activity] Failed to log:', error.message);
}

export async function getRecentActivity(limit = 20): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select(`
      *,
      actor:profiles!activity_log_actor_id_fkey(id, full_name, avatar_color)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Activity] getRecentActivity:', error.message);
    return [];
  }
  return data ?? [];
}

export async function getEntityActivity(
  entityType: string,
  entityId: string
): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select(`*, actor:profiles!activity_log_actor_id_fkey(id, full_name, avatar_color)`)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data ?? [];
}
