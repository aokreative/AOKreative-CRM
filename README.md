# A&O Kreative CRM v4

Internal CRM for A&O Kreative — built with React + TypeScript + Supabase.

## Stack
- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime)
- **Deploy**: Vercel

## Quick start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/ao-kreative-crm.git
cd ao-kreative-crm

# 2. Install
npm install

# 3. Set up env
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 4. Dev server
npm run dev   # → http://localhost:5173
```

## Deploy to Vercel

1. Push to GitHub
2. Import repo at vercel.com/new
3. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL`
4. Deploy — live in ~90 seconds

See `DEPLOYMENT.md` for the full Supabase setup guide.

## Pages
| Route | Page |
|-------|------|
| `/` | Dashboard — agency stats |
| `/clients` | Client management |
| `/pipeline` | Sales pipeline (Kanban) |
| `/invoices` | Invoicing & revenue tracking |
| `/proposals` | Proposal management |
| `/tasks` | Task board (Kanban) |
| `/calendar` | Team calendar |

## Roles
| Role | Permissions |
|------|-------------|
| admin | Full access |
| sales | Clients, pipeline, invoices, tasks |
| creative | View clients, own tasks only |
