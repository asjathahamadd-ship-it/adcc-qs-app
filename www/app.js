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

let user=null,loaded=false,docs=[],projects=[],settings={},logoUrl='';
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
  m.innerHTML=view==='register'?registerView():view==='projects'?projectsView():homeView();
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
  return`${hi}<h1>Where everything is now</h1>
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
function docForm(id){
  const x=id?docs.find(d=>d.id===id):null;editingId=id||null;
  pendingFiles=[];keptFiles=[...(x?.files||[])];removedFiles=[];
  const v=k=>esc(x?.[k]??'');
  openSheet(`<div class="ph"><h2>${x?'Edit document':'Add document'}</h2><button class="x" data-act="close" aria-label="Close">×</button></div>
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
   <div class="full btns"><button class="btn pri" type="submit" id="saveBtn">${x?'Save changes':'Add to register'}</button><button class="btn" type="button" data-act="close">Cancel</button></div>
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
    const {error}=await sb.from('settings').upsert({user_id:user.id,company:c,logo_path:settings.logo_path||null});
    let pe=null;if(!error&&pw)({error:pe}=await sb.auth.updateUser({password:pw}));
    busy=false;
    if(error||pe){msg.textContent=errMsg(error||pe);return}
    closeSheet();toast(pw?'Saved. Password changed.':'Saved');refresh(true);
  };
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
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#sheet').hidden)closeSheet()});
document.addEventListener('input',e=>{if(e.target.id==='q'){F.q=e.target.value;const pos=e.target.selectionStart;render();const q=$('#q');q.focus();q.setSelectionRange(pos,pos)}});
document.addEventListener('change',e=>{const m={fProj:'proj',fStatus:'status',fWith:'withp',fSort:'sort'}[e.target.id];if(m){F[m]=e.target.value;render()}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&user&&loaded&&$('#sheet').hidden)refresh(true)});

/* Android back button */
const CapApp=window.Capacitor?.Plugins?.App;
if(CapApp)CapApp.addListener('backButton',()=>{
  if(!$('#sheet').hidden)closeSheet();
  else if(view!=='home')go('home');
  else CapApp.exitApp();
});
render();
}
