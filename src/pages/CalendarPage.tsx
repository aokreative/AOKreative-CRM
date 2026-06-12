import { useState } from 'react';
import { useCalendar } from '../hooks';
import { CalendarService } from '../services/crm.service';
import { CalendarEvent, Profile } from '../types/database';

interface Props { profile: Profile | null; }

const TYPE_CHIP: Record<string, string> = { meeting:'cb', deadline:'cr', call:'cg', reminder:'ca' };
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function CalendarPage({ profile }: Props) {
  const { data: events, loading, refresh } = useCalendar();
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);

  const BLANK = { title:'', date: today.toISOString().slice(0,10), time:'', type:'meeting' as CalendarEvent['type'], notes:'', created_by: profile?.id||'' };
  const [form, setForm]   = useState({ ...BLANK });

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  function eventsForDay(d: number) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return events.filter(e => e.date === ds);
  }

  async function save() {
    if (!form.title || !form.date) return;
    setSaving(true);
    await CalendarService.create({ ...form, created_by: profile?.id||'' });
    setSaving(false); setOpen(false); refresh();
  }

  async function del(id: string) {
    await CalendarService.delete(id); refresh();
  }

  const upcoming = events
    .filter(e => new Date(e.date) >= new Date(today.toDateString()))
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  return (
    <div>
      <div className="page-hdr">
        <div><h2>Calendar</h2><p>{events.length} upcoming events</p></div>
        <button className="btn btn-primary" onClick={()=>{ setForm({ ...BLANK, created_by:profile?.id||'' }); setOpen(true); }}>+ Add Event</button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner"></div><span>Loading…</span></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'1.25rem', alignItems:'start' }}>
          {/* Calendar grid */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹</button>
              <span style={{ fontFamily:'var(--fh)', fontWeight:700, fontSize:'.9rem' }}>{MONTHS[month]} {year}</span>
              <button className="btn btn-ghost btn-sm" onClick={nextMonth}>›</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {DAYS.map(d => (
                <div key={d} style={{ textAlign:'center', fontSize:10, color:'var(--dim)', fontWeight:600, letterSpacing:'.05em', paddingBottom:'.5rem' }}>{d}</div>
              ))}
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const isToday = day===today.getDate() && month===today.getMonth() && year===today.getFullYear();
                const dayEvents = eventsForDay(day);
                return (
                  <div key={i} style={{
                    aspectRatio:'1', borderRadius:8,
                    display:'flex', flexDirection:'column', alignItems:'center',
                    padding:3, cursor:'pointer', transition:'background .1s',
                    background: isToday ? 'var(--amber-d)' : 'transparent',
                    border: isToday ? '1px solid var(--amber-b)' : '1px solid transparent',
                  }}
                    onMouseOver={e=>(e.currentTarget as HTMLElement).style.background=isToday?'var(--amber-d)':'rgba(255,255,255,.04)'}
                    onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=isToday?'var(--amber-d)':'transparent'}
                  >
                    <span style={{ fontSize:11.5, color: isToday?'var(--amber)':'var(--muted)', fontWeight: isToday?700:400 }}>{day}</span>
                    {dayEvents.length > 0 && (
                      <div style={{ display:'flex', gap:2, flexWrap:'wrap', justifyContent:'center', marginTop:2 }}>
                        {dayEvents.slice(0,3).map(ev => (
                          <div key={ev.id} style={{
                            width:5, height:5, borderRadius:'50%',
                            background: ev.type==='meeting'?'var(--blue)':ev.type==='deadline'?'var(--red)':ev.type==='call'?'var(--green)':'var(--amber)'
                          }} title={ev.title} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming events */}
          <div className="card">
            <div className="card-h"><span className="card-t">Upcoming</span></div>
            {upcoming.length === 0 ? (
              <div className="empty" style={{ padding:'2rem 0' }}><div className="empty-icon" style={{ fontSize:'1.5rem' }}>📅</div><p>No upcoming events</p></div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
                {upcoming.map(ev => (
                  <div key={ev.id} style={{
                    padding:'.6rem .75rem', borderRadius:7,
                    background:'rgba(255,255,255,.03)', border:'1px solid var(--border)',
                    display:'flex', alignItems:'flex-start', gap:'.5rem'
                  }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12.5, fontWeight:500, color:'var(--text)', marginBottom:2 }}>{ev.title}</div>
                      <div style={{ display:'flex', gap:'.4rem', alignItems:'center' }}>
                        <span className={`chip ${TYPE_CHIP[ev.type]||'cm'}`}>{ev.type}</span>
                        <span style={{ fontSize:10, color:'var(--dim)', fontFamily:'var(--fm)' }}>
                          {new Date(ev.date).toLocaleDateString('en-KE',{day:'numeric',month:'short'})}
                          {ev.time && ` · ${ev.time}`}
                        </span>
                      </div>
                    </div>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={()=>del(ev.id)} style={{ fontSize:11, flexShrink:0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`mo-bg ${open?'open':''}`}>
        <div className="mo">
          <div className="mo-hdr">
            <h3>Add Event</h3>
            <button className="mo-x" onClick={()=>setOpen(false)}>✕</button>
          </div>
          <div className="mo-body">
            <div className="f"><label>Title *</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Strategy call with client" /></div>
            <div className="f2">
              <div className="f"><label>Date *</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} /></div>
              <div className="f"><label>Time</label><input type="time" value={form.time||''} onChange={e=>setForm({...form,time:e.target.value})} /></div>
              <div className="f"><label>Type</label>
                <select value={form.type} onChange={e=>setForm({...form,type:e.target.value as CalendarEvent['type']})}>
                  <option value="meeting">Meeting</option><option value="call">Call</option>
                  <option value="deadline">Deadline</option><option value="reminder">Reminder</option>
                </select>
              </div>
            </div>
            <div className="f"><label>Notes</label><textarea rows={2} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div className="mo-foot">
            <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving…':'Save Event'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
