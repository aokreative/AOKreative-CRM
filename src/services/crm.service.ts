// ============================================================
// src/services/crm.service.ts
// Central API service layer — all CRM data operations
// Replaces every localStorage read/write in the original CRM.
// ============================================================
import { supabase } from '../lib/supabase';
import { logActivity } from './activity.service';
import type {
  Client, ClientInsert, ClientUpdate, ClientWithProfile,
  Lead, LeadInsert, LeadUpdate, LeadWithProfile,
  Task, TaskInsert, TaskUpdate, TaskWithRelations,
  CalendarEvent, CalendarEventInsert, CalendarEventUpdate,
  Invoice, InvoiceInsert, InvoiceUpdate, InvoiceWithClient,
  InvoiceItem, InvoiceItemInsert,
  Proposal, ProposalInsert, ProposalUpdate,
} from '../types/database';

// ─── Generic result wrapper ───────────────────────────────────────────────
export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

function err(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'message' in e) return (e as any).message;
  return 'An unexpected error occurred.';
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════════════════════════════
export const ClientService = {

  async getAll(): Promise<ServiceResult<ClientWithProfile[]>> {
    const { data, error } = await supabase
      .from('clients')
      .select(`
        *,
        assigned_profile:profiles!clients_assigned_to_fkey(
          id, full_name, avatar_color, role
        )
      `)
      .order('company_name');
    return { data: data as ClientWithProfile[] ?? null, error: error?.message ?? null };
  },

  async getById(id: string): Promise<ServiceResult<ClientWithProfile>> {
    const { data, error } = await supabase
      .from('clients')
      .select(`*, assigned_profile:profiles!clients_assigned_to_fkey(*)`)
      .eq('id', id)
      .single();
    return { data: data as ClientWithProfile ?? null, error: error?.message ?? null };
  },

  async create(
    payload: Omit<ClientInsert, 'created_by'>,
    actorId: string
  ): Promise<ServiceResult<Client>> {
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...payload, created_by: actorId })
      .select()
      .single();
    if (data) {
      await logActivity(actorId, 'created', 'client', data.id, {
        company_name: data.company_name,
      });
    }
    return { data: data ?? null, error: error?.message ?? null };
  },

  async update(
    id: string,
    updates: ClientUpdate,
    actorId: string
  ): Promise<ServiceResult<Client>> {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (data) {
      await logActivity(actorId, 'updated', 'client', id, { fields: Object.keys(updates) });
    }
    return { data: data ?? null, error: error?.message ?? null };
  },

  async delete(id: string, actorId: string): Promise<ServiceResult<null>> {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (!error) {
      await logActivity(actorId, 'deleted', 'client', id);
    }
    return { data: null, error: error?.message ?? null };
  },

  /** Fetch linked leads, tasks, invoices for client profile panel */
  async getClientDetail(clientId: string) {
    const [leadsRes, tasksRes, invoicesRes] = await Promise.all([
      supabase.from('leads').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('client_id', clientId).order('due_date'),
      supabase.from('invoices').select('*, items:invoice_items(*)').eq('client_id', clientId).order('issue_date', { ascending: false }),
    ]);
    return {
      leads: leadsRes.data ?? [],
      tasks: tasksRes.data ?? [],
      invoices: invoicesRes.data ?? [],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// LEADS  (pipeline)
// ═══════════════════════════════════════════════════════════════════════════
export const LeadService = {

  async getAll(): Promise<ServiceResult<LeadWithProfile[]>> {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        assigned_profile:profiles!leads_assigned_to_fkey(id, full_name, avatar_color),
        client:clients(id, company_name, avatar_color)
      `)
      .order('created_at', { ascending: false });
    return { data: data as LeadWithProfile[] ?? null, error: error?.message ?? null };
  },

  async create(
    payload: Omit<LeadInsert, 'created_by'>,
    actorId: string
  ): Promise<ServiceResult<Lead>> {
    const { data, error } = await supabase
      .from('leads')
      .insert({ ...payload, created_by: actorId })
      .select()
      .single();
    if (data) {
      await logActivity(actorId, 'created', 'lead', data.id, {
        company: data.company_name,
        value: data.deal_value,
      });
    }
    return { data: data ?? null, error: error?.message ?? null };
  },

  async update(
    id: string,
    updates: LeadUpdate,
    actorId: string
  ): Promise<ServiceResult<Lead>> {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (data && updates.stage) {
      await logActivity(actorId, 'stage_changed', 'lead', id, { stage: updates.stage });
    }
    return { data: data ?? null, error: error?.message ?? null };
  },

  async delete(id: string, actorId: string): Promise<ServiceResult<null>> {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (!error) await logActivity(actorId, 'deleted', 'lead', id);
    return { data: null, error: error?.message ?? null };
  },

  /** Pipeline aggregate — leads grouped by stage with total values */
  async getPipelineSummary() {
    const { data } = await supabase
      .from('leads')
      .select('stage, deal_value');

    const stages = ['new','contacted','qualified','proposal','negotiation','closed_won','closed_lost'];
    return stages.map(stage => ({
      stage,
      count: (data ?? []).filter(l => l.stage === stage).length,
      total: (data ?? [])
        .filter(l => l.stage === stage)
        .reduce((sum, l) => sum + (l.deal_value ?? 0), 0),
    }));
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════
export const TaskService = {

  async getAll(): Promise<ServiceResult<TaskWithRelations[]>> {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assigned_profile:profiles!tasks_assigned_to_fkey(id, full_name, avatar_color),
        client:clients(id, company_name, avatar_color)
      `)
      .order('due_date', { nullsFirst: false });
    return { data: data as TaskWithRelations[] ?? null, error: error?.message ?? null };
  },

  async create(
    payload: Omit<TaskInsert, 'created_by'>,
    actorId: string
  ): Promise<ServiceResult<Task>> {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...payload, created_by: actorId })
      .select()
      .single();
    if (data) await logActivity(actorId, 'created', 'task', data.id, { title: data.title });
    return { data: data ?? null, error: error?.message ?? null };
  },

  async updateStatus(
    id: string,
    status: Task['status'],
    actorId: string
  ): Promise<ServiceResult<Task>> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (data) await logActivity(actorId, 'status_changed', 'task', id, { status });
    return { data: data ?? null, error: error?.message ?? null };
  },

  async update(
    id: string,
    updates: TaskUpdate,
    actorId: string
  ): Promise<ServiceResult<Task>> {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (data) await logActivity(actorId, 'updated', 'task', id);
    return { data: data ?? null, error: error?.message ?? null };
  },

  async delete(id: string, actorId: string): Promise<ServiceResult<null>> {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) await logActivity(actorId, 'deleted', 'task', id);
    return { data: null, error: error?.message ?? null };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR EVENTS
// ═══════════════════════════════════════════════════════════════════════════
export const CalendarService = {

  async getMonth(year: number, month: number): Promise<ServiceResult<CalendarEvent[]>> {
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end = new Date(year, month, 0).toISOString().split('T')[0]; // last day
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('event_date', start)
      .lte('event_date', end)
      .order('event_date');
    return { data: data ?? null, error: error?.message ?? null };
  },

  async create(
    payload: Omit<CalendarEventInsert, 'created_by'>,
    actorId: string
  ): Promise<ServiceResult<CalendarEvent>> {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({ ...payload, created_by: actorId })
      .select()
      .single();
    return { data: data ?? null, error: error?.message ?? null };
  },

  async update(
    id: string,
    updates: CalendarEventUpdate,
    actorId: string
  ): Promise<ServiceResult<CalendarEvent>> {
    const { data, error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data ?? null, error: error?.message ?? null };
  },

  async delete(id: string): Promise<ServiceResult<null>> {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    return { data: null, error: error?.message ?? null };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════════════════════
export const InvoiceService = {

  async getAll(): Promise<ServiceResult<InvoiceWithClient[]>> {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients(id, company_name, email),
        items:invoice_items(*)
      `)
      .order('created_at', { ascending: false });
    return { data: data as InvoiceWithClient[] ?? null, error: error?.message ?? null };
  },

  async getById(id: string): Promise<ServiceResult<InvoiceWithClient>> {
    const { data, error } = await supabase
      .from('invoices')
      .select(`*, client:clients(id, company_name, email), items:invoice_items(*)`)
      .eq('id', id)
      .single();
    return { data: data as InvoiceWithClient ?? null, error: error?.message ?? null };
  },

  /** Generate next invoice number e.g. AOK-2025-0042 */
  async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true });
    const seq = String((count ?? 0) + 1).padStart(4, '0');
    return `AOK-${year}-${seq}`;
  },

  async create(
    invoicePayload: Omit<InvoiceInsert, 'created_by'>,
    items: Omit<InvoiceItemInsert, 'invoice_id'>[],
    actorId: string
  ): Promise<ServiceResult<Invoice>> {
    // 1. Insert invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({ ...invoicePayload, created_by: actorId })
      .select()
      .single();

    if (invErr || !invoice) return { data: null, error: invErr?.message ?? 'Failed to create invoice' };

    // 2. Insert line items
    if (items.length > 0) {
      const lineItems = items.map((item, i) => ({
        ...item,
        invoice_id: invoice.id,
        sort_order: i,
      }));
      const { error: itemsErr } = await supabase.from('invoice_items').insert(lineItems);
      if (itemsErr) return { data: null, error: itemsErr.message };
    }

    await logActivity(actorId, 'created', 'invoice', invoice.id, {
      num: invoice.invoice_num,
    });
    return { data: invoice, error: null };
  },

  async updateStatus(
    id: string,
    status: InvoiceStatus,
    actorId: string
  ): Promise<ServiceResult<Invoice>> {
    const { data, error } = await supabase
      .from('invoices')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (data) await logActivity(actorId, 'status_changed', 'invoice', id, { status });
    return { data: data ?? null, error: error?.message ?? null };
  },

  async update(
    id: string,
    invoiceUpdates: InvoiceUpdate,
    items?: Omit<InvoiceItemInsert, 'invoice_id'>[],
    actorId?: string
  ): Promise<ServiceResult<Invoice>> {
    const { data, error } = await supabase
      .from('invoices')
      .update(invoiceUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    if (items !== undefined) {
      // Replace all items
      await supabase.from('invoice_items').delete().eq('invoice_id', id);
      if (items.length > 0) {
        await supabase.from('invoice_items').insert(
          items.map((item, i) => ({ ...item, invoice_id: id, sort_order: i }))
        );
      }
    }

    if (actorId) await logActivity(actorId, 'updated', 'invoice', id);
    return { data: data ?? null, error: null };
  },

  async delete(id: string, actorId: string): Promise<ServiceResult<null>> {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (!error) await logActivity(actorId, 'deleted', 'invoice', id);
    return { data: null, error: error?.message ?? null };
  },

  /** Revenue summary for dashboard */
  async getRevenueSummary() {
    const { data } = await supabase
      .from('invoices')
      .select('status, total, issue_date');

    const now = new Date();
    const thisMonth = data?.filter(i => {
      const d = new Date(i.issue_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    return {
      totalPaid: (data ?? []).filter(i => i.status === 'Paid').reduce((s,i) => s + i.total, 0),
      totalOutstanding: (data ?? []).filter(i => i.status === 'Sent').reduce((s,i) => s + i.total, 0),
      totalOverdue: (data ?? []).filter(i => i.status === 'Overdue').reduce((s,i) => s + i.total, 0),
      thisMonthRevenue: (thisMonth ?? []).filter(i => i.status === 'Paid').reduce((s,i) => s + i.total, 0),
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PROPOSALS
// ═══════════════════════════════════════════════════════════════════════════
export const ProposalService = {

  async getAll(): Promise<ServiceResult<Proposal[]>> {
    const { data, error } = await supabase
      .from('proposals')
      .select('*, client:clients(id, company_name)')
      .order('updated_at', { ascending: false });
    return { data: data ?? null, error: error?.message ?? null };
  },

  async save(
    payload: Omit<ProposalInsert, 'created_by'>,
    actorId: string
  ): Promise<ServiceResult<Proposal>> {
    const { data, error } = await supabase
      .from('proposals')
      .insert({ ...payload, created_by: actorId })
      .select()
      .single();
    return { data: data ?? null, error: error?.message ?? null };
  },

  async update(
    id: string,
    updates: ProposalUpdate
  ): Promise<ServiceResult<Proposal>> {
    const { data, error } = await supabase
      .from('proposals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data: data ?? null, error: error?.message ?? null };
  },

  async delete(id: string): Promise<ServiceResult<null>> {
    const { error } = await supabase.from('proposals').delete().eq('id', id);
    return { data: null, error: error?.message ?? null };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD AGGREGATE  (single call replaces multiple localStorage reads)
// ═══════════════════════════════════════════════════════════════════════════
export async function getDashboardStats() {
  const [
    { count: clientCount },
    { count: activeLeadCount },
    { count: overdueTaskCount },
    revenue,
    pipeline,
  ] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
    supabase.from('leads').select('id', { count: 'exact', head: true }).not('stage', 'in', '(closed_won,closed_lost)'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'todo').lt('due_date', new Date().toISOString().split('T')[0]),
    InvoiceService.getRevenueSummary(),
    LeadService.getPipelineSummary(),
  ]);

  return {
    activeClients: clientCount ?? 0,
    activeLeads: activeLeadCount ?? 0,
    overdueTasks: overdueTaskCount ?? 0,
    revenue,
    pipeline,
  };
}
