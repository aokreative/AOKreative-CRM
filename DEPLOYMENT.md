# A&O Kreative CRM — Supabase + Vercel Deployment Guide

> Note: For a quick deploy I replaced the `@...` secret references in `vercel.json` with placeholder values so the Vercel build can run. These are NOT real secrets — create Vercel project secrets named `supabase_url`, `supabase_anon_key`, and `app_url` and replace the placeholders for production.

## What's in this package

```
ao-kreative-crm/
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   ← Full DB schema + RLS + triggers
│   ├── seed.sql                     ← Initial team member accounts
│   ├── storage-policies.sql         ← Storage bucket RLS
│   └── config.toml                  ← Supabase CLI config (local dev)
├── src/
│   ├── types/
│   │   └── database.ts              ← Full TypeScript type system
│   ├── lib/
│   │   ├── supabase.ts              ← Typed client singleton
│   │   └── migrate-localstorage.ts  ← One-time data migration helper
│   ├── services/
│   │   ├── auth.service.ts          ← Login, logout, password reset, profiles
│   │   ├── crm.service.ts           ← All CRUD: clients, leads, tasks, invoices
│   │   ├── storage.service.ts       ← File uploads, downloads, attachments
│   │   └── activity.service.ts      ← Audit trail / activity log
│   └── hooks/
│       └── index.ts                 ← React hooks (data + realtime + permissions)
├── .env.example                     ← Copy → .env.local
├── vercel.json                      ← Deployment config + security headers
└── package.json
```

---

## PHASE 1 — Supabase Project Setup (15 minutes)

### 1.1 Create project

1. Go to **https://supabase.com** → New Project
2. Name: `ao-kreative-crm`
3. Region: **Central Africa (or closest)** — Cape Town or Mumbai
4. Password: generate a strong one, save it in your password manager
5. Click **Create new project** and wait ~2 minutes

### 1.2 Run the schema migration

1. In Supabase Dashboard → **SQL Editor** → New Query
2. Paste the entire contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run** — should complete with no errors
4. Confirm in **Table Editor** that you see: `profiles`, `clients`, `leads`, `tasks`, `calendar_events`, `invoices`, `invoice_items`, `proposals`, `attachments`, `activity_log`

### 1.3 Create storage buckets

1. Dashboard → **Storage** → New Bucket
   - Name: `crm-attachments` | Public: **OFF** | Max file size: **52428800** (50 MB)
2. New Bucket again:
   - Name: `avatars` | Public: **ON** | Max file size: **2097152** (2 MB)
   - Allowed MIME types: `image/jpeg, image/png, image/gif, image/webp`
3. Run `supabase/storage-policies.sql` in SQL Editor to apply RLS

### 1.4 Get your API credentials

Dashboard → **Settings** → **API**:
- Copy **Project URL** → `VITE_SUPABASE_URL`
- Copy **anon / public key** → `VITE_SUPABASE_ANON_KEY`

### 1.5 Configure Auth

Dashboard → **Authentication** → **Settings**:
- **Site URL**: `https://crm.ao-kreative.co.ke` (your custom domain)
- **Redirect URLs**: add `https://crm.ao-kreative.co.ke/**` and `https://ao-kreative-crm.vercel.app/**`
- **Disable** "Enable email confirmations" for internal tool (or keep ON for security)
- **Enable**: Secure password change
- **Minimum password length**: 10

### 1.6 Create team accounts

Dashboard → **Authentication** → **Users** → **Invite user**:

| Name    | Email                        | Role     |
|---------|------------------------------|----------|
| Andy    | andy@ao-kreative.co.ke       | admin    |
| Kafa    | kafa@ao-kreative.co.ke       | creative |
| Barbara | barbara@ao-kreative.co.ke    | creative |
| Ricky   | ricky@ao-kreative.co.ke      | sales    |

After each user accepts their invite and sets a password, run this in SQL Editor to assign their role:
```sql
-- Replace email and role as needed
UPDATE profiles
SET role = 'admin'
WHERE email = 'andy@ao-kreative.co.ke';

UPDATE profiles SET role = 'sales'    WHERE email = 'ricky@ao-kreative.co.ke';
UPDATE profiles SET role = 'creative' WHERE email = 'kafa@ao-kreative.co.ke';
UPDATE profiles SET role = 'creative' WHERE email = 'barbara@ao-kreative.co.ke';
```

---

## PHASE 2 — Migrate existing data (10 minutes)

### 2.1 Export from old CRM

1. Open your old `ao-kreative-crm-v3.html` in a browser
2. Open DevTools (F12) → Console
3. Paste this and press Enter:
```javascript
const keys = ['aok_clients','aok_leads','aok_tasks','aok_calendar','aok_invoices','aok_proposals'];
const out = {};
keys.forEach(k => { const v = localStorage.getItem(k); if(v) out[k] = JSON.parse(v); });
copy(JSON.stringify(out));
console.log('✅ Data copied to clipboard! Paste into a file called legacy-data.json');
```
4. Save the clipboard contents as `legacy-data.json`

### 2.2 Import into Supabase

In your new app (after Andy logs in), run from browser console:
```javascript
import { importLegacyData } from './src/lib/migrate-localstorage.ts';
import { supabase } from './src/lib/supabase.ts';

const blob = await fetch('/legacy-data.json').then(r => r.text());
const result = await importLegacyData(blob, supabase, 'ANDY_USER_UUID');
console.log('Imported:', result.imported);
console.log('Errors:', result.errors);
```

Replace `ANDY_USER_UUID` with Andy's actual UUID from `profiles` table.

Expected output:
```
Imported: { clients: 5, leads: 12, tasks: 8, calendar_events: 15, invoices: 3 }
Errors: []
```

---

## PHASE 3 — Connect to your React app (30 minutes)

### 3.1 Integrate the service layer

The services replace all localStorage calls 1-for-1:

| Old code (localStorage)               | New code (Supabase service)                              |
|---------------------------------------|----------------------------------------------------------|
| `clients = JSON.parse(localStorage.getItem('aok_clients'))` | `const { data } = await ClientService.getAll()` |
| `localStorage.setItem('aok_clients', ...)` | `await ClientService.create(payload, userId)` |
| Manual filter/sort in JS              | SQL-level filtering, indexed queries                     |
| No realtime                           | `useClients()` hook auto-refreshes on any change         |

### 3.2 Wrap the app with auth gate

```tsx
// src/App.tsx
import { useAuth } from './hooks';
import { LoginPage } from './pages/LoginPage';
import { CRMApp } from './pages/CRMApp';

export function App() {
  const { authUser, loading } = useAuth();

  if (loading) return <div className="splash">Loading…</div>;
  if (!authUser) return <LoginPage />;

  return <CRMApp user={authUser} />;
}
```

### 3.3 Replace login logic

```typescript
// In your login form handler:
import { signIn } from './services/auth.service';

async function handleLogin(email: string, password: string) {
  const { data, error } = await signIn(email, password);
  if (error) {
    showError(error); // e.g. "Incorrect email or password."
    return;
  }
  // data.profile.role is 'admin' | 'creative' | 'sales'
  navigateToDashboard();
}
```

### 3.4 Use permission gates

```tsx
import { usePermissions } from './hooks';

function InvoicesPage({ profile }) {
  const perms = usePermissions(profile);

  if (!perms.canViewInvoices) {
    return <div>Access restricted to Admin and Sales roles.</div>;
  }

  return <InvoicesList />;
}
```

### 3.5 Wire up file uploads

```typescript
import { uploadAttachment } from './services/storage.service';

async function handleFileSelect(file: File, clientId: string, userId: string) {
  const { attachment, signedUrl, error } = await uploadAttachment(
    file, 'client', clientId, userId
  );
  if (error) return showToast(`Upload failed: ${error}`);
  // attachment is now in DB, signedUrl is a 1-hour preview link
  showPreview(signedUrl);
}
```

---

## PHASE 4 — Deploy to Vercel (10 minutes)

### 4.1 Push to GitHub

```bash
git init
git add .
git commit -m "feat: A&O Kreative CRM with Supabase backend"
git remote add origin https://github.com/your-username/ao-kreative-crm.git
git push -u origin main
```

### 4.2 Deploy on Vercel

1. Go to **https://vercel.com/new**
2. Import your GitHub repo
3. Framework: **Vite** (auto-detected)
4. Add environment variables:

```
VITE_SUPABASE_URL       = https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY  = eyJ...
VITE_APP_URL            = https://crm.ao-kreative.co.ke
```

5. Click **Deploy** — live in ~90 seconds

### 4.3 Add custom domain (optional)

Vercel Dashboard → your project → **Settings** → **Domains**:
- Add `crm.ao-kreative.co.ke`
- Add the CNAME record to your DNS: `crm` → `cname.vercel-dns.com`
- SSL is automatic

---

## PHASE 5 — Generate TypeScript types (optional but recommended)

Once your schema is live, generate fully-typed DB types:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref xxxxxxxxxxxxxxxxxxxx

# Generate types
npm run supabase:types
# → writes src/types/supabase.generated.ts
```

Then in `src/lib/supabase.ts`, replace:
```typescript
export type Database = any;
```
with:
```typescript
import type { Database } from '../types/supabase.generated';
```

This gives you full autocomplete on every `.from('table').select(...)` call.

---

## Role Permissions Matrix

| Feature                  | Admin | Sales | Creative |
|--------------------------|:-----:|:-----:|:--------:|
| View Dashboard           | ✅    | ✅    | ✅       |
| View Clients             | ✅    | ✅    | ✅       |
| Add / Edit Clients       | ✅    | ✅    | ❌       |
| Delete Clients           | ✅    | ❌    | ❌       |
| View Pipeline / Leads    | ✅    | ✅    | ✅       |
| Add / Edit Leads         | ✅    | ✅    | ❌       |
| View Invoices            | ✅    | ✅    | ❌       |
| Create / Edit Invoices   | ✅    | ✅    | ❌       |
| Delete Invoices          | ✅    | ❌    | ❌       |
| Tasks (all)              | ✅    | ✅    | Own only |
| Calendar (all)           | ✅    | ✅    | Own only |
| File Uploads             | ✅    | ✅    | ✅       |
| View Activity Log        | ✅    | ✅    | ❌       |
| Manage Team / Users      | ✅    | ❌    | ❌       |

---

## Local development

```bash
# 1. Clone and install
git clone https://github.com/your-username/ao-kreative-crm.git
cd ao-kreative-crm
npm install

# 2. Set up env
cp .env.example .env.local
# Fill in your Supabase credentials

# 3. (Optional) Run Supabase locally
npm install -g supabase
supabase start
# Use the local URLs from `supabase status` in .env.local

# 4. Start dev server
npm run dev
# → http://localhost:5173
```

---

## Security checklist

- [x] Row Level Security enabled on all tables
- [x] Anon key only in frontend (never service_role key)
- [x] Signed URLs for private file access (1h expiry)
- [x] File type allowlist enforced client + server side
- [x] Max file size enforced (50 MB attachments, 2 MB avatars)
- [x] HTTPS enforced via Vercel + HSTS header
- [x] Content Security Policy headers in vercel.json
- [x] Auth sign-up disabled (invite-only team)
- [x] Minimum password length: 10 characters
- [x] Audit trail: all creates/updates/deletes logged
- [ ] TODO: Enable Supabase PITR (Point-in-Time Recovery) on Pro plan
- [ ] TODO: Set up weekly automated backup export

---

## Troubleshooting

**"Missing VITE_SUPABASE_URL"** → `.env.local` not created or Vite not restarted.

**"Profile not found"** → User signed up but trigger didn't fire. Run manually:
```sql
INSERT INTO profiles (id, full_name, email)
SELECT id, raw_user_meta_data->>'full_name', email FROM auth.users WHERE id = '<uuid>';
```

**RLS blocking reads** → Check `auth.uid()` is set. If testing in SQL Editor, run:
```sql
SELECT auth.uid(); -- should return a UUID, not null
```

**Realtime not updating** → Ensure Realtime is enabled in Supabase Dashboard → Database → Replication → `supabase_realtime` publication includes your tables.

**Invoice totals not calculating** → The trigger `trg_invoice_items_recalc` recalculates on insert/update/delete of `invoice_items`. Verify it exists:
```sql
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'trg_invoice_items_recalc';
```
