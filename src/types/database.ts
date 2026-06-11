// ============================================================
// A&O Kreative CRM — Database Types
// Auto-generated base types; extend in domain files as needed.
// ============================================================

export type UserRole = 'admin' | 'creative' | 'sales';
export type ClientStatus = 'Active' | 'Paused' | 'Inactive';
export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
export type LeadSource = 'Instagram' | 'Referral' | 'Cold Outreach' | 'Website' | 'Event' | 'LinkedIn' | 'Other';
export type TaskStatus = 'todo' | 'inprogress' | 'review' | 'done';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';

// ────────────────────────────────────────────────────────────
// Base DB rows (mirrors Supabase schema exactly)
// ────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_color: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  company_name: string;
  primary_contact: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  status: ClientStatus;
  avatar_color: string;
  monthly_retainer: number | null;
  contract_end: string | null;
  services: string[];
  assigned_to: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  company_name: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  deal_value: number | null;
  stage: LeadStage;
  assigned_to: string | null;
  notes: string | null;
  client_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  client_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  label: string;
  event_date: string;
  event_time: string | null;
  color: string;
  notes: string | null;
  client_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_num: string;
  client_id: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  vat_rate: number;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;    // computed column
  sort_order: number;
}

export interface Proposal {
  id: string;
  name: string;
  client_id: string | null;
  content: Record<string, unknown> | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  entity_type: 'client' | 'lead' | 'invoice' | 'task' | 'proposal';
  entity_id: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ────────────────────────────────────────────────────────────
// Enriched / joined types (used in UI components)
// ────────────────────────────────────────────────────────────
export interface ClientWithProfile extends Client {
  assigned_profile?: Profile;
}

export interface LeadWithProfile extends Lead {
  assigned_profile?: Profile;
  client?: Client;
}

export interface TaskWithRelations extends Task {
  assigned_profile?: Profile;
  client?: Pick<Client, 'id' | 'company_name' | 'avatar_color'>;
}

export interface InvoiceWithClient extends Invoice {
  client: Pick<Client, 'id' | 'company_name' | 'email'>;
  items: InvoiceItem[];
}

// ────────────────────────────────────────────────────────────
// Insert / Update DTOs  (omit DB-managed fields)
// ────────────────────────────────────────────────────────────
export type ClientInsert = Omit<Client, 'id' | 'created_at' | 'updated_at'>;
export type ClientUpdate = Partial<ClientInsert>;

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at'>;
export type LeadUpdate = Partial<LeadInsert>;

export type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at'>;
export type TaskUpdate = Partial<TaskInsert>;

export type CalendarEventInsert = Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>;
export type CalendarEventUpdate = Partial<CalendarEventInsert>;

export type InvoiceInsert = Omit<Invoice, 'id' | 'subtotal' | 'total' | 'created_at' | 'updated_at'>;
export type InvoiceUpdate = Partial<InvoiceInsert>;

export type InvoiceItemInsert = Omit<InvoiceItem, 'id' | 'line_total'>;

export type ProposalInsert = Omit<Proposal, 'id' | 'created_at' | 'updated_at'>;
export type ProposalUpdate = Partial<ProposalInsert>;

// ────────────────────────────────────────────────────────────
// Permissions matrix (mirrors RLS logic in TypeScript)
// ────────────────────────────────────────────────────────────
export const ROLE_PERMISSIONS = {
  admin: {
    canManageUsers: true,
    canDeleteAny: true,
    canViewInvoices: true,
    canEditInvoices: true,
    canManageClients: true,
    canManageLeads: true,
    canViewActivityLog: true,
  },
  sales: {
    canManageUsers: false,
    canDeleteAny: false,
    canViewInvoices: true,
    canEditInvoices: true,
    canManageClients: true,
    canManageLeads: true,
    canViewActivityLog: true,
  },
  creative: {
    canManageUsers: false,
    canDeleteAny: false,
    canViewInvoices: false,
    canEditInvoices: false,
    canManageClients: false,
    canManageLeads: false,
    canViewActivityLog: false,
  },
} satisfies Record<UserRole, Record<string, boolean>>;
