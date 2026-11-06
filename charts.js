import {escape as e,fmt,median,histogram,regression} from './core.js';
export const COLORS={baja:'#5b8dee',alta:'#e8c547',compra:'#5b8dee',venta:'#e8c547',correcta:'#7ed6a1',intuitiva:'#e8c547',otra:'#9aa3bd'};
const W=1000,H=390,L=90,R=55,T=38,B=65;
const svg=body=>`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${body}</svg>`;
const text=(x,y,s,extra='')=>`<text x="${x}" y="${y}" ${extra}>${e(s)}</text>`;
const line=(x,y,x2,y2,color='#41465a',extra='')=>`<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${color}" ${extra}/>`;
function axes(xmin,xmax,ymax=100,ylabel='n'){
  if(ylabel==='n')ymax=Math.max(4,Math.ceil(ymax/4)*4);
  const x=v=>L+(v-xmin)/(xmax-xmin)*(W-L-R),y=v=>H-B-v/(ymax||1)*(H-T-B);let out='';
  for(let i=0;i<=4;i++){const v=i*(ymax||1)/4;out+=line(L,y(v),W-R,y(v),'#2a2d3e')+text(L-15,y(v)+7,fmt(v), 'text-anchor="end"');}
  for(let i=0;i<=4;i++){const v=xmin+i*(xmax-xmin)/4;out+=text(x(v),H-B+35,fmt(v),'text-anchor="middle"');}
  out+=text(18,25,ylabel);return {x,y,out};
}
export function discrete(values,labels,{reference=null,xlabel=''}={}){
  const counts=labels.map((_,i)=>values.filter(v=>v===i).length),max=Math.max(1,...counts),n=values.length;
  const {x,y,out}=axes(-.5,labels.length-.5,max);let b=out;
  // Cover numeric x ticks; category labels are more useful here.
  b+=`<rect x="${L-20}" y="${H-B+9}" width="${W-L-R+40}" height="50" fill="#161820"/>`;
  counts.forEach((v,i)=>{const width=(W-L-R)/labels.length*.65;b+=`<rect x="${x(i)-width/2}" y="${y(v)}" width="${width}" height="${H-B-y(v)}" rx="5" fill="#e8c547"/>`+text(x(i),y(v)-10,String(v),'text-anchor="middle"')+text(x(i),H-B+35,labels[i],'text-anchor="middle"');});
  if(reference!=null)b+=line(x(reference),T,x(reference),H-B,'#7ed6a1','stroke-width="3" stroke-dasharray="7 5"')+text(x(reference)-8,T-10,fmt(reference),'text-anchor="end" fill="#7ed6a1"');
  return `<div class="chart-label">${e(xlabel)} · n = ${n}</div>`+svg(b);
}
export function continuous(values,{domain,bins=12,reference=null,xlabel=''}={}){
  const h=histogram(values,bins,domain);if(!h.bins.length)return '<p class="empty">Todavía no hay datos suficientes.</p>';
  const {x,y,out}=axes(h.min,h.max,Math.max(1,...h.bins.map(b=>b.n)));let b=out;
  for(const bin of h.bins)b+=`<rect x="${x(bin.x)+2}" y="${y(bin.n)}" width="${(W-L-R)/bins-4}" height="${H-B-y(bin.n)}" fill="#e8c547" rx="3"/>`;
  if(reference!=null)b+=line(x(reference),T,x(reference),H-B,'#7ed6a1','stroke-width="3" stroke-dasharray="7 5"');
  return `<div class="chart-label">${e(xlabel)} · n = ${values.length}${h.outside?` · ${h.outside} fuera de escala`:''}</div>`+svg(b);
}
export function strip(item,rows,reveal){
  const [min,max]=item.domain,x=v=>L+(v-min)/(max-min)*(W-L-R);let b='';
  ['baja','alta'].forEach((cond,j)=>{const yy=105+j*155,group=rows.filter(a=>a.condition===cond),inside=group.filter(a=>a.parsed.value>=min&&a.parsed.value<=max),outside=group.length-inside.length,med=median(group.map(a=>a.parsed.value)),color=COLORS[cond];
    b+=text(L,yy-45,`Ancla ${cond} · ${fmt(item[cond==='alta'?'high':'low'])} · n = ${group.length}${outside?` · +${outside} fuera de escala`:''}`,`fill="${color}"`)+line(L,yy,W-R,yy,'#363b4d');
    inside.sort((a,b)=>a.parsed.value-b.parsed.value).forEach((r,k)=>{const jitter=((k*37)%7-3)*7;b+=`<circle cx="${x(r.parsed.value)}" cy="${yy+jitter}" r="6.5" fill="${color}" opacity=".8"/>`;});
    const anchor=item[cond==='alta'?'high':'low'];b+=line(x(anchor),yy-32,x(anchor),yy+32,color,'stroke-width="3" stroke-dasharray="5 4"');
    if(med!=null){const pos=Math.max(L,Math.min(W-R,x(med)));b+=line(pos,yy-34,pos,yy+34,'#fff','stroke-width="4"')+text(pos,yy+58,`Med. ${fmt(med)}`,`text-anchor="middle" fill="#fff"`);}
  });
  for(let k=0;k<=4;k++){const val=min+k*(max-min)/4;b+=text(x(val),H-12,fmt(val),'text-anchor="middle"');}
  if(reveal)b+=line(x(item.real),T,x(item.real),H-B,'#7ed6a1','stroke-width="3"')+text(x(item.real)+8,25,`Real: ${fmt(item.real)}`,'fill="#7ed6a1"');
  return svg(b)+`<p class="chart-note">${e(item.unit)} · punteada: ancla · blanca: mediana (incluye valores fuera de escala)</p>`;
}
export function scatter(points,reveal,real=88){
  const ymax=200,visible=points.filter(p=>p.y>=0&&p.y<=ymax),{x,y,out}=axes(0,100,ymax,'Estimación');let b=out;
  for(const p of visible)b+=`<circle cx="${x(p.x)}" cy="${y(p.y)}" r="7" fill="#e8c547" opacity=".65"/>`;
  const fit=regression(points);
  b+=`<defs><clipPath id="plot-clip"><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}"/></clipPath></defs>`;
  if(fit)b+=line(x(0),y(fit.intercept),x(100),y(fit.intercept+100*fit.slope),'#5b8dee','stroke-width="3" clip-path="url(#plot-clip)"');
  if(reveal)b+=line(L,y(real),W-R,y(real),'#7ed6a1','stroke-width="3" stroke-dasharray="7 4"')+text(W-R-5,y(real)-10,`${real} teclas`,'text-anchor="end" fill="#7ed6a1"');
  return svg(b)+`<p class="chart-note">Número de la ruleta → · n = ${points.length}${points.length!==visible.length?` · +${points.length-visible.length} fuera de escala`:''} · regresión y correlación incluyen todos los valores.</p>`;
}
export function stacked(counts,n,labels=Object.keys(counts)){
  return `<div class="stacked">${Object.entries(counts).filter(([,v])=>v).map(([k,v],i)=>`<div style="width:${100*v/n}%;background:${COLORS[k]||[COLORS.baja,COLORS.alta][i%2]}" title="${e(k)}: ${v}">${100*v/n>=9?fmt(100*v/n,0)+' %':''}</div>`).join('')}</div><div class="stack-legend">${Object.entries(counts).map(([k,v],i)=>`<span><i style="background:${COLORS[k]||[COLORS.baja,COLORS.alta][i%2]}"></i>${e(labels[i]||k)}: ${fmt(n?100*v/n:0)} % (${v})</span>`).join('')}</div>`;
}

// Small multiples: each object has its own units, keeping all individual responses.
export function compareGroups(rows,{domain,conditions=['baja','alta'],labels=['Baja','Alta'],anchors,truth,reveal=false}={}){
  const [min,max]=domain,x=v=>145+(v-min)/(max-min)*410;let out='';
  conditions.forEach((condition,j)=>{
    const y=40+j*65,group=rows.filter(r=>r.condition===condition),visible=group.filter(r=>r.parsed.value>=min&&r.parsed.value<=max),outside=group.length-visible.length,med=median(group.map(r=>r.parsed.value)),color=COLORS[condition];
    out+=`<text x="4" y="${y-10}" fill="${color}" font-size="25">${e(labels[j])}</text><text x="4" y="${y+20}" font-size="20">n=${group.length}${outside?` · +${outside} fuera`:''}</text>`;
    out+=line(145,y,555,y,'#363b4d');
    visible.sort((a,b)=>a.parsed.value-b.parsed.value).forEach((r,k)=>{out+=`<circle cx="${x(r.parsed.value)}" cy="${y+((k*3)%7-3)*4}" r="5.8" fill="${color}" opacity=".72"/>`;});
    if(anchors?.[j]!=null)out+=line(x(anchors[j]),y-24,x(anchors[j]),y+24,color,'stroke-width="2" stroke-dasharray="5 4"');
    if(med!=null){const pos=Math.max(145,Math.min(555,x(med)));out+=line(pos,y-22,pos,y+22,'#fff','stroke-width="4"');}
  });
  for(let k=0;k<=2;k++){const v=min+(max-min)*k/2;out+=`<text x="${x(v)}" y="157" text-anchor="middle" font-size="22">${e(fmt(v))}</text>`;}
  if(reveal&&truth!=null)out+=line(x(truth),15,x(truth),130,'#7ed6a1','stroke-width="3" stroke-dasharray="6 4"');
  return `<svg class="facet-chart" viewBox="0 0 600 170" role="img" aria-label="${e(labels[0])} y ${e(labels[1])}: puntos individuales y medianas">${out}</svg>`;
}
