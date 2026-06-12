import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Profile } from '../../types/database';
import { signOut } from '../../services/auth.service';

interface Props { children: ReactNode; profile: Profile | null; }

const NAV = [
  { path: '/',          label: 'Dashboard',    icon: '⬛', section: 'MAIN' },
  { path: '/clients',   label: 'Clients',      icon: '🏢', section: 'MAIN' },
  { path: '/pipeline',  label: 'Pipeline',     icon: '🎯', section: 'MAIN' },
  { path: '/invoices',  label: 'Invoices',     icon: '🧾', section: 'FINANCE' },
  { path: '/proposals', label: 'Proposals',    icon: '📄', section: 'FINANCE' },
  { path: '/tasks',     label: 'Tasks',        icon: '✅', section: 'WORK' },
  { path: '/calendar',  label: 'Calendar',     icon: '📅', section: 'WORK' },
];

const ROLE_COLOR: Record<string, string> = {
  admin: 'var(--amber)', sales: 'var(--teal)', creative: 'var(--purple)'
};
const AV_COLOR: Record<string, string> = {
  Andy:'#60A5FA', Kafa:'#A78BFA', Barbara:'#F472B6', Ricky:'#2DD4BF'
};

export default function DashboardLayout({ children, profile }: Props) {
  const loc = useLocation();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
  }

  const sections = ['MAIN','FINANCE','WORK'];

  async function handleLogout() {
    await signOut();
    window.location.href = '/';
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'User';
  const avColor = AV_COLOR[firstName] || 'var(--amber)';

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{ position:'fixed', inset:0, zIndex:40, background:'rgba(0,0,0,.6)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width:'var(--sb)', minHeight:'100vh', background:'var(--bg2)',
        borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column',
        flexShrink:0, position:'relative', zIndex:50,
        ...(mobileOpen ? {} : {}),
      }}
        className="sidebar"
      >
        {/* Logo */}
        <div style={{ padding:'1.5rem 1.25rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
          <div style={{
            fontFamily:'var(--fm)', fontSize:9, letterSpacing:'.15em',
            textTransform:'uppercase', color:'var(--amber)',
            background:'var(--amber-d)', border:'1px solid var(--amber-b)',
            padding:'2px 7px', borderRadius:4, display:'inline-flex', marginBottom:'.6rem'
          }}>CRM v4</div>
          <h1 style={{ fontFamily:'var(--fh)', fontSize:'1rem', fontWeight:800, color:'var(--text)' }}>A&O Kreative</h1>
          <p style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>Creative Intelligence</p>
        </div>

        {/* Nav */}
        <nav style={{ padding:'1rem .75rem', flex:1, overflowY:'auto' }}>
          {sections.map(sec => {
            const items = NAV.filter(n => n.section === sec);
            return (
              <div key={sec} style={{ marginBottom:'1.25rem' }}>
                <div style={{
                  fontSize:9, fontWeight:600, letterSpacing:'.12em',
                  textTransform:'uppercase', color:'var(--dim)',
                  padding:'0 .5rem', marginBottom:'.4rem'
                }}>{sec}</div>
                {items.map(item => {
                  const active = loc.pathname === item.path;
                  return (
                    <button key={item.path}
                      onClick={() => { nav(item.path); setMobileOpen(false); }}
                      style={{
                        display:'flex', alignItems:'center', gap:9,
                        padding:'.42rem .6rem', borderRadius:7,
                        cursor:'pointer', fontSize:12.5, width:'100%',
                        textAlign:'left', marginBottom:1, transition:'all .13s',
                        background: active ? 'var(--amber-d)' : 'none',
                        color: active ? 'var(--amber)' : 'var(--muted)',
                        border: active ? '1px solid var(--amber-b)' : '1px solid transparent',
                        fontFamily:'var(--fb)',
                      }}
                    >
                      <span style={{ width:16, textAlign:'center', fontSize:13 }}>{item.icon}</span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{
          padding:'.875rem 1.25rem', borderTop:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:'.6rem'
        }}>
          <div className="av" style={{ background: avColor + '22', color: avColor, flexShrink:0 }}>
            {profile ? initials(profile.full_name) : '??'}
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <div style={{ fontSize:12, fontWeight:500, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {profile?.full_name || 'User'}
            </div>
            <div style={{
              fontSize:10, color: ROLE_COLOR[profile?.role || 'creative'],
              textTransform:'uppercase', letterSpacing:'.06em', fontFamily:'var(--fm)'
            }}>
              {profile?.role || '—'}
            </div>
          </div>
          <button onClick={handleLogout}
            style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:16, padding:4, borderRadius:4, transition:'color .15s' }}
            title="Sign out"
            onMouseOver={e => (e.currentTarget.style.color='var(--red)')}
            onMouseOut={e => (e.currentTarget.style.color='var(--dim)')}
          >↪</button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
        {/* Top bar */}
        <div style={{
          height:54, borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', padding:'0 1.75rem',
          gap:'1rem', flexShrink:0, background:'var(--bg2)'
        }}>
          <div style={{ fontFamily:'var(--fh)', fontSize:'1rem', fontWeight:700, flex:1 }}>
            {NAV.find(n => n.path === loc.pathname)?.label || 'A&O Kreative'}
          </div>
          <div style={{ fontSize:11, color:'var(--dim)', fontFamily:'var(--fm)' }}>
            {new Date().toLocaleDateString('en-KE', { weekday:'short', month:'short', day:'numeric' })}
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex:1, overflowY:'auto', padding:'1.75rem' }}>
          {children}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { position: fixed !important; left: 0; top: 0; bottom: 0; transform: translateX(-100%); transition: transform .2s; z-index: 50; }
          .sidebar.open { transform: translateX(0) !important; }
        }
      `}</style>
    </div>
  );
}
