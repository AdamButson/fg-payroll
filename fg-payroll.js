/* FG Payroll — reads FieldGroove "Dispatcher by Truck" and builds a weekly tech-pay grid.
   Names, trucks and pay rates are NOT in this file; the loader bookmark supplies them as window.FGP_CFG. */
(async()=>{
const C=window.FGP_CFG;
if(!C){alert('FG Payroll: missing settings — use the FG Payroll loader bookmark.');return;}
if(location.hostname!=='app.fieldgroove.com'){alert('Open FieldGroove (app.fieldgroove.com) first, then click FG Payroll from that tab.');return;}
const COLS=C.cols, RIGS=C.rigs.map(r=>({...r,re:new RegExp(r.truck,'i')})), FLAT=C.flat||{};
const TRUCKS=Object.fromEntries(Object.entries(C.trucks||{}).map(([k,v])=>[k,new RegExp(v,'i')])), RIDES=C.rides||{};
const isRig=t=>RIGS.some(r=>r.re.test(t));
const p=n=>String(n).padStart(2,'0');
const fmt=d=>p(d.getMonth()+1)+'/'+p(d.getDate())+'/'+d.getFullYear();
const $=n=>'$'+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const r2=n=>Math.round(n*100)/100;
const DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const t=new Date();t.setHours(0,0,0,0);const w=new Date(t);w.setDate(t.getDate()-((t.getDay()+4)%7)-7);
const inp=window.__FGP_INPUT||prompt('Pay week START (Wednesday), MM/DD/YYYY',fmt(w));if(!inp)return;
const start=new Date(inp.trim());const days=[];for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(d);}
const box=document.createElement('div');box.style.cssText='position:fixed;top:10px;right:10px;z-index:99999;background:#222;color:#fff;padding:8px 12px;font:13px sans-serif;border-radius:6px';box.textContent='FG Payroll: loading…';document.body.appendChild(box);
const projCache={};
async function proj(wo,href){if(projCache[wo]!==undefined)return projCache[wo];const h=await(await fetch(href.split('?')[0],{credentials:'include'})).text();return projCache[wo]=((h.replace(/<[^>]+>/g,' ').match(/Project #\s*(\d+)/)||[])[1]||'?');}
const LOOKBACK=14,LOOKAHEAD=7;const key=d=>fmt(d);
const scan=[];for(let i=-LOOKBACK;i<7+LOOKAHEAD;i++){const d=new Date(start);d.setDate(start.getDate()+i);scan.push({d,inWeek:i>=0&&i<7});}
/* pull Dispatcher by Truck for every day in the window */
const data=[],visits={};
for(const {d,inWeek} of scan){
 box.textContent='FG Payroll: '+fmt(d);
 const h=await(await fetch('/Calendar/DispatcherByTruck?date='+encodeURIComponent(fmt(d)),{credentials:'include'})).text();
 if(/Account\/Login|type="password"/i.test(h)){box.remove();alert('FieldGroove session expired. Log in again, then rerun.');return;}
 const doc=new DOMParser().parseFromString(h,'text/html');const wos=[];
 if(inWeek&&![...doc.querySelectorAll('tr')].some(r=>isRig(r.cells[0]?.textContent||''))){box.remove();alert('Production rigs not found on Dispatcher by Truck. Set the location dropdown (top of FieldGroove) to All Locations, then rerun.');return;}
 for(const r of doc.querySelectorAll('tr')){
  if(r.cells.length<3)continue;
  const truck=r.cells[0].textContent.trim().split(/\n|Crew:/)[0].trim();if(!truck)continue;
  const rig=isRig(truck),wkend=d.getDay()===0||d.getDay()===6;
  if(!rig&&!(inWeek&&(wkend||Object.values(TRUCKS).some(re=>re.test(truck)))))continue;
  for(const c of [...r.cells].slice(1)){
   const m=c.textContent.replace(/\s+/g,' ').match(/Work Order #(\d+).*?([\d.]+)% of \$([\d,]+\.\d\d)/);if(!m)continue;
   const a=c.querySelector('a[href*="/Calendar/_Edit/"]');const o={truck,wo:m[1],amt:+m[3].replace(/,/g,''),d};
   if(rig)(visits[o.wo]=visits[o.wo]||[]).push(o);
   if(inWeek){o.job=a?await proj(o.wo,a.getAttribute('href')):'?';wos.push(o);}
  }
 }
 if(inWeek)data.push({d,wos});
}
/* multi-visit WOs: first visit + following consecutive workdays = production (labor split evenly);
   a visit after a gap = return trip ($0 production; helper still paid day rate) */
const nextWork=d=>{const n=new Date(d);do n.setDate(n.getDate()+1);while(n.getDay()===0||n.getDay()===6);return n;};
const plan={},review=[];
for(const wo in visits){
 const v=visits[wo].filter((x,i,arr)=>arr.findIndex(y=>key(y.d)===key(x.d))===i).sort((x,y)=>x.d-y.d);
 const prod=[v[0]];for(let i=1;i<v.length;i++){if(key(v[i].d)===key(nextWork(prod[prod.length-1].d)))prod.push(v[i]);else break;}
 const share=r2(v[0].amt/prod.length);const prodKeys=new Set(prod.map(x=>key(x.d)));
 plan[wo]={n:prod.length,share,prodKeys,amt:v[0].amt};
 if(v.length>1&&v.some(x=>x.d>=start&&x.d<=days[6])){
  const ret=v.filter(x=>!prodKeys.has(key(x.d))).map(x=>key(x.d).slice(0,5));
  const outside=prod.filter(x=>x.d<start||x.d>days[6]).map(x=>key(x.d).slice(0,5));
  review.push('WO '+wo+': visits '+v.map(x=>key(x.d).slice(0,5)).join(', ')+' → production '+[...prodKeys].map(k=>k.slice(0,5)).join(' + ')+' ('+$(share)+' each)'+(ret.length?'; return trip '+ret.join(', ')+' = $0':'')+(outside.length?'; share on '+outside.join(', ')+' falls in another pay period':''));
 }
}
/* build grid (rows 2–22 of the pay tab) */
const out=[];const wkTot={},wkDays={};
for(const {d,wos} of data){
 const wk=d.getDay()===0||d.getDay()===6;
 const amt=Object.fromEntries(COLS.map(c=>[c,''])),job=Object.fromEntries(COLS.map(c=>[c,'']));const notes=['',''];
 const jobs=a=>[...new Set(a.map(o=>o.job))].join(' / ');
 if(!wk){
  for(const k in FLAT)amt[k]=FLAT[k];
  RIGS.forEach((rg,ri)=>{
   const list=wos.filter(o=>rg.re.test(o.truck));let prod=0;const parts=[],rets=[];
   list.forEach(o=>{const pl=plan[o.wo];if(pl&&pl.prodKeys.has(key(d))){prod+=pl.share;parts.push(o.job+' '+$(pl.share)+(pl.n>1?' (1/'+pl.n+' of '+$(pl.amt)+')':''));}else rets.push(o.job);});
   const helperPay=rg.helper?(FLAT[rg.helper]||0):0;let n='';
   if(prod>0){const net=r2(prod-helperPay);amt[rg.name]=Math.max(net,0);job[rg.name]=jobs(list);
    if(parts.length>1||parts.some(x=>x.includes('(1/')))n=parts.join(' + ');
    if(helperPay)n=(n?n+'; ':'')+'prod '+$(r2(prod))+' − '+rg.helper+' '+$(helperPay)+(net<0?' → $0 (helper cost exceeded production)':'');
    if(rets.length)n+='; return trip '+rets.join('/')+' $0';}
   else if(rets.length){amt[rg.name]=0;job[rg.name]=jobs(list);n='return trip '+rets.join('/')+' – $0'+(rg.helper?', '+rg.helper+' day rate':'');}
   else{amt[rg.name]=0;job[rg.name]='Off';}
   if(rg.helper)job[rg.helper]=list.length?jobs(list):'';
   if(ri<2)notes[ri]=n;
  });
  for(const k in TRUCKS){const js=wos.filter(o=>TRUCKS[k].test(o.truck));if(js.length)job[k]=jobs(js);}
  for(const k in RIDES)if(job[RIDES[k]])job[k]=job[RIDES[k]];
 }else if(wos.length){
  /* weekend crews are one-offs: ask who worked each job, split its labor evenly between them */
  const seen=new Set(),parts=[],skipped=[];
  for(const o of wos.filter(o=>o.amt>0&&!seen.has(o.wo)&&seen.add(o.wo))){
   const q=DOW[d.getDay()]+' '+(d.getMonth()+1)+'/'+d.getDate()+': job '+o.job+' – '+$(o.amt)+' (scheduled on '+o.truck+')\nWho worked it? Names separated by commas, e.g. '+COLS.slice(0,2).join(', ')+'\nOptions: '+COLS.join(', ')+'\nLeave blank to skip.';
   const ans=window.__FGP_WEEKEND?(window.__FGP_WEEKEND[o.job]||''):(prompt(q,'')||'');
   const crew=ans.split(/[,&/]|\band\b/i).map(s=>s.trim().toLowerCase()).filter(Boolean).map(s=>COLS.find(c=>c.toLowerCase()===s)).filter(Boolean);
   if(!crew.length){skipped.push('job '+o.job+' '+$(o.amt)+' (on '+o.truck+')');continue;}
   const each=Math.floor(o.amt*100/crew.length)/100,extra=r2(o.amt-each*crew.length);
   crew.forEach((c,i)=>{amt[c]=r2((amt[c]||0)+each+(i===0?extra:0));job[c]=job[c]?job[c]+' / '+o.job:o.job;});
   parts.push(o.job+' '+$(o.amt)+' ÷ '+crew.length+' ('+crew.join(', ')+')');
  }
  notes[0]=parts.join('; ')+(skipped.length?(parts.length?'; ':'')+'NOT ASSIGNED: '+skipped.join('; '):'');
 }
 COLS.forEach(c=>{if(typeof amt[c]==='number'){wkTot[c]=(wkTot[c]||0)+amt[c];wkDays[c]=(wkDays[c]||0)+1;}});
 const money=v=>v===''?'':$(v);
 out.push([DOW[d.getDay()]+' '+(d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear(),...COLS.map(c=>money(amt[c])),'S',notes[0]]);
 out.push(['Job Number',...COLS.map(c=>job[c]),'L',notes[1]]);
 out.push(['Allocation',...COLS.map(()=>wk?'Weekend':'Gainesville'),'','']);
}
/* day rates are checked against the WEEKLY daily average (same as the sheet's Daily averages row), not per day */
const avgLines=RIGS.filter(rg=>rg.floor).map(rg=>{const tot=r2(wkTot[rg.name]||0),n=wkDays[rg.name]||0,avg=n?r2(tot/n):0;
 return avg>=rg.floor?rg.name+': avg '+$(avg)+'/day over '+n+' days ✓ meets '+$(rg.floor)
  :'⚠ '+rg.name+': avg '+$(avg)+'/day over '+n+' days — below '+$(rg.floor)+' day rate; short '+$(r2(rg.floor*n-tot))+' for the week';});
review.unshift(...avgLines);
const tsv=out.map(r=>r.join('\t')).join('\n');
box.remove();
if(window.__FGP_INPUT){window.__FGP_OUT=tsv+'\nREVIEW: '+review.join(' | ');return;}
const esc=x=>x.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const revHtml=review.length?'<div style="background:#fff3cd;padding:6px 8px;border-radius:4px"><b>REVIEW:</b><br>'+review.map(esc).join('<br>')+'</div>':'';
const o=document.createElement('div');
o.style.cssText='position:fixed;inset:5%;z-index:99999;background:#fff;border:2px solid #333;padding:12px;display:flex;flex-direction:column;gap:8px;font:13px sans-serif;box-shadow:0 8px 40px rgba(0,0,0,.4)';
o.innerHTML='<b>Pay week '+fmt(days[0])+' – '+fmt(days[6])+'</b><div>Click cell <b>A2</b> on the new pay tab and paste. Week Total / Daily averages stay as your formulas.</div>'+revHtml+'<textarea style="flex:1;width:100%;box-sizing:border-box;font:12px monospace;white-space:pre"></textarea><div><button id=fgc>Copy for Google Sheets</button> <button id=fgx>Close</button></div>';
o.querySelector('textarea').value=tsv;document.body.appendChild(o);
o.querySelector('#fgc').onclick=async e=>{await navigator.clipboard.writeText(tsv);e.target.textContent='Copied ✓';};
o.querySelector('#fgx').onclick=()=>o.remove();
})();
