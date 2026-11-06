// Explicit cloud load test: only on an EMPTY, CLOSED session; always clear our rows.
// Invocation: node scripts/load.mjs entregables/ACCESO-DOCENTE-clase21.txt
// --local uses the SQL QA server. No secrets are printed.
import fs from 'node:fs';import {randomUUID,randomBytes} from 'node:crypto';import {BACKEND} from '../config/backend.js';
const access=fs.readFileSync(process.argv[2]||'entregables/ACCESO-DOCENTE-clase21.txt','utf8');
const key=access.match(/Clave: (\w+)/)?.[1],session=process.argv.find(a=>a.startsWith('--session='))?.slice(10)||new URL(access.match(/Docente: (\S+)/)[1]).searchParams.get('s');
const endpoint=process.argv.includes('--local')?'http://127.0.0.1:4175':BACKEND.url;
const rpc=async(name,p={})=>{const r=await fetch(`${endpoint}/rest/v1/rpc/nype_dec_${name}`,{method:'POST',headers:{apikey:BACKEND.key,'Content-Type':'application/json'},body:JSON.stringify({p_session:session,...p})});const d=await r.json();if(!r.ok)throw Error(`${r.status}: ${d.message}`);return d;};
const admin=action=>rpc('admin',{p_key:key,p_action:action});
const initial=await admin('snapshot');
if(initial.open||initial.participants.length||initial.answers.length)throw Error('La prueba requiere una sesión vacía y cerrada. No se modificó nada.');
let succeeded=false;
const started=performance.now(),latencies=[];
const people=Array.from({length:40},()=>({p_participant:randomUUID(),p_token:randomBytes(32).toString('hex')})),owned=new Set(people.map(p=>p.p_participant));
try{
  await admin('open');
  let states=await Promise.all(people.map(p=>rpc('join',p)));
  const config=initial.config;
  while(states.some(s=>s.current)){
    states=await Promise.all(states.map(async(s,i)=>{
      if(!s.current)return s;const q=s.current,b=config.blocks.find(b=>b.id===q.block),item=b.items?.find(a=>a.id===q.item)||b.roulette;
      let raw;
      if(q.kind==='spin')raw=null;
      else if(q.options)raw=q.options[Math.random()<.65?0:1]?.id||q.options[0].id;
      else if(q.kind==='estimate')raw=String(Math.round(q.condition==='ruleta'?88+.45*(q.anchor-50)+(Math.random()-.5)*35:item.real*Math.exp((q.condition==='alta'?.3:-.3)+(Math.random()-.5)*.6)));
      else if(q.kind==='valuation')raw=String(Math.round(item.demoBase*(q.condition==='venta'?1.7:.9)*Math.exp((Math.random()-.5)*.6)/100)*100);
      else if(q.kind==='interval'){const center=item.real*(.6+Math.random()*.7),width=item.real*.15;raw={min:String(Math.round(center-width)),max:String(Math.round(center+width))};}
      else raw=String(Math.random()<.5?item.correct:item.intuitive);
      const begin=performance.now(),payload={...people[i],p_epoch:s.epoch,p_order:q.order,p_raw:raw,p_shown_at:new Date(Date.now()-5000).toISOString(),p_answered_at:new Date().toISOString(),p_event:randomUUID()};
      const result=await rpc('answer',payload);latencies.push(performance.now()-begin);return result;
    }));
  }
  const end=await admin('snapshot'),expected=states.reduce((s,q)=>s+q.total,0);
  if(end.participants.length!==40||end.answers.length!==expected||end.participants.some(p=>!p.completed_at))throw Error('Conteos inesperados.');
  latencies.sort((a,b)=>a-b);
  const cells=Object.fromEntries((config.design?.cells||[]).map(cell=>[cell,end.participants.filter(p=>p.assignment?.cell===cell).length]));
  if(Object.values(cells).some(n=>n!==10))throw Error('Las cuatro celdas no quedaron balanceadas.');
  console.log(JSON.stringify({environment:endpoint===BACKEND.url?'Supabase real':'PostgreSQL local',session,participants:40,answers:end.answers.length,cells,total_ms:Math.round(performance.now()-started),answer_p50_ms:Math.round(latencies[Math.floor(latencies.length*.5)]),answer_p95_ms:Math.round(latencies[Math.floor(latencies.length*.95)]),frame: Object.fromEntries(['ganancias','perdidas'].map(c=>[c,end.answers.filter(a=>a.condition===c).length]))}));succeeded=true;
}finally{
  // Verify exclusive ownership before deleting. If an unexpected person joined, leave all rows.
  const snapshot=await admin('close');
  if(snapshot.participants.every(p=>owned.has(p.participant_id))){await admin('clear');console.log('Datos de prueba borrados. Recepción cerrada.');}
  else console.log('Se detectaron participantes extra: no se borraron datos. Revisá la sesión.');
}
if(!succeeded)process.exitCode=1;
