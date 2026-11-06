// Presentation only: reads existing, anonymous results. No storage or backend calls.
import {escape as e,fmt,median} from './core.js?v=2';
import {compareGroups} from './charts.js?v=2';

const money=value=>value==null?'—':`$${fmt(value,2)}`;
export function ownershipSummary(group){
  const buyers=group.rows.filter(r=>r.condition==='compra');
  const sellers=group.rows.filter(r=>r.condition==='venta');
  const buy=median(buyers.map(r=>r.parsed.value)),sell=median(sellers.map(r=>r.parsed.value));
  let comparison;
  if(buy==null||sell==null)comparison='La comparación aparece cuando haya respuestas en los dos grupos.';
  else if(buy===sell)comparison='Las medianas de venta y compra <strong>coinciden</strong>.';
  else if(buy===0)comparison='La mediana de compra es <strong>$0</strong>; el cociente venta/compra no está definido.';
  else if(sell===0)comparison='La mediana para vender es <strong>$0</strong>.';
  else comparison=`La mediana para vender equivale a <strong>${(sell/buy).toLocaleString('es-AR',{maximumSignificantDigits:3})} veces</strong> la mediana para comprar.`;
  return {buyers,sellers,buy,sell,comparison};
}

export function ownershipOverviewCard(group,detailURL){
  const {buyers,sellers,buy,sell,comparison}=ownershipSummary(group),item=group.item;
  return `<article class="facet-card ownership-overview-card">
    <img class="result-product" src="${e(item.image)}" alt="${e(item.imageAlt)}">
    <h2>${e(item.label)}</h2>
    <div class="ownership-overview-prices">
      <div class="ownership-sell"><span>Lo venderían por</span><strong>${money(sell)}</strong><small>mediana · n = ${sellers.length}</small></div>
      <div class="ownership-buy"><span>Pagarían</span><strong>${money(buy)}</strong><small>mediana · n = ${buyers.length}</small></div>
    </div>
    ${compareGroups(group.rows,{domain:item.domain,conditions:['venta','compra'],labels:['Venderían','Pagarían']})}
    <p class="ownership-card-comparison">${comparison}</p>
    <a class="ownership-expand" href="${e(detailURL)}">Ampliar ${e(item.label.toLocaleLowerCase('es-AR'))} <span aria-hidden="true">↗</span></a>
  </article>`;
}

export function ownershipDetail(group){
  const {buyers,sellers,buy,sell,comparison}=ownershipSummary(group);
  return `<div class="ownership-detail">
    <div class="ownership-headlines">
      <section class="ownership-stat ownership-sell"><p class="ownership-eyebrow">LES TOCÓ «ES TUYO»</p><h2>Lo venderían por</h2><strong class="ownership-price">${money(sell)}</strong><p class="ownership-stat-n">mediana · n = ${sellers.length}</p></section>
      <section class="ownership-stat ownership-buy"><p class="ownership-eyebrow">LES TOCÓ «NO ES TUYO»</p><h2>Pagarían</h2><strong class="ownership-price">${money(buy)}</strong><p class="ownership-stat-n">mediana · n = ${buyers.length}</p></section>
    </div>
    <p class="ownership-comparison">${comparison}</p>
    <section class="ownership-person-plot"><h2>Cada punto es una persona</h2><p>Lo que pidieron para vender y lo que ofrecieron para comprar. La línea gruesa marca la mediana de cada grupo.</p>${ownershipDotplot(group.rows,group.item.domain)}</section>
    <p class="ownership-context">Mismo objeto y foto; roles asignados al azar. Respuestas hipotéticas en pesos argentinos. Las medianas incluyen todos los valores.</p>
  </div>`;
}

export function ownershipDotplot(rows,domain){
  const width=1100,height=205,left=180,right=75,top=25,bottom=165;
  const [min,max]=domain,x=value=>left+(value-min)/(max-min)*(width-left-right);
  let body='';
  for(let i=0;i<=4;i++){
    const value=min+(max-min)*i/4,px=x(value);
    body+=`<line x1="${px}" x2="${px}" y1="${top}" y2="${bottom}" class="ownership-gridline"/><text x="${px}" y="195" text-anchor="middle" class="ownership-axis">${e(money(value))}</text>`;
  }
  for(const [condition,label,y] of [['venta','Lo venderían',55],['compra','Pagarían',130]]){
    const group=rows.filter(r=>r.condition===condition),inside=group.filter(r=>r.parsed.value>=min&&r.parsed.value<=max),outside=group.length-inside.length;
    const med=median(group.map(r=>r.parsed.value)),color=condition==='venta'?'ownership-sell':'ownership-buy';
    body+=`<g class="${color}"><text x="${left-18}" y="${y+7}" text-anchor="end" class="ownership-row-label">${e(label)}</text>`;
    if(outside)body+=`<text x="${left-18}" y="${y+30}" text-anchor="end" class="ownership-outside">+${outside} fuera de escala</text>`;
    inside.sort((a,b)=>a.parsed.value-b.parsed.value).forEach((row,index)=>{
      body+=`<circle cx="${x(row.parsed.value)}" cy="${y+((index*3)%7-3)*4}" r="6" class="ownership-person"><title>${e(money(row.parsed.value))}</title></circle>`;
    });
    if(med!=null){
      const px=Math.max(left,Math.min(width-right,x(med))),anchor=px>width-right-100?'end':px<left+100?'start':'middle';
      body+=`<line x1="${px}" x2="${px}" y1="${y-20}" y2="${y+20}" class="ownership-median"/><text x="${px}" y="${y-28}" text-anchor="${anchor}" class="ownership-median-label">${e(money(med))}${med<min||med>max?' *':''}</text>`;
    }
    body+='</g>';
  }
  const clippedMedian=['venta','compra'].some(c=>{const m=median(rows.filter(r=>r.condition===c).map(r=>r.parsed.value));return m!=null&&(m<min||m>max);});
  return `<svg viewBox="0 0 ${width} ${height}" class="ownership-dotplot" role="img" aria-label="Precios individuales y medianas para vender y comprar">${body}</svg>${clippedMedian?'<p class="ownership-clipped-median">* Mediana fuera del rango visible; incluye todas las respuestas.</p>':''}`;
}
