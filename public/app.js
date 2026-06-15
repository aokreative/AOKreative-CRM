// ══════════════════════════════════
// STORAGE HELPERS
// ══════════════════════════════════
const LS = {
  g: k => { try { return JSON.parse(localStorage.getItem(k)) } catch{ return null } },
  s: (k,v) => localStorage.setItem(k, JSON.stringify(v)),
};
const DEF_PW = 'ao2026';
const DEF_PC = 'ao2026#';

const getLoginPw  = () => localStorage.getItem('crm_pw')  || DEF_PW;
const getPasscode = () => localStorage.getItem('crm_pc')  || DEF_PC;
const isAuthed    = () => sessionStorage.getItem('crm_ok') === '1';

// Data arrays — loaded from localStorage
let CLIENTS  = [];
let LEADS    = [];
let TASKS    = { todo:[], in_progress:[], review:[], done:[] };
let CAL_EVS  = {};
let NEXT_CID = 1;
let NEXT_LID = 1;
let NEXT_TID = 1;
let NEXT_IID = 1;
let NEXT_PID = 1;
let INVOICES = [];
let PROPOSALS = [];

// ── IndexedDB for PDF files ──
let IDB = null;
function initIDB(){
  return new Promise(res=>{
    const req=indexedDB.open('aokreative_v1',1);
    req.onupgradeneeded=e=>{if(!e.target.result.objectStoreNames.contains('files'))e.target.result.createObjectStore('files',{keyPath:'id'})};
    req.onsuccess=e=>{IDB=e.target.result;res()};
    req.onerror=()=>res();
  });
}
const idbSet=(id,blob)=>new Promise((res,rej)=>{if(!IDB)return res();const tx=IDB.transaction('files','readwrite');tx.objectStore('files').put({id,blob});tx.oncomplete=res;tx.onerror=rej});
const idbGet=(id)=>new Promise(res=>{if(!IDB)return res(null);const tx=IDB.transaction('files','readonly');const r=tx.objectStore('files').get(id);r.onsuccess=e=>res(e.target.result?.blob||null);r.onerror=()=>res(null)});
const idbDel=(id)=>new Promise(res=>{if(!IDB)return res();const tx=IDB.transaction('files','readwrite');tx.objectStore('files').delete(id);tx.oncomplete=res;tx.onerror=res});

function loadData() {
  CLIENTS   = LS.g('crm_clients')   || [];
  LEADS     = LS.g('crm_leads')     || [];
  TASKS     = LS.g('crm_tasks')     || { todo:[], in_progress:[], review:[], done:[] };
  CAL_EVS   = LS.g('crm_calevs')   || {};
  INVOICES  = LS.g('crm_invoices') || [];
  PROPOSALS = LS.g('crm_proposals')|| [];
  NEXT_CID  = LS.g('crm_ncid')    || 1;
  NEXT_LID  = LS.g('crm_nlid')    || 1;
  NEXT_TID  = LS.g('crm_ntid')    || 1;
  NEXT_IID  = LS.g('crm_niid')    || 1;
  NEXT_PID  = LS.g('crm_npid')    || 1;
}
function saveData() {
  LS.s('crm_clients',   CLIENTS);
  LS.s('crm_leads',     LEADS);
  LS.s('crm_tasks',     TASKS);
  LS.s('crm_calevs',    CAL_EVS);
  LS.s('crm_invoices',  INVOICES);
  LS.s('crm_proposals', PROPOSALS);
  LS.s('crm_ncid',      NEXT_CID);
  LS.s('crm_nlid',      NEXT_LID);
  LS.s('crm_ntid',      NEXT_TID);
  LS.s('crm_niid',      NEXT_IID);
  LS.s('crm_npid',      NEXT_PID);
}
function getPrivate(cid) { return LS.g('crm_priv_' + cid) || {}; }
function setPrivate(cid, d) { LS.s('crm_priv_' + cid, d); }

// ══════════════════════════════════
// AUTH
// ══════════════════════════════════
function doLogin() {
  const v = document.getElementById('lpw').value;
  if (v === getLoginPw()) {
    sessionStorage.setItem('crm_ok','1');
    document.getElementById('ls').classList.add('hidden');
    document.getElementById('lerr').classList.remove('show');
    initApp();
  } else {
    document.getElementById('lerr').classList.add('show');
    document.getElementById('lpw').value = '';
    document.getElementById('lpw').focus();
  }
}
function doLogout() { sessionStorage.removeItem('crm_ok'); location.reload(); }

function chgLoginPw() {
  const cur=document.getElementById('s-cpw').value, nw=document.getElementById('s-npw').value, cf=document.getElementById('s-cfpw').value;
  const msg=document.getElementById('s-pw-msg'); msg.style.display='block';
  if(cur!==getLoginPw()){msg.style.color='var(--red)';msg.textContent='❌ Current password incorrect.';return}
  if(nw.length<6){msg.style.color='var(--red)';msg.textContent='❌ Min 6 characters.';return}
  if(nw!==cf){msg.style.color='var(--red)';msg.textContent='❌ Passwords do not match.';return}
  localStorage.setItem('crm_pw',nw);
  msg.style.color='var(--green)';msg.textContent='✅ Password updated.';
  ['s-cpw','s-npw','s-cfpw'].forEach(id=>document.getElementById(id).value='');
  showNotif('🔐 Login password changed','success');
}
function chgPasscode() {
  const cur=document.getElementById('s-cpc').value, nw=document.getElementById('s-npc').value, cf=document.getElementById('s-cfpc').value;
  const msg=document.getElementById('s-pc-msg'); msg.style.display='block';
  if(cur!==getPasscode()){msg.style.color='var(--red)';msg.textContent='❌ Current passcode incorrect.';return}
  if(nw.length<4){msg.style.color='var(--red)';msg.textContent='❌ Min 4 characters.';return}
  if(nw!==cf){msg.style.color='var(--red)';msg.textContent='❌ Passcodes do not match.';return}
  localStorage.setItem('crm_pc',nw);
  msg.style.color='var(--green)';msg.textContent='✅ Passcode updated.';
  ['s-cpc','s-npc','s-cfpc'].forEach(id=>document.getElementById(id).value='');
  showNotif('🔒 Private passcode changed','success');
}
function checkPwStr(pw,bid){
  const b=document.getElementById(bid); if(!b)return;
  let s=0; if(pw.length>=8)s++; if(/[A-Z]/.test(pw))s++; if(/[0-9]/.test(pw))s++; if(/[^A-Za-z0-9]/.test(pw))s++;
  b.style.background=['','var(--red)','var(--orange)','var(--amber)','var(--green)'][s]||'var(--border)';
}

// ══════════════════════════════════
// NAVIGATION
// ══════════════════════════════════
const PG_TITLES = {dashboard:'Dashboard',pipeline:'Sales Pipeline',clients:'Clients',invoices:'Invoices',proposals:'Proposals Folder',tasks:'Task Manager',calendar:'Content Calendar',ai:'AI Assistant'};
const CTA_SETUP = {
  dashboard: {label:'+ New Lead', fn:()=>openLeadModal()},
  pipeline:  {label:'+ New Lead', fn:()=>openLeadModal()},
  clients:   {label:'+ New Client', fn:()=>openClientModal()},
  tasks:     {label:'+ New Task', fn:()=>openTaskModal()},
  invoices:  {label:'+ New Invoice', fn:()=>openInvoiceModal()},
  proposals: {label:'+ Upload PDF', fn:()=>document.getElementById('prop-file-in').click()},
  calendar:  {label:'+ Add Event', fn:()=>openCalEventMo(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate())},
  ai:        {label:'', fn:null},
};

function nav(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sbi[data-pg]').forEach(b=>b.classList.remove('on'));
  document.getElementById('pg-'+id).classList.add('active');
  const btn=document.querySelector(`.sbi[data-pg="${id}"]`); if(btn)btn.classList.add('on');
  document.getElementById('pg-title').textContent = PG_TITLES[id]||id;
  const cta=document.getElementById('main-cta');
  const c=CTA_SETUP[id];
  if(c&&c.label){cta.textContent=c.label;cta.style.display='';cta.onclick=c.fn;}
  else cta.style.display='none';
  if(id==='pipeline')renderPipeline();
  if(id==='clients')renderClients();
  if(id==='invoices')renderInvoices();
  if(id==='proposals')renderProposals();
  if(id==='tasks')renderTasks();
  if(id==='calendar')renderCalendar();
  updateBadges();
}

function updateBadges() {
  document.getElementById('bdg-pipe').textContent = LEADS.length;
  document.getElementById('bdg-cli').textContent  = CLIENTS.length;
  const tc = Object.values(TASKS).flat().length;
  document.getElementById('bdg-task').textContent = tc;
}

// ══════════════════════════════════
// DASHBOARD
// ══════════════════════════════════
function renderDashboard() {
  // Stats
  const totalRet = CLIENTS.filter(c=>c.status==='Active').reduce((s,c)=>s+parseRetainer(c.retainer),0);
  const activeCli = CLIENTS.filter(c=>c.status==='Active').length;
  const pipeVal = LEADS.reduce((s,l)=>s+parseRetainer(l.value),0);
  const todayTasks = Object.values(TASKS).flat().filter(t=>!t.done_flag);

  document.getElementById('dash-stats').innerHTML = `
    <div class="sc"><div class="sc-lbl">Monthly Retainer</div><div class="sc-val">${totalRet?'KES '+fmtNum(totalRet):'—'}</div><div class="sc-sub">${activeCli} active client${activeCli!==1?'s':''}</div></div>
    <div class="sc"><div class="sc-lbl">Active Clients</div><div class="sc-val">${activeCli}</div><div class="sc-sub">${CLIENTS.length} total</div></div>
    <div class="sc"><div class="sc-lbl">Pipeline Value</div><div class="sc-val">${pipeVal?'KES '+fmtNum(pipeVal):'—'}</div><div class="sc-sub">${LEADS.length} lead${LEADS.length!==1?'s':''}</div></div>
    <div class="sc"><div class="sc-lbl">Open Tasks</div><div class="sc-val">${todayTasks.length}</div><div class="sc-sub">${TASKS.done.length} completed</div></div>
  `;

  // Top clients
  const sorted = [...CLIENTS].sort((a,b)=>parseRetainer(b.retainer)-parseRetainer(a.retainer)).slice(0,5);
  const maxRet = sorted.length ? parseRetainer(sorted[0].retainer) : 1;
  const TEAM_C = {amber:'#F59E0B',blue:'#60A5FA',purple:'#A78BFA',pink:'#F472B6',teal:'#2DD4BF'};
  document.getElementById('dash-topcli').innerHTML = sorted.length ?
    `<div class="mb-wrap">${sorted.map(c=>`<div class="mb-row"><div class="mb-lbl">${c.name}</div><div class="mb-track"><div class="mb-fill" style="width:${maxRet?Math.round(parseRetainer(c.retainer)/maxRet*100):0}%;background:${c.color}"></div></div><div class="mb-val">${c.retainer?'KES '+c.retainer:'—'}</div></div>`).join('')}</div>`
    : `<div class="empty" style="padding:2rem"><div class="empty-icon">💰</div><div class="empty-s">No clients yet.</div></div>`;

  // Tasks
  const allTasks = [...TASKS.todo,...TASKS.in_progress].slice(0,4);
  document.getElementById('dash-tasks').innerHTML = allTasks.length ?
    `<div style="display:flex;flex-direction:column;gap:.5rem">${allTasks.map(t=>`
      <div style="display:flex;align-items:center;gap:.7rem;padding:.45rem 0;border-bottom:1px solid var(--border)">
        <div style="width:13px;height:13px;border-radius:3px;border:1.5px solid ${t.priority==='high'?'var(--red)':t.priority==='medium'?'var(--amber)':'var(--border2)'};flex-shrink:0"></div>
        <div style="flex:1;font-size:12.5px">${t.title}</div>
        <span class="chip ${t.priority==='high'?'cr':t.priority==='medium'?'ca':'cm'}" style="font-size:9.5px">${t.priority}</span>
      </div>`).join('')}</div>`
    : `<div class="empty" style="padding:2rem"><div class="empty-icon">✅</div><div class="empty-s">No tasks yet.</div></div>`;

  // Activity
  const acts = [...LEADS.slice(-3).reverse().map(l=>[`Lead added: ${l.company}`,l.assignee,'info']),
                 ...CLIENTS.slice(-2).reverse().map(c=>[`Client: ${c.name} added`,c.assigned,'success'])].slice(0,5);
  document.getElementById('dash-activity').innerHTML = acts.length ?
    `<table class="tbl"><thead><tr><th>Event</th><th>Owner</th></tr></thead><tbody>${acts.map(a=>`<tr><td class="pk">${a[0]}</td><td>${a[1]||'—'}</td></tr>`).join('')}</tbody></table>`
    : `<div class="empty" style="padding:2rem"><div class="empty-icon">📋</div><div class="empty-s">Activity will appear here as you add data.</div></div>`;

  // Team workload
  const team = ['Andy','Kafa','Barbara','Ricky'];
  const tcols = {'Andy':'var(--blue)','Kafa':'var(--purple)','Barbara':'var(--pink)','Ricky':'var(--teal)'};
  const tinit = {'Andy':'AN','Kafa':'KA','Barbara':'BA','Ricky':'RI'};
  const allT = Object.values(TASKS).flat();
  const maxTc = Math.max(1,...team.map(m=>allT.filter(t=>(t.assignees||[]).includes(m)).length));
  document.getElementById('dash-team').innerHTML = `<div style="display:flex;flex-direction:column;gap:.6rem">${
    team.map(m=>{
      const cnt = allT.filter(t=>(t.assignees||[]).includes(m)).length;
      return `<div style="display:flex;align-items:center;gap:.75rem">
        <div class="av" style="background:${tcols[m]}22;color:${tcols[m]};font-size:10px">${tinit[m]}</div>
        <div style="flex:1"><div style="font-size:12px;margin-bottom:3px">${m}</div>
        <div style="height:4px;background:var(--border2);border-radius:2px"><div style="width:${cnt?Math.round(cnt/maxTc*100):0}%;height:100%;background:${tcols[m]};border-radius:2px"></div></div></div>
        <span style="font-family:var(--fm);font-size:10px;color:var(--muted)">${cnt} task${cnt!==1?'s':''}</span>
      </div>`;
    }).join('')}</div>`;
}

function parseRetainer(s) {
  if(!s)return 0;
  const n=s.toString().replace(/[^0-9.]/g,'');
  return parseFloat(n)||0;
}
function fmtNum(n) {
  if(n>=1000000)return (n/1000000).toFixed(1)+'M';
  if(n>=1000)return Math.round(n/1000)+'K';
  return n.toLocaleString();
}
const fmtM = n=>'KES '+Number(n||0).toLocaleString('en-KE');
const fmtSz = b=>{if(b>1048576)return(b/1048576).toFixed(1)+' MB';if(b>1024)return Math.round(b/1024)+' KB';return b+' B'};

// ══════════════════════════════════
// PIPELINE
// ══════════════════════════════════
const PIPE_STAGES = [
  {id:'new',color:'#6366F1',label:'New'},
  {id:'contacted',color:'#3B82F6',label:'Contacted'},
  {id:'qualified',color:'#F59E0B',label:'Qualified'},
  {id:'proposal',color:'#8B5CF6',label:'Proposal Sent'},
  {id:'negotiation',color:'#EC4899',label:'Negotiation'},
  {id:'closed_won',color:'#10B981',label:'Won ✓'},
];
const TEAM_C = {'Andy':'#60A5FA','Kafa':'#A78BFA','Barbara':'#F472B6','Ricky':'#2DD4BF'};

function renderPipeline() {
  const board=document.getElementById('pipe-board'); board.innerHTML='';
  PIPE_STAGES.forEach(st=>{
    const leads=LEADS.filter(l=>l.status===st.id);
    const total=leads.reduce((s,l)=>s+parseRetainer(l.value),0);
    const col=document.createElement('div'); col.className='pipe-col';
    col.innerHTML=`
      <div class="pipe-hdr">
        <div class="pipe-hl"><div class="pdot" style="background:${st.color}"></div><span class="pipe-nm">${st.label}</span><span class="pipe-ct">${leads.length}</span></div>
        <span class="pipe-total">${total?'KES '+fmtNum(total):''}</span>
      </div>
      ${leads.length?leads.map(l=>{
        const ai=l.assignee?(l.assignee.split(' ').map(w=>w[0]).join('').slice(0,2)):'??';
        const ac=TEAM_C[l.assignee]||'#7A84A0';
        return `<div class="lc" onclick="openLeadModal(${l.id})">
          <div class="lc-co">${l.company}</div>
          <div class="lc-nm">${l.contact}</div>
          <div class="lc-ft">
            <span class="lc-val">${l.value?'KES '+l.value:''}</span>
            <div class="lc-av" style="background:${ac}22;color:${ac}">${ai}</div>
          </div>
          <div class="lc-dt">${l.source||''} · ${l.daysAgo||'Today'}</div>
        </div>`;
      }).join(''):'' }
      <button style="width:100%;padding:.42rem;border-radius:7px;border:1px dashed var(--border);background:none;color:var(--dim);cursor:pointer;font-size:11.5px;margin-top:.25rem" onclick="openLeadModalStage('${st.id}')">+ Add</button>
    `;
    board.appendChild(col);
  });
  if(!LEADS.length){
    board.innerHTML='';
    const e=document.createElement('div');e.style.width='100%';
    e.innerHTML=`<div class="empty"><div class="empty-icon">⊞</div><div class="empty-t">Pipeline is empty</div><div class="empty-s">Add your first lead to start tracking your sales pipeline.</div><button class="btn btn-primary" style="margin-top:.75rem" onclick="openLeadModal()">+ Add First Lead</button></div>`;
    board.appendChild(e);
  }
}

// ══════════════════════════════════
// CLIENTS
// ══════════════════════════════════
function renderClients() {
  const grid=document.getElementById('cl-grid');
  if(!CLIENTS.length){
    grid.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">◉</div><div class="empty-t">No clients yet</div><div class="empty-s">Add your first client to start managing relationships and tracking retainers.</div><button class="btn btn-primary" style="margin-top:.75rem" onclick="openClientModal()">+ Add First Client</button></div>`;return;
  }
  grid.innerHTML=CLIENTS.map(c=>`
    <div class="cl-card" onclick="openCP(${c.id})">
      <div class="cl-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openClientModal(${c.id})" title="Edit">✏</button>
        <button class="btn btn-danger btn-icon btn-sm" onclick="delClient(${c.id})" title="Delete">✕</button>
      </div>
      <div class="cl-top">
        <div class="av" style="background:${c.color}22;color:${c.color};width:40px;height:40px;font-size:13px;font-weight:800">${initials(c.name)}</div>
        <div class="cl-info"><h4>${c.name}</h4><p>${c.contact||''}</p></div>
        <span class="chip ${c.status==='Active'?'cg':c.status==='Paused'?'ca':'cm'}" style="margin-left:auto">${c.status||'Active'}</span>
      </div>
      <div style="font-size:11px;color:var(--dim);margin-bottom:.75rem">${c.industry||''}</div>
      <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.75rem">${(c.services||[]).map(s=>`<span class="chip cm" style="font-size:9.5px">${s}</span>`).join('')}</div>
      <div class="cl-stats">
        <div><div class="cl-sl">Monthly Retainer</div><div class="cl-sv" style="color:var(--amber)">${c.retainer?'KES '+c.retainer:'—'}</div></div>
        <div><div class="cl-sl">Contract End</div><div class="cl-sv" style="font-size:11.5px">${c.contractEnd||'—'}</div></div>
        <div><div class="cl-sl">Assigned To</div><div class="cl-sv" style="font-size:11.5px">${c.assigned||'—'}</div></div>
        <div><div class="cl-sl">Status</div><div class="cl-sv" style="color:${c.status==='Active'?'var(--green)':'var(--muted)'}">${c.status||'Active'}</div></div>
      </div>
    </div>
  `).join('');
}

function delClient(id) {
  if(!confirm('Delete this client? This cannot be undone.'))return;
  CLIENTS=CLIENTS.filter(c=>c.id!==id);
  localStorage.removeItem('crm_priv_'+id);
  saveData(); renderClients(); renderDashboard(); updateBadges();
  showNotif('Client deleted','info');
}

// Client Profile Panel
let currentCPId = null;
function openCP(id) {
  currentCPId = id;
  const c=CLIENTS.find(x=>x.id===id); if(!c)return;
  document.getElementById('cp-nm').textContent=c.name;
  document.getElementById('cp-ind').textContent=c.industry||'';
  const av=document.getElementById('cp-av');
  av.textContent=initials(c.name); av.style.background=c.color+'22'; av.style.color=c.color;
  document.getElementById('cp-edit-btn').onclick=()=>openClientModal(id);
  document.getElementById('cp-del-btn').onclick=()=>{if(confirm('Delete '+c.name+'?')){delClient(id);closeCP();}};

  const pd=getPrivate(id);
  document.getElementById('cp-body').innerHTML=`
    <div class="cp-sec">
      <div class="cp-sec-t">Contact Information</div>
      <div class="cp-row">
        <div class="cpf"><div class="cpf-l">Primary Contact</div><div class="cpf-v">${c.contact||'—'}</div></div>
        <div class="cpf"><div class="cpf-l">Industry</div><div class="cpf-v">${c.industry||'—'}</div></div>
        <div class="cpf"><div class="cpf-l">Email</div><div class="cpf-v mt">${c.email||'—'}</div></div>
        <div class="cpf"><div class="cpf-l">Phone</div><div class="cpf-v mt">${c.phone||'—'}</div></div>
      </div>
    </div>
    <div class="cp-sec">
      <div class="cp-sec-t">Account</div>
      <div class="cp-row">
        <div class="cpf"><div class="cpf-l">Monthly Retainer</div><div class="cpf-v" style="color:var(--amber)">${c.retainer?'KES '+c.retainer:'—'}</div></div>
        <div class="cpf"><div class="cpf-l">Contract End</div><div class="cpf-v">${c.contractEnd||'—'}</div></div>
        <div class="cpf"><div class="cpf-l">Account Manager</div><div class="cpf-v">${c.assigned||'—'}</div></div>
        <div class="cpf"><div class="cpf-l">Status</div><div class="cpf-v" style="color:${c.status==='Active'?'var(--green)':'var(--muted)'}">${c.status||'Active'}</div></div>
      </div>
    </div>
    ${(c.services||[]).length?`<div class="cp-sec"><div class="cp-sec-t">Services</div><div style="display:flex;flex-wrap:wrap;gap:.4rem">${c.services.map(s=>`<span class="chip ca">${s}</span>`).join('')}</div></div>`:''}
    ${c.notes?`<div class="cp-sec"><div class="cp-sec-t">Internal Notes</div><div class="cp-notes">${c.notes}</div></div>`:''}
    <!-- PRIVATE SECTION -->
    <div class="priv-wrap" id="priv-${id}">
      <div class="priv-bar" onclick="togglePriv(${id})">
        <span style="font-size:15px">🔒</span>
        <span class="priv-lbl">Private Information</span>
        <span class="priv-hint">Contract · Financials · Sensitive notes</span>
        <span class="priv-chev">▼</span>
      </div>
      <div class="priv-ask">
        <div style="font-size:12px;color:var(--muted);margin-bottom:.65rem">Enter your private passcode to unlock.</div>
        <div class="priv-pin-row">
          <input class="priv-pin" type="password" id="ppin-${id}" placeholder="••••••••" onkeydown="if(event.key==='Enter')submitPriv(${id})">
          <button class="btn btn-primary btn-sm" onclick="submitPriv(${id})">Unlock</button>
        </div>
        <div class="priv-err" id="perr-${id}">Incorrect passcode.</div>
      </div>
      <div class="priv-content">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem">
          <span style="font-size:11.5px;color:var(--amber);font-family:var(--fm)">🔓 UNLOCKED</span>
          <button onclick="lockPriv(${id})" style="font-size:11px;color:var(--dim);background:none;border:none;cursor:pointer;text-decoration:underline">Lock</button>
        </div>
        <div class="pf2">
          <div class="pf"><div class="pf-l">Contract Value</div><div class="pf-v">${pd.contractValue||'—'}</div></div>
          <div class="pf"><div class="pf-l">Payment Terms</div><div class="pf-v">${pd.paymentTerms||'—'}</div></div>
        </div>
        <div class="pf2">
          <div class="pf"><div class="pf-l">Billing Contact</div><div class="pf-v mt">${pd.billingContact||'—'}</div></div>
          <div class="pf"><div class="pf-l">Direct Phone</div><div class="pf-v mt">${pd.personalPhone||'—'}</div></div>
        </div>
        <div class="pf2">
          <div class="pf"><div class="pf-l">NDA</div><div class="pf-v">${pd.nda||'—'}</div></div>
          <div class="pf"><div class="pf-l">Profit Margin</div><div class="pf-v" style="color:var(--green)">${pd.profitMargin||'—'}</div></div>
        </div>
        <div class="pf2">
          <div class="pf"><div class="pf-l">Payment History</div><div class="pf-v">${pd.paymentHistory||'—'}</div></div>
          <div class="pf"></div>
        </div>
        ${pd.internalNotes?`<div class="pf"><div class="pf-l">Confidential Notes</div><div class="pf-v mt">${pd.internalNotes}</div></div>`:''}
        ${pd.sensitiveIssues?`<div class="pf"><div class="pf-l">⚠ Sensitive Issues</div><div class="pf-v danger">${pd.sensitiveIssues}</div></div>`:''}
      </div>
    </div>
  `;
  document.getElementById('cp-bg').classList.add('open');
}
function closeCP() { document.getElementById('cp-bg').classList.remove('open'); currentCPId=null; }
document.getElementById('cp-bg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeCP();});

function togglePriv(id) {
  const w=document.getElementById('priv-'+id);
  if(w.classList.contains('unlocked')){lockPriv(id);return;}
  w.classList.toggle('asking');
  if(w.classList.contains('asking'))setTimeout(()=>{const i=document.getElementById('ppin-'+id);if(i)i.focus();},50);
}
function submitPriv(id) {
  const inp=document.getElementById('ppin-'+id),err=document.getElementById('perr-'+id);
  if(inp.value===getPasscode()){
    document.getElementById('priv-'+id).classList.remove('asking');
    document.getElementById('priv-'+id).classList.add('unlocked');
    err.classList.remove('show');inp.value='';
  } else {err.classList.add('show');inp.value='';inp.focus();}
}
function lockPriv(id) {
  const w=document.getElementById('priv-'+id);
  w.classList.remove('unlocked','asking');
  const i=document.getElementById('ppin-'+id);if(i)i.value='';
}

// ══════════════════════════════════
// CLIENT MODAL (ADD / EDIT)
// ══════════════════════════════════
function openClientModal(id) {
  const isEdit=!!id;
  document.getElementById('cli-mo-title').textContent=isEdit?'Edit Client':'Add New Client';
  document.getElementById('cli-edit-id').value=id||'';
  // Reset all fields
  ['c-nm','c-ct','c-em','c-ph','c-ind','c-ret','c-end','c-notes','c-pv','c-pt','c-pb','c-pp','c-pn','c-pm','c-ph2','c-pin','c-psi'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  document.getElementById('c-status').value='Active';
  // Reset color
  document.querySelectorAll('#c-color-opts .co-opt').forEach(o=>o.classList.remove('sel'));
  document.querySelector('#c-color-opts .co-opt').classList.add('sel');
  // Reset assignee
  document.querySelectorAll('#c-assign-opts .ta').forEach(t=>t.classList.remove('sel'));
  document.querySelector('#c-assign-opts .ta').classList.add('sel');
  // Reset services
  document.querySelectorAll('#c-svc-tags .svc-tag').forEach(t=>t.classList.remove('sel'));

  if(isEdit){
    const c=CLIENTS.find(x=>x.id===id);if(!c)return;
    document.getElementById('c-nm').value=c.name||'';
    document.getElementById('c-ct').value=c.contact||'';
    document.getElementById('c-em').value=c.email||'';
    document.getElementById('c-ph').value=c.phone||'';
    document.getElementById('c-ind').value=c.industry||'';
    document.getElementById('c-ret').value=c.retainer||'';
    document.getElementById('c-end').value=c.contractEnd||'';
    document.getElementById('c-notes').value=c.notes||'';
    document.getElementById('c-status').value=c.status||'Active';
    // Color
    const copt=document.querySelector(`#c-color-opts .co-opt[data-color="${c.color}"]`);
    if(copt){document.querySelectorAll('#c-color-opts .co-opt').forEach(o=>o.classList.remove('sel'));copt.classList.add('sel');}
    // Assignee
    document.querySelectorAll('#c-assign-opts .ta').forEach(t=>{t.classList.toggle('sel',t.dataset.name===c.assigned);});
    // Services
    document.querySelectorAll('#c-svc-tags .svc-tag').forEach(t=>{t.classList.toggle('sel',(c.services||[]).includes(t.textContent.trim()));});
    // Private
    const pd=getPrivate(id);
    document.getElementById('c-pv').value=pd.contractValue||'';
    document.getElementById('c-pt').value=pd.paymentTerms||'';
    document.getElementById('c-pb').value=pd.billingContact||'';
    document.getElementById('c-pp').value=pd.personalPhone||'';
    document.getElementById('c-pn').value=pd.nda||'';
    document.getElementById('c-pm').value=pd.profitMargin||'';
    document.getElementById('c-ph2').value=pd.paymentHistory||'';
    document.getElementById('c-pin').value=pd.internalNotes||'';
    document.getElementById('c-psi').value=pd.sensitiveIssues||'';
  }
  openMo('add-client');
}

function saveClient() {
  const nm=document.getElementById('c-nm').value.trim();
  if(!nm){alert('Company name is required.');return;}
  const editId=parseInt(document.getElementById('cli-edit-id').value)||0;
  const color=document.querySelector('#c-color-opts .co-opt.sel')?.dataset.color||'#F59E0B';
  const assigned=document.querySelector('#c-assign-opts .ta.sel')?.dataset.name||'Andy';
  const services=[...document.querySelectorAll('#c-svc-tags .svc-tag.sel')].map(t=>t.textContent.trim());
  const cData={
    id:editId||NEXT_CID,
    name:nm,
    contact:document.getElementById('c-ct').value.trim(),
    email:document.getElementById('c-em').value.trim(),
    phone:document.getElementById('c-ph').value.trim(),
    industry:document.getElementById('c-ind').value.trim(),
    retainer:document.getElementById('c-ret').value.trim(),
    contractEnd:document.getElementById('c-end').value.trim(),
    assigned, services, color,
    status:document.getElementById('c-status').value,
    notes:document.getElementById('c-notes').value.trim(),
    createdAt:editId?(CLIENTS.find(c=>c.id===editId)?.createdAt||Date.now()):Date.now(),
  };
  const priv={
    contractValue:document.getElementById('c-pv').value.trim(),
    paymentTerms:document.getElementById('c-pt').value.trim(),
    billingContact:document.getElementById('c-pb').value.trim(),
    personalPhone:document.getElementById('c-pp').value.trim(),
    nda:document.getElementById('c-pn').value.trim(),
    profitMargin:document.getElementById('c-pm').value.trim(),
    paymentHistory:document.getElementById('c-ph2').value.trim(),
    internalNotes:document.getElementById('c-pin').value.trim(),
    sensitiveIssues:document.getElementById('c-psi').value.trim(),
  };
  if(editId){CLIENTS=CLIENTS.map(c=>c.id===editId?cData:c);}
  else{CLIENTS.push(cData);NEXT_CID++;}
  setPrivate(cData.id,priv);
  saveData(); closeMo('add-client'); renderClients(); renderDashboard(); updateBadges();
  showNotif(editId?'✅ Client updated':'✅ Client added','success');
}

function pickColor(el) { document.querySelectorAll('#c-color-opts .co-opt').forEach(o=>o.classList.remove('sel')); el.classList.add('sel'); }
function pickAssignee(el) { document.querySelectorAll('#c-assign-opts .ta').forEach(t=>t.classList.remove('sel')); el.classList.add('sel'); }

// ══════════════════════════════════
// LEAD MODAL (ADD / EDIT)
// ══════════════════════════════════
function openLeadModal(id) {
  const isEdit=!!id;
  document.getElementById('lead-mo-title').textContent=isEdit?'Edit Lead':'Add New Lead';
  document.getElementById('lead-edit-id').value=id||'';
  if(!isEdit){['l-co','l-nm','l-em','l-ph','l-val','l-notes'].forEach(i=>document.getElementById(i).value='');document.getElementById('l-src').value='Instagram';document.getElementById('l-stage').value='new';document.getElementById('l-assign').value='Andy';}
  else{
    const l=LEADS.find(x=>x.id===id);if(!l)return;
    document.getElementById('l-co').value=l.company||'';
    document.getElementById('l-nm').value=l.contact||'';
    document.getElementById('l-em').value=l.email||'';
    document.getElementById('l-ph').value=l.phone||'';
    document.getElementById('l-val').value=l.value||'';
    document.getElementById('l-src').value=l.source||'Instagram';
    document.getElementById('l-stage').value=l.status||'new';
    document.getElementById('l-assign').value=l.assignee||'Andy';
    document.getElementById('l-notes').value=l.notes||'';
  }
  openMo('add-lead');
}
function openLeadModalStage(st){openLeadModal();document.getElementById('l-stage').value=st;}
function saveLead() {
  const co=document.getElementById('l-co').value.trim();
  if(!co){alert('Company name is required.');return;}
  const editId=parseInt(document.getElementById('lead-edit-id').value)||0;
  const assignee=document.getElementById('l-assign').value;
  const lData={
    id:editId||NEXT_LID,
    company:co,
    contact:document.getElementById('l-nm').value.trim(),
    email:document.getElementById('l-em').value.trim(),
    phone:document.getElementById('l-ph').value.trim(),
    value:document.getElementById('l-val').value.trim(),
    source:document.getElementById('l-src').value,
    status:document.getElementById('l-stage').value,
    assignee, notes:document.getElementById('l-notes').value.trim(),
    daysAgo:'Today',
    createdAt:editId?(LEADS.find(l=>l.id===editId)?.createdAt||Date.now()):Date.now(),
  };
  if(editId)LEADS=LEADS.map(l=>l.id===editId?lData:l);
  else{LEADS.push(lData);NEXT_LID++;}
  saveData(); closeMo('add-lead'); renderPipeline(); renderDashboard(); updateBadges();
  showNotif(editId?'✅ Lead updated':'✅ Lead added to pipeline','success');
}

// ══════════════════════════════════
// TASKS
// ══════════════════════════════════
const TK_COLS=[
  {id:'todo',label:'To Do',color:'#6366F1'},
  {id:'in_progress',label:'In Progress',color:'#F59E0B'},
  {id:'review',label:'Review',color:'#A78BFA'},
  {id:'done',label:'Done',color:'#10B981'},
];
const PR_CHIP={high:'cr',medium:'ca',low:'cm'};

function renderTasks() {
  const board=document.getElementById('tk-board');
  board.innerHTML=TK_COLS.map(col=>`
    <div>
      <div class="tk-col-h">
        <div style="display:flex;align-items:center;gap:.4rem">
          <div style="width:7px;height:7px;border-radius:50%;background:${col.color}"></div>
          <span class="tk-col-t">${col.label}</span>
          <span style="font-family:var(--fm);font-size:9.5px;padding:1px 5px;border-radius:3px;background:rgba(255,255,255,.06);color:var(--muted)">${(TASKS[col.id]||[]).length}</span>
        </div>
      </div>
      ${(TASKS[col.id]||[]).map(t=>{
        const firstA=(t.assignees||[])[0]||'';
        const ac=TEAM_C[firstA]||'#7A84A0';
        const ai=firstA.split(' ').map(w=>w[0]).join('').slice(0,2);
        return `<div class="tk-card" onclick="openTaskModal(${t.id})">
          <button class="tk-del" onclick="event.stopPropagation();delTask(${t.id},'${col.id}')">✕</button>
          <div class="tk-title">${t.title}</div>
          <div class="tk-meta">
            <span class="chip ${PR_CHIP[t.priority]||'cm'}" style="font-size:9px">${t.priority||'medium'}</span>
            ${t.due?`<span class="tk-due">Due ${t.due}</span>`:''}
            ${t.client?`<span style="font-size:10px;color:var(--dim)">${t.client}</span>`:''}
            ${firstA?`<div class="lc-av" style="background:${ac}22;color:${ac};margin-left:auto;width:20px;height:20px;font-size:8px">${ai}</div>`:''}
          </div>
        </div>`;
      }).join('')}
      <button style="width:100%;padding:.42rem;border-radius:7px;border:1px dashed var(--border);background:none;color:var(--dim);cursor:pointer;font-size:11.5px;margin-top:.25rem" onclick="openTaskModalStage('${col.id}')">+ Add</button>
    </div>
  `).join('');
}

function openTaskModal(id) {
  const isEdit=!!id;
  document.getElementById('task-mo-title').textContent=isEdit?'Edit Task':'Add New Task';
  document.getElementById('task-edit-id').value=id||'';
  // Populate client dropdown
  const sel=document.getElementById('t-client');
  sel.innerHTML='<option value="">— Select client —</option>'+CLIENTS.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  // Reset
  if(!isEdit){
    ['t-title','t-notes'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('t-prio').value='medium';
    document.getElementById('t-stage').value='todo';
    document.getElementById('t-client').value='';
    document.getElementById('t-due').value='';
    document.querySelectorAll('#t-assign-opts .ta').forEach(t=>t.classList.remove('sel'));
  } else {
    const allT=Object.values(TASKS).flat();
    const t=allT.find(x=>x.id===id);if(!t)return;
    document.getElementById('t-title').value=t.title||'';
    document.getElementById('t-prio').value=t.priority||'medium';
    document.getElementById('t-stage').value=t.stage||'todo';
    document.getElementById('t-client').value=t.client||'';
    document.getElementById('t-due').value=t.due||'';
    document.getElementById('t-notes').value=t.notes||'';
    document.querySelectorAll('#t-assign-opts .ta').forEach(ta=>{ta.classList.toggle('sel',(t.assignees||[]).includes(ta.dataset.name));});
  }
  openMo('add-task');
}
function openTaskModalStage(st){openTaskModal();document.getElementById('t-stage').value=st;}

function saveTask() {
  const ttl=document.getElementById('t-title').value.trim();
  if(!ttl){alert('Task title is required.');return;}
  const editId=parseInt(document.getElementById('task-edit-id').value)||0;
  const stage=document.getElementById('t-stage').value;
  const assignees=[...document.querySelectorAll('#t-assign-opts .ta.sel')].map(t=>t.dataset.name);
  const tData={
    id:editId||NEXT_TID,
    title:ttl,
    client:document.getElementById('t-client').value,
    priority:document.getElementById('t-prio').value,
    due:document.getElementById('t-due').value,
    stage, assignees,
    notes:document.getElementById('t-notes').value.trim(),
    createdAt:editId?(Object.values(TASKS).flat().find(t=>t.id===editId)?.createdAt||Date.now()):Date.now(),
  };
  if(editId){
    // Remove from all stages then re-add
    Object.keys(TASKS).forEach(k=>{TASKS[k]=TASKS[k].filter(t=>t.id!==editId);});
  } else {NEXT_TID++;}
  if(!TASKS[stage])TASKS[stage]=[];
  TASKS[stage].push(tData);
  saveData(); closeMo('add-task'); renderTasks(); renderDashboard(); updateBadges();
  showNotif(editId?'✅ Task updated':'✅ Task created','success');
}
function delTask(id,col){
  TASKS[col]=TASKS[col].filter(t=>t.id!==id);
  saveData(); renderTasks(); renderDashboard(); updateBadges();
  showNotif('Task removed','info');
}

// ══════════════════════════════════
// CALENDAR
// ══════════════════════════════════
// Calendar state
let CAL_VIEW_Y=new Date().getFullYear(),CAL_VIEW_M=new Date().getMonth();
const CAL_MN=['January','February','March','April','May','June','July','August','September','October','November','December'];

function renderCalendar(){
  const y=CAL_VIEW_Y,m=CAL_VIEW_M;
  document.getElementById('cal-title').textContent=`${CAL_MN[m]} ${y}`;
  const startOffset=(new Date(y,m,1).getDay()+6)%7;
  const daysInM=new Date(y,m+1,0).getDate();
  const today=new Date();
  let html='';
  for(let i=0;i<startOffset;i++)html+=`<div class="cal-day empty"></div>`;
  for(let d=1;d<=daysInM;d++){
    const isToday=(d===today.getDate()&&m===today.getMonth()&&y===today.getFullYear());
    const key=`${y}-${m+1}-${d}`;
    const evs=CAL_EVS[key]||[];
    html+=`<div class="cal-day${isToday?' today':''}" onclick="openCalEventMo(${y},${m+1},${d})">
      <div class="cal-dn">${d}</div>
      ${evs.map(ev=>`<div class="cal-ev" style="background:${ev.color||'#F59E0B'}22;color:${ev.color||'#F59E0B'}">${ev.time?ev.time+' ':''}${ev.label}</div>`).join('')}
    </div>`;
  }
  document.getElementById('cal-grid').innerHTML=html;
}
function calShift(dir){CAL_VIEW_M+=dir;if(CAL_VIEW_M>11){CAL_VIEW_M=0;CAL_VIEW_Y++}if(CAL_VIEW_M<0){CAL_VIEW_M=11;CAL_VIEW_Y--}renderCalendar()}
function calGoToday(){CAL_VIEW_Y=new Date().getFullYear();CAL_VIEW_M=new Date().getMonth();renderCalendar()}

function openCalEventMo(y,m,d){
  const key=`${y}-${m}-${d}`;
  document.getElementById('cal-ev-date-key').value=key;
  document.getElementById('cal-ev-mo-title').textContent=`${d} ${CAL_MN[m-1]} ${y} — Add Event`;
  document.getElementById('cal-ev-label-in').value='';
  document.getElementById('cal-ev-color-in').value='#F59E0B';
  document.getElementById('cal-ev-time-in').value='';
  document.getElementById('cal-ev-notes-in').value='';
  // Show existing events for day
  const evs=CAL_EVS[key]||[];
  const exWrap=document.getElementById('cal-ex-events');
  if(evs.length){
    exWrap.style.display='';
    document.getElementById('cal-ex-list').innerHTML=evs.map((ev,i)=>`
      <div style="display:flex;align-items:center;gap:.55rem;margin-bottom:.35rem;padding:.4rem .7rem;background:var(--bg3);border-radius:6px;border:1px solid var(--border)">
        <div style="width:7px;height:7px;border-radius:50%;background:${ev.color};flex-shrink:0"></div>
        <div style="flex:1;font-size:12.5px">${ev.time?`<span style="font-family:var(--fm);font-size:10px;color:var(--dim);margin-right:3px">${ev.time}</span> `:''} ${ev.label}</div>
        <button onclick="deleteCalEv('${key}',${i})" style="background:none;border:none;color:var(--dim);cursor:pointer;font-size:13px;padding:1px 4px" title="Remove">✕</button>
      </div>`).join('');
  } else exWrap.style.display='none';
  document.getElementById('mo-cal-ev').classList.add('open');
}
function saveCalEvent(){
  const label=document.getElementById('cal-ev-label-in').value.trim();
  if(!label){alert('Event label required.');return}
  const key=document.getElementById('cal-ev-date-key').value;
  if(!CAL_EVS[key])CAL_EVS[key]=[];
  CAL_EVS[key].push({label,color:document.getElementById('cal-ev-color-in').value,time:document.getElementById('cal-ev-time-in').value,notes:document.getElementById('cal-ev-notes-in').value.trim()});
  saveData();document.getElementById('mo-cal-ev').classList.remove('open');renderCalendar();showNotif('📅 Event added','success');
}
function deleteCalEv(key,idx){
  CAL_EVS[key].splice(idx,1);if(!CAL_EVS[key].length)delete CAL_EVS[key];
  saveData();document.getElementById('mo-cal-ev').classList.remove('open');renderCalendar();showNotif('Event removed','info');
}

// ══════════════════════════════════
// AI ASSISTANT
// ══════════════════════════════════
const AI_FORMS = {
  proposal:{title:'📝 Proposal Generator',fields:`
    <div class="f2 f"><label>Company Name</label><input id="ai-co" value="" placeholder="Client company"><label>Industry</label><input id="ai-ind" value="" placeholder="Industry"></div>
    <div class="f"><label>Services Requested</label><input id="ai-srv" placeholder="Social Media, Paid Ads..."></div>
    <div class="f2 f"><label>Monthly Budget (KES)</label><input id="ai-bud" placeholder="150,000"><label>Key Goals</label><input id="ai-goal" placeholder="Goals..."></div>
    <button class="btn btn-primary" style="margin-top:.5rem;width:100%" onclick="genAI('proposal')">✦ Generate Proposal</button>`},
  followup:{title:'💬 Follow-Up Writer',fields:`
    <div class="f2 f"><label>Lead / Client</label><input id="ai-lead" placeholder="Name — Company"><label>Stage</label><select id="ai-stg"><option>Proposal Sent</option><option>Contacted</option><option>Qualified</option></select></div>
    <div class="f2 f"><label>Days Since Contact</label><input id="ai-days" placeholder="5 days"><label>Channel</label><select id="ai-ch"><option>WhatsApp</option><option>Email</option></select></div>
    <button class="btn btn-primary" style="margin-top:.5rem;width:100%" onclick="genAI('followup')">✦ Write Follow-Up</button>`},
  summary:{title:'📋 Meeting Summarizer',fields:`
    <div class="f"><label>Paste Raw Meeting Notes</label><textarea id="ai-notes" rows="6" placeholder="Paste your raw notes here..."></textarea></div>
    <button class="btn btn-primary" style="margin-top:.5rem;width:100%" onclick="genAI('summary')">✦ Summarize Notes</button>`},
};
const AI_OUT = {
  proposal:`PROPOSAL DRAFT\nDigital Marketing Services — A&O Kreative\n\n━━━ EXECUTIVE SUMMARY ━━━\nA&O Kreative proposes a comprehensive digital marketing partnership to accelerate your online growth and drive measurable results.\n\n━━━ SERVICES PROPOSED ━━━\n✦ Social Media Management\n✦ Paid Advertising (Meta + Google)\n✦ Influencer Marketing\n\n━━━ INVESTMENT ━━━\nMonthly Retainer: As per brief\nSetup Fee (Month 1): Included\nContract: 6 months with monthly review\n\nNext Step: 30-minute strategy call this week. 📞`,
  followup:`Hey! 👋\n\nHope your week is going well. Just following up on the proposal we sent over — we're genuinely excited about the potential here.\n\nWould you be open to a quick 20-minute call this week to go over any questions?\n\nLooking forward to it! 🙌\n— A&O Kreative`,
  summary:`MEETING SUMMARY\n\n━━━ KEY DECISIONS ━━━\n• [Edit: List confirmed decisions here]\n\n━━━ ACTION ITEMS ━━━\n→ [Assign and add action items]\n\n━━━ NEXT STEPS ━━━\n[Edit: What happens after this meeting]`
};
function runAI(type){const f=AI_FORMS[type];document.getElementById('ai-title').textContent=f.title;document.getElementById('ai-form').innerHTML=f.fields;document.getElementById('ai-out').classList.remove('vis');}
function genAI(type){const o=document.getElementById('ai-out');o.innerHTML='<div class="ai-tag">✦ AI · Generating…</div>';o.classList.add('vis');setTimeout(()=>{o.innerHTML=`<div class="ai-tag">✦ AI · Generated just now</div>${AI_OUT[type]}`;showNotif('✦ AI output ready — review before sending','success');},1400);}

// ══════════════════════════════════
// INVOICES
// ══════════════════════════════════
function renderInvoices(){
  const filter=document.getElementById('inv-filter-sel')?.value||'';
  const list=INVOICES.filter(i=>!filter||i.status===filter);
  const paid=INVOICES.filter(i=>i.status==='Paid').reduce((s,i)=>s+(i.total||0),0);
  const out=INVOICES.filter(i=>i.status!=='Paid').reduce((s,i)=>s+(i.total||0),0);
  const sumEl=document.getElementById('inv-summary-txt');
  if(sumEl)sumEl.textContent=`${INVOICES.length} invoices · Paid: ${fmtM(paid)} · Outstanding: ${fmtM(out)}`;
  const el=document.getElementById('inv-list');if(!el)return;
  if(!list.length){el.innerHTML=`<div class="empty"><div class="empty-icon">◧</div><div class="empty-t">No invoices yet</div><div class="empty-s">Create your first invoice to start tracking payments.</div><button class="btn btn-primary" style="margin-top:.65rem" onclick="openInvoiceModal()">+ New Invoice</button></div>`;return}
  const sChip=s=>{const m={Draft:'cm',Sent:'cb',Paid:'cg',Overdue:'cr'};return`<span class="chip ${m[s]||'cm'}">${s}</span>`};
  el.innerHTML=[...list].sort((a,b)=>b.id-a.id).map(inv=>`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:.8rem 1rem;display:flex;align-items:center;gap:.875rem;margin-bottom:.45rem;cursor:pointer;transition:all .15s" onclick="viewInvoice(${inv.id})" onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="font-family:var(--fm);font-size:11px;color:var(--amber);width:80px;flex-shrink:0">${inv.number}</div>
      <div style="font-size:13px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${inv.clientName}</div>
      <div style="font-family:var(--fm);font-size:11px;color:var(--dim);width:90px;flex-shrink:0;text-align:center">${inv.issueDate||'—'}</div>
      <div style="font-family:var(--fh);font-size:13px;font-weight:700;min-width:110px;text-align:right;flex-shrink:0">${fmtM(inv.total)}</div>
      <div style="width:80px;flex-shrink:0;text-align:right">${sChip(inv.status)}</div>
      <div style="flex-shrink:0;display:flex;gap:.25rem">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();openInvoiceModal(${inv.id})" title="Edit">✏</button>
        <button class="btn btn-danger btn-icon btn-sm" onclick="event.stopPropagation();delInvoice(${inv.id})" title="Delete">✕</button>
      </div>
    </div>`).join('');
}
function openInvoiceModal(id){
  document.getElementById('inv-mo-title').textContent=id?'Edit Invoice':'New Invoice';
  document.getElementById('inv-edit-id').value=id||'';
  const sel=document.getElementById('inv-client-sel');
  sel.innerHTML='<option value="">— Select client —</option>'+CLIENTS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.querySelectorAll('#inv-status-opts .svc-tag').forEach(t=>t.classList.remove('sel'));
  document.querySelector('#inv-status-opts .svc-tag').classList.add('sel');
  document.getElementById('inv-items-wrap').innerHTML='';
  document.getElementById('inv-notes-in').value='';
  const today=new Date().toISOString().slice(0,10);
  const due=new Date(Date.now()+30*864e5).toISOString().slice(0,10);
  document.getElementById('inv-issue-in').value=today;
  document.getElementById('inv-due-in').value=due;
  if(id){
    const inv=INVOICES.find(i=>i.id===id);
    if(inv){
      document.getElementById('inv-client-sel').value=inv.clientId||'';
      document.getElementById('inv-num-in').value=inv.number||'';
      document.getElementById('inv-issue-in').value=inv.issueDate||today;
      document.getElementById('inv-due-in').value=inv.dueDate||due;
      document.getElementById('inv-notes-in').value=inv.notes||'';
      document.querySelectorAll('#inv-status-opts .svc-tag').forEach(t=>t.classList.toggle('sel',t.dataset.v===inv.status));
      (inv.items||[]).forEach(item=>addInvItem(item));
    }
  } else {
    document.getElementById('inv-num-in').value='INV-'+String(NEXT_IID).padStart(3,'0');
    addInvItem();addInvItem();
  }
  calcInvTotals();
  document.getElementById('mo-add-invoice').classList.add('open');
}
function addInvItem(item){
  const wrap=document.getElementById('inv-items-wrap');const row=document.createElement('div');
  row.style.cssText='display:grid;grid-template-columns:1fr 60px 110px 30px;gap:.4rem;align-items:center;margin-bottom:.45rem';
  row.innerHTML=`
    <input type="text" placeholder="Service / Description" value="${item?.desc||''}" oninput="calcInvTotals()" style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:.5rem .65rem;font-size:12.5px;color:var(--text);font-family:var(--fb);outline:none">
    <input type="number" value="${item?.qty||1}" min="1" oninput="calcInvTotals()" style="width:100%;text-align:center;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:.5rem .3rem;font-size:12.5px;color:var(--text);font-family:var(--fb);outline:none">
    <input type="number" value="${item?.unitPrice||''}" placeholder="0" min="0" oninput="calcInvTotals()" style="width:100%;text-align:right;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:.5rem .65rem;font-size:12.5px;color:var(--text);font-family:var(--fb);outline:none">
    <button onclick="this.closest('div').remove();calcInvTotals()" style="background:none;border:none;color:var(--dim);cursor:pointer;font-size:14px;padding:4px;transition:color .12s" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--dim)'">✕</button>`;
  wrap.appendChild(row);
}
function getInvItems(){
  return [...document.querySelectorAll('#inv-items-wrap > div')].map(r=>{
    const ins=r.querySelectorAll('input');
    return{desc:ins[0].value.trim(),qty:parseFloat(ins[1].value)||1,unitPrice:parseFloat(ins[2].value)||0};
  }).filter(i=>i.desc);
}
function calcInvTotals(){
  const items=getInvItems();const sub=items.reduce((s,i)=>s+i.qty*i.unitPrice,0);
  const tax=sub*.16;const tot=sub+tax;
  document.getElementById('inv-sub-disp').textContent=fmtM(sub);
  document.getElementById('inv-tax-disp').textContent=fmtM(tax);
  document.getElementById('inv-tot-disp').textContent=fmtM(tot);
}
function pickInvStatus(el){document.querySelectorAll('#inv-status-opts .svc-tag').forEach(t=>t.classList.remove('sel'));el.classList.add('sel')}
function saveInvoice(){
  const clientId=document.getElementById('inv-client-sel').value;if(!clientId){alert('Select a client.');return}
  const items=getInvItems();if(!items.length){alert('Add at least one line item.');return}
  const sub=items.reduce((s,i)=>s+i.qty*i.unitPrice,0),tax=sub*.16,total=sub+tax;
  const editId=parseInt(document.getElementById('inv-edit-id').value)||0;
  const client=CLIENTS.find(c=>c.id==clientId);
  const status=document.querySelector('#inv-status-opts .svc-tag.sel')?.dataset.v||'Draft';
  const invData={id:editId||NEXT_IID,number:document.getElementById('inv-num-in').value,clientId:parseInt(clientId),clientName:client?.name||'Unknown',issueDate:document.getElementById('inv-issue-in').value,dueDate:document.getElementById('inv-due-in').value,items,subtotal:sub,tax,total,status,notes:document.getElementById('inv-notes-in').value.trim(),createdAt:editId?(INVOICES.find(i=>i.id===editId)?.createdAt||Date.now()):Date.now()};
  if(editId)INVOICES=INVOICES.map(i=>i.id===editId?invData:i);else{INVOICES.push(invData);NEXT_IID++}
  saveData();document.getElementById('mo-add-invoice').classList.remove('open');renderInvoices();renderDashboard();updateBadges();showNotif('✅ Invoice saved','success');
}
function viewInvoice(id){
  const inv=INVOICES.find(i=>i.id===id);if(!inv)return;
  const sC={Draft:'var(--muted)',Sent:'var(--blue)',Paid:'var(--green)',Overdue:'var(--red)'};
  document.getElementById('inv-view-edit-btn').onclick=()=>{document.getElementById('mo-view-inv').classList.remove('open');openInvoiceModal(id)};
  document.getElementById('inv-view-del-btn').onclick=()=>{if(confirm('Delete invoice?')){delInvoice(id);document.getElementById('mo-view-inv').classList.remove('open')}};
  const client=CLIENTS.find(c=>c.id===inv.clientId);
  document.getElementById('inv-detail-body').innerHTML=`
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:1.75rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.75rem;flex-wrap:wrap;gap:.875rem">
        <div>
          <div style="font-family:var(--fm);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--amber);background:var(--amber-d);border:1px solid var(--amber-b);padding:2px 8px;border-radius:4px;display:inline-flex;margin-bottom:.45rem">🎨 INVOICE</div>
          <div style="font-family:var(--fh);font-size:1.15rem;font-weight:800">A&amp;O Kreative</div>
          <div style="font-size:11.5px;color:var(--muted);margin-top:2px">Creative Agency · Nairobi, Kenya</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--fh);font-size:1.4rem;font-weight:800;color:var(--amber);margin-bottom:.2rem">${inv.number}</div>
          <div style="font-size:11.5px;color:var(--muted);line-height:1.9">Issued: ${inv.issueDate||'—'}<br>Due: ${inv.dueDate||'—'}<br><span style="color:${sC[inv.status]};font-weight:600">${inv.status}</span></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.875rem;margin-bottom:1.25rem">
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:.75rem .9rem">
          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-bottom:.35rem">From</div>
          <div style="font-size:13.5px;font-weight:600;margin-bottom:2px">A&amp;O Kreative</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.65">Creative Agency<br>Nairobi, Kenya</div>
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:.75rem .9rem">
          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-bottom:.35rem">Bill To</div>
          <div style="font-size:13.5px;font-weight:600;margin-bottom:2px">${inv.clientName}</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.65">${client?`${client.contact||''}<br>${client.email||''}`:''}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:1.1rem">
        <thead><tr>
          <th style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);padding:.45rem .65rem;text-align:left;border-bottom:1px solid var(--border)">Description</th>
          <th style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);padding:.45rem .65rem;text-align:right;border-bottom:1px solid var(--border)">Qty</th>
          <th style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);padding:.45rem .65rem;text-align:right;border-bottom:1px solid var(--border)">Unit Price</th>
          <th style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);padding:.45rem .65rem;text-align:right;border-bottom:1px solid var(--border)">Amount</th>
        </tr></thead>
        <tbody>${(inv.items||[]).map(item=>`<tr>
          <td style="padding:.55rem .65rem;border-bottom:1px solid rgba(255,255,255,.03);font-size:12.5px;color:var(--text);font-weight:500">${item.desc}</td>
          <td style="padding:.55rem .65rem;border-bottom:1px solid rgba(255,255,255,.03);font-size:12.5px;font-family:var(--fm);text-align:right;color:var(--muted)">${item.qty}</td>
          <td style="padding:.55rem .65rem;border-bottom:1px solid rgba(255,255,255,.03);font-size:12.5px;font-family:var(--fm);text-align:right;color:var(--muted)">${fmtM(item.unitPrice)}</td>
          <td style="padding:.55rem .65rem;border-bottom:1px solid rgba(255,255,255,.03);font-size:12.5px;font-family:var(--fm);text-align:right;color:var(--muted)">${fmtM(item.qty*item.unitPrice)}</td>
        </tr>`).join('')}</tbody>
      </table>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem;padding-top:.875rem;border-top:1px solid var(--border)">
        <div style="display:flex;gap:1.25rem;font-size:12.5px"><span style="color:var(--muted)">Subtotal</span><span style="font-family:var(--fm);min-width:105px;text-align:right">${fmtM(inv.subtotal)}</span></div>
        <div style="display:flex;gap:1.25rem;font-size:12.5px"><span style="color:var(--muted)">VAT (16%)</span><span style="font-family:var(--fm);min-width:105px;text-align:right">${fmtM(inv.tax)}</span></div>
        <div style="display:flex;gap:1.25rem;margin-top:.3rem;padding-top:.65rem;border-top:1px solid var(--border)"><span style="font-family:var(--fh);font-size:1rem;font-weight:800;color:var(--amber)">Total</span><span style="font-family:var(--fh);font-size:1rem;font-weight:800;color:var(--amber);min-width:105px;text-align:right">${fmtM(inv.total)}</span></div>
      </div>
      ${inv.notes?`<div style="margin-top:1rem;padding:.875rem;background:var(--bg2);border-radius:8px;border:1px solid var(--border);font-size:12.5px;color:var(--muted);line-height:1.7">${inv.notes}</div>`:''}
    </div>`;
  document.getElementById('mo-view-inv').classList.add('open');
}
function delInvoice(id){INVOICES=INVOICES.filter(i=>i.id!==id);saveData();renderInvoices();renderDashboard();updateBadges();showNotif('Invoice deleted','info')}

// ══ PROPOSALS ══
let _pendPropFiles=[];
function renderProposals(){
  const grid=document.getElementById('prop-grid');if(!grid)return;
  const sumEl=document.getElementById('prop-summary-txt');
  if(sumEl)sumEl.textContent=PROPOSALS.length?`${PROPOSALS.length} proposal${PROPOSALS.length!==1?'s':''} stored`:'Store and manage your PDF proposals';
  grid.innerHTML=PROPOSALS.length?PROPOSALS.map(p=>`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:1rem;transition:all .15s;position:relative;cursor:pointer" onclick="viewProposal(${p.id})" onmouseover="this.style.borderColor='var(--border2)';this.style.transform='translateY(-1px)';this.querySelector('.prop-del-act').style.display='flex'" onmouseout="this.style.borderColor='var(--border)';this.style.transform='';this.querySelector('.prop-del-act').style.display='none'">
      <div class="prop-del-act" style="position:absolute;top:.65rem;right:.65rem;display:none;gap:.25rem">
        <button class="btn btn-danger btn-icon btn-sm" onclick="event.stopPropagation();delProposal(${p.id})">✕</button>
      </div>
      <div style="font-size:28px;margin-bottom:.5rem">📄</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${p.name}">${p.name}</div>
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:.5rem">${p.clientName||'No client linked'}</div>
      <div style="font-family:var(--fm);font-size:10px;color:var(--dim)">${fmtSz(p.size)} · ${new Date(p.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>
      ${p.notes?`<div style="font-size:11px;color:var(--muted);margin-top:.4rem;line-height:1.5">${p.notes}</div>`:''}
    </div>`).join(''):'';
}
function handlePropDrop(e){e.preventDefault();document.getElementById('prop-drop-zone').style.borderColor='';document.getElementById('prop-drop-zone').style.background='';handlePropFiles(e.dataTransfer.files)}
function handlePropFiles(files){
  const pdfs=[...files].filter(f=>f.name.endsWith('.pdf')||f.type.includes('pdf'));
  if(!pdfs.length){showNotif('Only PDF files accepted','warn');return}
  _pendPropFiles=pdfs;openPropModal(_pendPropFiles[0]);
}
function openPropModal(file){
  document.getElementById('prop-name-in').value=file.name.replace(/\.pdf$/i,'');
  document.getElementById('prop-notes-in').value='';
  const sel=document.getElementById('prop-client-in');
  sel.innerHTML='<option value="">— No client linked —</option>'+CLIENTS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('mo-prop-det').classList.add('open');
}
async function savePropDetails(){
  const file=_pendPropFiles[0];if(!file)return;
  const name=document.getElementById('prop-name-in').value.trim()||file.name;
  const clientId=document.getElementById('prop-client-in').value;
  const client=CLIENTS.find(c=>c.id==clientId);
  const notes=document.getElementById('prop-notes-in').value.trim();
  const fk='prop_'+NEXT_PID+'_'+Date.now();
  try{
    await idbSet(fk,file);
    PROPOSALS.push({id:NEXT_PID,name,clientId:clientId||null,clientName:client?.name||'',size:file.size,fk,notes,createdAt:Date.now()});
    NEXT_PID++;saveData();_pendPropFiles.shift();
    document.getElementById('mo-prop-det').classList.remove('open');
    renderProposals();updateBadges();showNotif('📄 Proposal saved: '+name,'success');
    if(_pendPropFiles.length)openPropModal(_pendPropFiles[0]);
  }catch(e){showNotif('Failed to save PDF','warn')}
}
async function viewProposal(id){
  const p=PROPOSALS.find(x=>x.id===id);if(!p)return;
  const blob=await idbGet(p.fk);
  if(!blob){showNotif('PDF not found — may need to re-upload','warn');return}
  window.open(URL.createObjectURL(blob),'_blank');
}
function delProposal(id){
  if(!confirm('Delete this proposal?'))return;
  const p=PROPOSALS.find(x=>x.id===id);if(p)idbDel(p.fk);
  PROPOSALS=PROPOSALS.filter(x=>x.id!==id);saveData();renderProposals();updateBadges();showNotif('Proposal deleted','info');
}

// ══════════════════════════════════
// MODALS
// ══════════════════════════════════
function openMo(id){document.getElementById('mo-'+id).classList.add('open');}
function closeMo(id){document.getElementById('mo-'+id).classList.remove('open');}
document.querySelectorAll('.mo-bg').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');}));

// ══════════════════════════════════
// GLOBAL SEARCH
// ══════════════════════════════════
function globalSearch(q) {
  if(!q.trim())return;
  const ql=q.toLowerCase();
  const hits=[
    ...CLIENTS.filter(c=>c.name.toLowerCase().includes(ql)||c.contact.toLowerCase().includes(ql)).map(c=>({type:'Client',name:c.name,sub:c.contact,fn:()=>{nav('clients');setTimeout(()=>openCP(c.id),100)}})),
    ...LEADS.filter(l=>l.company.toLowerCase().includes(ql)||l.contact.toLowerCase().includes(ql)).map(l=>({type:'Lead',name:l.company,sub:l.contact,fn:()=>{nav('pipeline');}})),
  ];
  if(hits.length){showNotif(`Found ${hits.length} result${hits.length!==1?'s':''} for "${q}"`);}
}

// ══════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════
function showNotif(msg,type='info'){
  const c=document.getElementById('nc'),el=document.createElement('div');
  el.className='notif-i';
  const col={success:'var(--green)',info:'var(--blue)',warn:'var(--amber)'}[type]||'var(--blue)';
  el.style.borderLeft=`3px solid ${col}`;el.textContent=msg;
  c.appendChild(el);setTimeout(()=>el.remove(),3500);
}

// ══════════════════════════════════
// HELPERS
// ══════════════════════════════════
function initials(nm){return(nm||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();}

// ══════════════════════════════════
// INIT
// ══════════════════════════════════
window.addEventListener('load',async()=>{
  await initIDB();
  if(isAuthed()){
    document.getElementById('ls').classList.add('hidden');
    initApp();
  }
});
function initApp(){
  loadData();
  renderDashboard();
  updateBadges();
  renderCalendar();
}
