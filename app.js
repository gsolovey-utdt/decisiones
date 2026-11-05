import {backend} from './api.js';
import {escape as e,parseNumber,uniformInt} from './core.js';
const params=new URLSearchParams(location.search),session=params.get('s')||'clase21',demo=params.get('demo')==='1',root=document.querySelector('#app');
const key=`nype_decisiones:${demo?'demo:':''}${session}`;
let api,state,local={},device,busy=false;
const header=()=>`<header class="brand"><span class="badge">NyPE</span><span>Neurociencia y Psicología Experimental</span></header>${demo?'<p class="demo-label">DEMOSTRACIÓN · DATOS SIMULADOS</p>':''}`;
const save=()=>localStorage.setItem(key,JSON.stringify(local));
function message(text,retry){root.innerHTML=header()+`<section class="card"><h1>${e(text)}</h1>${retry?'<button id="retry" class="primary">Reintentar</button>':''}</section>`;if(retry)document.querySelector('#retry').onclick=retry;}
function failure(err,retry){if(err.message.includes('CLOSED')){message('La actividad ya cerró');return;}if(err.message.includes('RESET')){local={};save();message('El docente reinició la actividad.',boot);return;}message(err.message,retry);}
async function start(){if(busy)return;busy=true;try{local.started=true;save();state=await api.call('join',identity());local.epoch=state.epoch;save();render();}catch(err){failure(err,start);}finally{busy=false;}}
const identity=()=>({p_participant:device.id,p_token:device.token});
function render(){
  if(!state.open){message('La actividad ya cerró');return;}
  if(state.completed_at||!state.current){root.innerHTML='<p class="done">Listo, gracias. Dejá el celular boca abajo</p>';return;}
  const s=state.current,screenKey=`${state.epoch}:${s.order}`;
  if(local.screenKey!==screenKey){local.screenKey=screenKey;local.shownAt=new Date().toISOString();local.draft=null;save();}
  const options=s.options?.map(o=>`<button type="button" class="option" data-option="${e(o.id)}">${e(o.text)}</button>`).join('')||'';
  root.innerHTML=header()+`<div class="progress-meta"><span>Actividad de clase</span><span>${s.order} / ${state.total}</span></div><div class="progress" role="progressbar" aria-label="Progreso" aria-valuemin="0" aria-valuemax="${state.total}" aria-valuenow="${s.order-1}"><span style="width:${100*(s.order-1)/state.total}%"></span></div><section class="card" aria-labelledby="question">${s.instruction?`<p class="instruction">${e(s.instruction)}</p>`:''}${s.text?`<p class="scenario">${e(s.text)}</p>`:''}<h1 id="question" tabindex="-1">${e(s.prompt)}</h1>${s.subtitle?`<p>${e(s.subtitle)}</p>`:''}<form id="answer" autocomplete="off">${s.kind==='spin'?'<div class="roulette-shell"><div id="wheel" class="wheel" aria-hidden="true"></div><div id="spin-number" class="spin-number" role="status">?</div></div><button class="primary" id="spin" type="button">Girá la ruleta</button>':options?`<div class="options ${s.block==='decil'?'deciles':''}">${options}</div>`:s.kind==='interval'?`<div class="interval-fields"><label>Mínimo<input id="min" inputmode="decimal" type="text" maxlength="100" required></label><label>Máximo<input id="max" inputmode="decimal" type="text" maxlength="100" required></label></div><p class="unit">${e(s.unit)}</p><button class="primary" type="submit">Continuar</button>`:`<label class="number-label" for="number">Tu respuesta · ${e(s.unit)}</label><input id="number" type="text" inputmode="decimal" maxlength="200" required><button class="primary" type="submit">Continuar</button>`}<p id="error" class="error" role="alert"></p></form></section><p class="footnote">Respondé con lo primero que te parezca. Cada respuesta queda guardada al continuar.</p>`;
  document.querySelector('#question').focus({preventScroll:true});window.scrollTo(0,0);
  for(const input of root.querySelectorAll('input')){input.value=local.draft?.[input.id]||'';input.oninput=()=>{local.draft={...local.draft,[input.id]:input.value};save();};}
  root.querySelectorAll('[data-option]').forEach(btn=>btn.onclick=()=>submit(btn.dataset.option));
  document.querySelector('#answer').onsubmit=event=>{event.preventDefault();const raw=s.kind==='interval'?{min:document.querySelector('#min').value,max:document.querySelector('#max').value}:document.querySelector('#number').value;const values=s.kind==='interval'?[parseNumber(raw.min),parseNumber(raw.max)]:[parseNumber(raw,s.kind==='problem')];if(s.kind!=='problem'&&values.some(n=>n==null||n<0)){error('Escribí un número válido, mayor o igual a cero.');return;}if(s.kind==='interval'&&values[0]>values[1]){error('El mínimo no puede ser mayor que el máximo.');return;}submit(raw);};
  if(s.kind==='spin')document.querySelector('#spin').onclick=spin;
  if(local.pending){setDisabled(true);sendPending();}
}
function error(text){const el=document.querySelector('#error');if(el)el.textContent=text;}
function setDisabled(value){root.querySelectorAll('button,input').forEach(el=>el.disabled=value);}
async function submit(raw,delay=0){
  if(busy)return;busy=true;setDisabled(true);error('');
  local.pending={...identity(),p_order:state.current.order,p_epoch:state.epoch,p_raw:raw,p_shown_at:local.shownAt,p_answered_at:new Date().toISOString(),p_event:crypto.randomUUID()};save();
  await sendPending(delay);
}
async function sendPending(delay=0){
  busy=true;setDisabled(true);const isSpin=state.current?.kind==='spin';
  try{
    const begin=performance.now(),next=await api.call('answer',local.pending);
    const wait=Math.max(0,delay-(performance.now()-begin));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
    local.pending=null;save();state=next;
    if(isSpin){const n=next.spin??next.current?.anchor;document.querySelector('#wheel')?.classList.remove('spinning');const result=document.querySelector('#spin-number');if(result)result.textContent=String(n);const button=document.querySelector('#spin');if(button){button.textContent='Continuar';button.disabled=false;button.onclick=()=>{busy=false;render();};}else render();}
    else render();
  }catch(err){
    if(/CLOSED|RESET/.test(err.message)){failure(err);return;}
    error(err.message+' Tu respuesta sigue en este dispositivo.');const form=document.querySelector('#answer');if(form){const btn=document.createElement('button');btn.type='button';btn.className='primary';btn.textContent='Reintentar envío';btn.id='retry-send';form.querySelector('#retry-send')?.remove();form.append(btn);btn.onclick=()=>sendPending();}
  }finally{busy=false;}
}
async function spin(){if(busy)return;document.querySelector('#wheel').classList.add('spinning');let timer=setInterval(()=>{const n=document.querySelector('#spin-number');if(n)n.textContent=String(uniformInt());},65);const promise=submit(null,3000);setTimeout(()=>clearInterval(timer),2800);await promise;clearInterval(timer);}
async function boot(){
  try{
    if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(session))throw Error('El enlace de la sesión no es válido.');
    try{device=JSON.parse(localStorage.getItem('nype_decisiones_device'));}catch{}
    if(!device?.id||!device?.token){device={id:crypto.randomUUID(),token:Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')};localStorage.setItem('nype_decisiones_device',JSON.stringify(device));}
    local=JSON.parse(localStorage.getItem(key)||'{}');api=await backend(session,demo);const status=await api.call('status');
    if(!status.open){message('La actividad ya cerró');return;}
    if(local.epoch&&local.epoch!==status.epoch){local={};save();}
    if(local.started){state=await api.call('join',identity());local.epoch=state.epoch;save();if(local.pending&&local.pending.p_order<=state.cursor){local.pending=null;save();}render();return;}
    root.innerHTML=header()+`<section class="card intro"><p class="eyebrow">ACTIVIDAD DE CLASE · UNOS 8 MINUTOS</p><h1>Antes de empezar</h1><p class="scenario">${e(status.intro)}</p><button class="primary" id="start">Empezar</button></section>`;document.querySelector('#start').onclick=start;
  }catch(err){failure(err,boot);}
}
// A browser Back/Forward or another tab can never restore an answered screen.
window.addEventListener('pageshow',ev=>{if(ev.persisted)boot();});
window.addEventListener('storage',ev=>{if(ev.key===key&&!busy)boot();});
boot();
