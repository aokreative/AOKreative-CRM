// ============================================================
// src/lib/migrate-localstorage.ts
// One-time migration: reads the original CRM's localStorage
// keys and imports all data into Supabase.
//
// USAGE (run once in browser console on the OLD HTML CRM page):
//   1. Open the old ao-kreative-crm-v3.html in a browser.
//   2. Open DevTools > Console.
//   3. Paste this entire script and press Enter.
//   4. Copy the printed JSON blob.
//   5. Run importLegacyData(blob, supabase, userId) from the new app.
// ============================================================

// ── Step 1: EXPORT (run on old page) ───────────────────────
export function exportLocalStorageData(): string {
  const keys = [
    'aok_clients',
    'aok_leads',
    'aok_tasks',
    'aok_calendar',
    'aok_invoices',
    'aok_proposals',
  ];

  const exported: Record<string, unknown> = {};
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        exported[key] = JSON.parse(raw);
      } catch {
        console.warn(`[migrate] Could not parse ${key}`);
      }
    }
  }

  const blob = JSON.stringify(exported, null, 2);
  console.log('=== COPY THIS JSON ===');
  console.log(blob);
  console.log('=== END ===');
  return blob;
}

// ── Step 2: IMPORT (run from new app after auth) ────────────
interface LegacyClient {
  id: string; name: string; contact: string; email?: string; phone?: string;
  industry?: string; status?: string; color?: string; retainer?: string | number;
  contractEnd?: string; services?: string[]; assignedTo?: string; notes?: string;
}

interface LegacyLead {
  id: string; company: string; name: string; email?: string; phone?: string;
  source?: string; value?: string | number; stage?: string;
  assignedTo?: string; notes?: string;
}

interface LegacyTask {
  id: string; title: string; status?: string; priority?: string;
  due?: string; client?: string; assignedTo?: string; notes?: string;
}

interface LegacyCalEvent {
  id: string; label: string; date: string; time?: string;
  color?: string; notes?: string;
}

interface LegacyInvoice {
  id: string; num?: string; clientId?: string; status?: string;
  issued?: string; due?: string; items?: Array<{
    desc: string; qty: number; price: number;
  }>; notes?: string;
}

export async function importLegacyData(
  jsonBlob: string,
  supabaseClient: any,     // pass your supabase instance
  actorId: string,
  profileIdMap?: Record<string, string> // map old name → new profile UUID
): Promise<{ imported: Record<string, number>; errors: string[] }> {
  const data = JSON.parse(jsonBlob);
  const errors: string[] = [];
  const imported: Record<string, number> = {};

  // ── Clients ──────────────────────────────────────────────
  const legacyClients: LegacyClient[] = data['aok_clients'] ?? [];
  const clientIdMap: Record<string, string> = {};

  for (const c of legacyClients) {
    const { data: row, error } = await supabaseClient.from('clients').insert({
      company_name:     c.name,
      primary_contact:  c.contact,
      email:            c.email ?? null,
      phone:            c.phone ?? null,
      industry:         c.industry ?? null,
      status:           (['Active','Paused','Inactive'].includes(c.status ?? '') ? c.status : 'Active'),
      avatar_color:     c.color ?? '#F59E0B',
      monthly_retainer: c.retainer ? Number(String(c.retainer).replace(/,/g,'')) : null,
      contract_end:     c.contractEnd ?? null,
      services:         c.services ?? [],
      notes:            c.notes ?? null,
      created_by:       actorId,
    }).select('id').single();

    if (error) { errors.push(`Client "${c.name}": ${error.message}`); continue; }
    clientIdMap[c.id] = row.id;
  }
  imported.clients = Object.keys(clientIdMap).length;

  // ── Leads ────────────────────────────────────────────────
  const legacyLeads: LegacyLead[] = data['aok_leads'] ?? [];
  let leadsImported = 0;

  for (const l of legacyLeads) {
    const validStages = ['new','contacted','qualified','proposal','negotiation','closed_won','closed_lost'];
    const { error } = await supabaseClient.from('leads').insert({
      company_name: l.company,
      contact_name: l.name,
      email:        l.email ?? null,
      phone:        l.phone ?? null,
      source:       l.source ?? 'Other',
      deal_value:   l.value ? Number(String(l.value).replace(/,/g,'')) : null,
      stage:        validStages.includes(l.stage ?? '') ? l.stage : 'new',
      notes:        l.notes ?? null,
      created_by:   actorId,
    });
    if (error) { errors.push(`Lead "${l.company}": ${error.message}`); continue; }
    leadsImported++;
  }
  imported.leads = leadsImported;

  // ── Tasks ────────────────────────────────────────────────
  const legacyTasks: LegacyTask[] = data['aok_tasks'] ?? [];
  let tasksImported = 0;

  for (const t of legacyTasks) {
    const validStatuses = ['todo','inprogress','review','done'];
    const { error } = await supabaseClient.from('tasks').insert({
      title:       t.title,
      status:      validStatuses.includes(t.status ?? '') ? t.status : 'todo',
      priority:    ['Low','Medium','High'].includes(t.priority ?? '') ? t.priority : 'Medium',
      due_date:    t.due ?? null,
      notes:       t.notes ?? null,
      created_by:  actorId,
    });
    if (error) { errors.push(`Task "${t.title}": ${error.message}`); continue; }
    tasksImported++;
  }
  imported.tasks = tasksImported;

  // ── Calendar Events ───────────────────────────────────────
  const legacyEvents: LegacyCalEvent[] = [];
  const rawCal = data['aok_calendar'] ?? {};
  for (const [dateKey, evArr] of Object.entries(rawCal)) {
    for (const ev of evArr as LegacyCalEvent[]) {
      legacyEvents.push({ ...ev, date: dateKey });
    }
  }

  let eventsImported = 0;
  for (const ev of legacyEvents) {
    const { error } = await supabaseClient.from('calendar_events').insert({
      label:       ev.label,
      event_date:  ev.date,
      event_time:  ev.time ?? null,
      color:       ev.color ?? '#F59E0B',
      notes:       ev.notes ?? null,
      created_by:  actorId,
    });
    if (error) { errors.push(`Calendar event "${ev.label}": ${error.message}`); continue; }
    eventsImported++;
  }
  imported.calendar_events = eventsImported;

  // ── Invoices ──────────────────────────────────────────────
  const legacyInvoices: LegacyInvoice[] = data['aok_invoices'] ?? [];
  let invoicesImported = 0;

  for (const inv of legacyInvoices) {
    const mappedClientId = inv.clientId ? clientIdMap[inv.clientId] : null;

    // We need a client_id — skip if not found
    if (!mappedClientId) {
      errors.push(`Invoice "${inv.num}": client not found in import, skipped.`);
      continue;
    }

    const { data: invRow, error: invErr } = await supabaseClient.from('invoices').insert({
      invoice_num: inv.num ?? `LEGACY-${Date.now()}`,
      client_id:   mappedClientId,
      status:      ['Draft','Sent','Paid','Overdue'].includes(inv.status ?? '') ? inv.status : 'Draft',
      issue_date:  inv.issued ?? new Date().toISOString().split('T')[0],
      due_date:    inv.due ?? null,
      notes:       inv.notes ?? null,
      created_by:  actorId,
    }).select('id').single();

    if (invErr) { errors.push(`Invoice "${inv.num}": ${invErr.message}`); continue; }

    if (inv.items && inv.items.length > 0) {
      await supabaseClient.from('invoice_items').insert(
        inv.items.map((item, i) => ({
          invoice_id:  invRow.id,
          description: item.desc,
          quantity:    item.qty,
          unit_price:  item.price,
          sort_order:  i,
        }))
      );
    }
    invoicesImported++;
  }
  imported.invoices = invoicesImported;

  // ── Summary ───────────────────────────────────────────────
  console.log('[migrate] Import complete:', imported);
  if (errors.length) console.warn('[migrate] Errors:', errors);

  return { imported, errors };
}
