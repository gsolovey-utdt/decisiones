// Runs the actual PostgreSQL functions locally; no cloud writes.
import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';import path from 'node:path';import {parseNumber,analyze} from '../core.js';
const modulePath=process.env.PGLITE_MODULE||path.resolve('.qa/package/dist/index.js');
const {PGlite}=await import(pathToFileURL(modulePath));const {pgcrypto}=await import(pathToFileURL(path.join(path.dirname(modulePath),'contrib/pgcrypto.js')));
const pg=new PGlite({extensions:{pgcrypto}}),config=JSON.parse(fs.readFileSync('config/clase21.json','utf8')),legacy=JSON.parse(fs.readFileSync('config/clase21-v1.json','utf8'));
await pg.exec('create schema extensions;create role anon;create role authenticated;');await pg.exec(fs.readFileSync('schema.sql','utf8'));
const key='local-test-key',hash=createHash('sha256').update(key).digest('hex');
await pg.query('insert into nype_dec_sessions(id,config,key_hash) values ($1,$2,$3)',['clase21',{...legacy,id:'clase21'},hash]);
const rpc=async(name,p)=>{const keys=Object.keys(p),q=await pg.query(`select nype_dec_${name}(${keys.map((k,i)=>k+' => $'+(i+1)).join(',')}) as result`,keys.map(k=>k==='p_raw'?JSON.stringify(p[k]):p[k]));return q.rows[0].result;};
const admin=(action,s='clase21')=>rpc('admin',{p_session:s,p_key:key,p_action:action});
const rawFor=(s,c)=>{const b=c.blocks.find(b=>b.id===s.block),i=b.items?.find(i=>i.id===s.item)||b.roulette;if(s.kind==='spin')return null;if(s.options)return s.options[0].id;if(s.kind==='interval')return {min:String(i.real),max:String(i.real)};return String(i.correct??i.real??50000);};
const answer=(person,state,c,overrides={})=>({...person,p_epoch:state.epoch,p_order:state.current.order,p_raw:rawFor(state.current,c),p_shown_at:'2026-11-06T12:00:00Z',p_answered_at:'2026-11-06T12:00:05Z',p_event:randomUUID(),...overrides});
await admin('open');const oldPerson={p_session:'clase21',p_participant:randomUUID(),p_token:'f'.repeat(64)};let oldState=await rpc('join',oldPerson),oldPayload;
while(oldState.current){oldPayload=answer(oldPerson,oldState,legacy);oldState=await rpc('answer',oldPayload);}
const oldSnapshot=await admin('snapshot');assert.equal(oldSnapshot.answers.length,22);
await pg.exec(fs.readFileSync('migrations/20261106_entre_grupos.sql','utf8'));await pg.exec(fs.readFileSync('migrations/20261106_entre_grupos.sql','utf8'));
const archive=await admin('snapshot','clase21-v1'),fresh=await admin('snapshot');
assert.equal(archive.open,false);assert.deepEqual(archive.answers,oldSnapshot.answers);assert.equal(archive.participants[0].completed_at,oldSnapshot.participants[0].completed_at);
assert.equal(fresh.answers.length,0);assert.equal(fresh.epoch,2);assert.equal(fresh.open,true);assert.equal(fresh.config.designVersion,2);
await assert.rejects(()=>rpc('answer',oldPayload),/RESET/);
await admin('close');await assert.rejects(()=>rpc('join',{p_session:'clase21',p_participant:randomUUID(),p_token:'a'.repeat(64)}),/CLOSED/);
await assert.rejects(()=>rpc('admin',{p_session:'clase21',p_key:'wrong',p_action:'open'}),/UNAUTHORIZED/);
await assert.rejects(()=>rpc('admin',{p_session:'clase21',p_key:null,p_action:'open'}),/UNAUTHORIZED/);await admin('open');
const people=Array.from({length:40},(_,i)=>({p_session:'clase21',p_participant:randomUUID(),p_token:(i+1).toString(16).padStart(64,'0')}));
let states=await Promise.all(people.map(p=>rpc('join',p))),snapshot=await admin('snapshot');
assert.equal(snapshot.participants.length,40);for(const cell of config.design.cells)assert.equal(snapshot.participants.filter(p=>p.assignment.cell===cell).length,10);
// Every prefix of a four-person block is approximately balanced.
for(let n=1;n<=40;n++){const counts=config.design.cells.map(cell=>snapshot.participants.slice(0,n).filter(p=>p.assignment.cell===cell).length);assert.ok(Math.max(...counts)-Math.min(...counts)<=1);}
assert.deepEqual(await rpc('join',people[0]),states[0]);await assert.rejects(()=>rpc('join',{...people[0],p_token:null}),/UNAUTHORIZED/);
for(const raw of ['1.100','384.403','1.234,5','12.5','$ 50 pesos','no sé']){const r=await pg.query('select _nype_dec_number($1,true) as n',[raw]);assert.equal(r.rows[0].n==null?null:Number(r.rows[0].n),parseNumber(raw,true));}
let lastPayload;
for(let step=0;step<19;step++){
 const payloads=states.map((state,i)=>{const s=state.current;assert.equal(s.order,step+1);assert.ok(!('real' in s)&&!('correct' in s));if(step>=16)assert.equal(s.item,['maquinas','lago','pelota'][step-16]);if(s.kind==='valuation')assert.ok(s.image.startsWith('assets/'));return answer(people[i],state,config,s.kind==='problem'&&i===0?{p_raw:'no sé'}:{});});
 if(step===0){await assert.rejects(()=>rpc('answer',{...payloads[0],p_token:null}),/UNAUTHORIZED/);await assert.rejects(()=>rpc('answer',{...payloads[0],p_epoch:null}),/RESET/);await assert.rejects(()=>rpc('answer',{...payloads[0],p_order:2}),/Orden/);}
 if(states[0].current.kind==='valuation')await assert.rejects(()=>rpc('answer',{...payloads[0],p_raw:'-1'}),/inválida/);
 states=await Promise.all(payloads.map(p=>rpc('answer',p)));
 if(step===0){assert.deepEqual(await rpc('answer',payloads[0]),states[0]);await assert.rejects(()=>rpc('answer',{...payloads[0],p_event:randomUUID()}),/ya fue respondida/);}
 lastPayload=payloads[0];
}
snapshot=await admin('snapshot');const stats=analyze(config,snapshot.participants,snapshot.answers);assert.equal(snapshot.answers.length,760);assert.equal(stats.complete,40);assert.equal(stats.anchorScores.length,40);assert.equal(stats.endowment.length,3);
assert.equal(snapshot.answers.filter(a=>a.block==='enfermedad'&&a.condition==='ganancias').length,20);
for(const p of snapshot.participants){const rows=snapshot.answers.filter(r=>r.participant_id===p.participant_id);assert.ok(rows.every(r=>r.reaction_time_ms===5000&&r.design_version===2));assert.ok(rows.filter(r=>r.kind==='estimate'&&r.condition!=='ruleta').every(r=>r.condition===p.assignment.anchorGroup));assert.ok(rows.filter(r=>r.kind==='valuation').every(r=>r.condition===p.assignment.ownershipGroup));const spin=rows.find(r=>r.kind==='spin').parsed.value;assert.ok(Number.isInteger(spin)&&spin>=0&&spin<=100);assert.equal(rows.find(r=>r.condition==='ruleta'&&r.kind==='estimate').anchor,spin);}
await pg.exec('set role anon');for(const name of ['nype_dec_sessions','nype_dec_participants','nype_dec_answers'])await assert.rejects(()=>pg.query('select * from '+name),/permission denied/);await assert.rejects(()=>pg.query("select _nype_dec_plan('{}','ganancias','{}')"),/permission denied/);await pg.exec('reset role');
await admin('clear');assert.equal((await admin('snapshot')).answers.length,0);assert.equal((await admin('snapshot','clase21-v1')).answers.length,22);await admin('open');await assert.rejects(()=>rpc('answer',lastPayload),/RESET/);
console.log('PASS: archive preserved, migration repeatable, 40 participants / 760 responses, four cells of 10, stable between assignments, 20/20 framing, 19-screen order, photos, timing, idempotency, RLS and reset.');await pg.close();
