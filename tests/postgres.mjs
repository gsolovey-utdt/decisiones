// Development-only: PGLITE_MODULE points to @electric-sql/pglite/dist/index.js.
// Real PostgreSQL SQL/RLS/RPC execution, not a JavaScript mock. No cloud writes.
import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';import path from 'node:path';import {parseNumber,analyze} from '../core.js';
const modulePath=process.env.PGLITE_MODULE||path.resolve('.qa/package/dist/index.js');
const {PGlite}=await import(pathToFileURL(modulePath));const {pgcrypto}=await import(pathToFileURL(path.join(path.dirname(modulePath),'contrib/pgcrypto.js')));
const pg=new PGlite({extensions:{pgcrypto}}),config=JSON.parse(fs.readFileSync('config/clase21.json','utf8'));
await pg.exec('create schema extensions;create role anon;create role authenticated;');await pg.exec(fs.readFileSync('schema.sql','utf8'));
const key='test-key-never-used-in-production',hash=createHash('sha256').update(key).digest('hex');
await pg.query('insert into nype_dec_sessions(id,config,key_hash) values ($1,$2,$3)',['clase21',config,hash]);
const rpc=async(name,p)=>{const keys=Object.keys(p);const q=await pg.query(`select nype_dec_${name}(${keys.map((k,i)=>k+' => $'+(i+1)).join(',')}) as result`,keys.map(k=>k==='p_raw'?JSON.stringify(p[k]):p[k]));return q.rows[0].result;};
const admin=action=>rpc('admin',{p_session:'clase21',p_key:key,p_action:action});
assert.equal((await rpc('status',{p_session:'clase21'})).open,false);
await assert.rejects(()=>rpc('join',{p_session:'clase21',p_participant:randomUUID(),p_token:'a'.repeat(64)}),/CLOSED/);
await assert.rejects(()=>rpc('admin',{p_session:'clase21',p_key:'wrong',p_action:'open'}),/UNAUTHORIZED/);
await assert.rejects(()=>rpc('admin',{p_session:'clase21',p_key:null,p_action:'open'}),/UNAUTHORIZED/);
await admin('open');
const people=Array.from({length:40},(_,i)=>({p_session:'clase21',p_participant:randomUUID(),p_token:(i+1).toString(16).padStart(64,'0')}));
let states=await Promise.all(people.map(p=>rpc('join',p)));
assert.equal((await admin('snapshot')).participants.length,40);
// Rejoining is idempotent and secrets cannot be omitted.
assert.deepEqual(await rpc('join',people[0]),states[0]);
await assert.rejects(()=>rpc('join',{...people[0],p_token:null}),/UNAUTHORIZED/);
for(const raw of ['1.100','384.403','1.234,5','12.5','$ 50 pesos','no sé','47 días y 2 horas']){
  const result=await pg.query('select _nype_dec_number($1,true) as n',[raw]);assert.equal(result.rows[0].n==null?null:Number(result.rows[0].n),parseNumber(raw,true),raw);
}
let disease={ganancias:0,perdidas:0},lastPayload;
for(let step=0;step<22;step++){
  const payloads=states.map((state,i)=>{
    const s=state.current;assert.equal(s.order,step+1);assert.ok(!('correct' in s)&&!('real' in s));
    if(s.block==='enfermedad')disease[s.condition]++;
    const block=config.blocks.find(b=>b.id===s.block),item=block.items?.find(x=>x.id===s.item)||block.roulette;
    let raw=s.options?.[0].id??String(item?.correct??item?.real??1);
    if(s.kind==='interval')raw={min:String(item.real),max:String(item.real)};
    if(s.kind==='spin')raw=null;
    if(s.kind==='problem'&&i===0)raw='no sé';
    return {...people[i],p_epoch:state.epoch,p_order:s.order,p_raw:raw,p_shown_at:'2026-11-05T12:00:00Z',p_answered_at:'2026-11-05T12:00:05Z',p_event:randomUUID()};
  });
  if(step===0){
    await assert.rejects(()=>rpc('answer',{...payloads[0],p_token:null}),/UNAUTHORIZED/);
    await assert.rejects(()=>rpc('answer',{...payloads[0],p_order:2}),/Orden/);
  }
  states=await Promise.all(payloads.map(p=>rpc('answer',p)));
  if(step===0){
    assert.deepEqual(await rpc('answer',payloads[0]),states[0]);
    await assert.rejects(()=>rpc('answer',{...payloads[0],p_event:randomUUID(),p_raw:'menos'}),/ya fue respondida/);
  }
  lastPayload=payloads[0];
}
assert.deepEqual(disease,{ganancias:20,perdidas:20});
const snapshot=await admin('snapshot'),stats=analyze(config,snapshot.participants,snapshot.answers);
assert.equal(snapshot.answers.length,880);assert.equal(stats.complete,40);assert.equal(stats.coverage[0],5);
for(const p of people){const a=snapshot.answers.filter(r=>r.participant_id===p.p_participant);assert.equal(a.filter(r=>r.kind==='estimate'&&r.condition==='alta').length,2);assert.equal(a.filter(r=>r.kind==='estimate'&&r.condition==='baja').length,2);assert.ok(a.every(r=>r.reaction_time_ms===5000));const spin=a.find(r=>r.kind==='spin').parsed.value;assert.ok(Number.isInteger(spin)&&spin>=0&&spin<=100);assert.equal(a.find(r=>r.condition==='ruleta'&&r.kind==='estimate').anchor,spin);}
assert.ok(snapshot.answers.filter(r=>r.participant_id===people[0].p_participant&&r.kind==='problem').every(r=>r.parsed.classification==='otra'));
await pg.exec('set role anon');
for(const name of ['nype_dec_sessions','nype_dec_participants','nype_dec_answers'])await assert.rejects(()=>pg.query('select * from '+name),/permission denied/);
await assert.rejects(()=>pg.query("select _nype_dec_number('1',false)"),/permission denied/);
assert.equal((await rpc('status',{p_session:'clase21'})).open,true);
await pg.exec('reset role');
await admin('close');await assert.rejects(()=>rpc('answer',lastPayload),/CLOSED/);
await admin('clear');const cleared=await admin('snapshot');assert.equal(cleared.epoch,2);assert.equal(cleared.open,false);assert.equal(cleared.answers.length,0);assert.equal(cleared.participants.length,0);
await admin('open');await assert.rejects(()=>rpc('answer',lastPayload),/RESET/);
console.log('PASS · SQL migration, 40 concurrent callers, 880 answers, balance 20/20, persistence, idempotency, no backtracking, timing, RLS, key validation, close and session reset.');
await pg.close();
