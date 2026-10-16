const $=s=>document.querySelector(s),LS=localStorage,V={};
const C={y:'#facc15',g:'#22c55e',b:'#3b82f6',r:'#ef4444',p:'#ec4899'};
let D={schema_version:1,gears:[],runs:[]},sha=null,page='summary',edit=null,gedit=null,F={t:'',l:'',g:''},mixKm=true,charts=[];
const cfg=()=>({repo:LS.repo||'',tok:LS.tok||''});
const pad=n=>String(n).padStart(2,'0'),cap=s=>s[0].toUpperCase()+s.slice(1);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';');
const toast=(m,e)=>{const t=$('#toast');t.textContent=m;t.style.background=e?'#ef4444':'#22c55e';t.style.display='block';setTimeout(()=>t.style.display='none',2800)};
const b64e=s=>{let b='';new TextEncoder().encode(s).forEach(c=>b+=String.fromCharCode(c));return btoa(b)};
const b64d=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g,'')),c=>c.charCodeAt(0)));
const mmss=s=>{if(!(s>0)||!isFinite(s))return'—';s=Math.round(s);return Math.floor(s/60)+':'+pad(s%60)};
const hms=s=>{s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return(h?h+':'+pad(m):m)+':'+pad(s%60)};
const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>key(new Date());
const mon=s=>{const d=new Date(s+'T00:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return d};
const wk=d=>{const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));x.setUTCDate(x.getUTCDate()+4-(x.getUTCDay()||7));return Math.ceil(((x-Date.UTC(x.getUTCFullYear(),0,1))/864e5+1)/7)};
const pace=r=>r.time_sec/r.distance_km;
const gname=id=>(D.gears.find(g=>g.id==id)||{}).name||'No gear';
const agg=rs=>rs.reduce((a,r)=>(a.km+=r.distance_km,a.s+=r.time_sec,a),{km:0,s:0});

/* ---------- GitHub storage ---------- */
const H=()=>({Authorization:'Bearer '+cfg().tok,Accept:'application/vnd.github+json'});
const URLF=()=>`https://api.github.com/repos/${cfg().repo}/contents/stc-run-data.json`;
async function load(){const r=await fetch(URLF(),{headers:H(),cache:'no-store'});
 if(r.status==404){const q=await fetch('https://api.github.com/repos/'+cfg().repo,{headers:H()});if(!q.ok)throw Error('Repo not found or token has no access');D={schema_version:1,gears:[],runs:[]};sha=null;return}
 if(!r.ok)throw Error('GitHub error '+r.status);const j=await r.json();sha=j.sha;D=JSON.parse(b64d(j.content))}
async function save(fn){for(let i=0;i<3;i++){try{await load()}catch(e){toast(e.message,1);return false}
 fn(D);const r=await fetch(URLF(),{method:'PUT',headers:H(),body:JSON.stringify({message:'update',content:b64e(JSON.stringify(D,null,1)),...(sha&&{sha})})});
 if(r.ok){sha=(await r.json()).content.sha;return true}if(r.status!=409&&r.status!=422)break}
 try{await load()}catch{}toast('Could not save. Check connection and try again.',1);return false}

/* ---------- Shared pieces ---------- */
const gstat=g=>{const rs=D.runs.filter(r=>r.gear_id==g.id),t=agg(rs),u=agg(rs.filter(r=>r.type!='walk'));return{km:(+g.start_km||0)+t.km,n:rs.length,pace:u.km?u.s/u.km:null,last:rs.map(r=>r.date).sort().pop()}};
const gcard=(g,btns)=>{const s=gstat(g),p=s.km/g.max_km*100;return`<div class="card"><div class="top"><b>${esc(g.name)}</b><span>${btns}</span></div><div class="mut">Since ${g.start_date}</div><div class="bar"><i style="width:${Math.min(p,100)}%;background:${p>=100?'var(--r)':p>=80?'var(--y)':'var(--g)'}"></i></div><div>${s.km.toFixed(0)} / ${g.max_km} km (${p.toFixed(0)}%) ${p>=100?'<span class="err">Over limit, consider replacing</span>':p>=80?'<span class="warn">Nearing limit</span>':''}</div><div class="mut">${s.n} runs · Avg <span style="color:var(--p)">${mmss(s.pace)} /km</span>${s.last?' · Last used '+s.last:''}</div></div>`};
const ds=(type,label,data,color)=>({type,label,data,borderColor:color,backgroundColor:color,tension:.25,order:type=='line'?0:1});
const chart=(id,labels,sets,fmt,min)=>charts.push(new Chart($('#'+id),{type:'bar',data:{labels,datasets:sets},options:{plugins:{legend:{labels:{boxWidth:12}}},scales:{y:{min,ticks:{callback:fmt||(v=>v)}}}}}));

/* ---------- Summary ---------- */
function weeks(){const m=mon(today()),a=[];for(let i=7;i>=0;i--){const d=new Date(m);d.setDate(d.getDate()-7*i);a.push({k:key(d),l:'W'+wk(d)})}return a}
function pb(){const R=D.runs.filter(r=>r.type!='walk');if(!R.length)return[['No runs yet','—']];const o=[['Longest run',Math.max(...R.map(r=>r.distance_km)).toFixed(1)+' km']],fr=R.filter(r=>r.distance_km>=3);
 o.push(['Fastest pace (≥ 3 km)',fr.length?mmss(Math.min(...fr.map(pace)))+' /km':'—']);
 const wm={};D.runs.forEach(r=>{const k=key(mon(r.date));wm[k]=(wm[k]||0)+r.distance_km});o.push(['Best week',Math.max(...Object.values(wm)).toFixed(1)+' km']);
 [[5,'5K'],[10,'10K'],[21.0975,'21K'],[35,'35K'],[42.195,'42K']].forEach(([d,n])=>{const c=R.filter(r=>r.distance_km>=d&&r.distance_km<=d*1.1);o.push(['Best '+n,c.length?'est. '+hms(Math.min(...c.map(pace))*d):'—'])});return o}
V.summary=()=>{Chart.defaults.color='#94a3b8';Chart.defaults.borderColor='#334155';
 const W=weeks(),L=W.map(w=>w.l),inW=(r,w)=>key(mon(r.date))==w.k;
 const f=loc=>W.map(w=>{const rs=D.runs.filter(r=>inW(r,w)&&(!loc||r.location==loc)),t=agg(rs),u=agg(rs.filter(r=>r.type!='walk'));return{km:t.km,pace:u.km?u.s/u.km/60:null}});
 const A=f(),O=f('outdoor'),T=f('treadmill'),pv=a=>a.map(x=>x.pace),kv=a=>a.map(x=>x.km);
 const ps=[...pv(A),...pv(O),...pv(T)].filter(x=>x),pmin=ps.length?Math.floor(Math.min(...ps)-.5):undefined;
 const ef=loc=>W.map(w=>{const v=D.runs.filter(r=>r.type=='easy'&&r.avg_hr&&r.location==loc&&inW(r,w)).map(r=>r.distance_km*1000/(r.time_sec/60)/r.avg_hr);return v.length?v.reduce((a,b)=>a+b)/v.length:null});
 const act=D.gears.filter(g=>g.status=='active').sort((a,b)=>gstat(b).km-gstat(a).km).map(g=>gcard(g,'')).join('')||'<div class="card mut">No active gear. Add one in the Gear tab.</div>';
 $('#app').innerHTML=`<div class="grid"><div class="card"><h3>Avg. Pace (min/km), last 8 weeks</h3><canvas id="c1"></canvas></div><div class="card"><h3>Total Distance (km), last 8 weeks</h3><canvas id="c2"></canvas></div><div class="card"><h3>Efficiency Factor, Easy runs (higher = fitter)</h3><canvas id="c3"></canvas></div><div class="card"><h3>Personal Bests</h3>${pb().map(([k,v])=>`<div class="top" style="padding:4px 0"><span>${k}</span><b>${v}</b></div>`).join('')}</div><div class="card"><div class="top"><h3>Run Type Mix</h3><button class="b sm" data-act="mix">By ${mixKm?'km':'runs'}</button></div><canvas id="c4"></canvas></div></div><h2>Gear</h2><div class="grid">${act}</div>`;
 chart('c1',L,[ds('bar','Total',pv(A),C.y),ds('line','Outdoor',pv(O),C.g),ds('line','Treadmill',pv(T),C.b)],v=>mmss(v*60),pmin);
 chart('c2',L,[ds('bar','Total',kv(A),C.y),ds('line','Outdoor',kv(O),C.g),ds('line','Treadmill',kv(T),C.b)]);
 chart('c3',L,[ds('line','Outdoor',ef('outdoor'),C.g),ds('line','Treadmill',ef('treadmill'),C.b)]);
 const n={easy:0,long:0,interval:0,walk:0};D.runs.forEach(r=>n[r.type]+=mixKm?r.distance_km:1);
 charts.push(new Chart($('#c4'),{type:'doughnut',data:{labels:['Easy','Long','Interval','Walk'],datasets:[{data:Object.values(n).map(v=>+v.toFixed(1)),backgroundColor:['#a78bfa','#f97316','#14b8a6','#64748b'],borderColor:'#1e293b'}]}}))};

/* ---------- Run Record ---------- */
const toDraft=r=>({id:r.id,date:r.date,location:r.location,type:r.type,gear:r.gear_id||'',dist:r.distance_km,h:Math.floor(r.time_sec/3600),m:Math.floor(r.time_sec%3600/60),s:r.time_sec%60,hr:r.avg_hr??'',el:(r.location=='treadmill'?r.incline_pct:r.elev_gain_m)??'',rpe:r.rpe,notes:r.notes||''});
const newDraft=()=>{const l=[...D.runs].sort((a,b)=>b.date.localeCompare(a.date))[0]||{};return{date:today(),location:l.location||'outdoor',type:'easy',gear:'',dist:'',h:'',m:'',s:'',hr:'',el:'',rpe:null,notes:''}};
const secs=()=>(+edit.h||0)*3600+(+edit.m||0)*60+(+edit.s||0);
const calcPace=()=>{const d=+edit.dist,s=secs(),p=s/d;$('#pace').innerHTML=edit.type=='walk'?'<span class="mut">Not used for Walk</span>':d>0&&s>0?`<b>${mmss(p)} /km</b>`+(p<180||p>720?' <span class="warn">Please check distance and time</span>':''):'<b>—</b>'};
const sel=(id,o,v)=>`<select id="${id}">${o.map(([k,l])=>`<option value="${k}" ${k==v?'selected':''}>${l}</option>`).join('')}</select>`;
const rcard=r=>{const meta=[r.avg_hr&&'HR '+r.avg_hr,r.rpe&&'RPE '+r.rpe,r.location=='treadmill'?(r.incline_pct!=null&&r.incline_pct+' %'):(r.elev_gain_m!=null&&'+'+r.elev_gain_m+' m'),r.avg_hr&&r.type!='walk'&&'EF '+(r.distance_km*1000/(r.time_sec/60)/r.avg_hr).toFixed(2)].filter(Boolean).join(' · ');
 return`<div class="card"><div class="top"><b>${new Date(r.date+'T00:00:00').toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</b><span>${cap(r.type)}</span></div><div>${r.location=='outdoor'?'🌳 Outdoor':'🏃 Treadmill'} · ${esc(gname(r.gear_id))}</div><div>${r.distance_km.toFixed(2)} km · ${hms(r.time_sec)}${r.type=='walk'?'':' · '+mmss(pace(r))+' /km'}</div><div class="mut">${meta}</div>${r.notes?`<div class="mut">"${esc(r.notes)}"</div>`:''}<div style="text-align:right;margin-top:6px"><button class="b sm" data-act="redit" data-id="${r.id}">Edit</button><button class="b sm" data-act="rdel" data-id="${r.id}">Delete</button></div></div>`};
V.record=()=>{if(edit)return runForm();
 const rs=D.runs.filter(r=>(!F.t||r.type==F.t)&&(!F.l||r.location==F.l)&&(!F.g||(F.g=='none'?!r.gear_id:r.gear_id==F.g))).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 let h='',cur='';rs.forEach(r=>{const m=r.date.slice(0,7);if(m!=cur){cur=m;const g=rs.filter(x=>x.date.slice(0,7)==m);h+=`<h3 style="margin-top:14px">${new Date(m+'-01T00:00:00').toLocaleDateString('en',{month:'long',year:'numeric'})} · ${g.length} runs · ${g.reduce((a,x)=>a+x.distance_km,0).toFixed(1)} km</h3>`}h+=rcard(r)});
 $('#app').innerHTML=`<div class="top"><h2>Run Record</h2><button class="b on" data-act="radd">+ Add Run</button></div><div class="row">${sel('fil_t',[['','All types'],['easy','Easy'],['long','Long'],['interval','Interval'],['walk','Walk']],F.t)}${sel('fil_l',[['','All locations'],['outdoor','Outdoor'],['treadmill','Treadmill']],F.l)}${sel('fil_g',[['','All gear'],['none','No gear'],...D.gears.map(g=>[g.id,esc(g.name)])],F.g)}</div>${h||'<div class="card mut" style="margin-top:12px">No runs yet. Tap + Add Run to log your first one.</div>'}`};
function runForm(){const e=edit,tr=e.location=='treadmill',bt=(k,v,l)=>`<button class="b ${e[k]==v?'on':''}" data-act="set" data-k="${k}" data-v="${v}">${l}</button>`;
 $('#app').innerHTML=`<div class="card"><h2>${e.id?'Edit':'Add'} Run</h2><label>Date *</label><input type="date" id="f_date" value="${e.date}" max="${today()}"><label>Location *</label><div class="row">${bt('location','treadmill','Treadmill')}${bt('location','outdoor','Outdoor')}</div><label>Type *</label><div class="row">${bt('type','easy','Easy')}${bt('type','long','Long')}${bt('type','interval','Interval')}${bt('type','walk','Walk')}</div><label>Gear</label>${sel('f_gear',[['','None'],...D.gears.filter(g=>g.status=='active'||g.id==e.gear).map(g=>[g.id,esc(g.name)])],e.gear)}<label>Distance (km) *</label><input id="f_dist" inputmode="decimal" value="${e.dist}"><label>Time *</label><div class="row"><input id="f_h" inputmode="numeric" placeholder="h" value="${e.h}"><input id="f_m" inputmode="numeric" placeholder="m" value="${e.m}"><input id="f_s" inputmode="numeric" placeholder="s" value="${e.s}"></div><label>Avg Pace (auto)</label><div id="pace"></div><label>Avg HR (bpm)</label><input id="f_hr" inputmode="numeric" value="${e.hr}"><label>${tr?'Incline (%)':'Elevation gain (m)'}</label><input id="f_el" inputmode="decimal" value="${e.el}"><label>RPE (1-10)</label><div class="row" style="flex-wrap:wrap">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="b ${e.rpe==n?'on':''}" style="flex:1 0 17%" data-act="set" data-k="rpe" data-v="${n}">${n}</button>`).join('')}</div><label>Notes</label><textarea id="f_notes" rows="2" maxlength="200">${esc(e.notes)}</textarea><button class="pri" data-act="rsave">Save Run</button><button class="b" style="width:100%;margin-top:8px" data-act="rcancel">Cancel</button></div>`;calcPace()}
async function rsave(){const e=edit,d=+e.dist,s=secs();
 if(!e.date||e.date>today()||!(d>0)||!(s>0)||+e.m>59||+e.s>59)return toast('Fill the required fields correctly',1);
 const hr=e.hr===''?null:+e.hr;if(hr!==null&&(hr<40||hr>220))return toast('Avg HR must be between 40 and 220',1);
 const tr=e.location=='treadmill',el=e.el===''?null:+e.el;
 const r={id:e.id||'r_'+Date.now(),date:e.date,location:e.location,type:e.type,gear_id:e.gear||null,distance_km:d,time_sec:s,avg_hr:hr,elev_gain_m:tr?null:el,incline_pct:tr?el:null,rpe:e.rpe||null,notes:e.notes.trim()};
 if(await save(x=>{const i=x.runs.findIndex(q=>q.id==r.id);i<0?x.runs.push(r):x.runs[i]=r})){edit=null;toast('Run saved ✓');render()}}

/* ---------- Gear ---------- */
V.gear=()=>{if(gedit)return gearForm();const a=D.gears.filter(g=>g.status=='active'),r=D.gears.filter(g=>g.status!='active');
 const b=(g,t,x)=>`<button class="b sm" data-act="gedit" data-id="${g.id}">Edit</button><button class="b sm" data-act="${t}" data-id="${g.id}">${x}</button><button class="b sm" data-act="gdel" data-id="${g.id}">Delete</button>`;
 $('#app').innerHTML=`<div class="top"><h2>My Gear</h2><button class="b on" data-act="gadd">+ Add Gear</button></div><h3>Active (${a.length})</h3>${a.map(g=>gcard(g,b(g,'gret','Retire'))).join('')||'<div class="card mut">No gear yet. Add your first pair of shoes.</div>'}<h3>Retired (${r.length})</h3>${r.map(g=>gcard(g,b(g,'gact','Reactivate'))).join('')}`};
function gearForm(){const e=gedit;$('#app').innerHTML=`<div class="card"><h2>${e.id?'Edit':'Add'} Gear</h2><label>Name *</label><input id="f_name" value="${esc(e.name)}"><label>Start date *</label><input type="date" id="f_sd" value="${e.sd}"><label>Starting distance (km)</label><input id="f_sk" inputmode="decimal" value="${e.sk}"><label>Max distance (km) *</label><input id="f_mk" inputmode="decimal" value="${e.mk}"><label>Notes</label><textarea id="f_gn" rows="2">${esc(e.gn)}</textarea><button class="pri" data-act="gsave">Save Gear</button><button class="b" style="width:100%;margin-top:8px" data-act="gcancel">Cancel</button></div>`}
async function gsave(){const e=gedit,n=e.name.trim();
 if(!n||!e.sd||!(+e.mk>0)||D.gears.some(g=>g.id!=e.id&&g.name.toLowerCase()==n.toLowerCase()))return toast('Name is required and must be unique',1);
 const o={id:e.id||'g_'+Date.now(),name:n,start_date:e.sd,start_km:+e.sk||0,max_km:+e.mk,status:e.status||'active',retired_date:e.rd||null,notes:e.gn.trim()};
 if(await save(x=>{const i=x.gears.findIndex(q=>q.id==o.id);i<0?x.gears.push(o):x.gears[i]=o})){gedit=null;toast('Gear saved ✓');render()}}

/* ---------- Settings ---------- */
V.settings=()=>{const c=cfg();$('#app').innerHTML=`<div class="card"><h2>Settings</h2><label>Data repo (owner/repo)</label><input id="s_repo" value="${esc(c.repo)}" placeholder="username/stc-run-data" autocapitalize="off" autocorrect="off"><label>GitHub token</label><input id="s_tok" type="password" value="${esc(c.tok)}" autocapitalize="off"><button class="pri" data-act="savecfg">Save and test connection</button><div class="row" style="margin-top:12px"><button class="b" data-act="exj">Export JSON</button><button class="b" data-act="exc">Export CSV</button></div></div>`};
const dl=(n,t)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t]));a.download=n;a.click()};

/* ---------- Core ---------- */
function render(){charts.forEach(c=>c.destroy());charts=[];document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.p==page));
 const c=cfg();if((!c.repo||!c.tok)&&page!='settings'){page='settings'}V[page]()}
async function show(){const c=cfg();if(c.repo&&c.tok&&page!='settings'&&!edit&&!gedit){try{await load()}catch(e){toast(e.message,1)}}render()}
document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-act],[data-p]');if(!b)return;const d=b.dataset,a=d.act;
 if(d.p){page=d.p;edit=gedit=null;return show()}
 if(a=='radd'){edit=newDraft();render()}
 else if(a=='redit'){edit=toDraft(D.runs.find(r=>r.id==d.id));render()}
 else if(a=='rcancel'){edit=null;render()}
 else if(a=='rsave')rsave();
 else if(a=='rdel'){if(confirm('Delete this run?')&&await save(x=>{x.runs=x.runs.filter(r=>r.id!=d.id)})){toast('Run deleted');render()}}
 else if(a=='set'){if(d.k=='rpe')edit.rpe=edit.rpe==+d.v?null:+d.v;else{edit[d.k]=d.v;if(d.k=='location')edit.el=''}render()}
 else if(a=='gadd'){gedit={name:'',sd:today(),sk:0,mk:700,gn:''};render()}
 else if(a=='gedit'){const g=D.gears.find(g=>g.id==d.id);gedit={id:g.id,name:g.name,sd:g.start_date,sk:g.start_km,mk:g.max_km,gn:g.notes||'',status:g.status,rd:g.retired_date};render()}
 else if(a=='gcancel'){gedit=null;render()}
 else if(a=='gsave')gsave();
 else if(a=='gdel'){const n=D.runs.filter(r=>r.gear_id==d.id).length;if(confirm('Delete this gear?'+(n?` ${n} runs use it. They will be kept and shown as No gear.`:''))&&await save(x=>{x.gears=x.gears.filter(g=>g.id!=d.id);x.runs.forEach(r=>{if(r.gear_id==d.id)r.gear_id=null})})){toast('Gear deleted');render()}}
 else if(a=='gret'||a=='gact'){if(await save(x=>{const g=x.gears.find(g=>g.id==d.id);g.status=a=='gret'?'retired':'active';g.retired_date=a=='gret'?today():null}))render()}
 else if(a=='mix'){mixKm=!mixKm;render()}
 else if(a=='savecfg'){LS.repo=$('#s_repo').value.trim();LS.tok=$('#s_tok').value.trim();try{await load();toast('Connected ✓');page='summary';render()}catch(e){toast(e.message,1)}}
 else if(a=='exj')dl('stc-run-data.json',JSON.stringify(D,null,1));
 else if(a=='exc'){const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;dl('stc-run.csv',['date,location,type,gear,distance_km,time_sec,avg_hr,elev_gain_m,incline_pct,rpe,notes',...D.runs.map(r=>[r.date,r.location,r.type,gname(r.gear_id),r.distance_km,r.time_sec,r.avg_hr,r.elev_gain_m,r.incline_pct,r.rpe,r.notes].map(q).join(','))].join('\n'))}});
document.addEventListener('input',ev=>{const t=ev.target;if(t.id&&t.id.startsWith('f_')){(page=='gear'?gedit:edit)[t.id.slice(2)]=t.value;if(page=='record')calcPace()}});
document.addEventListener('change',ev=>{const t=ev.target;if(t.id&&t.id.startsWith('fil_')){F[t.id[4]]=t.value;render()}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!edit&&!gedit&&page!='settings')show()});
show();
