import {backend} from './api.js';
import {analyze,fmt,mean,median,pct,spearman,csv,escape as e,groupBy} from './core.js';
import {strip,discrete,continuous,scatter,stacked} from './charts.js';
const params=new URLSearchParams(location.search),session=params.get('s')||'clase21',demo=params.get('demo')==='1';
let view=params.get('v')||'panel',key=decodeURIComponent(location.hash.slice(1))||sessionStorage.getItem('nype_dec_key:'+session)||'',api,data,stats,busy=false,timer,revealed=new Set();
const $=id=>document.getElementById(id), percent=(n,d)=>`${fmt(pct(n,d))} %`,nLabel=n=>`<span class="n-label">n = ${n}</span>`;
const counts=(rows,field,keys)=>Object.fromEntries(keys.map(k=>[k,rows.filter(r=>field(r)===k).length]));
const table=(headers,rows)=>`<table><thead><tr>${headers.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
function link(v,withDemo=demo){return `admin.html?s=${encodeURIComponent(session)}&v=${encodeURIComponent(v)}${withDemo?'&demo=1':''}${!withDemo&&key?'#'+encodeURIComponent(key):''}`;}
function renderNav(){
  const anchors=data.config.blocks.find(b=>b.type==='anchors')?.items||[];
  const has=type=>data.config.blocks.some(b=>b.type===type);
  const views=[['panel','Panel'],...(has('problems')?[['problemas','Tres problemas']]:[]),...anchors.map(i=>['anclaje-'+i.id,i.label]),...(has('anchors')?[['resumen','Anclaje · resumen']]:[]),...(data.config.blocks.find(b=>b.type==='anchors')?.roulette?[['ruleta','Ruleta']]:[]),...(has('choice')?[['linda',data.config.blocks.find(b=>b.type==='choice').label]]:[]),...(has('framing')?[['enfermedad','Enfermedad']]:[]),...(has('intervals')?[['intervalos','Intervalos']]:[]),...(has('decile')?[['decil','Decil']]:[])];
  $('views').innerHTML=views.map(([v,l])=>`<a href="${link(v)}" class="${v===view?'active':''}" ${v===view?'aria-current="page"':''}>${e(l)}</a>`).join('');
  $('views').querySelectorAll('a').forEach(a=>a.onclick=ev=>{if(ev.ctrlKey||ev.metaKey)return;ev.preventDefault();view=new URL(a.href).searchParams.get('v');history.replaceState(null,'',a.href);renderNav();render();});
}
function render(){
  const reveal=revealed.has(view),a=stats;let title,content;
  if(view==='panel'){
    title='La clase, en vivo';
    content=`<div class="two-cols"><div><div class="metrics"><div><strong>${a.n}</strong><span>empezaron</span></div><div><strong>${a.complete}</strong><span>terminaron todo</span></div></div>${table(['Actividad','Empezaron','Completaron'],data.config.blocks.map(b=>[e(b.label),a.blocks[b.id].started,a.blocks[b.id].completed]))}</div><div class="join-card"><img src="entregables/${e(session)}-qr.png" alt="QR para abrir la actividad" onerror="this.hidden=true"><p class="join-url">${e(new URL('index.html?s='+encodeURIComponent(session),location.href).href)}</p><p>Respondé desde tu celular.</p></div></div>`;
  } else if(view.startsWith('anclaje-')){
    const group=a.anchors.find(g=>g.item.id===view.slice(8));if(!group){view='panel';render();return;}
    title=group.item.label;content=nLabel(group.rows.length)+strip(group.item,group.rows,reveal);
  } else if(view==='resumen'){
    title='Anclaje · resumen';
    content=`<div class="two-cols"><div>${table(['Ítem','Ancla baja','Ancla alta',...(reveal?['Real']:[])],a.anchors.map(g=>{const low=g.rows.filter(r=>r.condition==='baja'),high=g.rows.filter(r=>r.condition==='alta');return [e(g.item.label),`${fmt(median(low.map(r=>r.parsed.value)))} <small>n=${low.length}</small>`,`${fmt(median(high.map(r=>r.parsed.value)))} <small>n=${high.length}</small>`,...(reveal?[fmt(g.item.real)]:[])];}))}<p class="chart-note"><span class="blue">● Baja</span> · <span class="gold">● Alta</span> · medianas</p></div><div><div class="metrics"><div><strong>${percent(a.indices.filter(v=>v>0).length,a.indices.length)}</strong><span>con índice positivo · n = ${a.indices.length}</span></div></div>${continuous(a.indices,{domain:[-2,2],xlabel:'Índice de anclaje',reference:0})}</div></div><p class="chart-note">Por persona: promedio de ln(estimación / real) con alta − promedio con baja. Se incluyen los cuatro ítems completos y estimaciones positivas. ${a.indexExcluded} excluidos por valores no positivos.</p>`;
  } else if(view==='ruleta'){
    title='Un número y una estimación';content=`<p class="lead-stat">Spearman ρ = <b>${fmt(spearman(a.roulette.map(p=>p.x),a.roulette.map(p=>p.y)),3)}</b> ${nLabel(a.roulette.length)}</p>${scatter(a.roulette,reveal,data.config.blocks.find(b=>b.type==='anchors').roulette.real)}`;
  } else if(view==='linda'){
    title='¿Qué es más probable?';const block=data.config.blocks.find(b=>b.type==='choice'),rows=a.byBlock[block.id]||[];
    content=`${nLabel(rows.length)}<div class="linda-options">${block.options.map((o,i)=>`<p><span class="${i?'gold':'blue'}">${i+1}.</span> ${e(o.text)}</p>`).join('')}</div>${stacked(counts(rows,r=>r.parsed.value,block.options.map(o=>o.id)),rows.length,['Cajera','Cajera y feminista'])}${reveal?'<p class="answer-reveal">La probabilidad de una conjunción no puede superar la de uno de sus componentes.</p>':''}`;
  } else if(view==='enfermedad'){
    title='La enfermedad · dos versiones';const rows=a.byBlock[data.config.blocks.find(b=>b.type==='framing').id]||[];
    content=table(['Versión','Segura','Riesgosa','n'],['ganancias','perdidas'].map(cond=>{const group=rows.filter(r=>r.condition===cond),safe=group.filter(r=>r.parsed.value==='segura').length;return [cond==='ganancias'?'Ganancias':'Pérdidas',`${percent(safe,group.length)} (${safe})`,`${percent(group.length-safe,group.length)} (${group.length-safe})`,group.length];}))+`<p class="explain">Ganancias: A segura / B riesgosa.<br>Pérdidas: C segura / D riesgosa.</p>${reveal?'<p class="answer-reveal">Los programas seguros tienen las mismas consecuencias. Los programas riesgosos también.</p>':''}`;
  } else if(view==='intervalos'){
    title='¿Cuánto cubren nuestros intervalos?';
    content=`<div class="two-cols"><div>${discrete(a.coverage,Array.from({length:a.intervals.length+1},(_,i)=>String(i)),{reference:.98*a.intervals.length,xlabel:'Intervalos que contienen el valor real'})}<p class="lead-stat">Promedio: <b>${fmt(mean(a.coverage),2)}</b> / ${a.intervals.length}</p></div><div>${table(['Ítem','Contiene el real','n',...(reveal?['Real']:[])],a.intervals.map(g=>[e(g.item.label),percent(g.hits,g.rows.length),g.rows.length,...(reveal?[fmt(g.item.real)]:[])]))}<p class="chart-note">Referencia del 98 %: ${fmt(.98*a.intervals.length)} de ${a.intervals.length}. Histograma y promedio: solo personas con todos los intervalos.</p></div></div>`;
  } else if(view==='decil'){
    title='¿Dónde creemos que vamos a quedar?';
    content=`<div class="two-cols"><div>${discrete(a.deciles.map(v=>v-1),Array.from({length:10},(_,i)=>String(i+1)),{xlabel:'Decil esperado · 1 = notas más altas'})}</div><div class="metrics vertical"><div><strong>${percent(a.deciles.filter(v=>v<=2).length,a.deciles.length)}</strong><span>en los dos deciles más altos<br>Referencia: 20 %</span></div><div><strong>${percent(a.deciles.filter(v=>v>=6).length,a.deciles.length)}</strong><span>en la mitad de abajo<br>Referencia: 50 %</span></div></div></div>`;
  } else if(view==='problemas'){
    title='Tres problemas';
    content=`<div class="two-cols"><div>${a.problems.map(g=>`<div class="problem-result"><h2>${e(g.item.label)} ${nLabel(g.rows.length)}</h2>${stacked(counts(g.rows,r=>r.parsed.classification,['correcta','intuitiva','otra']),g.rows.length)}${reveal?`<p class="answer-reveal">Correcta: ${g.item.correct} · intuitiva: ${g.item.intuitive}</p>`:''}<p class="chart-note">Mediana del tiempo: aciertos ${fmt(median(g.rows.filter(r=>r.parsed.classification==='correcta').map(r=>r.reaction_time_ms/1000)))} s · otras ${fmt(median(g.rows.filter(r=>r.parsed.classification!=='correcta').map(r=>r.reaction_time_ms/1000)))} s</p></div>`).join('')}</div><div>${discrete(a.scores,Array.from({length:a.problems.length+1},(_,i)=>String(i)),{xlabel:'Puntaje total'})}</div></div>`;
  } else {view='panel';render();return;}
  $('stage').innerHTML=`${demo?'<div class="demo-label">DATOS SIMULADOS · NO SON RESPUESTAS DE LA CLASE</div>':''}<header class="slide-header"><h1>${e(title)}</h1><span class="reception ${data.open?'is-open':''}">${data.open?'Recepción abierta':'Recepción cerrada'}</span></header><div class="slide-content">${content}</div><footer>NyPE · UTDT · ${e(session)}<span>${data.answers.length} respuestas guardadas</span></footer>`;
  $('reveal').textContent=reveal?'Ocultar respuesta':'Mostrar respuesta';$('reveal').hidden=['panel','decil'].includes(view);
  $('toggle-open').textContent=data.open?'Cerrar recepción':'Abrir recepción';
  $('live').textContent=`${demo?'DEMO · ':''}${a.n} participantes · actualizado ${new Date().toLocaleTimeString('es-AR',{timeZone:'America/Buenos_Aires'})}`;
}
async function refresh(action='snapshot'){
  if(busy)return;busy=true;clearTimeout(timer);
  try{data=await api.call('admin',{p_key:key,p_action:action});stats=analyze(data.config,data.participants,data.answers);$('access').innerHTML='';renderNav();render();$('management-status').textContent=action==='clear'?'Sesión vacía. La recepción quedó cerrada.':action!=='snapshot'?'Listo.':'';}
  catch(err){$('live').textContent='Sin actualizar';if(err.message.includes('UNAUTHORIZED'))access();else $('management-status').textContent=err.message;}
  finally{busy=false;if(!demo)timer=setTimeout(()=>refresh(),4000);}
}
function access(){clearTimeout(timer);$('access').innerHTML='<form id="key-form" class="card"><label>Clave docente<input id="key" type="password" autocomplete="off" required></label><button class="primary">Entrar</button><p id="key-error" role="alert"></p></form>';$('key-form').onsubmit=ev=>{ev.preventDefault();key=$('key').value.trim();sessionStorage.setItem('nype_dec_key:'+session,key);history.replaceState(null,'',link(view));refresh();};}
$('session').textContent=session;
$('student-link').href=`index.html?s=${encodeURIComponent(session)}${demo?'&demo=1':''}`;
$('demo-link').href=link(view,true);
$('reveal').onclick=()=>{if(revealed.has(view))revealed.delete(view);else revealed.add(view);render();};
$('project').onclick=()=>{document.body.classList.toggle('projecting');$('project').textContent=document.body.classList.contains('projecting')?'Salir de proyección':'Proyectar';};
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){document.body.classList.remove('projecting');$('project').textContent='Proyectar';}});
$('toggle-open').onclick=()=>refresh(data.open?'close':'open');
$('clear').onclick=()=>{if(prompt(`Para borrar todas las respuestas de ${session}, escribí ${session}. La recepción se cerrará.`)===session)refresh('clear');};
$('export').onclick=()=>{if(!data)return;const blob=new Blob([csv(data.answers,session)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`decisiones_${session}${demo?'_demo':''}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
try{api=await backend(session,demo);if(key||demo){if(key)sessionStorage.setItem('nype_dec_key:'+session,key);refresh();}else access();}catch(err){$('access').textContent=err.message;}
