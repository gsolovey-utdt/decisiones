import test from 'node:test';
import assert from 'node:assert/strict';
import {ownershipSummary,ownershipDetail,ownershipDotplot} from '../ownership-view.js';

const group=(buy=[],sell=[])=>({item:{label:'Lentes',domain:[0,300000]},rows:[...buy.map(value=>({condition:'compra',parsed:{value}})),...sell.map(value=>({condition:'venta',parsed:{value}}))]});

test('La frase compara medianas, no promedios, y se adapta a la dirección del resultado',()=>{
  const g=group([25000,25000,300000],[150000,150000,0]);
  assert.equal(ownershipSummary(g).buy,25000);
  assert.equal(ownershipSummary(g).sell,150000);
  assert.match(ownershipSummary(g).comparison,/6 veces/);
  assert.match(ownershipSummary(group([100],[50])).comparison,/0,5 veces/);
  assert.match(ownershipSummary(group([100],[100])).comparison,/coinciden/);
});

test('Sin grupos completos, o con mediana cero, no se inventan cocientes',()=>{
  assert.match(ownershipSummary(group()).comparison,/cuando haya respuestas/);
  assert.match(ownershipSummary(group([100])).comparison,/cuando haya respuestas/);
  assert.match(ownershipSummary(group([0],[100])).comparison,/no está definido/);
  assert.match(ownershipSummary(group([0],[0])).comparison,/coinciden/);
  assert.match(ownershipSummary(group([100],[0])).comparison,/\$0/);
  assert.match(ownershipSummary(group([100000],[1])).comparison,/0,00001 veces/);
});

test('El gráfico cuenta los extremos sin alterar la mediana y dibuja cada respuesta visible',()=>{
  const g=group([25000,25000],[150000,150000,10000000]);
  const svg=ownershipDotplot(g.rows,g.item.domain);
  assert.equal((svg.match(/class="ownership-person"/g)||[]).length,4);
  assert.match(svg,/\+1 fuera de escala/);
  assert.match(svg,/\$150.000/);
  assert.equal(ownershipSummary(g).sellers.length,3);
  assert.match(ownershipDotplot(group([],[10000000]).rows,g.item.domain),/Mediana fuera del rango visible/);
});

test('La vista explica qué se está viendo sin afirmar un resultado causal o un efecto obligatorio',()=>{
  const html=ownershipDetail(group([25000],[150000]));
  assert.match(html,/Cada punto es una persona/);
  assert.match(html,/mediana · n = 1/);
  assert.match(html,/Respuestas hipotéticas/);
  assert.doesNotMatch(html,/resultado clásico|alrededor del doble|no se explica por gustos/i);
});
