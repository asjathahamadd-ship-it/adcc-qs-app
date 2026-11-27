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
const F2={proj:''};let pphotos=[],ppMissing=false,ppProj='',ppNew=[],ppKept=[],ppRemoved=[],editingPP=null,lbList=[],lbIdx=0;const urlCache={};let dprPhotosNew=[],dprPhotosKept=[],dprPhotosRemoved=[],editingDpr=null;
const WEATHER=['Sunny','Hot','Humid','Windy','Dusty / sandstorm','Cloudy','Rain'];
const TRADES=['Foreman','Mason','Steel fixer','Carpenter','Labour / helper','Electrician','Plumber','Painter','Plasterer','Tile fixer','Welder','Scaffolder','Operator','Driver','Supervisor','Engineer','Safety officer'];
const UNITS=['m²','m³','m','nos','kg','ton','LS','%'];
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
function gate(m){$('#gateMsg').textContent=m;$('#gate').hidden=false}
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
  if(r.error){dprs=[];dprMissing=true}else{dprMissing=false;dprs=r.data.map(x=>({id:x.id,project:x.project_id||'',date:x.report_date,weather:x.weather||'',work:x.work||[],manpower:x.manpower||[],equipment:x.equipment||'',remarks:x.remarks||'',photos:x.photos||[],updated:x.updated_at}))}
  const prevLogo=settings.logo_path;settings=s.data||{};
  if(settings.logo_path&&settings.logo_path!==prevLogo){const {data}=await sb.storage.from(BUCKET).createSignedUrl(settings.logo_path,60*60*24*7);logoUrl=data?.signedUrl||''}
  if(!settings.logo_path)logoUrl='';
  loaded=true;
}
async function refresh(silent){
  try{await load();$('#gate').hidden=true;render()}
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
}
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
   <button class="kpi" data-act="go" data-f="open"><b>${open.length}</b><small>Open documents</small></button>
   <button class="kpi ${late.length?'alert':''}" data-act="go" data-f="late"><b>${late.length}</b><small>Overdue · ${soon.length} due this week</small></button>
   <button class="kpi" data-act="go" data-f="pend"><b>${short(sum(pend))}</b><small>Awaiting payment · ${pend.length}</small></button>
   <button class="kpi" data-act="go" data-f="paid"><b>${short(sum(paid))}</b><small>Paid · ${paid.length}</small></button>
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
function openSheet(html){$('#panel').innerHTML=html;$('#sheet').hidden=false;document.body.style.overflow='hidden';$('#panel').scrollTop=0}
function closeSheet(){if(busy)return;$('#sheet').hidden=true;document.body.style.overflow='';editingId=null}
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

/* ---------- DPR (daily progress report) ---------- */
const menCount=r=>r.manpower.reduce((s,m)=>s+(Number(m.count)||0),0);
function dprTodayCard(){
  if(dprMissing)return'';
  const t=dprs.filter(r=>r.date===today());
  return`<button class="card dprtoday" data-act="${t.length?'dpr-open':'dpr-new'}" data-id="${t.length?esc(t[0].id):''}"><span><b>Today's DPR</b><span class="mute small">${t.length?`Done · ${t.length>1?t.length+' reports · ':''}${t.reduce((s,r)=>s+menCount(r),0)} manpower · ${t.reduce((s,r)=>s+r.work.length,0)} activities`:'Not filled yet. Tap to add.'}</span></span><span class="stamp ${t.length?'c-green':'c-amber'}">${t.length?'Filled':'Pending'}</span></button>`;
}
function dprView(){
  if(dprMissing)return`<div class="top"><h1>Daily progress</h1></div><div class="empty"><h2>One-time setup needed</h2><p>The DPR table hasn't been created in Supabase yet. Run the DPR setup script in the Supabase SQL Editor, then tap Refresh.</p><button class="btn pri" data-act="refresh">↻ Refresh</button></div>`;
  const list=dprs.filter(r=>!F2.proj||r.project===F2.proj);
  return`<div class="top"><h1>Daily progress</h1><button class="btn pri sm" data-act="dpr-new">+ New DPR</button></div>
  <div class="filters" style="grid-template-columns:minmax(0,1fr)"><select id="fDprProj" aria-label="Project">${opts(projects.map(p=>({v:p.id,l:p.name})),F2.proj,'All projects')}</select></div>
  <div class="list">${list.map(r=>{const p=projName(r.project);return`<button class="row" data-act="dpr-open" data-id="${esc(r.id)}">
    <span class="head"><span class="stamp c-blue">${esc(fmtDate(r.date))}</span>${p?`<span class="cat">${esc(p)}</span>`:''}</span>
    <span class="t">${r.work.length?esc(r.work.slice(0,2).map(w=>w.activity).filter(Boolean).join(', '))+(r.work.length>2?` +${r.work.length-2} more`:''):'No activities recorded'}</span><span class="amt">${menCount(r)} men</span>
    <span class="m"><span>${r.work.length} activities</span>${r.photos.length?`<span>${r.photos.length} photos</span>`:''}${r.weather?`<span>${esc(r.weather)}</span>`:''}${r.remarks?'<span class="late">Has remarks</span>':''}</span></button>`}).join('')||`<div class="empty"><p>No daily reports yet. Add today's DPR: work done, manpower, photos and remarks.</p><button class="btn pri" data-act="dpr-new">+ New DPR</button></div>`}</div>`;
}
async function photoUrls(ph){
  if(!ph.length)return{};const {data}=await sb.storage.from(BUCKET).createSignedUrls(ph.map(f=>f.path),3600);
  const m={};(data||[]).forEach(d=>{if(d.signedUrl)m[d.path]=d.signedUrl});return m;
}
async function dprDetail(id){
  const r=dprs.find(x=>x.id===id);if(!r)return closeSheet();
  openSheet(`<div class="ph"><div><div class="cat">Daily progress report${projName(r.project)?' · '+esc(projName(r.project)):''}</div><h2>${esc(fmtDate(r.date))}</h2></div><button class="x" data-act="close" aria-label="Close">×</button></div>
  ${r.weather?`<p class="mute" style="margin:0 0 6px">Weather: <b>${esc(r.weather)}</b></p>`:''}
  <h3 class="sec">Work done (${r.work.length})</h3>
  ${r.work.length?`<table class="dt"><thead><tr><th>Activity</th><th>Location</th><th class="num">Qty</th></tr></thead><tbody>${r.work.map(w=>`<tr><td>${esc(w.activity)}</td><td>${esc(w.location)}</td><td class="num">${w.qty!==''&&w.qty!=null?esc(w.qty)+' '+esc(w.unit||''):''}</td></tr>`).join('')}</tbody></table>`:'<p class="mute small">None recorded.</p>'}
  <h3 class="sec">Manpower (${menCount(r)})</h3>
  ${r.manpower.length?`<table class="dt"><tbody>${r.manpower.map(m=>`<tr><td>${esc(m.trade)}</td><td class="num">${esc(m.count)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="num"><b>${menCount(r)}</b></td></tr></tbody></table>`:'<p class="mute small">None recorded.</p>'}
  ${r.equipment?`<h3 class="sec">Equipment</h3><p style="white-space:pre-wrap;margin:0">${esc(r.equipment)}</p>`:''}
  <h3 class="sec">Remarks / delays / issues</h3><p style="white-space:pre-wrap;margin:0" class="${r.remarks?'':'mute small'}">${r.remarks?esc(r.remarks):'None.'}</p>
  <h3 class="sec">Photos (${r.photos.length})</h3><div class="pgrid" id="pgrid">${r.photos.map(()=>'<div class="ph-ph"></div>').join('')||'<p class="mute small">No photos.</p>'}</div>
  <div class="btns" style="margin-top:22px"><button class="btn" data-act="dpr-edit" data-id="${esc(r.id)}">Edit</button><button class="btn danger" data-act="dpr-del" data-id="${esc(r.id)}">Delete</button></div><div id="delBox"></div>`);
  const g=$('#pgrid');if(g&&r.photos.length){g.innerHTML=r.photos.map((f,j)=>thumb(f,'dpr:'+r.id,j)).join('');fillThumbs(g)}
}
const workRow=w=>`<div class="wrow" data-row="work"><input data-k="activity" placeholder="Activity, e.g. Blockwork 200mm" value="${esc(w.activity||'')}"><input data-k="location" placeholder="Location / area" value="${esc(w.location||'')}"><input data-k="qty" type="number" inputmode="decimal" step="any" placeholder="Qty" value="${esc(w.qty??'')}"><input data-k="unit" list="unitList" placeholder="Unit" value="${esc(w.unit||'')}"><button type="button" class="x sm" data-act="dpr-rmrow" aria-label="Remove">×</button></div>`;
const manRow=m=>`<div class="mrow" data-row="man"><input data-k="trade" list="tradeList" placeholder="Trade, e.g. Mason" value="${esc(m.trade||'')}"><input data-k="count" type="number" inputmode="numeric" min="0" placeholder="No." value="${esc(m.count??'')}"><button type="button" class="x sm" data-act="dpr-rmrow" aria-label="Remove">×</button></div>`;
function dprForm(id,pre){
  const r=id?dprs.find(x=>x.id===id):(pre||null);editingDpr=id||null;
  dprPhotosNew=[];dprPhotosKept=[...(r?.photos||[])];dprPhotosRemoved=[];
  const work=r?.work?.length?r.work:[{}],man=r?.manpower?.length?r.manpower:[{}];
  openSheet(`<div class="ph"><h2>${id?'Edit DPR':(pre?'New DPR (prepared by AI)':'New daily progress report')}</h2><button class="x" data-act="close" aria-label="Close">×</button></div>
  <form class="form" id="dprForm" novalidate>
   <datalist id="tradeList">${TRADES.map(t=>`<option value="${esc(t)}">`).join('')}</datalist><datalist id="unitList">${UNITS.map(t=>`<option value="${esc(t)}">`).join('')}</datalist>
   <label>Date<input name="date" type="date" value="${esc(r?.date||today())}" required></label>
   <label>Project<select name="project">${opts(projects.map(p=>({v:p.id,l:p.name})),r?.project||F2.proj||(projects.length===1?projects[0].id:''),'No project')}</select></label>
   <label class="full">Weather<select name="weather">${opts(WEATHER,r?.weather||'','—')}</select></label>
   <div class="full"><b class="small">Work done today</b><div id="workRows" class="rows">${work.map(workRow).join('')}</div><button type="button" class="btn sm" data-act="dpr-addwork">+ Add activity</button></div>
   <div class="full"><b class="small">Manpower</b><div id="manRows" class="rows">${man.map(manRow).join('')}</div>
    <div class="btns"><button type="button" class="btn sm" data-act="dpr-addman">+ Add trade</button>${!id&&dprs.length?'<button type="button" class="btn sm" data-act="dpr-copyman">Copy from last DPR</button>':''}<span class="mute small" id="menTotal" style="align-self:center"></span></div></div>
   <label class="full">Equipment on site<textarea name="equipment" placeholder="e.g. 1 JCB, 1 mobile crane 25T, 2 concrete mixers" style="min-height:60px">${esc(r?.equipment||'')}</textarea></label>
   <label class="full">Remarks / delays / issues<textarea name="remarks" placeholder="e.g. Waiting for consultant inspection on slab, material delay for blocks">${esc(r?.remarks||'')}</textarea></label>
   <div class="full"><b class="small">Site photos</b><ul class="files" id="photoList" style="margin:6px 0"></ul>
    <label class="btn sm" style="width:max-content">Add photos<input id="photoIn" type="file" accept="image/*" multiple hidden></label></div>
   <p id="formMsg" class="full small late" role="alert"></p>
   <div class="full btns"><button class="btn pri" type="submit" id="saveBtn">${id?'Save changes':'Save DPR'}</button><button class="btn" type="button" data-act="close">Cancel</button></div>
  </form>`);
  drawPhotos();menTotal();
  $('#photoIn').onchange=e=>{for(const f of e.target.files){if(f.size>20*1048576){toast(f.name+' is over 20 MB');continue}dprPhotosNew.push(f)}e.target.value='';drawPhotos()};
  $('#dprForm').oninput=e=>{if(e.target.dataset.k==='count')menTotal()};
  $('#dprForm').onsubmit=saveDpr;
}
function menTotal(){const t=[...document.querySelectorAll('#manRows [data-k=count]')].reduce((s,i)=>s+(Number(i.value)||0),0);const el=$('#menTotal');if(el)el.textContent=`Total: ${t} men`}
function drawPhotos(){
  const l=$('#photoList');if(!l)return;
  l.innerHTML=dprPhotosKept.map((f,i)=>`<li><span>${esc(f.name)}</span><button type="button" class="link" data-act="dpr-rmkept" data-i="${i}">Remove</button></li>`).join('')+
   dprPhotosNew.map((f,i)=>`<li><span>${esc(f.name)} <span class="mute">(new)</span></span><button type="button" class="link" data-act="dpr-rmnew" data-i="${i}">Remove</button></li>`).join('');
}
const readRows=(sel,keys)=>[...document.querySelectorAll(sel)].map(row=>{const o={};keys.forEach(k=>{const v=row.querySelector(`[data-k=${k}]`).value.trim();o[k]=(k==='qty'||k==='count')?(v===''?'':Number(v)):v});return o});
async function saveDpr(e){
  e.preventDefault();if(busy)return;
  const fd=new FormData(e.target),g=k=>(fd.get(k)||'').toString().trim(),msg=$('#formMsg');
  if(!g('date')){msg.textContent='Please pick a date.';return}
  const work=readRows('#workRows .wrow',['activity','location','qty','unit']).filter(w=>w.activity||w.location||w.qty!=='');
  const manpower=readRows('#manRows .mrow',['trade','count']).filter(m=>m.trade||m.count!=='');
  if(!work.length&&!manpower.length&&!g('remarks')&&!dprPhotosNew.length&&!dprPhotosKept.length){msg.textContent='Add at least one activity, trade, remark or photo.';return}
  const btn=$('#saveBtn');busy=true;btn.disabled=true;msg.textContent='';
  const photos=[...dprPhotosKept],uploaded=[];
  try{
    for(let i=0;i<dprPhotosNew.length;i++){const f=dprPhotosNew[i];btn.textContent=`Uploading photo ${i+1} of ${dprPhotosNew.length}…`;
      try{const path=await upload(f);uploaded.push(path);photos.push({path,name:f.name,size:f.size})}catch(err){err.upload=f.name;throw err}}
    btn.textContent='Saving…';
    const row={project_id:g('project')||null,report_date:g('date'),weather:g('weather'),work,manpower,equipment:g('equipment'),remarks:g('remarks'),photos,updated_at:new Date().toISOString()};
    const {error}=editingDpr?await sb.from('dprs').update(row).eq('id',editingDpr):await sb.from('dprs').insert(row);
    if(error)throw error;
    await removeFiles(dprPhotosRemoved.map(f=>f.path));
    busy=false;closeSheet();toast('DPR saved');refresh(true);
  }catch(err){
    busy=false;btn.disabled=false;btn.textContent=editingDpr?'Save changes':'Save DPR';
    if(!err.upload)await removeFiles(uploaded);
    msg.textContent=err.upload?`Couldn't upload ${err.upload}: ${err.message||'please try again'}`:errMsg(err);
  }
}

/* ---------- Progress photos ---------- */
const STAGES=['Site clearance & setting out','Excavation','Anti-termite treatment','Polythene sheet','PCC / blinding','Waterproofing (foundation)','Reinforcement','Shuttering / formwork','Concreting (RCC)','De-shuttering & curing','Backfilling & compaction','Blockwork','MEP first fix','Plastering','Screed & waterproofing (roof / wet areas)','Tiling & flooring','False ceiling','Painting','Doors, windows & joinery','MEP second fix & fixtures','Final finish / handover'];
async function signed(paths){
  const now=Date.now(),need=[...new Set(paths)].filter(p=>p&&!(urlCache[p]&&urlCache[p].exp>now));
  for(let i=0;i<need.length;i+=100){const {data}=await sb.storage.from(BUCKET).createSignedUrls(need.slice(i,i+100),3600);(data||[]).forEach(d=>{if(d.signedUrl)urlCache[d.path]={url:d.signedUrl,exp:now+50*60e3}})}
  const m={};paths.forEach(p=>{if(urlCache[p])m[p]=urlCache[p].url});return m;
}
async function fillThumbs(root){
  const els=[...(root||document).querySelectorAll('img[data-path]:not([src])')];if(!els.length)return;
  const m=await signed(els.map(e=>e.dataset.path));els.forEach(e=>{const u=m[e.dataset.path];if(u)e.src=u});
}
const thumb=(f,list,i)=>`<button type="button" class="pthumb" data-act="lb" data-list="${esc(list)}" data-i="${i}"><img data-path="${esc(f.path)}" alt="${esc(f.name)}" loading="lazy"></button>`;
function stageList(){const extra=[...new Set(pphotos.map(x=>x.stage))].filter(s=>!STAGES.includes(s));return[...STAGES,...extra]}
function photosView(){
  if(ppMissing)return`<div class="top"><h1>Progress photos</h1></div><div class="empty"><h2>One-time setup needed</h2><p>The progress photos table hasn't been created in Supabase yet. Run the setup script in the Supabase SQL Editor, then tap Refresh.</p><button class="btn pri" data-act="refresh">↻ Refresh</button></div>`;
  if(!ppProj&&projects.length===1)ppProj=projects[0].id;
  const list=pphotos.filter(x=>!ppProj||x.project===ppProj),total=list.reduce((s,x)=>s+x.photos.length,0);
  const rows=stageList().map((st,i)=>{
    const es=list.filter(x=>x.stage===st),ph=es.flatMap(x=>x.photos),last=es[0]?.date;
    return`<li class="stg ${es.length?'done':''}"><span class="dot">${i+1}</span><div class="sbody">
     <div class="shead"><button class="stitle" data-act="pp-stage" data-s="${esc(st)}">${esc(st)}</button>
      ${es.length?`<span class="mute small">${ph.length} photo${ph.length===1?'':'s'} · ${fmtDate(last)}</span>`:''}
      <button class="btn sm" data-act="pp-new" data-s="${esc(st)}">+ Photos</button></div>
     ${ph.length?`<div class="strip">${ph.slice(0,6).map((f,j)=>thumb(f,'stage:'+st,j)).join('')}${ph.length>6?`<button class="more" data-act="pp-stage" data-s="${esc(st)}">+${ph.length-6}</button>`:''}</div>`:''}
    </div></li>`}).join('');
  return`<div class="top"><h1>Progress photos</h1><div class="btns"><button class="btn sm" data-act="ai-sort">✨ AI sort photos</button><button class="btn pri sm" data-act="pp-new" data-s="">+ Add photos</button></div></div>
  <div class="filters" style="grid-template-columns:minmax(0,1fr)"><select id="fPPProj" aria-label="Project">${opts(projects.map(p=>({v:p.id,l:p.name})),ppProj,'All projects')}</select></div>
  <p class="mute small" style="margin:0 0 12px">${total} photos · ${new Set(list.map(x=>x.stage)).size} of ${stageList().length} stages recorded</p>
  <ol class="stages">${rows}</ol><button class="btn sm" data-act="pp-new" data-s="Other" style="margin-top:10px">+ Other stage</button>`;
}
function stagePhotos(st){return pphotos.filter(x=>x.stage===st&&(!ppProj||x.project===ppProj))}
function stageSheet(st){
  const es=stagePhotos(st);
  openSheet(`<div class="ph"><div><div class="cat">Progress photos${ppProj?' · '+esc(projName(ppProj)):''}</div><h2>${esc(st)}</h2></div><button class="x" data-act="close" aria-label="Close">×</button></div>
  <button class="btn pri" data-act="pp-new" data-s="${esc(st)}" style="margin-bottom:14px">+ Add photos to this stage</button>
  ${es.length?es.map(x=>`<section class="ppentry"><div class="shead"><div><b>${esc(fmtDate(x.date))}</b>${x.location?` · ${esc(x.location)}`:''}${!ppProj&&projName(x.project)?`<div class="mute small">${esc(projName(x.project))}</div>`:''}</div><button class="link" data-act="pp-edit" data-id="${esc(x.id)}">Edit</button></div>
   ${x.note?`<p style="margin:4px 0 8px;white-space:pre-wrap">${esc(x.note)}</p>`:''}<div class="pgrid">${x.photos.map((f,j)=>thumb(f,'entry:'+x.id,j)).join('')}</div></section>`).join(''):'<p class="mute">No photos for this stage yet.</p>'}`);
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
  openSheet(`<div class="ph"><h2>${x?'Edit photos':'Add progress photos'}</h2><button class="x" data-act="close" aria-label="Close">×</button></div>
  <form class="form" id="ppForm" novalidate>
   <label>Project<select name="project">${opts(projects.map(p=>({v:p.id,l:p.name})),x?.project||ppProj||(projects.length===1?projects[0].id:''),'No project')}</select></label>
   <label>Date<input name="date" type="date" value="${esc(x?.date||today())}"></label>
   <label class="full">Stage<select name="stage" id="ppStage">${opts([...stageList(),'Other'],isOther?'Other':st,'Choose stage')}</select></label>
   <label class="full" id="otherWrap" ${isOther?'':'hidden'}>Stage name<input name="other" value="${esc(isOther&&st!=='Other'?st:'')}" placeholder="e.g. Swimming pool tiling"></label>
   <label class="full">Location / element<input name="location" value="${esc(x?.location||'')}" placeholder="e.g. Footing F1–F6, Grid A–C, Ground floor slab"></label>
   <label class="full">Note<textarea name="note" style="min-height:60px" placeholder="Optional, e.g. Inspected by consultant, WIR-045">${esc(x?.note||'')}</textarea></label>
   <div class="full"><b class="small">Photos</b><div class="pgrid" id="ppGrid" style="margin:8px 0"></div>
    <div class="btns"><label class="btn sm">📷 Take photo<input id="ppCam" type="file" accept="image/*" capture="environment" hidden></label><label class="btn sm">Choose from gallery<input id="ppIn" type="file" accept="image/*" multiple hidden></label></div></div>
   <p id="formMsg" class="full small late" role="alert"></p>
   <div class="full btns"><button class="btn pri" type="submit" id="saveBtn">${x?'Save changes':'Save photos'}</button><button class="btn" type="button" data-act="close">Cancel</button>${x?`<button class="btn danger" type="button" data-act="pp-del" data-id="${esc(x.id)}">Delete</button>`:''}</div>
   <div id="delBox" class="full"></div>
  </form>`);
  drawPP();
  const add=e=>{for(const f of e.target.files){if(f.size>25*1048576){toast(f.name+' is too large');continue}ppNew.push(f)}e.target.value='';drawPP()};
  $('#ppIn').onchange=add;$('#ppCam').onchange=add;
  $('#ppStage').onchange=e=>{$('#otherWrap').hidden=e.target.value!=='Other'};
  $('#ppForm').onsubmit=savePP;
}
function drawPP(){
  const g=$('#ppGrid');if(!g)return;
  g.innerHTML=ppKept.map((f,i)=>`<div class="pthumb rel"><img data-path="${esc(f.path)}" alt=""><button type="button" class="rm" data-act="pp-rmkept" data-i="${i}" aria-label="Remove">×</button></div>`).join('')+
   ppNew.map((f,i)=>`<div class="pthumb rel"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="rm" data-act="pp-rmnew" data-i="${i}" aria-label="Remove">×</button></div>`).join('')||'<p class="mute small" style="grid-column:1/-1;margin:0">No photos yet.</p>';
  fillThumbs(g);
}
async function savePP(e){
  e.preventDefault();if(busy)return;
  const fd=new FormData(e.target),g=k=>(fd.get(k)||'').toString().trim(),msg=$('#formMsg');
  let stage=g('stage');if(stage==='Other')stage=g('other')||'Other';
  if(!stage){msg.textContent='Please choose a stage.';return}
  if(!ppNew.length&&!ppKept.length){msg.textContent='Add at least one photo.';return}
  const btn=$('#saveBtn');busy=true;btn.disabled=true;msg.textContent='';
  const photos=[...ppKept],uploaded=[];
  try{
    for(let i=0;i<ppNew.length;i++){btn.textContent=`Uploading ${i+1} of ${ppNew.length}…`;
      const f=await compress(ppNew[i]);
      try{const path=await upload(f);uploaded.push(path);photos.push({path,name:f.name,size:f.size})}catch(err){err.upload=ppNew[i].name;throw err}}
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
/* lightbox */
function lbOpen(list,i){
  if(list.startsWith('stage:'))lbList=stagePhotos(list.slice(6)).flatMap(x=>x.photos.map(f=>({...f,cap:`${fmtDate(x.date)}${x.location?' · '+x.location:''}`})));
  else if(list.startsWith('entry:')){const x=pphotos.find(e=>e.id===list.slice(6));lbList=(x?.photos||[]).map(f=>({...f,cap:`${fmtDate(x.date)}${x.location?' · '+x.location:''}`}))}
  else if(list.startsWith('dpr:')){const r=dprs.find(e=>e.id===list.slice(4));lbList=(r?.photos||[]).map(f=>({...f,cap:fmtDate(r.date)}))}
  lbIdx=+i||0;let lb=$('#lb');
  if(!lb){document.body.insertAdjacentHTML('beforeend','<div class="lb" id="lb"><button class="x lbx" data-act="lb-close" aria-label="Close">×</button><button class="lbn prev" data-act="lb-prev" aria-label="Previous">‹</button><img id="lbImg" alt=""><button class="lbn next" data-act="lb-next" aria-label="Next">›</button><div class="lbcap" id="lbCap"></div></div>');lb=$('#lb')}
  lb.hidden=false;lbShow();
}
async function lbShow(){
  const f=lbList[lbIdx];if(!f)return;const img=$('#lbImg');img.removeAttribute('src');
  $('#lbCap').textContent=`${f.cap||''}   ${lbIdx+1} / ${lbList.length}`;
  const m=await signed([f.path]);if(m[f.path])img.src=m[f.path];
}

/* ---------- AI assistant (Gemini via Supabase function "ai") ---------- */
let chat=[],aiBusy=false,sortItems=[];
const AI_MODEL='claude-sonnet-5-5';const AI_FN='smart-task';
function nowText(){return new Date().toLocaleString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dubai'})+' (Dubai time)'}
function aiContext(){
  const P=id=>projName(id)||null;
  return JSON.stringify({
    today:today(),now:nowText(),
    me:{username:username(),full_name:settings.full_name||null,job_title:settings.job_title||'Quantity Surveyor',phone:settings.phone||null,company:settings.company||'Al Adeeb Building Contracting LLC'},
    projects:projects.map(p=>({id:p.id,name:p.name,code:p.code||null,client:p.client||null,contract_value_aed:p.value===''?null:p.value})),
    documents:docs.map(d=>({id:d.id,type:d.category,project:P(d.project),project_id:d.project||null,title:d.title,ref:d.ref||null,party:d.party||null,amount_aed:d.amount===''?null:d.amount,status:d.status,currently_with:d.withp,submitted:d.submitted||null,due:d.due||null,overdue:!!isLate(d),notes:d.notes||null,files:d.files.map(f=>f.name),last_update:d.history.length?d.history[d.history.length-1]:null,updated:d.updated})),
    dprs:dprs.slice(0,60).map(r=>({id:r.id,date:r.date,project:P(r.project),weather:r.weather||null,work:r.work,manpower:r.manpower,total_manpower:menCount(r),equipment:r.equipment||null,remarks:r.remarks||null,photos:r.photos.length})),
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
 {name:'prepare_dpr',description:'Prepare a daily progress report. Opens a pre-filled DPR form for the user to check and save.',input_schema:{type:'object',properties:{date:{type:'string',description:'YYYY-MM-DD'},project_id:{type:'string'},weather:{type:'string'},work:{type:'array',items:{type:'object',properties:{activity:{type:'string'},location:{type:'string'},qty:{type:'number'},unit:{type:'string'}},required:['activity']}},manpower:{type:'array',items:{type:'object',properties:{trade:{type:'string'},count:{type:'number'}},required:['trade','count']}},equipment:{type:'string'},remarks:{type:'string'}},required:['date']}},
 {name:'prepare_document',description:'Prepare a new register entry (IPA, VO, RFI, tender, etc). Opens a pre-filled form for the user to check and save.',input_schema:{type:'object',properties:{category:{type:'string'},project_id:{type:'string'},title:{type:'string'},ref:{type:'string'},party:{type:'string'},amount:{type:'number'},status:{type:'string'},with_party:{type:'string'},submitted:{type:'string'},due:{type:'string'},notes:{type:'string'}},required:['title','category']}},
 {name:'update_document',description:'Change the status, who currently has it, or due date of an existing register document. User confirms before it is saved.',input_schema:{type:'object',properties:{document_id:{type:'string'},status:{type:'string'},with_party:{type:'string'},due:{type:'string'},note:{type:'string',description:'Short history note'}},required:['document_id']}}
];
async function callAI(body){
  const {data,error}=await sb.functions.invoke(AI_FN,{body:{model:AI_MODEL,...body}});
  if(error){let m=error.message||'AI is not available.';try{const j=await error.context?.json?.();if(j?.error?.message)m=j.error.message}catch{}throw new Error(m)}
  if(data?.error)throw new Error(data.error.message||'AI error');
  return data;
}
const md=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^#{1,3} (.+)$/gm,'<b>$1</b>').replace(/^[-*] (.+)$/gm,'• $1');
function aiOpen(prefill){
  openSheet(`<div class="ph"><div><div class="cat">Powered by Gemini</div><h2>✨ AI assistant</h2></div><div class="btns"><button class="btn sm" data-act="ai-clear">New chat</button><button class="x" data-act="close" aria-label="Close">×</button></div></div>
  <div class="chat" id="chat"></div>
  <form class="chatin" id="aiForm"><textarea id="aiIn" rows="2" placeholder="Ask anything, or tell me what to do… (tap 🎤 on your keyboard to speak)"></textarea><button class="btn pri" id="aiSend" type="submit">Send</button></form>`);
  drawChat();
  $('#aiForm').onsubmit=e=>{e.preventDefault();const v=$('#aiIn').value.trim();if(v)aiSend(v)};
  $('#aiIn').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&window.innerWidth>900){e.preventDefault();$('#aiForm').requestSubmit()}};
  if(prefill)aiSend(prefill);
}
const SUGGEST=['Write today\'s DPR: ','Which payments are pending and with whom?','Email the consultant to follow up all overdue IPAs','Weekly progress & payment summary for my senior','Which construction stages have no photos yet?'];
function drawChat(){
  const c=$('#chat');if(!c)return;
  c.innerHTML=(chat.length?'':`<div class="aihello"><p><b>Hi${settings.full_name?' '+esc(settings.full_name.split(' ')[0]):''}!</b> I can see all your documents, DPRs and photos. Ask me a question or tell me what to prepare. I'll fill in dates, references and amounts automatically.</p><div class="sugg">${SUGGEST.map(s=>`<button class="chip" data-act="ai-sugg" data-t="${esc(s)}">${esc(s.replace(/: $/,'…'))}</button>`).join('')}</div></div>`)+
   chat.map((m,i)=>m.role==='user'?`<div class="msg me">${esc(m.text)}</div>`:`<div class="msg ai">${m.text?`<div>${md(m.text)}</div>`:''}${(m.actions||[]).map((a,j)=>actionCard(a,i,j)).join('')}</div>`).join('')+
   (aiBusy?'<div class="msg ai typing">Thinking…</div>':'');
  c.scrollTop=c.scrollHeight;$('#panel').scrollTop=$('#panel').scrollHeight;
}
function actionCard(a,i,j){
  const k=`data-i="${i}" data-j="${j}"`,v=a.input||{};
  if(a.name==='draft_email')return`<div class="acard"><div class="ah">✉️ Email draft</div>${v.to?`<div class="small"><b>To:</b> ${esc(v.to)}</div>`:''}${v.cc?`<div class="small"><b>Cc:</b> ${esc(v.cc)}</div>`:''}<div class="small"><b>Subject:</b> ${esc(v.subject)}</div><pre class="mail">${esc(v.body)}</pre><div class="btns"><button class="btn sm pri" data-act="ai-copy" ${k}>Copy</button><button class="btn sm" data-act="ai-mail" ${k}>Open in email app</button></div></div>`;
  if(a.name==='prepare_dpr')return`<div class="acard"><div class="ah">📋 DPR ready · ${esc(fmtDate(v.date))}</div><div class="small mute">${(v.work||[]).length} activities · ${(v.manpower||[]).reduce((s,m)=>s+(Number(m.count)||0),0)} manpower${v.remarks?' · remarks':''}</div><div class="btns"><button class="btn sm pri" data-act="ai-dpr" ${k}>Review & save</button></div></div>`;
  if(a.name==='prepare_document')return`<div class="acard"><div class="ah">📄 New ${esc(v.category||'document')}</div><div class="small"><b>${esc(v.title)}</b>${v.amount!=null?' · '+money(v.amount):''}${v.status?' · '+esc(v.status):''}</div><div class="btns"><button class="btn sm pri" data-act="ai-doc" ${k}>Review & save</button></div></div>`;
  if(a.name==='update_document'){const d=docs.find(x=>x.id===v.document_id);return`<div class="acard"><div class="ah">🔄 Update ${esc(d?.title||'document')}</div><div class="small">${v.status?`Status → <b>${esc(v.status)}</b> `:''}${v.with_party?`· With → <b>${esc(v.with_party)}</b> `:''}${v.due?`· Due → <b>${esc(fmtDate(v.due))}</b>`:''}${v.note?`<br><span class="mute">${esc(v.note)}</span>`:''}</div><div class="btns">${a.done?'<span class="stamp c-green">Applied</span>':`<button class="btn sm pri" data-act="ai-upd" ${k}>Apply</button>`}</div></div>`}
  return'';
}
async function aiSend(text){
  if(aiBusy)return;chat.push({role:'user',text});aiBusy=true;const inp=$('#aiIn');if(inp)inp.value='';drawChat();
  const messages=chat.slice(-16).map(m=>({role:m.role==='user'?'user':'assistant',content:m.role==='user'?m.text:((m.text||'')+(m.actions?.length?`\n[I prepared: ${m.actions.map(a=>a.name+' '+JSON.stringify(a.input).slice(0,300)).join('; ')}]`:''))||'(done)'}));
  try{
    const r=await callAI({system:aiSystem(),messages,tools:AI_TOOLS,max_tokens:3000});
    const blocks=r.content||[];
    chat.push({role:'assistant',text:blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim(),actions:blocks.filter(b=>b.type==='tool_use').map(b=>({name:b.name,input:b.input}))});
  }catch(e){chat.push({role:'assistant',text:'⚠️ '+(e.message||'AI error')+(String(e.message).match(/not found|404|FunctionsFetchError|Failed to send/i)?'\n\nThe AI function isn\'t set up in Supabase yet. Follow the AI setup steps.':'')})}
  aiBusy=false;drawChat();
}
function aiAct(t){
  const a=chat[+t.dataset.i]?.actions?.[+t.dataset.j];if(!a)return;const v=a.input||{},act=t.dataset.act;
  if(act==='ai-copy'){const txt=(v.to?`To: ${v.to}\n`:'')+(v.cc?`Cc: ${v.cc}\n`:'')+`Subject: ${v.subject}\n\n${v.body}`;navigator.clipboard.writeText(txt).then(()=>toast('Email copied'),()=>toast('Copy failed, select the text and copy'))}
  else if(act==='ai-mail'){location.href=`mailto:${encodeURIComponent(v.to||'')}?subject=${encodeURIComponent(v.subject||'')}${v.cc?'&cc='+encodeURIComponent(v.cc):''}&body=${encodeURIComponent(v.body||'')}`}
  else if(act==='ai-dpr'){if(dprMissing)return toast('Run the DPR setup script first');dprForm(null,{date:v.date||today(),project:projects.some(p=>p.id===v.project_id)?v.project_id:'',weather:WEATHER.includes(v.weather)?v.weather:'',work:(v.work||[]).map(w=>({activity:w.activity||'',location:w.location||'',qty:w.qty??'',unit:w.unit||''})),manpower:(v.manpower||[]).map(m=>({trade:m.trade,count:m.count})),equipment:v.equipment||'',remarks:v.remarks||'',photos:[]})}
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
  if(u&&(!user||user.id!==u.id)){user=u;$('#login').hidden=true;gate('Loading your register…');loaded=false;settings={};logoUrl='';refresh()}
  else if(!u&&ev!=='INITIAL_SESSION'||(!u&&!user)){user=null;docs=[];projects=[];loaded=false;closeSheet();showLogin()}
  else if(u)user=u;
});

/* ---------- events ---------- */
function go(v){view=v;render();window.scrollTo(0,0)}
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
  else if(a==='ai-clear'){chat=[];drawChat()}
  else if(a==='ai-sugg'){const t2=t.dataset.t;if(t2.endsWith(': ')){$('#aiIn').value=t2;$('#aiIn').focus()}else aiSend(t2)}
  else if(['ai-copy','ai-mail','ai-dpr','ai-doc','ai-upd'].includes(a))aiAct(t);
  else if(a==='ai-sort'){if(loaded)sortOpen()}
  else if(a==='sort-rm'){sortItems.splice(+t.dataset.i,1);drawSort()}
  else if(a==='sort-save')sortSave(t);
  else if(a==='pp-new'){if(loaded&&!ppMissing)ppForm(null,t.dataset.s);else if(ppMissing)go('photos')}
  else if(a==='pp-stage')stageSheet(t.dataset.s);
  else if(a==='pp-edit')ppForm(id);
  else if(a==='pp-rmkept'){ppRemoved.push(...ppKept.splice(+t.dataset.i,1));drawPP()}
  else if(a==='pp-rmnew'){ppNew.splice(+t.dataset.i,1);drawPP()}
  else if(a==='pp-del'){$('#delBox').innerHTML=`<div class="card" style="margin-top:12px"><p style="margin:0 0 10px">Delete these photos? This can't be undone.</p><div class="btns"><button type="button" class="btn danger" data-act="pp-delyes" data-id="${esc(id)}">Yes, delete</button><button type="button" class="btn" data-act="delno">Keep them</button></div></div>`}
  else if(a==='pp-delyes'){const x=pphotos.find(e=>e.id===id);const {error}=await sb.from('progress_photos').delete().eq('id',id);if(error)return toast(errMsg(error));await removeFiles((x?.photos||[]).map(f=>f.path));closeSheet();toast('Deleted');refresh(true)}
  else if(a==='lb')lbOpen(t.dataset.list,t.dataset.i);
  else if(a==='lb-close')$('#lb').hidden=true;
  else if(a==='lb-prev'){lbIdx=(lbIdx-1+lbList.length)%lbList.length;lbShow()}
  else if(a==='lb-next'){lbIdx=(lbIdx+1)%lbList.length;lbShow()}
  else if(a==='dpr-new'){if(loaded&&!dprMissing)dprForm(null);else if(dprMissing)go('dpr')}
  else if(a==='dpr-open')dprDetail(id);
  else if(a==='dpr-edit')dprForm(id);
  else if(a==='dpr-addwork'){$('#workRows').insertAdjacentHTML('beforeend',workRow({}));$('#workRows .wrow:last-child input').focus()}
  else if(a==='dpr-addman'){$('#manRows').insertAdjacentHTML('beforeend',manRow({}));$('#manRows .mrow:last-child input').focus()}
  else if(a==='dpr-rmrow'){t.parentElement.remove();menTotal()}
  else if(a==='dpr-copyman'){const last=[...dprs].sort((x,y)=>(y.date||'').localeCompare(x.date||''))[0];if(last?.manpower?.length){$('#manRows').innerHTML=last.manpower.map(manRow).join('');menTotal();toast('Copied manpower from '+fmtDate(last.date))}}
  else if(a==='dpr-rmkept'){dprPhotosRemoved.push(...dprPhotosKept.splice(+t.dataset.i,1));drawPhotos()}
  else if(a==='dpr-rmnew'){dprPhotosNew.splice(+t.dataset.i,1);drawPhotos()}
  else if(a==='dpr-del'){$('#delBox').innerHTML=`<div class="card" style="margin-top:12px"><p style="margin:0 0 10px">Delete this daily report and its photos? This can't be undone.</p><div class="btns"><button class="btn danger" data-act="dpr-delyes" data-id="${esc(id)}">Yes, delete</button><button class="btn" data-act="delno">Keep it</button></div></div>`}
  else if(a==='dpr-delyes'){const r=dprs.find(x=>x.id===id);const {error}=await sb.from('dprs').delete().eq('id',id);if(error)return toast(errMsg(error));await removeFiles((r?.photos||[]).map(f=>f.path));closeSheet();toast('Deleted');refresh(true)}
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
