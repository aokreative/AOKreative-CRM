-- ============================================================
-- A&O Kreative CRM — Supabase Schema
-- Migration: 001_initial_schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'creative', 'sales');
CREATE TYPE client_status AS ENUM ('Active', 'Paused', 'Inactive');
CREATE TYPE lead_stage AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost');
CREATE TYPE lead_source AS ENUM ('Instagram', 'Referral', 'Cold Outreach', 'Website', 'Event', 'LinkedIn', 'Other');
CREATE TYPE task_status AS ENUM ('todo', 'inprogress', 'review', 'done');
CREATE TYPE task_priority AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE invoice_status AS ENUM ('Draft', 'Sent', 'Paid', 'Overdue');
CREATE TYPE event_color AS ENUM ('#10B981', '#60A5FA', '#F59E0B', '#A78BFA', '#2DD4BF', '#FB923C', '#F87171');

-- ────────────────────────────────────────────────────────────
-- PROFILES  (extends auth.users)
-- ────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'creative',
  avatar_color TEXT NOT NULL DEFAULT '#F59E0B',
  email       TEXT UNIQUE NOT NULL,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- CLIENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE clients (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name     TEXT NOT NULL,
  primary_contact  TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  industry         TEXT,
  status           client_status NOT NULL DEFAULT 'Active',
  avatar_color     TEXT NOT NULL DEFAULT '#F59E0B',
  monthly_retainer NUMERIC(12,2),
  contract_end     TEXT,
  services         TEXT[] DEFAULT '{}',
  assigned_to      UUID REFERENCES profiles(id),
  notes            TEXT,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- LEADS  (pipeline)
-- ────────────────────────────────────────────────────────────
CREATE TABLE leads (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  source       lead_source NOT NULL DEFAULT 'Other',
  deal_value   NUMERIC(12,2),
  stage        lead_stage NOT NULL DEFAULT 'new',
  assigned_to  UUID REFERENCES profiles(id),
  notes        TEXT,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- TASKS
-- ────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  status       task_status NOT NULL DEFAULT 'todo',
  priority     task_priority NOT NULL DEFAULT 'Medium',
  due_date     DATE,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  assigned_to  UUID REFERENCES profiles(id),
  created_by   UUID REFERENCES profiles(id),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- CALENDAR EVENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE calendar_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label       TEXT NOT NULL,
  event_date  DATE NOT NULL,
  event_time  TIME,
  color       TEXT NOT NULL DEFAULT '#F59E0B',
  notes       TEXT,
  client_id   UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- INVOICES
-- ────────────────────────────────────────────────────────────
CREATE TABLE invoices (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_num  TEXT NOT NULL UNIQUE,
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  status       invoice_status NOT NULL DEFAULT 'Draft',
  issue_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date     DATE,
  subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate     NUMERIC(5,4) NOT NULL DEFAULT 0.16,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- INVOICE LINE ITEMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE invoice_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total  NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ────────────────────────────────────────────────────────────
-- PROPOSALS
-- ────────────────────────────────────────────────────────────
CREATE TABLE proposals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  client_id   UUID REFERENCES clients(id) ON DELETE SET NULL,
  content     JSONB,              -- stores proposal builder state
  notes       TEXT,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- FILE ATTACHMENTS  (linked to any entity)
-- ────────────────────────────────────────────────────────────
CREATE TABLE attachments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storage_path  TEXT NOT NULL,           -- path in Supabase Storage bucket
  file_name     TEXT NOT NULL,
  mime_type     TEXT,
  size_bytes    BIGINT,
  entity_type   TEXT NOT NULL,           -- 'client' | 'lead' | 'invoice' | 'task' | 'proposal'
  entity_id     UUID NOT NULL,
  uploaded_by   UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- ACTIVITY LOG  (audit trail)
-- ────────────────────────────────────────────────────────────
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES profiles(id),
  action      TEXT NOT NULL,            -- 'created' | 'updated' | 'deleted' | 'stage_changed' | etc.
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_clients_assigned   ON clients(assigned_to);
CREATE INDEX idx_clients_status     ON clients(status);
CREATE INDEX idx_leads_stage        ON leads(stage);
CREATE INDEX idx_leads_assigned     ON leads(assigned_to);
CREATE INDEX idx_tasks_status       ON tasks(status);
CREATE INDEX idx_tasks_assigned     ON tasks(assigned_to);
CREATE INDEX idx_tasks_due_date     ON tasks(due_date);
CREATE INDEX idx_invoices_client    ON invoices(client_id);
CREATE INDEX idx_invoices_status    ON invoices(status);
CREATE INDEX idx_calendar_date      ON calendar_events(event_date);
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX idx_activity_entity    ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_actor     ON activity_log(actor_id);

-- ────────────────────────────────────────────────────────────
-- AUTO-UPDATE updated_at TRIGGER
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated   BEFORE UPDATE ON profiles         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated    BEFORE UPDATE ON clients          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leads_updated      BEFORE UPDATE ON leads            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated      BEFORE UPDATE ON tasks            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated   BEFORE UPDATE ON invoices         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_proposals_updated  BEFORE UPDATE ON proposals        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_calendar_updated   BEFORE UPDATE ON calendar_events  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- AUTO-RECALCULATE invoice totals TRIGGER
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_invoice_id UUID;
  v_subtotal   NUMERIC;
  v_vat_rate   NUMERIC;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(quantity * unit_price), 0), vat_rate
    INTO v_subtotal, v_vat_rate
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
   WHERE ii.invoice_id = v_invoice_id
   GROUP BY i.vat_rate;
  UPDATE invoices SET
    subtotal = v_subtotal,
    total    = ROUND(v_subtotal * (1 + COALESCE(v_vat_rate, 0.16)), 2)
  WHERE id = v_invoice_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_items_recalc
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION recalculate_invoice_totals();

-- ────────────────────────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'creative')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

-- Helper: get current user role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Helper: is admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT current_user_role() = 'admin';
$$;

-- Enable RLS on all tables
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log     ENABLE ROW LEVEL SECURITY;

-- ── PROFILES policies ──────────────────────────────────────
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (is_admin());

-- ── CLIENTS policies ───────────────────────────────────────
-- Everyone authenticated can read clients
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Sales & Admin can create
CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (
    current_user_role() IN ('admin', 'sales')
  );

-- Assigned user, admin, or sales manager can update
CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (
    is_admin()
    OR assigned_to = auth.uid()
    OR current_user_role() = 'sales'
  );

-- Only admin can delete
CREATE POLICY "clients_delete" ON clients
  FOR DELETE USING (is_admin());

-- ── LEADS policies ─────────────────────────────────────────
CREATE POLICY "leads_select" ON leads
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "leads_insert" ON leads
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'sales'));

CREATE POLICY "leads_update" ON leads
  FOR UPDATE USING (
    is_admin()
    OR assigned_to = auth.uid()
    OR current_user_role() = 'sales'
  );

CREATE POLICY "leads_delete" ON leads
  FOR DELETE USING (is_admin() OR current_user_role() = 'sales');

-- ── TASKS policies ─────────────────────────────────────────
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    is_admin()
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (
    is_admin()
    OR created_by = auth.uid()
  );

-- ── CALENDAR EVENTS policies ───────────────────────────────
CREATE POLICY "cal_select" ON calendar_events
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "cal_insert" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "cal_update" ON calendar_events
  FOR UPDATE USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "cal_delete" ON calendar_events
  FOR DELETE USING (is_admin() OR created_by = auth.uid());

-- ── INVOICES policies ──────────────────────────────────────
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'sales'));

CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (current_user_role() IN ('admin', 'sales'));

CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (is_admin());

-- ── INVOICE ITEMS policies ─────────────────────────────────
CREATE POLICY "inv_items_select" ON invoice_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "inv_items_insert" ON invoice_items
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'sales'));

CREATE POLICY "inv_items_update" ON invoice_items
  FOR UPDATE USING (current_user_role() IN ('admin', 'sales'));

CREATE POLICY "inv_items_delete" ON invoice_items
  FOR DELETE USING (current_user_role() IN ('admin', 'sales'));

-- ── PROPOSALS policies ─────────────────────────────────────
CREATE POLICY "proposals_select" ON proposals
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "proposals_write" ON proposals
  FOR ALL USING (
    is_admin()
    OR created_by = auth.uid()
    OR current_user_role() = 'sales'
  );

-- ── ATTACHMENTS policies ───────────────────────────────────
CREATE POLICY "attachments_select" ON attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "attachments_delete" ON attachments
  FOR DELETE USING (
    is_admin()
    OR uploaded_by = auth.uid()
  );

-- ── ACTIVITY LOG policies ──────────────────────────────────
CREATE POLICY "activity_select" ON activity_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "activity_insert" ON activity_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only admin can purge logs
CREATE POLICY "activity_delete" ON activity_log
  FOR DELETE USING (is_admin());

-- ────────────────────────────────────────────────────────────
-- STORAGE BUCKETS
-- ────────────────────────────────────────────────────────────
-- Run these in Supabase Dashboard > Storage, or via API.
-- Bucket: 'crm-attachments' (private, max 50MB per file)
-- Bucket: 'avatars'         (public,  max 2MB per file)

-- Storage RLS for crm-attachments:
-- INSERT: authenticated users
-- SELECT: authenticated users (private bucket)
-- DELETE: uploader or admin
