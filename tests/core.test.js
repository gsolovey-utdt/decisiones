import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {makePlan,parseNumber,interpret,analyze,spearman,regression,ranks,csv,validateConfig} from '../core.js';
import {simulate} from '../demo.js';
const config=JSON.parse(fs.readFileSync(new URL('../config/clase21.json',import.meta.url)));
test('Diseño: dos altas y dos bajas, comparaciones antes de estimar, ruleta al final y bloques fijos',()=>{
  const combos=new Set(),orders=new Set();
  for(let j=0;j<1000;j++){
    const p=makePlan(config),anchors=p.filter(s=>s.kind==='estimate'&&s.condition!=='ruleta');
    assert.equal(p.length,22);assert.equal(anchors.filter(s=>s.condition==='alta').length,2);assert.equal(anchors.filter(s=>s.condition==='baja').length,2);
    assert.deepEqual([...new Set(p.map(s=>s.block))],config.blocks.map(b=>b.id));
    for(let i=0;i<8;i+=2){assert.equal(p[i].kind,'compare');assert.equal(p[i+1].kind,'estimate');assert.equal(p[i].item,p[i+1].item);assert.equal(p[i].anchor,p[i+1].anchor);}
    assert.equal(p[8].kind,'spin');assert.equal(p[9].item,'piano');assert.equal(p[10].item,'piano');assert.equal(p.at(-1).item,'lago');
    combos.add(anchors.filter(s=>s.condition==='alta').map(s=>s.item).sort().join(','));orders.add(anchors.map(s=>s.item).join(','));
    assert.deepEqual(p.find(s=>s.block==='enfermedad').options.map(o=>o.id),['segura','riesgosa']);
  }
  assert.equal(combos.size,6);assert.equal(orders.size,24);
});
test('Números rioplatenses y primer número de respuestas libres',()=>{
  for(const [raw,n] of [['1.100',1100],['384.403',384403],['1.234.567',1234567],['1.234,5',1234.5],['12.5',12.5],['12,5',12.5],[' 1 100 ',1100],['0',0],['$ 50 pesos',50],['unos 5 min',5],['47 días y 2 horas',47]])assert.equal(parseNumber(raw,true),n,raw);
  for(const raw of ['','no sé','1,2,3','1.2.3','Infinity','1e999'])assert.equal(parseNumber(raw),null,raw);
  assert.equal(parseNumber('no sé',true),null);assert.equal(parseNumber('12,5'),12.5);
});
test('Intervalos inclusivos, valores cero, validación y clasificación',()=>{
  const p=makePlan(config),interval=p.find(s=>s.kind==='interval'),problem=p.find(s=>s.kind==='problem');
  assert.deepEqual(interpret(interval,{min:'0',max:'1901'},config),{min:0,max:1901});
  assert.throws(()=>interpret(interval,{min:'10',max:'9'},config));
  assert.equal(interpret(problem,'$ 50 pesos',config).classification,'correcta');
  assert.equal(interpret(problem,'100',config).classification,'intuitiva');
  assert.equal(interpret(problem,'no sé',config).classification,'otra');
  assert.throws(()=>interpret(p[0],'otra',config));
});
test('Estadísticas: Spearman con empates, constante y regresión conocida',()=>{
  assert.deepEqual(ranks([2,1,2,9]),[2.5,1,2.5,4]);assert.equal(spearman([1,2,3],[3,2,1]),-1);
  assert.equal(spearman([1,1,1],[1,2,3]),null);assert.equal(spearman([1,2],[1,2]),null);
  assert.deepEqual(regression([{x:1,y:3},{x:2,y:5},{x:3,y:7}]),{slope:2,intercept:1});
});
test('Demo reproducible: 40 completos, 880 pantallas, grupos de enfermedad balanceados y efecto de anclaje',()=>{
  const d=simulate(config),a=analyze(config,d.participants,d.answers);
  assert.deepEqual(d,simulate(config));assert.equal(d.participants.length,40);assert.equal(d.answers.length,880);assert.equal(a.complete,40);
  assert.equal(a.indices.length,40);assert.ok(a.indices.filter(n=>n>0).length>=36);
  assert.equal(d.answers.filter(r=>r.block==='enfermedad'&&r.condition==='ganancias').length,20);
  for(const b of config.blocks)assert.equal(a.blocks[b.id].completed,40);
  assert.equal(a.scores.length,40);assert.equal(a.coverage.length,40);assert.equal(a.roulette.length,40);
});
test('Índice excluye ceros y no usa participantes incompletos',()=>{
  const d=simulate(config,2);d.answers.find(a=>a.participant_id==='demo-1'&&a.kind==='estimate').parsed.value=0;
  d.answers=d.answers.filter(a=>!(a.participant_id==='demo-2'&&a.item==='gandhi'&&a.kind==='estimate'));
  const a=analyze(config,d.participants,d.answers);assert.equal(a.indices.length,0);assert.equal(a.indexExcluded,1);
});
test('Panel cuenta como empezado el bloque que se está leyendo, aunque no tenga respuestas',()=>{
  const a=analyze(config,[{participant_id:'x',current_block:'anclaje'}],[]);assert.equal(a.blocks.anclaje.started,1);assert.equal(a.blocks.anclaje.completed,0);
});
test('CSV: texto original, tiempos, asignaciones, orden de opciones y protección de fórmulas',()=>{
  const d=simulate(config,1),row=d.answers.find(a=>a.kind==='problem');row.raw='=1+1';
  const out=csv([row],'clase21');assert.ok(out.startsWith('\ufeff'));assert.ok(out.includes("'=1+1"));
  for(const col of ['option_order','shown_at','answered_at','reaction_time_ms','condition','anchor','classification'])assert.ok(out.includes(col));
});
test('Nueva sesión e ítems se cargan por configuración; tipos futuros se rechazan explícitamente',()=>{
  const c=structuredClone(config);c.id='clase22';c.blocks[0].items[0].id='nuevo';c.blocks[0].items[0].prompt='Otra pregunta';
  assert.equal(validateConfig(c),c);assert.ok(makePlan(c).some(s=>s.item==='nuevo'));c.blocks.push({id:'futuro',type:'default'});assert.throws(()=>validateConfig(c));
});
