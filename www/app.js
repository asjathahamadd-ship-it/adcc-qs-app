/* ADCC QS Register — Android app + web version (Supabase backend) */
{
const SB_URL = 'https://lfyivbmwdgovvmbkxnqv.supabase.co';
const SB_KEY = 'sb_publishable_lQvZkU-cNR2DyqF7uAbBzA_JMpW1KBq';
const EMAIL_DOMAIN = 'adcc-qs.app';
const BUCKET = 'files';
const LOGO = 'logo.png';

const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

const CATS=['Payment / IPA','Subcontractor payment','Invoice','Tender','BOQ','Measurement sheet','Variation (VO)','RFI','NCR','Contract / LOA','Submittal','Letter / Correspondence','Other'];
const PAYCATS=new Set(['Payment / IPA','Subcontractor payment','Invoice']);
const STATUSES=['Draft','Submitted','Under review','Revise & resubmit','Approved','Certified','Invoiced','Paid','Closed','Rejected'];
const WITH=['Me','Site team','Project manager','Consultant / Engineer','Client','Subcontractor','Finance / Accounts','Other'];
const ST={Draft:'grey',Submitted:'blue','Under review':'amber','Revise & resubmit':'red',Approved:'green',Certified:'green',Invoiced:'violet',Paid:'green',Closed:'grey',Rejected:'red'};

let user=null,loaded=false,docs=[],projects=[],settings={},logoUrl='',dprs=[],dprMissing=false;
const F2={proj:''};let dprSrcNew=[],dprSrcKept=[],dprSrcRemoved=[];let ppVoice=null,ppNoDetOk=false,recState=null,pphotos=[],ppMissing=false,ppProj='',ppNew=[],ppKept=[],ppRemoved=[],editingPP=null,lbList=[],lbIdx=0;const urlCache={};let dprPhotosNew=[],dprPhotosKept=[],dprPhotosRemoved=[],editingDpr=null;
const F={q:'',cat:'All',proj:'',status:'',withp:'',sort:'updated'};
let view='home',pendingFiles=[],keptFiles=[],removedFiles=[],editingId=null,busy=false,signup=false;

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localISO=d=>{const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,10)};
const today=()=>localISO(Date.now());
const plusDays=n=>localISO(Date.now()+n*864e5);
const fmtDate=s=>{if(!s)return'';const d=new Date(s.length===10?s+'T00:00:00':s);return isNaN(d)?esc(s):d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})};
const fmtTime=s=>{const d=new Date(s);return isNaN(d)?'':d.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})};
const money=n=>(n===''||n==null||isNaN(n))?'':'AED '+Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const short=n=>{n=Number(n)||0;const a=Math.abs(n);return 'AED '+(a>=1e6?(n/1e6).toFixed(2).replace(/\.?0+$/,'')+'M':a>=1e4?Math.round(n/1e3)+'K':n.toLocaleString('en-US',{maximumFractionDigits:0}))};
const isDone=d=>['Paid','Closed','Rejected'].includes(d.status)||(['Approved','Certified'].includes(d.status)&&!PAYCATS.has(d.category));
const isLate=d=>!isDone(d)&&d.due&&d.due<today();
const isSoon=d=>!isDone(d)&&d.due&&d.due>=today()&&d.due<=plusDays(7);
const pendingPay=d=>PAYCATS.has(d.category)&&!['Paid','Closed','Rejected','Draft'].includes(d.status);
const projName=id=>projects.find(p=>p.id===id)?.name||'';
const stamp=s=>`<span class="stamp c-${ST[s]||'grey'}">${esc(s||'Draft')}</span>`;
const opts=(arr,sel,blank)=>(blank!=null?`<option value="">${esc(blank)}</option>`:'')+arr.map(o=>{const v=typeof o==='string'?o:o.v,l=typeof o==='string'?o:o.l;return`<option value="${esc(v)}"${v===sel?' selected':''}>${esc(l)}</option>`}).join('');
const safeUrl=u=>/^https?:\/\//i.test(u||'')?u:'';
const uuid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
const username=()=>(user?.email||'').split('@')[0];
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),3200)}
function gate(m){$('#gateMsg').textContent=m;const g=$('#gate');g.classList.remove('out');g.hidden=false}
function hideGate(){const g=$('#gate');if(g.hidden)return;g.classList.add('out');setTimeout(()=>{g.hidden=true;g.classList.remove('out')},350)}
function errMsg(e){const m=(e?.message||'').toLowerCase();if(m.includes('fetch')||m.includes('network'))return'No internet connection. Please try again.';if(m.includes('jwt')||m.includes('session'))return'Your login expired. Please log in again.';return'Couldn\'t save: '+(e?.message||'please try again')}
function openUrl(url){const B=window.Capacitor?.Plugins?.Browser;if(B)B.open({url});else window.open(url,'_blank','noopener')}

/* ---------- data ---------- */
const fromDoc=r=>({id:r.id,category:r.category||'Other',project:r.project_id||'',title:r.title,ref:r.ref||'',party:r.party||'',amount:r.amount??'',status:r.status||'Draft',withp:r.with_party||'Me',submitted:r.submitted||'',due:r.due||'',link:r.link||'',notes:r.notes||'',files:r.files||[],history:r.history||[],created:r.created_at,updated:r.updated_at});
async function load(){
  const [p,d,s]=await Promise.all([
    sb.from('projects').select('*').order('name'),
    sb.from('documents').select('*'),
    sb.from('settings').select('*').maybeSingle()]);
  const e=p.error||d.error||s.error;if(e)throw e;
  projects=p.data.map(r=>({id:r.id,name:r.name,code:r.code||'',client:r.client||'',value:r.value??''}));
  docs=d.data.map(fromDoc);
  const pp=await sb.from('progress_photos').select('*').order('taken_on',{ascending:false});
  if(pp.error){pphotos=[];ppMissing=true}else{ppMissing=false;pphotos=pp.data.map(x=>({id:x.id,project:x.project_id||'',stage:x.stage||'Other',location:x.location||'',date:x.taken_on,note:x.note||'',photos:x.photos||[]}))}
  const r=await sb.from('dprs').select('*').order('report_date',{ascending:false});
  if(r.error){dprs=[];dprMissing=true}else{dprMissing=false;dprs=r.data.map(x=>({id:x.id,project:x.project_id||'',date:x.report_date,weather:x.weather||'',work:x.work||[],manpower:x.manpower||[],equipment:x.equipment||'',remarks:x.remarks||'',photos:x.photos||[],details:x.details||null,equipment:x.equipment||'',updated:x.updated_at}))}
  const prevLogo=settings.logo_path;settings=s.data||{};
  if(settings.logo_path&&settings.logo_path!==prevLogo){const {data}=await sb.storage.from(BUCKET).createSignedUrl(settings.logo_path,60*60*24*7);logoUrl=data?.signedUrl||''}
  if(!settings.logo_path)logoUrl='';
  loaded=true;
}
async function refresh(silent){
  try{await load();hideGate();render()}
  catch(e){if(!loaded)gate('Couldn\'t load your register. '+errMsg(e)+' Pull down or reopen the app.');else if(!silent)toast(errMsg(e))}
}
async function upload(file){
  const path=`${user.id}/${uuid()}-${file.name.replace(/[^\w.\-]+/g,'_').slice(-80)}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
  if(error)throw error;return path;
}
async function removeFiles(paths){if(paths.length)try{await sb.storage.from(BUCKET).remove(paths)}catch{}}

/* ---------- views ---------- */
function brandHTML(){
  const name=settings.company||'Al Adeeb Building Contracting LLC';
  return`<div class="logo"><span class="tile"><img src="${esc(logoUrl||LOGO)}" alt="${esc(name)}"></span><span class="wm"><b>AL ADEEB</b><small>QS Register</small></span></div>`;
}
function render(){
  $('#railBrand').innerHTML=brandHTML();$('#barBrand').innerHTML=brandHTML();
  document.querySelectorAll('.tabs [data-v]').forEach(b=>{if(b.dataset.v===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  const m=$('#main');
  m.innerHTML=view==='register'?registerView():view==='projects'?projectsView():view==='dpr'?dprView():view==='photos'?photosView():homeView();
  if(view==='photos')fillThumbs();
  movePill();
  if(animateNext){animateNext=false;m.classList.remove('enter');void m.offsetWidth;m.classList.add('enter');
    let i=0;m.querySelectorAll('.top,h1,.eyebrow,.kpi,.card,.row,.stg,.filters,.search,.scroll,.empty,.proj>.card,.dprtoday').forEach(el=>{el.style.setProperty('--i',Math.min(i++,14))});
    if(!REDUCED)m.querySelectorAll('[data-count]').forEach(countUp)}
}
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;let animateNext=true;
function countUp(el){const end=Number(el.dataset.count)||0,fmt=el.dataset.fmt,t0=performance.now(),dur=900;const f=v=>fmt==='aed'?short(v):String(Math.round(v));
  const step=t=>{const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=f(end*e);if(k<1)requestAnimationFrame(step)};el.textContent=f(0);requestAnimationFrame(step)}
function movePill(){const nav=$('.tabs'),act=nav&&nav.querySelector('[data-v][aria-current]');let pill=$('#tabPill');if(!nav)return;
  if(!pill){pill=document.createElement('span');pill.id='tabPill';pill.className='tabpill';nav.appendChild(pill)}
  if(!act){pill.style.opacity=0;return}pill.style.opacity=1;
  const desk=innerWidth>=900;if(desk){pill.style.transform=`translateY(${act.offsetTop}px)`;pill.style.height=act.offsetHeight+'px';pill.style.width='';}else{pill.style.transform=`translateX(${act.offsetLeft+act.offsetWidth/2-20}px)`;pill.style.height='';pill.style.width=''}}
addEventListener('resize',()=>movePill());
addEventListener('scroll',()=>document.body.classList.toggle('scrolled',scrollY>8),{passive:true});
function homeView(){
  const d=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  const hi=`<div class="top" style="margin-bottom:6px"><p class="eyebrow" style="margin:0">${d}</p><button class="refresh" data-act="refresh">↻ Refresh</button></div>`;
  if(!docs.length&&!projects.length)return`${hi}<h1>Your QS register</h1>
   <div class="empty" style="margin-top:22px"><h2>Start your register</h2><p>Add a project, then log each payment application, tender document, measurement sheet or variation. Every time it moves, update its status and who has it now.</p>
   <div class="btns" style="justify-content:center"><button class="btn" data-act="proj-add">Add a project</button><button class="btn pri" data-act="add">Add a document</button></div></div>`;
  const open=docs.filter(x=>!isDone(x)),late=open.filter(isLate),soon=open.filter(isSoon);
  const pend=docs.filter(pendingPay),paid=docs.filter(x=>PAYCATS.has(x.category)&&x.status==='Paid');
  const sum=a=>a.reduce((s,x)=>s+(Number(x.amount)||0),0);
  const byWith=WITH.map(w=>({w,n:open.filter(x=>(x.withp||'Me')===w).length})).filter(x=>x.n).sort((a,b)=>b.n-a.n);
  const max=Math.max(1,...byWith.map(x=>x.n));
  const attn=[...late,...soon.filter(x=>!late.includes(x))].slice(0,6);
  const recent=[...docs].sort((a,b)=>(b.updated||'').localeCompare(a.updated||'')).slice(0,5);
  return`${hi}<h1>Where everything is now</h1>${dprTodayCard()}
  <div class="kpis">
   <button class="kpi" data-act="go" data-f="open"><b data-count="${open.length}">${open.length}</b><small>Open documents</small></button>
   <button class="kpi ${late.length?'alert':''}" data-act="go" data-f="late"><b data-count="${late.length}">${late.length}</b><small>Overdue · ${soon.length} due this week</small></button>
   <button class="kpi" data-act="go" data-f="pend"><b data-count="${sum(pend)}" data-fmt="aed">${short(sum(pend))}</b><small>Awaiting payment · ${pend.length}</small></button>
   <button class="kpi" data-act="go" data-f="paid"><b data-count="${sum(paid)}" data-fmt="aed">${short(sum(paid))}</b><small>Paid · ${paid.length}</small></button>
  </div>
  <div class="grid2">
   <section class="card"><h2>Currently with</h2>${byWith.length?`<div class="bars">${byWith.map(x=>`<button class="bar" data-act="with" data-w="${esc(x.w)}"><span class="lbl">${esc(x.w)}</span><i style="width:${x.n/max*100}%"></i><span class="n">${x.n}</span></button>`).join('')}</div>`:'<p class="mute">Nothing open. Everything is closed or paid.</p>'}</section>
   <section class="card"><h2>Needs attention</h2>${attn.length?`<div class="list">${attn.map(rowHTML).join('')}</div>`:'<p class="mute">Nothing overdue or due in the next 7 days.</p>'}</section>
  </div>
  <section style="margin-top:14px"><div class="top" style="margin-bottom:10px"><h2>Recently updated</h2><button class="link" data-act="nav" data-v="register">See full register</button></div><div class="list">${recent.map(rowHTML).join('')||'<p class="mute">No documents yet.</p>'}</div></section>`;
}
function rowHTML(x){
  const p=projName(x.project);
  return`<button class="row" data-act="open" data-id="${esc(x.id)}">
   <span class="head">${stamp(x.status)}<span class="cat">${esc(x.category)}</span></span>
   <span class="t">${esc(x.title)}</span><span class="amt">${money(x.amount)}</span>
   <span class="m"><span>With: <b>${esc(x.withp||'Me')}</b></span>${x.ref?`<span>${esc(x.ref)}</span>`:''}${p?`<span>${esc(p)}</span>`:''}${x.due?`<span class="${isLate(x)?'late':''}">Due ${fmtDate(x.due)}${isLate(x)?' · overdue':''}</span>`:''}</span>
  </button>`;
}
function filtered(){
  const q=F.q.trim().toLowerCase();
  const a=docs.filter(x=>{
    if(F.cat!=='All'&&x.category!==F.cat)return false;
    if(F.proj&&x.project!==F.proj)return false;
    if(F.withp&&(x.withp||'Me')!==F.withp)return false;
    if(F.status==='_open'&&isDone(x))return false;
    if(F.status==='_late'&&!isLate(x))return false;
    if(F.status==='_pend'&&!pendingPay(x))return false;
    if(F.status&&!F.status.startsWith('_')&&x.status!==F.status)return false;
    if(q&&![x.title,x.ref,x.party,x.notes,x.category,projName(x.project)].join(' ').toLowerCase().includes(q))return false;
    return true});
  const s=F.sort;
  a.sort((x,y)=>s==='due'?(x.due||'9999').localeCompare(y.due||'9999'):s==='amount'?(Number(y.amount)||0)-(Number(x.amount)||0):(y.updated||'').localeCompare(x.updated||''));
  return a;
}
function registerView(){
  const a=filtered(),tot=a.reduce((s,x)=>s+(Number(x.amount)||0),0);
  const stOpts=[{v:'_open',l:'All open'},{v:'_late',l:'Overdue'},{v:'_pend',l:'Awaiting payment'},...STATUSES];
  return`<div class="top"><h1>Register</h1><button class="btn pri sm" data-act="add">+ Add document</button></div>
  <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="q" type="search" placeholder="Search title, ref no., company, notes" value="${esc(F.q)}"></div>
  <div class="scroll" style="margin-top:10px">${['All',...CATS].map(c=>`<button class="chip" data-act="cat" data-c="${esc(c)}" aria-pressed="${F.cat===c}">${esc(c)}</button>`).join('')}</div>
  <div class="filters">
   <select id="fProj" aria-label="Project">${opts(projects.map(p=>({v:p.id,l:p.name})),F.proj,'All projects')}</select>
   <select id="fStatus" aria-label="Status">${opts(stOpts,F.status,'Any status')}</select>
   <select id="fWith" aria-label="Currently with">${opts(WITH,F.withp,'With anyone')}</select>
   <select id="fSort" aria-label="Sort">${opts([{v:'updated',l:'Recently updated'},{v:'due',l:'Due date'},{v:'amount',l:'Amount (high first)'}],F.sort)}</select>
  </div>
  <p class="mute small" style="margin:0 0 10px">${a.length} of ${docs.length} documents${tot?` · ${money(tot)}`:''}${(F.q||F.cat!=='All'||F.proj||F.status||F.withp)?` · <button class="link" data-act="clear">Clear filters</button>`:''}</p>
  <div class="list">${a.map(rowHTML).join('')||`<div class="empty"><p>${docs.length?'No documents match these filters.':'No documents yet. Add your first one.'}</p>${docs.length?'':'<button class="btn pri" data-act="add">Add a document</button>'}</div>`}</div>`;
}
function projectsView(){
  const sum=a=>a.reduce((s,x)=>s+(Number(x.amount)||0),0);
  return`<div class="top"><h1>Projects</h1><button class="btn pri sm" data-act="proj-add">+ Add project</button></div>
  ${projects.length?`<div class="proj">${projects.map(p=>{const ds=docs.filter(x=>x.project===p.id);return`<div class="card pc">
   <div><h3>${esc(p.name)}</h3><p class="mute small" style="margin:4px 0 0">${[p.code,p.client].filter(Boolean).map(esc).join(' · ')||'&nbsp;'}</p></div>
   <div class="nums"><span><b>${ds.filter(x=>!isDone(x)).length}</b>Open</span><span><b>${short(sum(ds.filter(pendingPay)))}</b>Awaiting</span><span><b>${short(sum(ds.filter(x=>PAYCATS.has(x.category)&&x.status==='Paid')))}</b>Paid</span></div>
   ${p.value!==''?`<p class="small mute" style="margin:0">Contract value ${money(p.value)}</p>`:''}
   <div class="btns"><button class="btn sm" data-act="proj-open" data-id="${esc(p.id)}">Open documents (${ds.length})</button><button class="btn sm" data-act="proj-edit" data-id="${esc(p.id)}">Edit</button></div></div>`}).join('')}</div>`
  :`<div class="empty"><h2>No projects yet</h2><p>Add each project you work on so you can group its payments, tenders and sheets together.</p><button class="btn pri" data-act="proj-add">Add a project</button></div>`}`;
}

/* ---------- sheets ---------- */
let sheetT;function openSheet(html){clearTimeout(sheetT);const sh=$('#sheet');const was=!sh.hidden&&!sh.classList.contains('closing');sh.classList.remove('closing');$('#panel').innerHTML=html;sh.hidden=false;if(!was){sh.classList.remove('opening');void sh.offsetWidth;sh.classList.add('opening')}document.body.style.overflow='hidden';$('#panel').scrollTop=0}
function closeSheet(){if(busy)return;if(recState?.mr?.state==='recording'){recState.mr.onstop=null;recState.stream?.getTracks().forEach(t=>t.stop());try{recState.mr.stop()}catch{}clearInterval(recState.iv);recState=null}const sh=$('#sheet');if(sh.hidden)return;editingId=null;document.body.style.overflow='';if(REDUCED){sh.hidden=true;return}sh.classList.add('closing');clearTimeout(sheetT);sheetT=setTimeout(()=>{sh.hidden=true;sh.classList.remove('closing','opening')},230)}
function detail(id){
  const x=docs.find(d=>d.id===id);if(!x)return closeSheet();
  const link=safeUrl(x.link);
  openSheet(`<div class="ph"><div><div class="cat">${esc(x.category)}${x.ref?' · '+esc(x.ref):''}</div><h2>${esc(x.title)}</h2></div><button class="x" data-act="close" aria-label="Close">×</button></div>
  <div class="btns" style="align-items:center;margin-bottom:14px">${stamp(x.status)}<span>With <b>${esc(x.withp||'Me')}</b></span>${isLate(x)?'<span class="late">Overdue</span>':''}</div>
  <form class="upd" id="updForm"><b class="full">Update where it is now</b>
   <label class="small">Status<select name="status">${opts(STATUSES,x.status)}</select></label>
   <label class="small">Now with<select name="withp">${opts(WITH,x.withp||'Me')}</select></label>
   <input class="full" name="note" placeholder="Note (optional), e.g. sent to consultant by email" aria-label="Note">
   <button class="btn pri full" type="submit">Save update</button></form>
  <h3 class="sec">Details</h3>
  <dl class="facts">
   <dt>Project</dt><dd>${esc(projName(x.project))||'—'}</dd>
   <dt>Company</dt><dd>${esc(x.party)||'—'}</dd>
   <dt>Amount</dt><dd>${money(x.amount)||'—'}</dd>
   <dt>Submitted</dt><dd>${fmtDate(x.submitted)||'—'}</dd>
   <dt>Due</dt><dd class="${isLate(x)?'late':''}">${fmtDate(x.due)||'—'}</dd>
   ${link?`<dt>Link</dt><dd><button class="link" data-act="url" data-u="${esc(link)}">${esc(link)}</button></dd>`:''}
   ${x.notes?`<dt>Notes</dt><dd style="white-space:pre-wrap">${esc(x.notes)}</dd>`:''}
  </dl>
  <h3 class="sec">Files</h3>
  ${x.files.length?`<ul class="files">${x.files.map(f=>`<li><button class="link" data-act="file" data-p="${esc(f.path)}">${esc(f.name)}</button><span class="mute">${((f.size||0)/1048576).toFixed(1)} MB</span></li>`).join('')}</ul>`:'<p class="mute small">No files attached. Use Edit to add a PDF or photo.</p>'}
  <h3 class="sec">History</h3>
  <ol class="tl">${[...x.history].reverse().map(h=>`<li><b>${esc(h.status)}</b> · with ${esc(h.withp)}<br><span class="mute">${fmtTime(h.t)}${h.note?' — '+esc(h.note):''}</span></li>`).join('')}</ol>
  <div class="btns" style="margin-top:22px"><button class="btn" data-act="edit" data-id="${esc(x.id)}">Edit</button><button class="btn danger" data-act="del" data-id="${esc(x.id)}">Delete</button></div>
  <div id="delBox"></div>`);
  $('#updForm').onsubmit=async e=>{
    e.preventDefault();if(busy)return;
    const fd=new FormData(e.target),st=fd.get('status'),w=fd.get('withp'),note=fd.get('note').trim();
    if(st===x.status&&w===x.withp&&!note)return toast('Nothing changed');
    const now=new Date().toISOString();busy=true;
    const {error}=await sb.from('documents').update({status:st,with_party:w,updated_at:now,history:[...x.history,{t:now,status:st,withp:w,note}]}).eq('id',x.id);
    busy=false;if(error)return toast(errMsg(error));
    toast('Updated');closeSheet();refresh(true);
  };
}
function docForm(id,pre){
  const x=id?docs.find(d=>d.id===id):(pre||null);editingId=id||null;
  pendingFiles=[];keptFiles=[...(x?.files||[])];removedFiles=[];
  const v=k=>esc(x?.[k]??'');
  openSheet(`<div class="ph"><h2>${id?'Edit document':(pre?'Add document (prepared by AI)':'Add document')}</h2><button class="x" data-act="close" aria-label="Close">×</button></div>
  <form class="form" id="docForm" novalidate>
   <label>Type<select name="category">${opts(CATS,x?.category||(F.cat!=='All'&&F.cat)||'Payment / IPA')}</select></label>
   <label>Project<select name="project">${opts(projects.map(p=>({v:p.id,l:p.name})),x?.project||F.proj||'','No project')}</select></label>
   <label class="full">Title <span class="req">*</span><input name="title" required value="${v('title')}" placeholder="e.g. IPA No. 07 – October 2026"></label>
   <label>Reference no.<input name="ref" value="${v('ref')}" placeholder="e.g. IPA-07 / VO-012"></label>
   <label>Company / party<input name="party" value="${v('party')}" placeholder="Client, consultant or subcontractor"></label>
   <label>Amount (AED)<input name="amount" type="number" inputmode="decimal" step="0.01" value="${v('amount')}"></label>
   <label>Status<select name="status">${opts(STATUSES,x?.status||'Draft')}</select></label>
   <label>Submitted on<input name="submitted" type="date" value="${v('submitted')}"></label>
   <label>Due / follow-up<input name="due" type="date" value="${v('due')}"></label>
   <label class="full">Currently with<select name="withp">${opts(WITH,x?.withp||'Me')}</select></label>
   <label class="full">Link (OneDrive, Google Drive, email)<input name="link" type="url" value="${v('link')}" placeholder="https://…"></label>
   <label class="full">Notes<textarea name="notes">${v('notes')}</textarea></label>
   <div class="full"><b class="small">Files (PDF, photos, Excel, Word — up to 20 MB each)</b><ul class="files" id="fileList" style="margin:6px 0"></ul>
    <label class="btn sm" style="width:max-content">Attach files<input id="fileIn" type="file" multiple hidden></label></div>
   <p id="formMsg" class="full small late" role="alert"></p>
   <div class="full btns"><button class="btn pri" type="submit" id="saveBtn">${id?'Save changes':'Add to register'}</button><button class="btn" type="button" data-act="close">Cancel</button></div>
  </form>`);
  drawFiles();
  $('#fileIn').onchange=e=>{for(const f of e.target.files){if(f.size>20*1048576){toast(f.name+' is over 20 MB');continue}pendingFiles.push(f)}e.target.value='';drawFiles()};
  $('#docForm').onsubmit=saveDoc;
}
function drawFiles(){
  const l=$('#fileList');if(!l)return;
  l.innerHTML=keptFiles.map((f,i)=>`<li><span>${esc(f.name)}</span><button type="button" class="link" data-act="rmkept" data-i="${i}">Remove</button></li>`).join('')+
   pendingFiles.map((f,i)=>`<li><span>${esc(f.name)} <span class="mute">(new)</span></span><button type="button" class="link" data-act="rmnew" data-i="${i}">Remove</button></li>`).join('');
}
async function saveDoc(e){
  e.preventDefault();if(busy)return;
  const fd=new FormData(e.target),g=k=>(fd.get(k)||'').toString().trim(),msg=$('#formMsg');
  if(!g('title')){msg.textContent='Please give the document a title.';return}
  if(g('link')&&!safeUrl(g('link'))){msg.textContent='The link must start with https://';return}
  const btn=$('#saveBtn');busy=true;btn.disabled=true;msg.textContent='';
  const files=[...keptFiles],uploaded=[];
  try{
    for(let i=0;i<pendingFiles.length;i++){
      const f=pendingFiles[i];btn.textContent=`Uploading ${i+1} of ${pendingFiles.length}…`;
      try{const path=await upload(f);uploaded.push(path);files.push({path,name:f.name,size:f.size})}
      catch(err){err.upload=f.name;throw err}
    }
    btn.textContent='Saving…';
    const old=editingId?docs.find(d=>d.id===editingId):null,now=new Date().toISOString();
    const row={project_id:g('project')||null,category:g('category'),title:g('title'),ref:g('ref'),party:g('party'),
      amount:g('amount')===''?null:Number(g('amount')),status:g('status'),with_party:g('withp'),submitted:g('submitted')||null,due:g('due')||null,
      link:g('link'),notes:g('notes'),files,updated_at:now,history:[...(old?.history||[])]};
    if(!old)row.history.push({t:now,status:row.status,withp:row.with_party,note:'Added to register'});
    else if(old.status!==row.status||old.withp!==row.with_party)row.history.push({t:now,status:row.status,withp:row.with_party,note:'Edited'});
    const {error}=old?await sb.from('documents').update(row).eq('id',old.id):await sb.from('documents').insert(row);
    if(error)throw error;
    await removeFiles(removedFiles.map(f=>f.path));
    busy=false;closeSheet();toast(old?'Saved':'Added to register');refresh(true);
  }catch(err){
    busy=false;btn.disabled=false;btn.textContent=editingId?'Save changes':'Add to register';
    if(!err.upload)await removeFiles(uploaded);
    msg.textContent=err.upload?`Couldn't upload ${err.upload}: ${err.message||'please try again'}`:errMsg(err);
  }
}
function projForm(id){
  const p=id?projects.find(x=>x.id===id):null,v=k=>esc(p?.[k]??''),n=p?docs.filter(d=>d.project===p.id).length:0;
  openSheet(`<div class="ph"><h2>${p?'Edit project':'Add project'}</h2><button class="x" data-act="close" aria-label="Close">×</button></div>
  <form class="form" id="projForm" novalidate>
   <label class="full">Project name <span class="req">*</span><input name="name" required value="${v('name')}" placeholder="e.g. G+4P+15 Residential, Al Mamzar"></label>
   <label>Project code<input name="code" value="${v('code')}"></label>
   <label>Client<input name="client" value="${v('client')}"></label>
   <label class="full">Contract value (AED)<input name="value" type="number" inputmode="decimal" step="0.01" value="${v('value')}"></label>
   <p id="formMsg" class="full small late" role="alert"></p>
   <div class="full btns"><button class="btn pri" type="submit">${p?'Save':'Add project'}</button><button class="btn" type="button" data-act="close">Cancel</button>
   ${p?(n?`<span class="small mute" style="align-self:center">Has ${n} documents, so it can't be deleted.</span>`:`<button class="btn danger" type="button" data-act="proj-del" data-id="${esc(p.id)}">Delete</button>`):''}</div>
  </form>`);
  $('#projForm').onsubmit=async e=>{
    e.preventDefault();if(busy)return;const fd=new FormData(e.target),g=k=>(fd.get(k)||'').toString().trim();
    if(!g('name')){$('#formMsg').textContent='Please enter a project name.';return}
    const row={name:g('name'),code:g('code'),client:g('client'),value:g('value')===''?null:Number(g('value')),updated_at:new Date().toISOString()};
    busy=true;const {error}=p?await sb.from('projects').update(row).eq('id',p.id):await sb.from('projects').insert(row);busy=false;
    if(error){$('#formMsg').textContent=errMsg(error);return}
    closeSheet();toast(p?'Project saved':'Project added');refresh(true);
  };
}
function settingsForm(){
  openSheet(`<div class="ph"><h2>Settings</h2><button class="x" data-act="close" aria-label="Close">×</button></div>
  <form class="form" id="setForm" novalidate>
   <div class="full"><b class="small">Logged in as</b><p style="margin:4px 0 0;font-size:18px;font-weight:700">${esc(username())}</p></div>
   <div class="full"><b class="small">Company logo</b>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:8px">
     <div style="background:var(--navy);padding:12px;border-radius:14px">${brandHTML()}</div>
     <label class="btn sm">${settings.logo_path?'Change logo':'Upload a sharper logo'}<input id="logoIn" type="file" accept="image/*" hidden></label>
     ${settings.logo_path?'<button type="button" class="btn sm danger" data-act="logo-rm">Use default</button>':''}
    </div></div>
   <label>Your full name (for emails)<input name="full_name" value="${esc(settings.full_name||'')}" placeholder="e.g. Asjath Ahamed"></label>
   <label>Job title<input name="job_title" value="${esc(settings.job_title||'Quantity Surveyor')}"></label>
   <label class="full">Phone (for email signature)<input name="phone" type="tel" value="${esc(settings.phone||'')}" placeholder="+971 …"></label>
   <label class="full">Company name<input name="company" value="${esc(settings.company||'Al Adeeb Building Contracting LLC')}"></label>
   <label class="full">New password (leave empty to keep)<input name="pw" type="password" autocomplete="new-password"></label>
   <p id="formMsg" class="full small late" role="alert"></p>
   <div class="full btns"><button class="btn pri" type="submit">Save</button><button class="btn danger" type="button" data-act="logout">Log out</button></div>
  </form>`);
  $('#logoIn').onchange=async e=>{
    const f=e.target.files[0];if(!f)return;const msg=$('#formMsg');
    if(f.size>2*1048576){msg.textContent='Logo must be under 2 MB.';return}
    try{busy=true;toast('Uploading logo…');const path=await upload(f),old=settings.logo_path;
      const {error}=await sb.from('settings').upsert({user_id:user.id,company:settings.company||null,logo_path:path});if(error)throw error;
      if(old)await removeFiles([old]);busy=false;await refresh(true);toast('Logo saved');settingsForm()}
    catch(err){busy=false;msg.textContent=errMsg(err)}
  };
  $('#setForm').onsubmit=async e=>{
    e.preventDefault();if(busy)return;const fd=new FormData(e.target),c=fd.get('company').toString().trim(),pw=fd.get('pw').toString();
    const msg=$('#formMsg');
    if(pw&&pw.length<6){msg.textContent='Password must be at least 6 characters.';return}
    busy=true;
    let {error}=await sb.from('settings').upsert({user_id:user.id,company:c,logo_path:settings.logo_path||null,full_name:fd.get('full_name').toString().trim(),job_title:fd.get('job_title').toString().trim(),phone:fd.get('phone').toString().trim()});
    if(error&&/column/i.test(error.message||'')){msg.textContent='Run the AI setup script in Supabase to save name and phone.';busy=false;return}
    let pe=null;if(!error&&pw)({error:pe}=await sb.auth.updateUser({password:pw}));
    busy=false;
    if(error||pe){msg.textContent=errMsg(error||pe);return}
    closeSheet();toast(pw?'Saved. Password changed.':'Saved');refresh(true);
  };
}

/* ---------- DPR (daily progress report) — ADCC format ---------- */
const WEATHER=['Sunny','Cloudy','Rainy','Windy','Dusty'];
const UNITS=['m²','m³','m','nos','kg','ton','LS','bags','trips'];
const DEF={
  staff:['Project Manager','Project Engineer','Site Engineer','Chemical Engineer','Quantity Surveyor','Mechanical & AC Engineer - MEP','Electrical Engineer - MEP','F.F & F.A Engineer - MEP','Document Controller','Surveyor','Safety Officer','Electrical & Plumbing Foreman - MEP','Safety Assistant','Steel Foreman','Surveyor Assist.'],
  labour:['Storekeeper + Assist. (Civil & MEP)','Carpenter & Foreman','Steel Fixer','Mason','Helper','Painter & Paint Foreman','Electrician - MEP','Plumber - MEP','A/C Technician - MEP','Office Boy','Chargehand','Waterproofing + Foreman','JCB Operator','Fire Fighting & Fire Alarm - MEP','Aluminum Works'],
  subs:['Block Works','Steel Fixer','RFI Waterproofing','Dwex Dewatering'],
  others:['Al Bayan MEP Sub-Contractor','JCB Operator','Shewal Operator','Bobcat Operator','Crane Operator'],
  equipment:['Tower Crane','3 Ton Pickup','Bar Bending Machine','Dewatering Pump','Bar Cutting Machine','Excavator','Mobile Crane','Compressor','Generator 60kV','Bobcat','Thread Machine Coupler','Pressed Machine Coupler','Diesel Tank','JCB']
};
const QLISTS=[['staff','Manpower on site: staff / designation','Total staff'],['labour','Labour / tradesmen','Total labour'],['subs','Sub-contractors on site','Total'],['others','Other sub-contractors / operators','Total'],['equipment','Plant & equipment','Total equipment']];
const num=v=>Number(v)||0;
const sumQ=a=>(a||[]).reduce((s,x)=>s+num(x.qty),0);
function normDpr(r){
  const d=r.details&&r.details.v===2?r.details:null;
  if(d)return{...d,photos:r.photos||[]};
  return{v:2,ref_no:'',location:'',employer:'',consultant:'',contractor:'',weather:{cond:r.weather||'',min:'',max:''},
    staff:[],labour:(r.manpower||[]).map(m=>({name:m.trade,qty:m.count})),subs:[],others:[],
    equipment:r.equipment?[{name:r.equipment,qty:''}]:[],materials:[],
    tasks:(r.work||[]).map(w=>({description:[w.activity,w.location].filter(Boolean).join(' – '),qty:[w.qty,w.unit].filter(x=>x!==''&&x!=null).join(' ')})),
    remarks:r.remarks||'',submitted_by:'',reviewed_by:'',photos:r.photos||[]};
}
const totals=d=>{const st=sumQ(d.staff),lb=sumQ(d.labour),sb=sumQ(d.subs)+sumQ(d.others);return{st,lb,sb,eq:sumQ(d.equipment),all:st+lb+sb}};
const menCount=r=>totals(normDpr(r)).all;
const lastDpr=proj=>[...dprs].filter(r=>!proj||r.project===proj).sort((x,y)=>(y.date||'').localeCompare(x.date||''))[0]||[...dprs].sort((x,y)=>(y.date||'').localeCompare(x.date||''))[0];
const nextRef=ref=>ref?ref.replace(/(\d+)(?!.*\d)/,n=>String(+n+1)):'';
function dprTodayCard(){
  if(dprMissing)return'';
  const t=dprs.filter(r=>r.date===today());
  return`<button class="card dprtoday" data-act="${t.length?'dpr-open':'dpr-new'}" data-id="${t.length?esc(t[0].id):''}"><span><b>Today's DPR</b><span class="mute small">${t.length?`Done · ${t.reduce((s,r)=>s+menCount(r),0)} total manpower`:'Not filled yet. Tap to add.'}</span></span><span class="stamp ${t.length?'c-green':'c-amber'}">${t.length?'Filled':'Pending'}</span></button>`;
}
function dprView(){
  if(dprMissing)return`<div class="top"><h1>Daily progress</h1></div><div class="empty"><h2>One-time setup needed</h2><p>Run the DPR setup script in the Supabase SQL Editor, then tap Refresh.</p><button class="btn pri" data-act="refresh">↻ Refresh</button></div>`;
  const list=dprs.filter(r=>!F2.proj||r.project===F2.proj);
  return`<div class="top"><h1>Daily progress</h1><button class="btn pri sm" data-act="dpr-new">+ New DPR</button></div>
  <div class="filters" style="grid-template-columns:minmax(0,1fr)"><select id="fDprProj" aria-label="Project">${opts(projects.map(p=>({v:p.id,l:p.name})),F2.proj,'All projects')}</select></div>
  <div class="list">${list.map(r=>{const d=normDpr(r),t=totals(d),p=projName(r.project);return`<button class="row" data-act="dpr-open" data-id="${esc(r.id)}">
    <span class="head"><span class="stamp c-blue">${esc(fmtDate(r.date))}</span>${d.ref_no?`<span class="cat">${esc(d.ref_no)}</span>`:''}${p?`<span class="cat">${esc(p)}</span>`:''}</span>
    <span class="t">${d.tasks.length?esc(d.tasks.slice(0,2).map(x=>x.description).join(', '))+(d.tasks.length>2?` +${d.tasks.length-2} more`:''):'No tasks recorded'}</span><span class="amt">${t.all} men</span>
    <span class="m"><span>Staff ${t.st}</span><span>Labour ${t.lb}</span><span>Sub-con ${t.sb}</span><span>Equip ${t.eq}</span>${r.photos.length?`<span>🖼 ${r.photos.length} photos</span>`:''}${(d.files||[]).length?'<span>📄 original file</span>':''}</span></button>`}).join('')||`<div class="empty"><p>No daily reports yet.</p><button class="btn pri" data-act="dpr-new">+ New DPR</button></div>`}</div>`;
}
function dprDetail(id){
  const r=dprs.find(x=>x.id===id);if(!r)return closeSheet();
  const d=normDpr(r),t=totals(d),P=projName(r.project);
  const qt=(rows,h)=>`<table class="rt"><thead><tr><th>No.</th><th>${esc(h)}</th><th class="num">Qty</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.name)}</td><td class="num">${num(x.qty)||''}</td></tr>`).join('')}</tbody></table>`;
  const tot=(l,v)=>`<div class="rtot"><span>${esc(l)}</span><b>${v}</b></div>`;
  openSheet(`<div class="ph noprint"><div><div class="cat">Daily progress report</div><h2>${esc(fmtDate(r.date))}</h2></div><button class="x" data-act="close" aria-label="Close">×</button></div>
  <div class="btns noprint" style="margin-bottom:12px"><button class="btn sm" data-act="dpr-edit" data-id="${esc(r.id)}">Edit</button>${window.Capacitor?'':'<button class="btn sm" data-act="dpr-print">🖨 Print / Save PDF</button>'}<button class="btn sm danger" data-act="dpr-del" data-id="${esc(r.id)}">Delete</button></div><div id="delBox" class="noprint"></div>
  ${(d.files||[]).length||r.photos.length?`<div class="dprlinks noprint">${(d.files||[]).map(f=>`<button class="btn sm" data-act="file" data-p="${esc(f.path)}">📄 Open original DPR: ${esc(f.name)}</button>`).join('')}${r.photos.length?`<button class="btn sm" data-act="lb" data-list="dpr:${esc(r.id)}" data-i="0">🖼 View ${r.photos.length} progress photos</button>`:''}</div>`:''}
  <div class="rep" id="rep">
   <div class="rhead"><span class="rlogo"><img src="${esc(logoUrl||LOGO)}" alt="ADCC"></span><div><div class="rtitle">DAILY PROGRESS REPORT</div><div class="rsub">${esc(d.location||P||'')}</div></div></div>
   <div class="rinfo"><div><small>Employer</small><b>${esc(d.employer||'—')}</b></div><div><small>Consultant</small><b>${esc(d.consultant||'—')}</b></div><div><small>Contractor</small><b>${esc(d.contractor||'—')}</b></div><div><small>Ref. no.</small><b>${esc(d.ref_no||'—')}</b></div><div><small>Date</small><b>${esc(fmtDate(r.date))}</b></div></div>
   <div class="rgrid">
    <section><h4>Manpower on site</h4><div class="r2">${qt(d.staff,'Staff / designation')}${qt(d.labour,'Labour / tradesmen')}</div><div class="r2">${tot('Total staff',t.st)}${tot('Total labour',t.lb)}</div></section>
    <section><h4>Weather & materials delivered</h4><div class="rweather">${WEATHER.map(w=>`<span class="${d.weather?.cond===w?'on':''}">${d.weather?.cond===w?'☑':'☐'} ${w}</span>`).join('')}<span>Min ${esc(d.weather?.min||'–')}°C</span><span>Max ${esc(d.weather?.max||'–')}°C</span></div>
     <table class="rt"><thead><tr><th>No.</th><th>Material</th><th class="num">Qty</th><th>Unit</th></tr></thead><tbody>${(d.materials.length?d.materials:[{}]).map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.material||'')}</td><td class="num">${esc(m.qty??'')}</td><td>${esc(m.unit||'')}</td></tr>`).join('')}</tbody></table>
     <h4 style="margin-top:12px">Plant & equipment</h4>${qt(d.equipment,'Equipment')}${tot('Total equipment',t.eq)}</section>
    <section><h4>Sub-contractors on site</h4><div class="r2">${qt(d.subs,'Sub-contractor')}${qt(d.others,'Other sub-contractors')}</div><div class="r2">${tot('Total',sumQ(d.subs))}${tot('Total',sumQ(d.others))}</div></section>
    <section><h4>Description of today's task</h4><table class="rt"><thead><tr><th>No.</th><th>Work description</th><th class="num">Qty</th></tr></thead><tbody>${d.tasks.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.description)}</td><td class="num">${esc(x.qty??'')}</td></tr>`).join('')}</tbody></table>
     <div class="rtot big"><span>Total manpower on site today (Staff + Labour + Sub-contractors)</span><b>${t.all}</b></div>
     ${d.remarks?`<h4 style="margin-top:12px">Remarks / delays</h4><p style="white-space:pre-wrap;margin:0">${esc(d.remarks)}</p>`:''}</section>
   </div>
   <div class="rsign"><div><small>Submitted by — Contractor</small><b>${esc(d.submitted_by||'')}</b></div><div><small>Reviewed by</small><b>${esc(d.reviewed_by||'')}</b></div></div>
   ${r.photos.length?`<h4 class="rph">Site photographs</h4><div class="pgrid rpg" id="pgrid">${r.photos.map((f,j)=>thumb(f,'dpr:'+r.id,j)).join('')}</div>`:''}
  </div>`);
  fillThumbs($('#panel'));
}
const qrow=(x,list)=>`<div class="qrow"><input data-k="name" value="${esc(x.name||'')}" placeholder="${list==='equipment'?'Equipment':'Name'}"><input data-k="qty" type="number" inputmode="numeric" min="0" step="any" value="${esc(x.qty??'')}" placeholder="0"><button type="button" class="x sm" data-act="dpr-rmrow" aria-label="Remove">×</button></div>`;
const mrow=m=>`<div class="mrow3"><input data-k="material" value="${esc(m.material||'')}" placeholder="Material"><input data-k="qty" type="number" inputmode="decimal" step="any" value="${esc(m.qty??'')}" placeholder="Qty"><input data-k="unit" list="unitList" value="${esc(m.unit||'')}" placeholder="Unit"><button type="button" class="x sm" data-act="dpr-rmrow" aria-label="Remove">×</button></div>`;
const trow=x=>`<div class="trow"><input data-k="description" value="${esc(x.description||'')}" placeholder="e.g. Steel reinforcement (columns & tie beam)"><input data-k="qty" value="${esc(x.qty??'')}" placeholder="Qty"><button type="button" class="x sm" data-act="dpr-rmrow" aria-label="Remove">×</button></div>`;
function blankDpr(proj){
  const L=lastDpr(proj),p=L?normDpr(L):null,me=[settings.full_name,settings.job_title].filter(Boolean);
  const names=k=>(p&&p[k].length?p[k]:DEF[k].map(n=>({name:n}))).map(x=>({name:x.name,qty:''}));
  return{v:2,ref_no:p?nextRef(p.ref_no):'',location:p?.location||'',employer:p?.employer||'',consultant:p?.consultant||'',contractor:p?.contractor||'ADCC',weather:{cond:'Sunny',min:'',max:''},
    staff:names('staff'),labour:names('labour'),subs:names('subs'),others:names('others'),equipment:names('equipment'),materials:[],tasks:[],remarks:'',
    submitted_by:p?.submitted_by||(me.length?`${me[0].toUpperCase()}${me[1]?' ('+me[1].toUpperCase()+')':''}`:''),reviewed_by:p?.reviewed_by||'',photos:[]};
}
function dprForm(id,pre){
  const r=id?dprs.find(x=>x.id===id):null;editingDpr=id||null;
  const d=r?normDpr(r):(pre||blankDpr(F2.proj));
  const date=r?.date||pre?.date||today(),proj=r?.project||pre?.project||F2.proj||(projects.length===1?projects[0].id:'');
  if(!pre||!pre._keepPhotos){dprPhotosNew=[];dprPhotosKept=[...(r?.photos||[])];dprPhotosRemoved=[];dprSrcNew=[];dprSrcKept=[...(d.files||[])]}
  const sec=([k,title,totLabel])=>`<fieldset class="dsec"><legend>${esc(title)}<span class="tot" data-tot="${k}"></span></legend><div class="qlist" data-list="${k}">${(d[k]||[]).map(x=>qrow(x,k)).join('')}</div><button type="button" class="btn sm" data-act="dpr-add" data-l="${k}">+ Add</button></fieldset>`;
  openSheet(`<div class="ph"><h2>${id?'Edit DPR':(pre&&!pre._blank?'New DPR (filled by AI)':'New daily progress report')}</h2><button class="x" data-act="close" aria-label="Close">×</button></div>
  <div class="aifill"><div><b>✨ Fill from a DPR file</b><div class="small mute">Upload a DPR PDF or photo. AI reads every count: staff, labour, sub-contractors, equipment, tasks.</div></div><label class="btn sm pri">Upload PDF / photo<input id="dprAiIn" type="file" accept="application/pdf,image/*" multiple hidden></label></div>
  <form class="form" id="dprForm" novalidate>
   <datalist id="unitList">${UNITS.map(t=>`<option value="${esc(t)}">`).join('')}</datalist>
   <label>Date<input name="date" type="date" value="${esc(date)}" required></label>
   <label>Ref. no.<input name="ref_no" value="${esc(d.ref_no||'')}" placeholder="e.g. ADCC-AB-1"></label>
   <label class="full">Project<select name="project">${opts(projects.map(p=>({v:p.id,l:p.name})),proj,'No project')}</select></label>
   <label class="full">Plot no. / location<input name="location" value="${esc(d.location||'')}" placeholder="e.g. Plot No. 1340486 • Al Mamzar, Dubai"></label>
   <label class="full">Employer<input name="employer" value="${esc(d.employer||'')}"></label>
   <label>Consultant<input name="consultant" value="${esc(d.consultant||'')}"></label>
   <label>Contractor<input name="contractor" value="${esc(d.contractor||'')}"></label>
   <fieldset class="dsec full"><legend>Weather</legend><div class="chips">${WEATHER.map(w=>`<label class="chipr"><input type="radio" name="wcond" value="${w}"${d.weather?.cond===w?' checked':''}><span>${w}</span></label>`).join('')}</div>
    <div class="r2f"><label>Min temp °C<input name="wmin" type="number" inputmode="decimal" value="${esc(d.weather?.min??'')}"></label><label>Max temp °C<input name="wmax" type="number" inputmode="decimal" value="${esc(d.weather?.max??'')}"></label></div></fieldset>
   <div class="full">${QLISTS.slice(0,2).map(sec).join('')}</div>
   <div class="full">${QLISTS.slice(2,4).map(sec).join('')}</div>
   <div class="full">${sec(QLISTS[4])}</div>
   <fieldset class="dsec full"><legend>Materials delivered today</legend><div class="qlist" data-list="materials">${(d.materials||[]).map(mrow).join('')}</div><button type="button" class="btn sm" data-act="dpr-add" data-l="materials">+ Add material</button></fieldset>
   <fieldset class="dsec full"><legend>Description of today's task</legend><div class="qlist" data-list="tasks">${(d.tasks.length?d.tasks:[{}]).map(trow).join('')}</div><button type="button" class="btn sm" data-act="dpr-add" data-l="tasks">+ Add task</button></fieldset>
   <div class="full grand" id="grand"></div>
   <label class="full">Remarks / delays / issues<textarea name="remarks" style="min-height:60px">${esc(d.remarks||'')}</textarea></label>
   <label>Submitted by<input name="submitted_by" value="${esc(d.submitted_by||'')}" placeholder="Name (designation)"></label>
   <label>Reviewed by<input name="reviewed_by" value="${esc(d.reviewed_by||'')}" placeholder="Name (designation)"></label>
   <div class="full" id="srcWrap"></div>
   <div class="full"><b class="small">Site photographs</b><ul class="files" id="photoList" style="margin:6px 0"></ul>
    <div class="btns"><label class="btn sm">📷 Take photo<input id="photoCam" type="file" accept="image/*" capture="environment" hidden></label><label class="btn sm">Add photos<input id="photoIn" type="file" accept="image/*" multiple hidden></label>${!id&&dprs.length?'<button type="button" class="btn sm" data-act="dpr-copyman">Copy numbers from last DPR</button>':''}</div></div>
   <p id="formMsg" class="full small late" role="alert"></p>
   <div class="full btns"><button class="btn pri" type="submit" id="saveBtn">${id?'Save changes':'Save DPR'}</button><button class="btn" type="button" data-act="close">Cancel</button></div>
  </form>`);
  drawPhotos();menTotal();
  const addP=e=>{for(const f of e.target.files){if(f.size>25*1048576){toast(f.name+' is too large');continue}dprPhotosNew.push(f)}e.target.value='';drawPhotos()};
  $('#photoIn').onchange=addP;$('#photoCam').onchange=addP;
  $('#dprAiIn').onchange=async e=>{const fs=[...e.target.files];e.target.value='';if(fs.length)aiFillDpr(fs)};
  $('#dprForm').oninput=e=>{if(e.target.dataset.k==='qty')menTotal()};
  $('#dprForm').onsubmit=saveDpr;
}
const readList=k=>[...document.querySelectorAll(`[data-list="${k}"]>div`)].map(row=>{const o={};row.querySelectorAll('[data-k]').forEach(i=>{const v=i.value.trim();o[i.dataset.k]=(i.dataset.k==='qty'&&i.type==='number')?(v===''?'':Number(v)):v});return o});
function formDpr(){
  const f=$('#dprForm'),g=k=>(f.elements[k]?.value||'').trim();
  const keep=a=>a.filter(x=>Object.values(x).some(v=>v!==''&&v!=null));
  return{v:2,ref_no:g('ref_no'),location:g('location'),employer:g('employer'),consultant:g('consultant'),contractor:g('contractor'),
    weather:{cond:(f.querySelector('[name=wcond]:checked')||{}).value||'',min:g('wmin'),max:g('wmax')},
    staff:keep(readList('staff')).filter(x=>x.name),labour:keep(readList('labour')).filter(x=>x.name),subs:keep(readList('subs')).filter(x=>x.name),others:keep(readList('others')).filter(x=>x.name),equipment:keep(readList('equipment')).filter(x=>x.name),
    materials:keep(readList('materials')),tasks:keep(readList('tasks')),remarks:g('remarks'),submitted_by:g('submitted_by'),reviewed_by:g('reviewed_by')};
}
function menTotal(){
  if(!$('#dprForm'))return;const s=k=>readList(k).reduce((a,x)=>a+num(x.qty),0);
  const st=s('staff'),lb=s('labour'),sb=s('subs')+s('others');
  QLISTS.forEach(([k])=>{const el=document.querySelector(`[data-tot="${k}"]`);if(el)el.textContent=' · '+s(k)});
  $('#grand').innerHTML=`<span>Total manpower on site today<br><small>Staff ${st} + Labour ${lb} + Sub-contractors ${sb}</small></span><b>${st+lb+sb}</b>`;
}
function drawSrc(){const w=$('#srcWrap');if(!w)return;const all=[...dprSrcKept.map((f,i)=>({n:f.name,k:'k',i})),...dprSrcNew.map((f,i)=>({n:f.name,k:'n',i}))];w.innerHTML=all.length?`<b class="small">Original DPR file (saved with this DPR)</b><ul class="files" style="margin:6px 0">${all.map(x=>`<li><span>📄 ${esc(x.n)}${x.k==='n'?' <span class="mute">(new)</span>':''}</span><button type="button" class="link" data-act="dpr-rmsrc" data-k="${x.k}" data-i="${x.i}">Remove</button></li>`).join('')}</ul>`:''}
function drawPhotos(){
  drawSrc();
  const l=$('#photoList');if(!l)return;
  l.innerHTML=dprPhotosKept.map((f,i)=>`<li><span>${esc(f.name)}</span><button type="button" class="link" data-act="dpr-rmkept" data-i="${i}">Remove</button></li>`).join('')+
   dprPhotosNew.map((f,i)=>`<li><span class="fimg"><img src="${URL.createObjectURL(f)}" alt="">${esc(f.name)} <span class="mute">(new)</span></span><button type="button" class="link" data-act="dpr-rmnew" data-i="${i}">Remove</button></li>`).join('');
}
async function saveDpr(e){
  e.preventDefault();if(busy)return;
  const f=e.target,msg=$('#formMsg'),date=f.elements.date.value,proj=f.elements.project.value;
  if(!date){msg.textContent='Please pick a date.';return}
  const d=formDpr(),t=totals(d);
  const btn=$('#saveBtn');busy=true;btn.disabled=true;msg.textContent='';
  const photos=[...dprPhotosKept],uploaded=[];
  try{
    for(let i=0;i<dprPhotosNew.length;i++){btn.textContent=`Uploading photo ${i+1} of ${dprPhotosNew.length}…`;
      const ff=await compress(dprPhotosNew[i]);
      try{const path=await upload(ff);uploaded.push(path);photos.push({path,name:ff.name,size:ff.size})}catch(err){err.upload=dprPhotosNew[i].name;throw err}}
    const srcFiles=[...dprSrcKept];for(let i=0;i<dprSrcNew.length;i++){btn.textContent='Uploading original DPR file…';const f=dprSrcNew[i];try{const path=await upload(f);uploaded.push(path);srcFiles.push({path,name:f.name,size:f.size})}catch(err){err.upload=f.name;throw err}}
    btn.textContent='Saving…';
    const row={project_id:proj||null,report_date:date,weather:d.weather.cond,
      work:d.tasks.map(x=>({activity:x.description,location:'',qty:x.qty,unit:''})),manpower:[...d.staff,...d.labour,...d.subs,...d.others].filter(x=>num(x.qty)).map(x=>({trade:x.name,count:num(x.qty)})),
      equipment:d.equipment.filter(x=>num(x.qty)).map(x=>`${x.qty} ${x.name}`).join(', '),remarks:d.remarks,photos,details:{...d,files:srcFiles,total:t.all},updated_at:new Date().toISOString()};
    const {error}=editingDpr?await sb.from('dprs').update(row).eq('id',editingDpr):await sb.from('dprs').insert(row);
    if(error){if(/details/i.test(error.message||''))error.message='Run the new DPR setup script in Supabase (adds the "details" column).';throw error}
    await removeFiles([...dprPhotosRemoved,...(dprSrcRemoved||[])].map(f=>f.path));dprSrcRemoved=[];
    busy=false;closeSheet();toast('DPR saved');refresh(true);
  }catch(err){
    busy=false;btn.disabled=false;btn.textContent=editingDpr?'Save changes':'Save DPR';
    if(!err.upload)await removeFiles(uploaded);
    msg.textContent=err.upload?`Couldn't upload ${err.upload}: ${err.message||'please try again'}`:(err.message&&/setup script/.test(err.message)?err.message:errMsg(err));
  }
}
/* AI: read a DPR file into the form */
const QITEM={type:'array',items:{type:'object',properties:{name:{type:'string'},qty:{type:'number'}},required:['name','qty']}};
const DPR_SCHEMA={type:'object',properties:{date:{type:'string',description:'YYYY-MM-DD'},project_id:{type:'string',description:'id from APP DATA projects if it matches'},ref_no:{type:'string'},location:{type:'string',description:'Plot no. and area, e.g. Plot No. 1340486 • Al Mamzar, Dubai'},employer:{type:'string'},consultant:{type:'string'},contractor:{type:'string'},
  weather:{type:'object',properties:{cond:{type:'string',description:'Sunny, Cloudy, Rainy, Windy or Dusty'},min:{type:'number'},max:{type:'number'}}},
  staff:{...QITEM,description:'Staff / designation rows with quantity'},labour:{...QITEM,description:'Labour / tradesmen rows with quantity'},subs:{...QITEM,description:'Sub-contractors on site (left table, e.g. pile breaking / specialist companies)'},others:{...QITEM,description:'Other sub-contractors and operators'},equipment:{...QITEM,description:'Plant & equipment rows with quantity'},
  materials:{type:'array',items:{type:'object',properties:{material:{type:'string'},qty:{type:'number'},unit:{type:'string'}}}},
  tasks:{type:'array',items:{type:'object',properties:{description:{type:'string'},qty:{type:'string'}},required:['description']}},
  remarks:{type:'string'},submitted_by:{type:'string'},reviewed_by:{type:'string'}},required:['date']};
const toB64=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(f)});
async function fileParts(files){
  const parts=[];for(const f of files){
    if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){if(f.size>15*1048576)throw new Error(f.name+' is too large (max 15 MB)');parts.push({type:'image',source:{type:'base64',media_type:'application/pdf',data:await toB64(f)}})}
    else parts.push({type:'image',source:{type:'base64',media_type:'image/jpeg',data:await smallB64(f,1800)}});
  }return parts;
}
function preFromAI(v){
  v={...v};if(!v.labour&&v.manpower)v.labour=v.manpower.map(m=>({name:m.trade,qty:m.count}));if(!v.tasks&&v.work)v.tasks=v.work.map(w=>({description:[w.activity,w.location].filter(Boolean).join(' – '),qty:[w.qty,w.unit].filter(x=>x!=null&&x!=='').join(' ')}));
  const cl=a=>(a||[]).filter(x=>x&&x.name).map(x=>({name:String(x.name),qty:x.qty??''}));
  const base=blankDpr(projects.some(p=>p.id===v.project_id)?v.project_id:F2.proj);
  const merge=(k)=>{const ai=cl(v[k]);if(!ai.length)return base[k];const out=base[k].map(x=>{const m=ai.find(a=>a.name.toLowerCase()===x.name.toLowerCase());return{name:x.name,qty:m?m.qty:''}});ai.forEach(a=>{if(!out.some(x=>x.name.toLowerCase()===a.name.toLowerCase()))out.push(a)});return out};
  return{...base,date:v.date||today(),project:projects.some(p=>p.id===v.project_id)?v.project_id:'',ref_no:v.ref_no||base.ref_no,location:v.location||base.location,employer:v.employer||base.employer,consultant:v.consultant||base.consultant,contractor:v.contractor||base.contractor,
    weather:{cond:WEATHER.find(w=>w.toLowerCase()===String(v.weather?.cond||'').toLowerCase())||'',min:v.weather?.min??'',max:v.weather?.max??''},
    staff:merge('staff'),labour:merge('labour'),subs:merge('subs'),others:merge('others'),equipment:merge('equipment'),
    materials:(v.materials||[]).map(m=>({material:m.material||'',qty:m.qty??'',unit:m.unit||''})),tasks:(v.tasks||[]).map(x=>({description:x.description||'',qty:x.qty??''})),
    remarks:v.remarks||'',submitted_by:v.submitted_by||base.submitted_by,reviewed_by:v.reviewed_by||base.reviewed_by};
}
/* AI: pull site photos out of an uploaded DPR (PDF or photo) */
const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
function loadPdfJs(){
  if(window.pdfjsLib)return Promise.resolve();
  return new Promise((res,rej)=>{const sc=document.createElement('script');sc.src=PDFJS+'pdf.min.js';sc.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.js';res()};sc.onerror=()=>rej(new Error('Could not load PDF reader'));document.head.appendChild(sc)});
}
async function fileCanvases(f){
  const out=[];
  if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){
    await loadPdfJs();const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;
    for(let i=1;i<=Math.min(pdf.numPages,4);i++){const pg=await pdf.getPage(i),v1=pg.getViewport({scale:1}),sc=Math.min(3,2600/Math.max(v1.width,v1.height)),vp=pg.getViewport({scale:sc});
      const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;out.push(c)}
  }else{const bmp=await createImageBitmap(f),sc=Math.min(1,3000/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);out.push(c)}
  return out;
}
const canvasB64=(c,max=1400)=>{const sc=Math.min(1,max/Math.max(c.width,c.height)),t=document.createElement('canvas');t.width=Math.round(c.width*sc);t.height=Math.round(c.height*sc);t.getContext('2d').drawImage(c,0,0,t.width,t.height);return t.toDataURL('image/jpeg',0.8).split(',')[1]};
async function extractDprPhotos(files){
  const photos=[];let n=0;
  for(const f of files){
    let pages;try{pages=await fileCanvases(f)}catch{continue}
    for(const c of pages){
      const r=await callAI({max_tokens:2000,system:'You locate photographs inside scanned documents.',messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:canvasB64(c)}},{type:'text',text:'This is a page of a construction daily progress report. Find every SITE PHOTOGRAPH on it (real camera photos of the construction site). Do NOT include logos, tables, signatures, stamps or text. Return one bounding box per photo as box_2d [ymin, xmin, ymax, xmax] normalized 0-1000. Return an empty list if there are none.'}]}],tools:[{name:'photo_boxes',description:'Bounding boxes of site photographs',input_schema:{type:'object',properties:{boxes:{type:'array',items:{type:'object',properties:{box_2d:{type:'array',items:{type:'number'}}},required:['box_2d']}}},required:['boxes']}}],tool_choice:{type:'tool',name:'photo_boxes'}});
      const boxes=((r.content||[]).find(b=>b.type==='tool_use')?.input?.boxes||[]).map(b=>b.box_2d).filter(b=>Array.isArray(b)&&b.length===4);
      for(const [y0,x0,y1,x1] of boxes){
        const X=Math.max(0,Math.min(x0,x1))/1000*c.width,Y=Math.max(0,Math.min(y0,y1))/1000*c.height,W=Math.abs(x1-x0)/1000*c.width,H=Math.abs(y1-y0)/1000*c.height;
        const area=(W*H)/(c.width*c.height);if(area<0.006||area>0.5||W<60||H<60)continue;
        const t=document.createElement('canvas');t.width=Math.round(W);t.height=Math.round(H);t.getContext('2d').drawImage(c,X,Y,W,H,0,0,t.width,t.height);
        const blob=await new Promise(res=>t.toBlob(res,'image/jpeg',0.88));if(blob)photos.push(new File([blob],`dpr-site-photo-${++n}.jpg`,{type:'image/jpeg'}));
      }
    }
  }
  return photos;
}
async function aiFillDpr(files){
  const box=document.querySelector('.aifill');box.classList.add('busy');box.querySelector('.small').textContent='AI is reading your file… (10–40 seconds)';
  try{
    const content=[...await fileParts(files),{type:'text',text:'This is a daily progress report (DPR) from a UAE construction site. Read it carefully and extract EVERY row with its exact quantity: staff/designation, labour/tradesmen, sub-contractors, other sub-contractors/operators, plant & equipment, weather (condition and min/max temp), materials delivered, the description of today\'s tasks, header fields (employer, consultant, contractor, ref no, date, plot/location), submitted by and reviewed by. Rows with blank quantity = 0. Keep row names exactly as written. Today is '+today()+'.'}];
    const r=await callAI({max_tokens:6000,system:'You extract construction daily progress report data accurately. Never invent numbers. Projects in the app: '+JSON.stringify(projects.map(p=>({id:p.id,name:p.name}))),messages:[{role:'user',content}],tools:[{name:'fill_dpr',description:'Return the full DPR data',input_schema:DPR_SCHEMA}],tool_choice:{type:'tool',name:'fill_dpr'}});
    const v=(r.content||[]).find(b=>b.type==='tool_use')?.input;if(!v)throw new Error('AI could not read this file. Try a clearer PDF or photo.');
    const keepNew=dprPhotosNew,keepKept=dprPhotosKept,keepRem=dprPhotosRemoved,eid=editingDpr,keepSrcK=dprSrcKept;
    const pre=preFromAI(v);pre._keepPhotos=true;dprPhotosNew=keepNew;dprPhotosKept=keepKept;dprPhotosRemoved=keepRem;dprSrcKept=keepSrcK;dprSrcNew=files.filter(f=>f.size<=20*1048576);
    if(eid){dprForm(null,pre);editingDpr=eid;$('#saveBtn').textContent='Save changes'}else dprForm(null,pre);
    const t=totals(pre);toast(`AI filled the DPR: ${t.all} total manpower. Now taking out the site photos…`);
    const box2=document.querySelector('.aifill .small');if(box2)box2.textContent='✓ Filled. Now taking out the site photos from your file…';
    try{const ph=await extractDprPhotos(files);if($('#dprForm')){dprPhotosNew.push(...ph);drawPhotos();const b3=document.querySelector('.aifill .small');if(b3)b3.textContent=ph.length?`✓ Filled, and ${ph.length} site photos added below. Please check before saving.`:'✓ Filled. No site photos found in the file. Add photos below if needed.';toast(ph.length?`${ph.length} site photos added`:'No site photos found in the file')}}
    catch(e){const b3=document.querySelector('.aifill .small');if(b3)b3.textContent='✓ Filled. Couldn\'t take out photos ('+(e.message||'error')+'). Add them below.'}
  }catch(e){box.classList.remove('busy');box.querySelector('.small').textContent='⚠️ '+(e.message||'AI error')}
}

/* ---------- Progress photos ---------- */
const STAGES=['Site clearance & setting out','Excavation','Anti-termite treatment','Polythene sheet','PCC / blinding','Waterproofing (foundation)','Reinforcement','Shuttering / formwork','Concreting (RCC)','Concrete testing (slump, temperature, cubes)','De-shuttering & curing','Backfilling & compaction','Blockwork','MEP first fix','Plastering','Screed & waterproofing (roof / wet areas)','Tiling & flooring','False ceiling','Painting','Doors, windows & joinery','MEP second fix & fixtures','Final finish / handover'];
async function signed(paths){
  const now=Date.now(),need=[...new Set(paths)].filter(p=>p&&!(urlCache[p]&&urlCache[p].exp>now));
  for(let i=0;i<need.length;i+=100){const {data}=await sb.storage.from(BUCKET).createSignedUrls(need.slice(i,i+100),3600);(data||[]).forEach(d=>{if(d.signedUrl)urlCache[d.path]={url:d.signedUrl,exp:now+50*60e3}})}
  const m={};paths.forEach(p=>{if(urlCache[p])m[p]=urlCache[p].url});return m;
}
async function fillThumbs(root){
  const els=[...(root||document).querySelectorAll('img[data-path]:not([src]),video[data-path]:not([src])')];if(!els.length)return;
  const m=await signed(els.map(e=>e.dataset.path));els.forEach(e=>{const u=m[e.dataset.path];if(u)e.src=u});
}
const isVid=f=>/^video\//.test(f.type||'')||/\.(mp4|mov|webm|3gp|m4v)$/i.test(f.name||f.path||'');
const isAud=f=>/^audio\//.test(f.type||'')||/\.(wav|m4a|mp3|webm|ogg|aac|amr)$/i.test(f.name||f.path||'')&&!/^video\//.test(f.type||'');
const media=(f,src)=>isAud(f)?`<span class="atile">🎤<small>Voice note</small></span>`:isVid(f)?`<video ${src?`src="${src}"`:`data-path="${esc(f.path)}"`} muted playsinline preload="metadata"></video><span class="vbadge">▶</span>`:`<img ${src?`src="${src}"`:`data-path="${esc(f.path)}"`} alt="${esc(f.name||'')}" loading="lazy">`;
const thumb=(f,list,i)=>`<button type="button" class="pthumb rel" data-act="lb" data-list="${esc(list)}" data-i="${i}">${media(f)}</button>`;
function stageList(){const extra=[...new Set(pphotos.map(x=>x.stage))].filter(s=>!STAGES.includes(s));return[...STAGES,...extra]}
function photosView(){
  if(ppMissing)return`<div class="top"><h1>Progress photos</h1></div><div class="empty"><h2>One-time setup needed</h2><p>The progress photos table hasn't been created in Supabase yet. Run the setup script in the Supabase SQL Editor, then tap Refresh.</p><button class="btn pri" data-act="refresh">↻ Refresh</button></div>`;
  if(!ppProj&&projects.length===1)ppProj=projects[0].id;
  const list=pphotos.filter(x=>!ppProj||x.project===ppProj),total=list.reduce((s,x)=>s+x.photos.length,0);
  const rows=stageList().map((st,i)=>{
    const es=list.filter(x=>x.stage===st),ph=es.flatMap(x=>x.photos),last=es[0]?.date;
    return`<li class="stg ${es.length?'done':''}"><span class="dot">${i+1}</span><div class="sbody">
     <div class="shead"><button class="stitle" data-act="pp-stage" data-s="${esc(st)}">${esc(st)}</button>
      ${es.length?`<span class="mute small">${ph.length} item${ph.length===1?'':'s'} · ${fmtDate(last)}${es.some(x=>!x.note)?' · <span class="late">⚠️ no details</span>':''}</span>`:''}
      <button class="btn sm" data-act="pp-new" data-s="${esc(st)}">+ Photos</button></div>
     ${ph.length?`<div class="strip">${ph.slice(0,6).map((f,j)=>thumb(f,'stage:'+st,j)).join('')}${ph.length>6?`<button class="more" data-act="pp-stage" data-s="${esc(st)}">+${ph.length-6}</button>`:''}</div>`:''}
    </div></li>`}).join('');
  return`<div class="top"><h1>Progress photos</h1><div class="btns"><button class="btn sm" data-act="ai-sort">✨ AI sort photos</button><button class="btn pri sm" data-act="pp-new" data-s="">+ Add photos</button></div></div>
  <div class="filters" style="grid-template-columns:minmax(0,1fr)"><select id="fPPProj" aria-label="Project">${opts(projects.map(p=>({v:p.id,l:p.name})),ppProj,'All projects')}</select></div>
  <p class="mute small" style="margin:0 0 12px">${total} photos · ${new Set(list.map(x=>x.stage)).size} of ${stageList().length} stages recorded</p>
  <ol class="stages">${rows}</ol><button class="btn sm" data-act="pp-new" data-s="Other" style="margin-top:10px">+ Other stage</button>
  ${pphotos.length?`<div class="dangerzone"><button class="link danger" data-act="pp-delall">🗑 Delete all progress photos (${pphotos.reduce((s,x)=>s+x.photos.length,0)})</button></div>`:''}`;
}
function stagePhotos(st){return pphotos.filter(x=>x.stage===st&&(!ppProj||x.project===ppProj))}
function stageSheet(st){
  const es=stagePhotos(st);
  openSheet(`<div class="ph"><div><div class="cat">Progress photos${ppProj?' · '+esc(projName(ppProj)):''}</div><h2>${esc(st)}</h2></div><button class="x" data-act="close" aria-label="Close">×</button></div>
  <button class="btn pri" data-act="pp-new" data-s="${esc(st)}" style="margin-bottom:14px">+ Add photos / videos to this stage</button>
  ${es.length?es.map(x=>`<section class="ppentry"><div class="shead"><div><b>${esc(fmtDate(x.date))}</b>${x.location?` · ${esc(x.location)}`:''}${!ppProj&&projName(x.project)?`<div class="mute small">${esc(projName(x.project))}</div>`:''}</div><button class="link" data-act="pp-edit" data-id="${esc(x.id)}">Edit</button></div>
   ${x.note?`<p style="margin:4px 0 8px;white-space:pre-wrap">${esc(x.note)}</p>`:`<p class="nodet">⚠️ No details added. <button class="link" data-act="pp-edit" data-id="${esc(x.id)}">Add voice details</button></p>`}<div class="pgrid">${x.photos.map((f,j)=>thumb(f,'entry:'+x.id,j)).join('')}</div></section>`).join(''):'<p class="mute">No photos for this stage yet.</p>'}`);
  fillThumbs($('#panel'));
}
async function compress(file){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size<400*1024)return file;
  try{const bmp=await createImageBitmap(file);const sc=Math.min(1,1920/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.82));if(!b||b.size>=file.size)return file;
    return new File([b],file.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'});}catch{return file}
}
function ppForm(id,stage){
  const x=id?pphotos.find(e=>e.id===id):null;editingPP=id||null;ppNew=[];ppKept=[...(x?.photos||[])];ppRemoved=[];
  const st=x?.stage||stage||'',isOther=st&&!stageList().includes(st)||st==='Other';
  openSheet(`<div class="ph"><h2>${x?'Edit photos / videos':'Add progress photos & videos'}</h2><button class="x" data-act="close" aria-label="Close">×</button></div>
  <form class="form" id="ppForm" novalidate>
   <label>Project<select name="project">${opts(projects.map(p=>({v:p.id,l:p.name})),x?.project||ppProj||(projects.length===1?projects[0].id:''),'No project')}</select></label>
   <label>Date<input name="date" type="date" value="${esc(x?.date||today())}"></label>
   <label class="full">Stage<select name="stage" id="ppStage">${opts([...stageList(),'Other'],isOther?'Other':st,'Choose stage')}</select></label>
   <label class="full" id="otherWrap" ${isOther?'':'hidden'}>Stage name<input name="other" value="${esc(isOther&&st!=='Other'?st:'')}" placeholder="e.g. Swimming pool tiling"></label>
   <label class="full">Location / element<input name="location" value="${esc(x?.location||'')}" placeholder="e.g. Footing F1–F6, Grid A–C, Ground floor slab"></label>
   <div class="full"><b class="small">Photos & videos</b><div class="pgrid" id="ppGrid" style="margin:8px 0"></div>
    <div class="btns"><label class="btn sm">📷 Photo<input id="ppCam" type="file" accept="image/*" capture="environment" hidden></label><label class="btn sm">🎥 Video<input id="ppVid" type="file" accept="video/*" capture="environment" hidden></label><label class="btn sm">Choose from gallery<input id="ppIn" type="file" accept="image/*,video/*" multiple hidden></label></div>
    <p class="small mute" style="margin:6px 0 0">Videos up to 20 MB (about 20–40 seconds). Keep test videos short.</p></div>
   <div class="full voice" id="ppAiBox">
    <div class="vhead"><b>🎤 Tell the details by voice</b><span class="small mute">Say where it is, what work, and all readings, e.g. <i>"Casting tie beams TB1 to TB6 ground floor, C40, slump 110, concrete temp 31, 6 cubes, inspected by consultant, WIR 45"</i></span></div>
    <div class="vctl" id="vctl"></div>
    <div class="small mute" id="ppAiMsg">After you stop recording, AI listens, looks at the photos and writes the engineering notes. The recording itself is not saved.</div>
    <details class="vtype"><summary>Or type details instead</summary><textarea name="readings" style="min-height:56px;margin-top:6px" placeholder="e.g. Grade C40, slump 110 mm, concrete temp 31°C, 6 cubes, WIR-045"></textarea><button type="button" class="btn sm pri" data-act="pp-ai" style="margin-top:6px">✨ Write notes</button></details>
   </div>
   <label class="full">Notes<textarea name="note" id="ppNote" style="min-height:120px" placeholder="Write your own notes, or tap ✨ Write notes">${esc(x?.note||'')}</textarea></label>
   <p id="formMsg" class="full small late" role="alert"></p>
   <div class="full btns"><button class="btn pri" type="submit" id="saveBtn">${x?'Save changes':'Save photos'}</button><button class="btn" type="button" data-act="close">Cancel</button>${x?`<button class="btn danger" type="button" data-act="pp-del" data-id="${esc(x.id)}">Delete</button>`:''}</div>
   <div id="delBox" class="full"></div>
  </form>`);
  drawPP();
  const add=e=>{for(const f of e.target.files){const lim=isVid(f)?20:25;if(f.size>lim*1048576){toast(`${f.name} is too large (max ${lim} MB). Record a shorter video.`);continue}ppNew.push(f)}e.target.value='';drawPP()};
  $('#ppIn').onchange=add;$('#ppCam').onchange=add;$('#ppVid').onchange=add;
  $('#ppStage').onchange=e=>{$('#otherWrap').hidden=e.target.value!=='Other'};
  ppVoice=null;ppNoDetOk=false;drawVoice();
  $('#ppForm').onsubmit=savePP;
}
function drawPP(){
  const g=$('#ppGrid');if(!g)return;
  g.innerHTML=ppKept.map((f,i)=>`<div class="pthumb rel">${media(f)}<button type="button" class="rm" data-act="pp-rmkept" data-i="${i}" aria-label="Remove">×</button></div>`).join('')+
   ppNew.map((f,i)=>`<div class="pthumb rel">${media(f,URL.createObjectURL(f))}<button type="button" class="rm" data-act="pp-rmnew" data-i="${i}" aria-label="Remove">×</button></div>`).join('')||'<p class="mute small" style="grid-column:1/-1;margin:0">No photos or videos yet.</p>';
  fillThumbs(g);
}
async function savePP(e){
  e.preventDefault();if(busy)return;
  const fd=new FormData(e.target),g=k=>(fd.get(k)||'').toString().trim(),msg=$('#formMsg');
  let stage=g('stage');if(stage==='Other')stage=g('other')||'Other';
  if(!stage){msg.textContent='Please choose a stage.';return}
  if(!ppNew.length&&!ppKept.length){msg.textContent='Add at least one photo or video.';return}
  if(!g('note')&&!ppNoDetOk){msg.innerHTML='⚠️ <b>No details added.</b> Tap 🎤 and say what this work is (location, readings, tests), or tap Save again to save without details.';ppNoDetOk=true;$('#ppAiBox').classList.add('nudge');$('#ppAiBox').scrollIntoView({behavior:'smooth',block:'center'});return}
  const btn=$('#saveBtn');busy=true;btn.disabled=true;msg.textContent='';
  const photos=[...ppKept],uploaded=[];
  try{
    for(let i=0;i<ppNew.length;i++){btn.textContent=`Uploading ${i+1} of ${ppNew.length}…`;
      const f=await compress(ppNew[i]);
      try{const path=await upload(f);uploaded.push(path);photos.push({path,name:f.name,size:f.size,type:f.type||''})}catch(err){err.upload=ppNew[i].name;throw err}}
    btn.textContent='Saving…';
    const row={project_id:g('project')||null,stage,location:g('location'),taken_on:g('date')||today(),note:g('note'),photos,updated_at:new Date().toISOString()};
    const {error}=editingPP?await sb.from('progress_photos').update(row).eq('id',editingPP):await sb.from('progress_photos').insert(row);
    if(error)throw error;
    await removeFiles(ppRemoved.map(f=>f.path));
    busy=false;closeSheet();toast('Photos saved');if(row.project_id)ppProj=row.project_id;refresh(true);
  }catch(err){
    busy=false;btn.disabled=false;btn.textContent=editingPP?'Save changes':'Save photos';
    if(!err.upload)await removeFiles(uploaded);
    msg.textContent=err.upload?`Couldn't upload ${err.upload}: ${err.message||'please try again'}`:errMsg(err);
  }
}
function ppDelAll(){
  const n=pphotos.length,files=pphotos.reduce((s,x)=>s+x.photos.length,0);
  openSheet(`<div class="ph"><h2>Delete all progress photos</h2><button class="x" data-act="close" aria-label="Close">×</button></div>
  <p>This deletes <b>all ${files} photos/videos</b> in <b>${n} entries</b> across <b>all projects</b>, with their notes. <b>This can't be undone.</b></p>
  <p class="small mute">DPRs and their photos are not affected.</p>
  <label class="full" style="display:grid;gap:6px;font-weight:600">Type DELETE to confirm<input id="delAllIn" autocapitalize="characters" autocomplete="off"></label>
  <p id="formMsg" class="small late" role="alert"></p>
  <div class="btns" style="margin-top:12px"><button class="btn danger" id="delAllBtn" data-act="pp-delall-yes" disabled>Delete everything</button><button class="btn" data-act="close">Cancel</button></div>`);
  $('#delAllIn').oninput=e=>{$('#delAllBtn').disabled=e.target.value.trim().toUpperCase()!=='DELETE'};
}
async function ppDelAllYes(btn){
  if($('#delAllIn').value.trim().toUpperCase()!=='DELETE')return;
  busy=true;btn.disabled=true;const list=[...pphotos],paths=list.flatMap(x=>x.photos.map(f=>f.path)),ids=list.map(x=>x.id);
  try{
    for(let i=0;i<ids.length;i+=100){btn.textContent=`Deleting… ${Math.min(i+100,ids.length)}/${ids.length}`;const {error}=await sb.from('progress_photos').delete().in('id',ids.slice(i,i+100));if(error)throw error}
    for(let i=0;i<paths.length;i+=100)await removeFiles(paths.slice(i,i+100));
    busy=false;closeSheet();toast('All progress photos deleted');refresh(true);
  }catch(e){busy=false;btn.disabled=false;btn.textContent='Delete everything';$('#formMsg').textContent=errMsg(e)}
}
/* ---------- Voice recording ---------- */
async function toWav(blob){
  const AC=window.AudioContext||window.webkitAudioContext,ac=new AC();
  const buf=await ac.decodeAudioData(await blob.arrayBuffer());ac.close&&ac.close();
  const rate=16000,len=Math.max(1,Math.ceil(buf.duration*rate)),off=new OfflineAudioContext(1,len,rate),src=off.createBufferSource();src.buffer=buf;src.connect(off.destination);src.start();
  const d=(await off.startRendering()).getChannelData(0),b=new ArrayBuffer(44+d.length*2),v=new DataView(b);
  const w=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i))};
  w(0,'RIFF');v.setUint32(4,36+d.length*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,d.length*2,true);
  for(let i=0;i<d.length;i++){const x=Math.max(-1,Math.min(1,d[i]));v.setInt16(44+i*2,x<0?x*0x8000:x*0x7fff,true)}
  return new File([b],`voice-note-${today()}-${Date.now().toString().slice(-5)}.wav`,{type:'audio/wav'});
}
const fmtSec=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
function drawVoice(){
  const c=$('#vctl');if(!c)return;
  if(recState)c.innerHTML=`<button type="button" class="vbtn rec" data-act="v-stop"><span class="dot"></span>Stop</button><span class="vtime" id="vtime">0:00</span><span class="wave"><i></i><i></i><i></i><i></i><i></i></span>`;
  else if(ppVoice)c.innerHTML=`<audio src="${URL.createObjectURL(ppVoice)}" controls></audio><button type="button" class="btn sm" data-act="v-start">🎤 Re-record</button><button type="button" class="btn sm" data-act="v-del">Delete</button><button type="button" class="btn sm pri" data-act="pp-ai">✨ Write notes again</button>`;
  else c.innerHTML=`<button type="button" class="vbtn" data-act="v-start"><span class="mic">🎤</span>Tap to record</button><label class="btn sm vfile">Use phone recorder<input id="vFile" type="file" accept="audio/*" capture hidden></label>`;
  const vf=$('#vFile');if(vf)vf.onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await gotAudio(f)};
}
async function gotAudio(blob){
  const msg=$('#ppAiMsg');
  try{ppVoice=await toWav(blob)}catch{if(/wav|mpeg|mp3|ogg|aac|flac/i.test(blob.type||'')){ppVoice=new File([blob],blob.name||'voice-note',{type:blob.type})}else{if(msg)msg.textContent='⚠️ Could not read that recording. Try the 🎤 button instead.';return}}
  if(ppVoice.size>12*1048576){ppVoice=null;if(msg)msg.textContent='⚠️ Voice note is too long. Keep it under about 3 minutes.';drawVoice();return}
  drawVoice();ppAI();
}
async function startRec(){
  const msg=$('#ppAiMsg');
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){$('#vFile')?.click();return}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}
  catch(e){if(msg)msg.textContent='⚠️ Microphone not allowed. Allow the microphone for this app, or use "Use phone recorder".';$('#vFile')?.click();return}
  const mr=new MediaRecorder(stream),chunks=[];mr.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  mr.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());clearInterval(recState?.iv);clearTimeout(recState?.to);recState=null;if(msg)msg.textContent='Processing your voice note…';await gotAudio(new Blob(chunks,{type:mr.mimeType||'audio/webm'}))};
  const t0=Date.now();recState={mr,stream,iv:setInterval(()=>{const el=$('#vtime');if(el)el.textContent=fmtSec((Date.now()-t0)/1000)},250),to:setTimeout(()=>mr.state==='recording'&&mr.stop(),180000)};
  mr.start();if(msg)msg.textContent='Recording… speak clearly. Tap Stop when finished (max 3 min).';drawVoice();
}
/* AI engineering notes for progress photos / videos */
async function videoFrames(file,n=4){
  const url=URL.createObjectURL(file),v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.src=url;
  await new Promise((res,rej)=>{v.onloadeddata=res;v.onerror=()=>rej(new Error('Could not read video'));setTimeout(res,8000)});
  const d=v.duration&&isFinite(v.duration)?v.duration:1,out=[];
  for(let k=0;k<n;k++){const t=Math.min(d-0.1,d*(k+0.5)/n);await new Promise(res=>{v.onseeked=res;v.currentTime=Math.max(0,t);setTimeout(res,3000)});
    const sc=Math.min(1,1280/Math.max(v.videoWidth||1280,v.videoHeight||720)),c=document.createElement('canvas');c.width=Math.round((v.videoWidth||1280)*sc);c.height=Math.round((v.videoHeight||720)*sc);c.getContext('2d').drawImage(v,0,0,c.width,c.height);out.push(c.toDataURL('image/jpeg',0.75).split(',')[1])}
  URL.revokeObjectURL(url);return out;
}
async function ppAI(){
  const f=$('#ppForm'),box=$('#ppAiBox'),msg=$('#ppAiMsg');if(!f||box.classList.contains('busy'))return;
  const g=k=>(f.elements[k]?.value||'').trim();let stage=g('stage');if(stage==='Other')stage=g('other');
  const items=[...ppNew.map(x=>({file:x})),...ppKept.filter(x=>!isAud(x)).map(x=>({kept:x}))].slice(0,6);
  if(!items.length&&!g('readings')&&!ppVoice){msg.textContent='Add a photo, a video or your details first.';return}
  box.classList.add('busy');msg.textContent=ppVoice?'AI is listening to your voice note and studying the photos… (10–40 seconds)':'AI is studying your photos/videos… (10–40 seconds)';
  try{
    const content=[];
    if(ppVoice)content.push({type:'text',text:'VOICE NOTE from the site engineer. Listen carefully, transcribe it, and use EVERY detail (location, element, work, grade, slump, temperatures, cubes, tests, bar sizes, top/bottom bars, cover, inspections, WIR numbers, people):'},{type:'image',source:{type:'base64',media_type:'audio/wav',data:await toB64(ppVoice)}});
    for(const it of items){
      let file=it.file;
      if(!file&&it.kept){if(isVid(it.kept)){content.push({type:'text',text:`[Saved video: ${it.kept.name}]`});continue}const u=(await signed([it.kept.path]))[it.kept.path];if(!u)continue;const b=await (await fetch(u)).blob();file=new File([b],it.kept.name,{type:b.type||'image/jpeg'})}
      if(isVid(file)){
        if(file.size<=8*1048576)content.push({type:'text',text:`Video: ${file.name}`},{type:'image',source:{type:'base64',media_type:file.type||'video/mp4',data:await toB64(file)}});
        else{content.push({type:'text',text:`Frames from video ${file.name}:`});for(const fr of await videoFrames(file))content.push({type:'image',source:{type:'base64',media_type:'image/jpeg',data:fr}})}
      }else content.push({type:'text',text:`Photo: ${file.name}`},{type:'image',source:{type:'base64',media_type:'image/jpeg',data:await smallB64(file,1400)}});
    }
    content.push({type:'text',text:`Stage selected: ${stage||'(not chosen — suggest one)'}\nLocation / element: ${g('location')||'-'}\nDate: ${g('date')}\nProject selected: ${projName(g('project'))||'-'}\nProjects in the app: ${JSON.stringify(projects.map(p=>({id:p.id,name:p.name,code:p.code,client:p.client})))}\nToday: ${today()}\nUser typed details: ${g('readings')||'(none)'}\nVoice note attached: ${ppVoice?'yes':'no'}\nExisting notes: ${g('note')||'(none)'}\n\nWrite site engineering notes for these progress photos/videos.`});
    const sys=`You are a senior site engineer / QA-QC inspector on a building project in Dubai, UAE, writing progress-photo notes for the contractor's records (Al Adeeb Building Contracting LLC). Be technical, practical and honest.
- Describe only what is actually visible; do not invent things you cannot see.
- Use the user's readings exactly as given (temperatures, slump, grade, quantities, test results) and compare them with TYPICAL requirements, e.g. for UAE hot-weather concreting (concrete temperature at placement commonly limited to about 32 °C unless the project spec says otherwise), slump vs the approved mix design, cube sampling and 7/28-day strength vs the specified grade; for reinforcement: bar sizes, spacing, top/bottom bar placement, laps and staggering, cover and spacer blocks, chairs, tying, couplers; for formwork, waterproofing, blockwork, etc. use the relevant checks.
- Always say limits are typical and must be confirmed against the project specification / approved method statement / consultant's requirements.
- Flag anything that looks wrong or needs attention.
- If there is a voice note, the transcript and the details from it are the most important input. Put the details in the right place (location, readings, checks).
- If the engineer gave NO details (no voice note, no typed details), say so in attention: "No details provided by the engineer — add location, readings and tests."
- Use the allowed stage list: ${JSON.stringify([...STAGES])}. Choose the stage that matches what the engineer SAYS (voice/typed) first, then what is visible. Only if nothing fits, give a short new stage name.
- From the voice note/typed details, pick out: the exact location/element as said (e.g. "Ground floor tie beams TB1–TB6, grid A–C"), the project (match to the projects list by name, plot number, area or client and return its id), and the date if mentioned (e.g. "yesterday" → ISO date).`;
    const r=await callAI({max_tokens:4000,system:sys,messages:[{role:'user',content}],tools:[{name:'engineering_notes',description:'Structured engineering notes for progress photos/videos',input_schema:{type:'object',properties:{stage:{type:'string'},location:{type:'string',description:'Exact location/element as said by the engineer, else as visible'},project_id:{type:'string',description:'id of the matching project from the list, if the engineer mentions it'},date:{type:'string',description:'YYYY-MM-DD if a date is mentioned'},transcript:{type:'string',description:'Word-for-word transcript of the voice note, if any'},summary:{type:'string',description:'2-3 sentence factual description of the work shown'},readings:{type:'array',description:'User readings compared with typical limits',items:{type:'object',properties:{item:{type:'string'},value:{type:'string'},typical_requirement:{type:'string'},status:{type:'string',description:'OK, CHECK or NOT OK'}},required:['item','value']}},checks:{type:'array',description:'Inspection checklist points for this stage, with what is visible',items:{type:'object',properties:{check:{type:'string'},observation:{type:'string'},status:{type:'string',description:'OK, CHECK or NOT VISIBLE'}},required:['check']}},attention:{type:'array',items:{type:'string'},description:'Issues or things to verify'},next_steps:{type:'array',items:{type:'string'}}},required:['summary']}}],tool_choice:{type:'tool',name:'engineering_notes'}});
    const v=(r.content||[]).find(b=>b.type==='tool_use')?.input;if(!v)throw new Error('AI could not write notes. Try again.');
    const ic=s=>/^ok/i.test(s||'')?'✅':/not ok/i.test(s||'')?'❌':'⚠️';
    const lines=[v.summary];
    if(v.readings?.length)lines.push('','READINGS',...v.readings.map(x=>`${ic(x.status)} ${x.item}: ${x.value}${x.typical_requirement?` (typical: ${x.typical_requirement})`:''}`));
    if(v.checks?.length)lines.push('','CHECKS',...v.checks.map(x=>`${ic(x.status)} ${x.check}${x.observation?` — ${x.observation}`:''}`));
    if(v.attention?.length)lines.push('','ATTENTION',...v.attention.map(x=>`• ${x}`));
    if(v.next_steps?.length)lines.push('','NEXT STEPS',...v.next_steps.map(x=>`• ${x}`));
    if(v.transcript)lines.push('','VOICE NOTE (transcript)',`"${v.transcript.trim()}"`);
    lines.push('','(AI notes — typical limits; confirm against project specification / consultant requirements)');
    const rd=g('readings');$('#ppNote').value=(rd?`Readings: ${rd}\n\n`:'')+lines.join('\n');
    const said=!!(ppVoice||g('readings')),set=[];
    const sel=$('#ppStage');
    if(sel&&v.stage&&(said||!g('stage'))){if([...sel.options].some(o=>o.value===v.stage)){if(sel.value!==v.stage)set.push('stage');sel.value=v.stage;$('#otherWrap').hidden=true}else if(v.stage.length<60){sel.value='Other';$('#otherWrap').hidden=false;f.elements.other.value=v.stage;set.push('stage')}}
    if(v.location&&(said||!g('location'))){if(g('location')!==v.location)set.push('location');f.elements.location.value=v.location}
    if(v.project_id&&projects.some(p=>p.id===v.project_id)&&(said||!g('project'))){if(g('project')!==v.project_id)set.push('project');f.elements.project.value=v.project_id}
    if(v.date&&/^\d{4}-\d{2}-\d{2}$/.test(v.date)&&said&&v.date!==g('date')){f.elements.date.value=v.date;set.push('date')}
    ['project','date','stage','location'].forEach(k=>{const el=k==='stage'?sel:f.elements[k];if(set.includes(k)&&el){el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1600)}});
    msg.textContent='✓ Notes written from your '+(ppVoice?'voice note':'details')+(set.length?` · AI also set the ${set.join(', ')}`:'')+'. Check, then Save.';$('#ppAiBox').classList.remove('nudge');$('#ppNote').classList.add('flash');setTimeout(()=>$('#ppNote')?.classList.remove('flash'),1500);
  }catch(e){msg.textContent='⚠️ '+(e.message||'AI error')}
  box.classList.remove('busy');
}
/* lightbox */
function lbOpen(list,i){
  if(list.startsWith('stage:'))lbList=stagePhotos(list.slice(6)).flatMap(x=>x.photos.map(f=>({...f,cap:`${fmtDate(x.date)}${x.location?' · '+x.location:''}`})));
  else if(list.startsWith('entry:')){const x=pphotos.find(e=>e.id===list.slice(6));lbList=(x?.photos||[]).map(f=>({...f,cap:`${fmtDate(x.date)}${x.location?' · '+x.location:''}`}))}
  else if(list.startsWith('dpr:')){const r=dprs.find(e=>e.id===list.slice(4));lbList=(r?.photos||[]).map(f=>({...f,cap:fmtDate(r.date)}))}
  lbIdx=+i||0;let lb=$('#lb');
  if(!lb){document.body.insertAdjacentHTML('beforeend','<div class="lb" id="lb"><button class="x lbx" data-act="lb-close" aria-label="Close">×</button><button class="lbn prev" data-act="lb-prev" aria-label="Previous">‹</button><div id="lbMedia" class="lbm"></div><button class="lbn next" data-act="lb-next" aria-label="Next">›</button><div class="lbcap" id="lbCap"></div></div>');lb=$('#lb')}
  lb.hidden=false;lbShow();
}
async function lbShow(){
  const f=lbList[lbIdx];if(!f)return;const box=$('#lbMedia');box.innerHTML='';
  $('#lbCap').textContent=`${f.cap||''}   ${lbIdx+1} / ${lbList.length}`;
  const m=await signed([f.path]);if(!m[f.path])return;
  box.innerHTML=isAud(f)?`<div class="lbaudio">🎤<b>Voice note</b><audio src="${m[f.path]}" controls autoplay></audio></div>`:isVid(f)?`<video src="${m[f.path]}" controls playsinline autoplay></video>`:`<img src="${m[f.path]}" alt="">`;
}

/* ---------- AI assistant (Gemini via Supabase function "ai") ---------- */
let chat=[],aiBusy=false,sortItems=[],chatFiles=[];
const AI_MODEL='claude-sonnet-5-5';let AI_FN='ai';
function nowText(){return new Date().toLocaleString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dubai'})+' (Dubai time)'}
function aiContext(){
  const P=id=>projName(id)||null;
  return JSON.stringify({
    today:today(),now:nowText(),
    me:{username:username(),full_name:settings.full_name||null,job_title:settings.job_title||'Quantity Surveyor',phone:settings.phone||null,company:settings.company||'Al Adeeb Building Contracting LLC'},
    projects:projects.map(p=>({id:p.id,name:p.name,code:p.code||null,client:p.client||null,contract_value_aed:p.value===''?null:p.value})),
    documents:docs.map(d=>({id:d.id,type:d.category,project:P(d.project),project_id:d.project||null,title:d.title,ref:d.ref||null,party:d.party||null,amount_aed:d.amount===''?null:d.amount,status:d.status,currently_with:d.withp,submitted:d.submitted||null,due:d.due||null,overdue:!!isLate(d),notes:d.notes||null,files:d.files.map(f=>f.name),last_update:d.history.length?d.history[d.history.length-1]:null,updated:d.updated})),
    dprs:dprs.slice(0,40).map(r=>{const d=normDpr(r),t=totals(d);return{id:r.id,date:r.date,project:P(r.project),ref_no:d.ref_no,weather:d.weather,staff:d.staff.filter(x=>num(x.qty)),labour:d.labour.filter(x=>num(x.qty)),subcontractors:[...d.subs,...d.others].filter(x=>num(x.qty)),equipment:d.equipment.filter(x=>num(x.qty)),materials:d.materials,tasks:d.tasks,totals:{staff:t.st,labour:t.lb,subcontractors:t.sb,total_manpower:t.all,equipment:t.eq},remarks:d.remarks||null,photos:r.photos.length}}),
    progress_photos:pphotos.map(x=>({id:x.id,project:P(x.project),stage:x.stage,location:x.location||null,date:x.date,note:x.note||null,photos:x.photos.length})),
    lists:{document_types:CATS,statuses:STATUSES,currently_with_options:WITH,construction_stages:STAGES,weather:WEATHER}
  });
}
function aiSystem(){
  return `You are the AI assistant inside "ADCC QS Register", the app a Quantity Surveyor at ${settings.company||'Al Adeeb Building Contracting LLC'} (Dubai, UAE) uses to track payments/IPAs, tenders, BOQs, measurement sheets, variations, RFIs, NCRs, daily progress reports (DPR) and site progress photos.
Current date and time: ${nowText()}. Today's ISO date: ${today()}. Currency: AED. Use UAE/GCC construction and FIDIC terminology.

Rules:
- Base every fact, amount, reference, date and status on APP DATA below. Never invent amounts, reference numbers, names or emails. If something is missing, put a clear placeholder like [consultant name] and say what's missing.
- When the user wants something done, CALL A TOOL so they can review and apply it: draft_email for any email/letter; prepare_dpr to fill a daily progress report; prepare_document to add a register entry; update_document to change status / who has it / due date. You may call several tools in one reply.
- Emails: professional, concise, UAE business style. Automatically include today's date, project name, document references, amounts, submission dates and how long it is pending where relevant. Sign off with the user's name, job title, company and phone from "me" (placeholders if missing).
- When fixing dates: "today" = ${today()}; "yesterday" = ${localISO(Date.now()-864e5)}.
- Answers to questions: short, clear, with numbers and totals. Use simple bullet lists. No long essays.

APP DATA (JSON):
${aiContext()}`;
}
const AI_TOOLS=[
 {name:'draft_email',description:'Draft an email or letter for the user to review, copy or open in their mail app.',input_schema:{type:'object',properties:{to:{type:'string',description:'Recipient email(s) if known, else empty'},cc:{type:'string'},subject:{type:'string'},body:{type:'string',description:'Full plain-text email body including greeting and signature'}},required:['subject','body']}},
 {name:'prepare_dpr',description:'Prepare a full daily progress report in ADCC format (staff, labour, sub-contractors, equipment, weather, materials, tasks). Opens a pre-filled DPR form for the user to check and save. When the user uploads a DPR file, extract every row and quantity exactly.',input_schema:DPR_SCHEMA},
 {name:'prepare_document',description:'Prepare a new register entry (IPA, VO, RFI, tender, etc). Opens a pre-filled form for the user to check and save.',input_schema:{type:'object',properties:{category:{type:'string'},project_id:{type:'string'},title:{type:'string'},ref:{type:'string'},party:{type:'string'},amount:{type:'number'},status:{type:'string'},with_party:{type:'string'},submitted:{type:'string'},due:{type:'string'},notes:{type:'string'}},required:['title','category']}},
 {name:'update_document',description:'Change the status, who currently has it, or due date of an existing register document. User confirms before it is saved.',input_schema:{type:'object',properties:{document_id:{type:'string'},status:{type:'string'},with_party:{type:'string'},due:{type:'string'},note:{type:'string',description:'Short history note'}},required:['document_id']}}
];
async function callAI(body){
  let {data,error}=await sb.functions.invoke(AI_FN,{body:{model:AI_MODEL,...body}});
  if(error&&(error.context?.status===404||error.name==='FunctionsFetchError'||/Failed to send/i.test(error.message||''))){const alt=AI_FN==='ai'?'smart-task':'ai';({data,error}=await sb.functions.invoke(alt,{body:{model:AI_MODEL,...body}}));if(!error)AI_FN=alt}
  if(error){let m=error.message||'AI is not available.';try{const j=await error.context?.json?.();if(j?.error?.message)m=j.error.message}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error.message||'AI error');
  return data;
}
const md=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^#{1,3} (.+)$/gm,'<b>$1</b>').replace(/^[-*] (.+)$/gm,'• $1');
function aiOpen(prefill){
  openSheet(`<div class="ph"><div><div class="cat">Powered by Gemini</div><h2>✨ AI assistant</h2></div><div class="btns"><button class="btn sm" data-act="ai-clear">New chat</button><button class="x" data-act="close" aria-label="Close">×</button></div></div>
  <div class="chat" id="chat"></div>
  <div id="aiFiles" class="aifiles"></div><form class="chatin" id="aiForm"><label class="btn attach" title="Attach PDF or photo">📎<input id="aiFile" type="file" accept="application/pdf,image/*" multiple hidden></label><textarea id="aiIn" rows="2" placeholder="Ask anything, or tell me what to do… (tap 🎤 on your keyboard to speak)"></textarea><button class="btn pri" id="aiSend" type="submit">Send</button></form>`);
  drawChat();
  $('#aiFile').onchange=e=>{chatFiles.push(...e.target.files);e.target.value='';drawAiFiles()};drawAiFiles();
  $('#aiForm').onsubmit=e=>{e.preventDefault();const v=$('#aiIn').value.trim();if(v||chatFiles.length)aiSend(v||'Read the attached file. If it is a DPR, prepare the DPR with every staff, labour, sub-contractor and equipment count.')};
  $('#aiIn').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&window.innerWidth>900){e.preventDefault();$('#aiForm').requestSubmit()}};
  if(prefill)aiSend(prefill);
}
const SUGGEST=['📎 Upload a DPR PDF and I\'ll fill everything','Write today\'s DPR: ','Which payments are pending and with whom?','Email the consultant to follow up all overdue IPAs','Weekly progress & payment summary for my senior','Which construction stages have no photos yet?'];
function drawAiFiles(){const b=$('#aiFiles');if(b)b.innerHTML=chatFiles.map((f,i)=>`<span class="chip">📄 ${esc(f.name)} <button type="button" class="link" data-act="ai-rmfile" data-i="${i}">×</button></span>`).join('')}
function drawChat(){
  const c=$('#chat');if(!c)return;
  c.innerHTML=(chat.length?'':`<div class="aihello"><p><b>Hi${settings.full_name?' '+esc(settings.full_name.split(' ')[0]):''}!</b> I can see all your documents, DPRs and photos. Ask me a question or tell me what to prepare. I'll fill in dates, references and amounts automatically.</p><div class="sugg">${SUGGEST.map(s=>`<button class="chip" data-act="ai-sugg" data-t="${esc(s)}">${esc(s.replace(/: $/,'…'))}</button>`).join('')}</div></div>`)+
   chat.map((m,i)=>m.role==='user'?`<div class="msg me">${esc(m.text)}${m.fnames?.length?`<div class="small" style="opacity:.8">📎 ${esc(m.fnames.join(', '))}</div>`:''}</div>`:`<div class="msg ai">${m.text?`<div>${md(m.text)}</div>`:''}${(m.actions||[]).map((a,j)=>actionCard(a,i,j)).join('')}</div>`).join('')+
   (aiBusy?'<div class="msg ai typing">Thinking…</div>':'');
  c.scrollTop=c.scrollHeight;$('#panel').scrollTop=$('#panel').scrollHeight;
}
function actionCard(a,i,j){
  const k=`data-i="${i}" data-j="${j}"`,v=a.input||{};
  if(a.name==='draft_email')return`<div class="acard"><div class="ah">✉️ Email draft</div>${v.to?`<div class="small"><b>To:</b> ${esc(v.to)}</div>`:''}${v.cc?`<div class="small"><b>Cc:</b> ${esc(v.cc)}</div>`:''}<div class="small"><b>Subject:</b> ${esc(v.subject)}</div><pre class="mail">${esc(v.body)}</pre><div class="btns"><button class="btn sm pri" data-act="ai-copy" ${k}>Copy</button><button class="btn sm" data-act="ai-mail" ${k}>Open in email app</button></div></div>`;
  if(a.name==='prepare_dpr'){const t=totals(preFromAI(v));return`<div class="acard"><div class="ah">📋 DPR ready · ${esc(fmtDate(v.date))}</div><div class="small mute">Staff ${t.st} · Labour ${t.lb} · Sub-con ${t.sb} · <b>Total ${t.all}</b> · Equipment ${t.eq} · ${(v.tasks||[]).length} tasks</div><div class="btns"><button class="btn sm pri" data-act="ai-dpr" ${k}>Review & save</button></div></div>`}
  if(a.name==='prepare_document')return`<div class="acard"><div class="ah">📄 New ${esc(v.category||'document')}</div><div class="small"><b>${esc(v.title)}</b>${v.amount!=null?' · '+money(v.amount):''}${v.status?' · '+esc(v.status):''}</div><div class="btns"><button class="btn sm pri" data-act="ai-doc" ${k}>Review & save</button></div></div>`;
  if(a.name==='update_document'){const d=docs.find(x=>x.id===v.document_id);return`<div class="acard"><div class="ah">🔄 Update ${esc(d?.title||'document')}</div><div class="small">${v.status?`Status → <b>${esc(v.status)}</b> `:''}${v.with_party?`· With → <b>${esc(v.with_party)}</b> `:''}${v.due?`· Due → <b>${esc(fmtDate(v.due))}</b>`:''}${v.note?`<br><span class="mute">${esc(v.note)}</span>`:''}</div><div class="btns">${a.done?'<span class="stamp c-green">Applied</span>':`<button class="btn sm pri" data-act="ai-upd" ${k}>Apply</button>`}</div></div>`}
  return'';
}
async function aiSend(text){
  if(aiBusy)return;const files=chatFiles;chatFiles=[];drawAiFiles();
  const um={role:'user',text,fnames:files.map(f=>f.name)};chat.push(um);aiBusy=true;const inp=$('#aiIn');if(inp)inp.value='';drawChat();
  if(files.length){try{um.parts=await fileParts(files)}catch(e){aiBusy=false;chat.push({role:'assistant',text:'⚠️ '+e.message});drawChat();return}}
  const messages=chat.slice(-16).map(m=>({role:m.role==='user'?'user':'assistant',content:m.role==='user'?(m===um&&m.parts?[...m.parts,{type:'text',text:m.text}]:m.text+(m.fnames?.length?` [attached: ${m.fnames.join(', ')}]`:'')):((m.text||'')+(m.actions?.length?`\n[I prepared: ${m.actions.map(a=>a.name+' '+JSON.stringify(a.input).slice(0,300)).join('; ')}]`:''))||'(done)'}));
  try{
    const r=await callAI({system:aiSystem(),messages,tools:AI_TOOLS,max_tokens:6000});
    const blocks=r.content||[];
    chat.push({role:'assistant',text:blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim(),actions:blocks.filter(b=>b.type==='tool_use').map(b=>({name:b.name,input:b.input}))});
  }catch(e){chat.push({role:'assistant',text:'⚠️ '+(e.message||'AI error')+(String(e.message).match(/not found|404|FunctionsFetchError|Failed to send/i)?'\n\nThe AI function isn\'t set up in Supabase yet. Follow the AI setup steps.':'')})}
  aiBusy=false;drawChat();
}
function aiAct(t){
  const a=chat[+t.dataset.i]?.actions?.[+t.dataset.j];if(!a)return;const v=a.input||{},act=t.dataset.act;
  if(act==='ai-copy'){const txt=(v.to?`To: ${v.to}\n`:'')+(v.cc?`Cc: ${v.cc}\n`:'')+`Subject: ${v.subject}\n\n${v.body}`;navigator.clipboard.writeText(txt).then(()=>toast('Email copied'),()=>toast('Copy failed, select the text and copy'))}
  else if(act==='ai-mail'){location.href=`mailto:${encodeURIComponent(v.to||'')}?subject=${encodeURIComponent(v.subject||'')}${v.cc?'&cc='+encodeURIComponent(v.cc):''}&body=${encodeURIComponent(v.body||'')}`}
  else if(act==='ai-dpr'){if(dprMissing)return toast('Run the DPR setup script first');dprForm(null,preFromAI(v))}
  else if(act==='ai-doc'){docForm(null,{category:CATS.includes(v.category)?v.category:'Other',project:projects.some(p=>p.id===v.project_id)?v.project_id:'',title:v.title||'',ref:v.ref||'',party:v.party||'',amount:v.amount??'',status:STATUSES.includes(v.status)?v.status:'Draft',withp:WITH.includes(v.with_party)?v.with_party:'Me',submitted:v.submitted||'',due:v.due||'',notes:v.notes||'',link:'',files:[],history:[]})}
  else if(act==='ai-upd')applyUpdate(a,t);
}
async function applyUpdate(a,btn){
  const v=a.input,d=docs.find(x=>x.id===v.document_id);if(!d)return toast('Document not found');
  const st=STATUSES.includes(v.status)?v.status:d.status,w=WITH.includes(v.with_party)?v.with_party:d.withp,now=new Date().toISOString();
  btn.disabled=true;
  const row={status:st,with_party:w,updated_at:now,history:[...d.history,{t:now,status:st,withp:w,note:(v.note||'Updated')+' (via AI)'}]};if(v.due)row.due=v.due;
  const {error}=await sb.from('documents').update(row).eq('id',d.id);
  if(error){btn.disabled=false;return toast(errMsg(error))}
  a.done=true;toast('Updated');await refresh(true);drawChat();
}
/* AI photo sorting */
async function smallB64(file,max=768){
  const bmp=await createImageBitmap(file);const sc=Math.min(1,max/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas');c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',0.7).split(',')[1];
}
function sortOpen(){
  if(ppMissing)return toast('Run the photos setup script first');
  sortItems=[];
  openSheet(`<div class="ph"><div><div class="cat">Powered by Gemini</div><h2>✨ AI sort photos</h2></div><button class="x" data-act="close" aria-label="Close">×</button></div>
  <p class="mute" style="margin-top:0">Pick many site photos at once. AI looks at each one, puts it in the right construction stage and writes a short description. You check, then save all.</p>
  <div class="form" style="margin-bottom:12px"><label>Project<select id="sortProj">${opts(projects.map(p=>({v:p.id,l:p.name})),ppProj||(projects.length===1?projects[0].id:''),'No project')}</select></label><label>Date taken<input id="sortDate" type="date" value="${today()}"></label></div>
  <label class="btn pri" style="width:max-content">Choose photos<input id="sortIn" type="file" accept="image/*" multiple hidden></label>
  <div id="sortList" class="sortlist"></div><p id="formMsg" class="small late" role="alert"></p><div id="sortSave"></div>`);
  $('#sortIn').onchange=async e=>{const fs=[...e.target.files];e.target.value='';if(!fs.length)return;await sortRun(fs)};
}
async function sortRun(files){
  const msg=$('#formMsg');msg.textContent='';
  const start=sortItems.length;files.forEach(f=>sortItems.push({file:f,url:URL.createObjectURL(f),stage:'',location:'',desc:'',state:'…'}));drawSort();
  for(let i=start;i<sortItems.length;i+=6){
    const batch=sortItems.slice(i,i+6);batch.forEach(x=>x.state='AI is looking…');drawSort();
    try{
      const content=[];for(let k=0;k<batch.length;k++){content.push({type:'text',text:`Photo ${k}:`});content.push({type:'image',source:{type:'base64',media_type:'image/jpeg',data:await smallB64(batch[k].file)}})}
      content.push({type:'text',text:`Classify each photo into exactly one of these construction stages: ${JSON.stringify([...STAGES,'Other'])}. Give a short location hint only if visible (e.g. "Footings", "Ground floor slab"), and a one-line factual description of the work shown.`});
      const r=await callAI({max_tokens:1500,system:'You are a construction site photo classifier for a UAE building contractor. Be accurate and factual.',messages:[{role:'user',content}],tools:[{name:'classify_photos',description:'Return the stage for each photo',input_schema:{type:'object',properties:{items:{type:'array',items:{type:'object',properties:{index:{type:'integer'},stage:{type:'string'},location_hint:{type:'string'},description:{type:'string'}},required:['index','stage','description']}}},required:['items']}}],tool_choice:{type:'tool',name:'classify_photos'}});
      const out=(r.content||[]).find(b=>b.type==='tool_use')?.input?.items||[];
      batch.forEach((x,k)=>{const o=out.find(z=>z.index===k)||{};x.stage=[...STAGES,'Other'].includes(o.stage)?o.stage:'Other';x.location=o.location_hint||'';x.desc=o.description||'';x.state=''});
    }catch(e){batch.forEach(x=>{x.state='';x.stage=x.stage||''});msg.textContent='AI: '+(e.message||'error')+'. You can still choose stages yourself.'}
    drawSort();
  }
}
function drawSort(){
  const l=$('#sortList');if(!l)return;
  l.innerHTML=sortItems.map((x,i)=>`<div class="sortrow"><img src="${x.url}" alt=""><div class="sortf">${x.state?`<span class="mute small">${esc(x.state)}</span>`:''}
   <select data-si="${i}" data-k="stage">${opts([...STAGES,'Other'],x.stage,'Choose stage')}</select>
   <input data-si="${i}" data-k="location" value="${esc(x.location)}" placeholder="Location">
   <input data-si="${i}" data-k="desc" value="${esc(x.desc)}" placeholder="Description"></div>
   <button type="button" class="x sm" data-act="sort-rm" data-i="${i}" aria-label="Remove">×</button></div>`).join('');
  $('#sortSave').innerHTML=sortItems.length&&!sortItems.some(x=>x.state)?`<button class="btn pri" data-act="sort-save" style="margin-top:12px">Save ${sortItems.length} photos into stages</button>`:'';
  l.oninput=l.onchange=e=>{const i=e.target.dataset.si;if(i!=null)sortItems[+i][e.target.dataset.k]=e.target.value};
}
async function sortSave(btn){
  if(sortItems.some(x=>!x.stage)){$('#formMsg').textContent='Choose a stage for every photo.';return}
  busy=true;btn.disabled=true;const proj=$('#sortProj').value,date=$('#sortDate').value||today();
  const groups={};sortItems.forEach(x=>{const key=x.stage+'|'+x.location;(groups[key]=groups[key]||[]).push(x)});
  try{let n=0;
    for(const key in groups){const g=groups[key],photos=[];
      for(const x of g){btn.textContent=`Uploading ${++n} of ${sortItems.length}…`;const f=await compress(x.file);const path=await upload(f);photos.push({path,name:f.name,size:f.size})}
      const {error}=await sb.from('progress_photos').insert({project_id:proj||null,stage:g[0].stage,location:g[0].location,taken_on:date,note:[...new Set(g.map(x=>x.desc).filter(Boolean))].join('\n'),photos});
      if(error)throw error}
    busy=false;closeSheet();toast('Photos saved into stages');if(proj)ppProj=proj;view='photos';refresh(true);
  }catch(e){busy=false;btn.disabled=false;btn.textContent='Try again';$('#formMsg').textContent=errMsg(e)}
}

/* ---------- login ---------- */
function showLogin(){
  $('#login').hidden=false;$('#gate').hidden=true;
  const f=$('#loginForm');f.reset();$('#loginErr').textContent='';setMode(false);
}
function setMode(s){
  signup=s;$('#confirmWrap').hidden=!s;
  $('#loginBtn').textContent=s?'Create account':'Log in';
  $('#loginSub').textContent=s?'Choose a username and password':'Log in with your username and password';
  $('#swapBtn').textContent=s?'Already have an account? Log in':'New user? Create an account';
  $('#loginForm').password.autocomplete=s?'new-password':'current-password';
}
$('#swapBtn').onclick=()=>{setMode(!signup);$('#loginErr').textContent=''};
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();const f=e.target,err=$('#loginErr'),btn=$('#loginBtn');
  const un=f.username.value.trim().toLowerCase(),pw=f.password.value;
  if(!/^[a-z0-9._-]{3,30}$/.test(un)){err.textContent='Username: 3–30 letters or numbers, no spaces.';return}
  if(pw.length<6){err.textContent='Password must be at least 6 characters.';return}
  if(signup&&pw!==f.confirm.value){err.textContent='Passwords don\'t match.';return}
  btn.disabled=true;err.textContent='';btn.textContent=signup?'Creating…':'Logging in…';
  const email=un+'@'+EMAIL_DOMAIN;
  try{
    if(signup){
      const {data,error}=await sb.auth.signUp({email,password:pw});
      if(error)throw error;
      if(!data.session){err.textContent='Account created, but "Confirm email" is still ON in Supabase. Turn it off (Authentication → Sign In / Providers → Email), then log in.';setMode(false);return}
    }else{
      const {error}=await sb.auth.signInWithPassword({email,password:pw});if(error)throw error;
    }
  }catch(ex){
    const m=(ex.message||'').toLowerCase();
    err.textContent=m.includes('invalid login')?'Wrong username or password.':m.includes('already')?'That username is already taken.':m.includes('not confirmed')?'Account not confirmed. Turn off "Confirm email" in Supabase, or confirm the user there.':m.includes('fetch')?'No internet connection.':(ex.message||'Something went wrong.');
  }finally{btn.disabled=false;btn.textContent=signup?'Create account':'Log in'}
};
sb.auth.onAuthStateChange((ev,session)=>{
  const u=session?.user||null;
  if(u&&(!user||user.id!==u.id)){user=u;$('#login').hidden=true;animateNext=true;gate('Loading your register…');loaded=false;settings={};logoUrl='';refresh()}
  else if(!u&&ev!=='INITIAL_SESSION'||(!u&&!user)){user=null;docs=[];projects=[];loaded=false;closeSheet();showLogin()}
  else if(u)user=u;
});

/* ---------- events ---------- */
function go(v){view=v;animateNext=true;render();window.scrollTo(0,0)}
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-act]');if(!t)return;
  const a=t.dataset.act,id=t.dataset.id;
  if(a==='nav')go(t.dataset.v);
  else if(a==='add'){if(loaded)docForm(null)}
  else if(a==='open')detail(id);
  else if(a==='close')closeSheet();
  else if(a==='edit')docForm(id);
  else if(a==='refresh'){toast('Refreshing…');refresh()}
  else if(a==='settings'){if(loaded)settingsForm()}
  else if(a==='logout'){busy=false;closeSheet();await sb.auth.signOut()}
  else if(a==='url')openUrl(t.dataset.u);
  else if(a==='file'){const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(t.dataset.p,3600);if(error)toast('Couldn\'t open file: '+error.message);else openUrl(data.signedUrl)}
  else if(a==='logo-rm'){const old=settings.logo_path;const {error}=await sb.from('settings').upsert({user_id:user.id,company:settings.company||null,logo_path:null});if(error)return toast(errMsg(error));await removeFiles([old]);await refresh(true);toast('Logo reset');settingsForm()}
  else if(a==='cat'){F.cat=t.dataset.c;render()}
  else if(a==='clear'){Object.assign(F,{q:'',cat:'All',proj:'',status:'',withp:''});render()}
  else if(a==='with'){Object.assign(F,{q:'',cat:'All',proj:'',status:'_open',withp:t.dataset.w});go('register')}
  else if(a==='go'){Object.assign(F,{q:'',cat:'All',proj:'',withp:'',status:{open:'_open',late:'_late',pend:'_pend',paid:'Paid'}[t.dataset.f]});go('register')}
  else if(a==='proj-open'){Object.assign(F,{q:'',cat:'All',status:'',withp:'',proj:id});go('register')}
  else if(a==='ai'){if(loaded)aiOpen()}
  else if(a==='ai-clear'){chat=[];chatFiles=[];drawAiFiles();drawChat()}
  else if(a==='ai-rmfile'){chatFiles.splice(+t.dataset.i,1);drawAiFiles()}
  else if(a==='ai-sugg'){const t2=t.dataset.t;if(t2.startsWith('📎')){$('#aiFile').click();return}if(t2.endsWith(': ')){$('#aiIn').value=t2;$('#aiIn').focus()}else aiSend(t2)}
  else if(['ai-copy','ai-mail','ai-dpr','ai-doc','ai-upd'].includes(a))aiAct(t);
  else if(a==='ai-sort'){if(loaded)sortOpen()}
  else if(a==='sort-rm'){sortItems.splice(+t.dataset.i,1);drawSort()}
  else if(a==='sort-save')sortSave(t);
  else if(a==='pp-new'){if(loaded&&!ppMissing)ppForm(null,t.dataset.s);else if(ppMissing)go('photos')}
  else if(a==='pp-ai')ppAI();
  else if(a==='pp-delall')ppDelAll();
  else if(a==='pp-delall-yes')ppDelAllYes(t);
  else if(a==='v-start')startRec();
  else if(a==='v-stop'){recState?.mr?.state==='recording'&&recState.mr.stop()}
  else if(a==='v-del'){ppVoice=null;drawVoice()}
  else if(a==='pp-stage')stageSheet(t.dataset.s);
  else if(a==='pp-edit')ppForm(id);
  else if(a==='pp-rmkept'){ppRemoved.push(...ppKept.splice(+t.dataset.i,1));drawPP()}
  else if(a==='pp-rmnew'){ppNew.splice(+t.dataset.i,1);drawPP()}
  else if(a==='pp-del'){$('#delBox').innerHTML=`<div class="card" style="margin-top:12px"><p style="margin:0 0 10px">Delete these photos? This can't be undone.</p><div class="btns"><button type="button" class="btn danger" data-act="pp-delyes" data-id="${esc(id)}">Yes, delete</button><button type="button" class="btn" data-act="delno">Keep them</button></div></div>`}
  else if(a==='pp-delyes'){const x=pphotos.find(e=>e.id===id);const {error}=await sb.from('progress_photos').delete().eq('id',id);if(error)return toast(errMsg(error));await removeFiles((x?.photos||[]).map(f=>f.path));closeSheet();toast('Deleted');refresh(true)}
  else if(a==='lb')lbOpen(t.dataset.list,t.dataset.i);
  else if(a==='lb-close'){$('#lb').hidden=true;$('#lbMedia').innerHTML=''}
  else if(a==='lb-prev'){lbIdx=(lbIdx-1+lbList.length)%lbList.length;lbShow()}
  else if(a==='lb-next'){lbIdx=(lbIdx+1)%lbList.length;lbShow()}
  else if(a==='dpr-new'){if(loaded&&!dprMissing)dprForm(null);else if(dprMissing)go('dpr')}
  else if(a==='dpr-open')dprDetail(id);
  else if(a==='dpr-edit')dprForm(id);
  else if(a==='dpr-add'){const l=t.dataset.l,box=document.querySelector(`[data-list="${l}"]`);box.insertAdjacentHTML('beforeend',l==='materials'?mrow({}):l==='tasks'?trow({}):qrow({},l));box.lastElementChild.querySelector('input').focus()}
  else if(a==='dpr-rmsrc'){if(t.dataset.k==='k')dprSrcRemoved.push(...dprSrcKept.splice(+t.dataset.i,1));else dprSrcNew.splice(+t.dataset.i,1);drawSrc()}
  else if(a==='dpr-rmrow'){t.parentElement.remove();menTotal()}
  else if(a==='dpr-print'){const rep=$('#rep');if(!rep)return;const pa=document.createElement('div');pa.id='printArea';pa.innerHTML=rep.outerHTML;document.body.appendChild(pa);document.body.classList.add('printing');setTimeout(()=>{window.print();setTimeout(()=>{document.body.classList.remove('printing');pa.remove()},500)},400)}
  else if(a==='dpr-copyman'){const L=lastDpr($('#dprForm').elements.project.value);if(!L)return;const d=normDpr(L);['staff','labour','subs','others','equipment'].forEach(k=>{const box=document.querySelector(`[data-list="${k}"]`);box.querySelectorAll('.qrow').forEach(row=>{const n=row.querySelector('[data-k=name]').value.trim().toLowerCase(),m=d[k].find(x=>String(x.name).toLowerCase()===n);if(m)row.querySelector('[data-k=qty]').value=m.qty??''})});menTotal();toast('Copied numbers from '+fmtDate(L.date))}
  else if(a==='dpr-rmkept'){dprPhotosRemoved.push(...dprPhotosKept.splice(+t.dataset.i,1));drawPhotos()}
  else if(a==='dpr-rmnew'){dprPhotosNew.splice(+t.dataset.i,1);drawPhotos()}
  else if(a==='dpr-del'){$('#delBox').innerHTML=`<div class="card" style="margin-top:12px"><p style="margin:0 0 10px">Delete this daily report and its photos? This can't be undone.</p><div class="btns"><button class="btn danger" data-act="dpr-delyes" data-id="${esc(id)}">Yes, delete</button><button class="btn" data-act="delno">Keep it</button></div></div>`}
  else if(a==='dpr-delyes'){const r=dprs.find(x=>x.id===id);const {error}=await sb.from('dprs').delete().eq('id',id);if(error)return toast(errMsg(error));await removeFiles([...(r?.photos||[]),...((r?.details||{}).files||[])].map(f=>f.path));closeSheet();toast('Deleted');refresh(true)}
  else if(a==='proj-add')projForm(null);
  else if(a==='proj-edit')projForm(id);
  else if(a==='proj-del'){const {error}=await sb.from('projects').delete().eq('id',id);if(error)return toast(errMsg(error));closeSheet();toast('Project deleted');refresh(true)}
  else if(a==='rmkept'){removedFiles.push(...keptFiles.splice(+t.dataset.i,1));drawFiles()}
  else if(a==='rmnew'){pendingFiles.splice(+t.dataset.i,1);drawFiles()}
  else if(a==='del'){$('#delBox').innerHTML=`<div class="card" style="margin-top:12px"><p style="margin:0 0 10px">Delete this document and its attached files? This can't be undone.</p><div class="btns"><button class="btn danger" data-act="delyes" data-id="${esc(id)}">Yes, delete</button><button class="btn" data-act="delno">Keep it</button></div></div>`}
  else if(a==='delno')$('#delBox').innerHTML='';
  else if(a==='delyes'){
    const x=docs.find(d=>d.id===id);const {error}=await sb.from('documents').delete().eq('id',id);
    if(error)return toast(errMsg(error));await removeFiles((x?.files||[]).map(f=>f.path));closeSheet();toast('Deleted');refresh(true);
  }
});
$('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet')closeSheet()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#lb')&&!$('#lb').hidden)$('#lb').hidden=true;else if(!$('#sheet').hidden)closeSheet()}});
document.addEventListener('input',e=>{if(e.target.id==='q'){F.q=e.target.value;const pos=e.target.selectionStart;render();const q=$('#q');q.focus();q.setSelectionRange(pos,pos)}});
document.addEventListener('change',e=>{if(e.target.id==='fDprProj'){F2.proj=e.target.value;render();return}if(e.target.id==='fPPProj'){ppProj=e.target.value;render();return}const m={fProj:'proj',fStatus:'status',fWith:'withp',fSort:'sort'}[e.target.id];if(m){F[m]=e.target.value;render()}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&user&&loaded&&$('#sheet').hidden)refresh(true)});

/* Android back button */
const CapApp=window.Capacitor?.Plugins?.App;
if(CapApp)CapApp.addListener('backButton',()=>{
  if($('#lb')&&!$('#lb').hidden)$('#lb').hidden=true;
  else if(!$('#sheet').hidden)closeSheet();
  else if(view!=='home')go('home');
  else CapApp.exitApp();
});
render();
}
