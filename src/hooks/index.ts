// ============================================================
// src/hooks/index.ts
// React hooks — data fetching, auth state, realtime subscriptions
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { onAuthStateChange, getCurrentSession } from '../services/auth.service';
import {
  ClientService, LeadService, TaskService,
  CalendarService, InvoiceService, getDashboardStats,
} from '../services/crm.service';
import type {
  Profile, Client, Lead, Task, CalendarEvent,
  Invoice, ClientWithProfile, LeadWithProfile, TaskWithRelations,
} from '../types/database';
import type { AuthUser } from '../services/auth.service';

// ═══════════════════════════════════════════════════════════
// useAuth — current session + profile
// ═══════════════════════════════════════════════════════════
export function useAuth() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentSession().then((u) => {
      setAuthUser(u);
      setLoading(false);
    });

    const { data: { subscription } } = onAuthStateChange((u) => {
      setAuthUser(u);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = authUser?.profile.role === 'admin';
  const isSales = authUser?.profile.role === 'sales' || isAdmin;
  const isCreative = authUser?.profile.role === 'creative';

  return { authUser, loading, isAdmin, isSales, isCreative };
}

// ═══════════════════════════════════════════════════════════
// Generic async data hook factory
// ═══════════════════════════════════════════════════════════
function useAsync<T>(
  fetcher: () => Promise<{ data: T | null; error: string | null }>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const result = await fetcher();
    setData(result.data);
    setError(result.error);
    setLoading(false);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch, setData };
}

// ═══════════════════════════════════════════════════════════
// useClients — with realtime subscription
// ═══════════════════════════════════════════════════════════
export function useClients() {
  const result = useAsync<ClientWithProfile[]>(
    () => ClientService.getAll(),
    []
  );

  // Realtime: re-fetch on any change to clients table
  useEffect(() => {
    const channel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        result.refetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [result.refetch]);

  return result;
}

// ═══════════════════════════════════════════════════════════
// useLeads — with realtime
// ═══════════════════════════════════════════════════════════
export function useLeads() {
  const result = useAsync<LeadWithProfile[]>(
    () => LeadService.getAll(),
    []
  );

  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        result.refetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [result.refetch]);

  return result;
}

// ═══════════════════════════════════════════════════════════
// useTasks — with realtime
// ═══════════════════════════════════════════════════════════
export function useTasks() {
  const result = useAsync<TaskWithRelations[]>(
    () => TaskService.getAll(),
    []
  );

  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        result.refetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [result.refetch]);

  return result;
}

// ═══════════════════════════════════════════════════════════
// useCalendar — fetches current month, exposes navigation
// ═══════════════════════════════════════════════════════════
export function useCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await CalendarService.getMonth(year, month);
    setEvents(data ?? []);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // Events indexed by date string for O(1) lookup
  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    (acc[ev.event_date] = acc[ev.event_date] ?? []).push(ev);
    return acc;
  }, {});

  return { events, eventsByDate, year, month, loading, prevMonth, nextMonth, refetch: fetchEvents };
}

// ═══════════════════════════════════════════════════════════
// useInvoices
// ═══════════════════════════════════════════════════════════
export function useInvoices() {
  return useAsync(() => InvoiceService.getAll(), []);
}

// ═══════════════════════════════════════════════════════════
// useDashboard — aggregated stats
// ═══════════════════════════════════════════════════════════
export function useDashboard() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDashboardStats>> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const data = await getDashboardStats();
    setStats(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime: re-aggregate when key tables change
  useEffect(() => {
    const tables = ['clients', 'leads', 'tasks', 'invoices'];
    const channels = tables.map(table =>
      supabase
        .channel(`dash-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          fetch();
        })
        .subscribe()
    );
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [fetch]);

  return { stats, loading, refetch: fetch };
}

// ═══════════════════════════════════════════════════════════
// useProfiles — team members for assignee selectors
// ═══════════════════════════════════════════════════════════
export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('full_name')
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  return { profiles };
}

// ═══════════════════════════════════════════════════════════
// useClientDetail — profile panel data
// ═══════════════════════════════════════════════════════════
export function useClientDetail(clientId: string | null) {
  const [detail, setDetail] = useState<{
    leads: Lead[]; tasks: Task[]; invoices: Invoice[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) { setDetail(null); return; }
    setLoading(true);
    ClientService.getClientDetail(clientId).then(d => {
      setDetail(d);
      setLoading(false);
    });
  }, [clientId]);

  return { detail, loading };
}

// ═══════════════════════════════════════════════════════════
// usePermissions — gate UI elements based on role
// ═══════════════════════════════════════════════════════════
export function usePermissions(profile: Profile | undefined) {
  const role = profile?.role ?? 'creative';
  return {
    canManageUsers:   role === 'admin',
    canDeleteAny:     role === 'admin',
    canViewInvoices:  role !== 'creative',
    canEditInvoices:  role !== 'creative',
    canManageClients: role !== 'creative',
    canManageLeads:   role !== 'creative',
    canViewActivity:  role !== 'creative',
    canEditOwn:       true,
  };
}
