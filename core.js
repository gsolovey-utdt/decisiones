// Shared, DOM-free experiment and analysis functions. No dependencies.
export const fmt = (n, digits = 1) => n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('es-AR', {maximumFractionDigits: digits});
export const mean = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
export const median = a => { const b=a.filter(Number.isFinite).sort((x,y)=>x-y), n=b.length; return n ? (b[(n-1)>>1]+b[n>>1])/2 : null; };
export const pct = (n,d) => d ? 100*n/d : null;
export const escape = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function shuffle(a, rng=Math.random) { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(rng()*(i+1)); [b[i],b[j]]=[b[j],b[i]];} return b; }
export function uniformInt(max=101) { const a=new Uint32Array(1), bound=Math.floor(4294967296/max)*max; do{crypto.getRandomValues(a);}while(a[0]>=bound); return a[0]%max; }
export function parseNumber(raw, free=false) {
  let s=String(raw).trim().replace(/\s/g,'');
  if(free){const m=s.match(/[+-]?\d+(?:[.,]\d+)*/); if(!m)return null; s=m[0];}
  if(!/^[+-]?\d+(?:[.,]\d+)*$/.test(s))return null;
  if(s.includes(',')) { if((s.match(/,/g)||[]).length!==1)return null; s=s.replace(/\./g,'').replace(',','.'); }
  else if(/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  if(!/^[+-]?\d+(?:\.\d+)?$/.test(s))return null;
  const n=Number(s); return Number.isFinite(n)&&Math.abs(n)<=1e15 ? n : null;
}
export function validateConfig(c) {
  if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(c.id)||!c.intro||!c.blocks?.length)throw Error('Configuración de sesión inválida.');
  const ids=new Set();
  for(const b of c.blocks){
    if(ids.has(b.id))throw Error('Bloque repetido.'); ids.add(b.id);
    if(!['anchors','choice','framing','intervals','decile','problems','endowment'].includes(b.type))throw Error('Tipo de bloque no implementado.');
    if(b.type==='anchors'&&b.design!=='between'&&(b.items.length%2||b.items.length<2))throw Error('Usá una cantidad par de ítems.');
    if(b.type==='endowment'&&b.items.some(i=>!i.image||!i.prompts?.compra||!i.prompts?.venta))throw Error('Falta foto o consigna en un objeto.');
    const itemIds=new Set();for(const item of b.items||[]){if(itemIds.has(item.id)||!item.id||(!item.prompt&&b.type!=='endowment'))throw Error('Ítem inválido o repetido.');itemIds.add(item.id);}
  }
  return c;
}
export function makePlan(c, {high, frame='ganancias', anchorGroup, ownershipGroup, rng=Math.random}={}) {
  anchorGroup??=rng()<.5?'baja':'alta';ownershipGroup??=rng()<.5?'compra':'venta';
  const screens=[];
  const add=(b,item,s)=>screens.push({block:b.id,item,...s,order:screens.length+1});
  for(const b of c.blocks){
    if(b.type==='anchors'){
      const hi=high||shuffle(b.items.map(i=>i.id),rng).slice(0,b.items.length/2);
      for(const i of shuffle(b.items,rng)){
        const condition=b.design==='between'?anchorGroup:hi.includes(i.id)?'alta':'baja',anchor=condition==='alta'?i.high:i.low;
        const meta={condition,anchor,unit:i.unit};
        add(b,i.id,{...meta,kind:'compare',prompt:i.compare.replace('{A}',fmt(anchor,6)),options:[{id:'mas',text:'Más'},{id:'menos',text:'Menos'}]});
        add(b,i.id,{...meta,kind:'estimate',prompt:i.prompt,subtitle:'¿Cuál es tu mejor estimación?'});
      }
      if(b.roulette){const i=b.roulette; add(b,i.id,{kind:'spin',prompt:'Girá la ruleta',condition:'ruleta'});
        add(b,i.id,{kind:'compare',prompt:i.compare,condition:'ruleta',options:[{id:'mas',text:'Más'},{id:'menos',text:'Menos'}]});
        add(b,i.id,{kind:'estimate',prompt:i.prompt,condition:'ruleta',unit:i.unit});}
    } else if(b.type==='endowment'){
      for(const i of (b.shuffle?shuffle(b.items,rng):b.items))add(b,i.id,{kind:'valuation',condition:ownershipGroup,prompt:i.prompts[ownershipGroup],text:i.description,instruction:b.instruction,unit:b.unit,image:i.image,imageAlt:i.imageAlt});
    } else if(b.type==='choice')add(b,b.idItem,{kind:'choice',text:b.text,prompt:b.prompt,options:b.shuffle?shuffle(b.options,rng):b.options});
    else if(b.type==='framing')add(b,b.idItem,{kind:'choice',condition:frame,text:b.text,prompt:b.prompt,options:b.versions[frame]});
    else if(b.type==='intervals')for(const i of b.items)add(b,i.id,{kind:'interval',prompt:i.prompt,instruction:b.instruction,unit:i.unit});
    else if(b.type==='decile')add(b,b.idItem,{kind:'choice',prompt:b.prompt,options:Array.from({length:10},(_,k)=>({id:String(k+1),text:k===0?'1 · el 10 % de notas más altas':k===9?'10 · el 10 % de notas más bajas':`${k+1} · decil ${k+1}`}))});
    else if(b.type==='problems')for(const i of b.items)add(b,i.id,{kind:'problem',prompt:i.prompt,unit:i.unit});
  }
  return screens;
}
export function interpret(screen, raw, config) {
  if(['choice','compare'].includes(screen.kind)){
    const option=screen.options.find(o=>o.id===raw); if(!option)throw Error('Elegí una opción.');
    return {value:screen.block==='decil'?Number(raw):raw};
  }
  if(screen.kind==='spin'){const n=Number(raw);if(!Number.isInteger(n)||n<0||n>100)throw Error('Número inválido.');return {value:n};}
  if(screen.kind==='interval'){
    const min=parseNumber(raw.min),max=parseNumber(raw.max);
    if(min==null||max==null||min<0||max<0)throw Error('Escribí dos números válidos, mayores o iguales a cero.');
    if(min>max)throw Error('El mínimo no puede ser mayor que el máximo.');
    return {min,max};
  }
  const value=parseNumber(raw,screen.kind==='problem');
  if(value==null&&screen.kind!=='problem')throw Error('Escribí un número válido. Podés usar coma o punto decimal.');
  if(value!=null&&value<0)throw Error('Escribí un número mayor o igual a cero.');
  if(screen.kind==='problem'){
    if(!String(raw).trim())throw Error('Escribí tu respuesta.');
    const item=config.blocks.find(b=>b.id===screen.block).items.find(i=>i.id===screen.item);
    return {value,classification:value===item.correct?'correcta':value===item.intuitive?'intuitiva':'otra'};
  }
  return {value};
}
export function ranks(a) {
  const sorted=a.map((v,i)=>({v,i})).sort((x,y)=>x.v-y.v),out=[];
  for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].v===sorted[i].v)j++;for(let k=i;k<j;k++)out[sorted[k].i]=(i+j+1)/2;i=j;}return out;
}
export function correlation(x,y){if(x.length<3)return null;const mx=mean(x),my=mean(y),cov=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0),xx=x.reduce((s,v)=>s+(v-mx)**2,0),yy=y.reduce((s,v)=>s+(v-my)**2,0);return xx&&yy?cov/Math.sqrt(xx*yy):null;}
export const spearman = (x,y)=>correlation(ranks(x),ranks(y));
export function regression(points){if(points.length<2)return null;const x=points.map(p=>p.x),y=points.map(p=>p.y),mx=mean(x),my=mean(y),xx=x.reduce((s,v)=>s+(v-mx)**2,0);if(!xx)return null;const slope=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/xx;return {slope,intercept:my-slope*mx};}
export const groupBy=(a,key)=>a.reduce((m,v)=>{const k=typeof key==='function'?key(v):v[key];(m[k]??=[]).push(v);return m;},{});
export function analyze(config,participants,answers){
  const byBlock=groupBy(answers,'block'),byPerson=groupBy(answers,'participant_id'), plan=makePlan(config),blocks={};
  for(const b of config.blocks){const expected=plan.filter(s=>s.block===b.id).length; blocks[b.id]={started:new Set([...(byBlock[b.id]||[]).map(a=>a.participant_id),...participants.filter(p=>p.current_block===b.id).map(p=>p.participant_id)]).size,completed:Object.values(byPerson).filter(a=>a.filter(r=>r.block===b.id).length===expected).length};}
  const anchorBlock=config.blocks.find(b=>b.type==='anchors'), anchors=(anchorBlock?.items||[]).map(item=>({item,rows:(byBlock[anchorBlock.id]||[]).filter(a=>a.item===item.id&&a.kind==='estimate')}));
  const indices=[],excluded=[],anchorScores=[];
  if(anchorBlock)for(const [id,a] of Object.entries(byPerson)){
    const rows=a.filter(r=>r.block===anchorBlock.id&&r.kind==='estimate'&&r.condition!=='ruleta');
    if(rows.length!==anchorBlock.items.length)continue;
    if(rows.some(r=>!(r.parsed.value>0))){excluded.push(id);continue;}
    const logs=groupBy(rows,'condition'),value=r=>Math.log(r.parsed.value/anchorBlock.items.find(i=>i.id===r.item).real);
    if(anchorBlock.design==='between'&&Object.keys(logs).length===1)anchorScores.push({participant_id:id,condition:rows[0].condition,value:mean(rows.map(value))});
    if(logs.alta?.length===anchorBlock.items.length/2&&logs.baja?.length===anchorBlock.items.length/2)indices.push(mean(logs.alta.map(value))-mean(logs.baja.map(value)));
  }
  const problemsBlock=config.blocks.find(b=>b.type==='problems');
  const problems=(problemsBlock?.items||[]).map(item=>({item,rows:(byBlock[problemsBlock.id]||[]).filter(a=>a.item===item.id)}));
  const scores=Object.values(byPerson).map(a=>a.filter(r=>r.block===problemsBlock?.id)).filter(a=>a.length===problems.length&&a.length).map(a=>a.filter(r=>r.parsed.classification==='correcta').length);
  const intervalBlock=config.blocks.find(b=>b.type==='intervals');
  const intervals=(intervalBlock?.items||[]).map(item=>{const rows=(byBlock[intervalBlock.id]||[]).filter(a=>a.item===item.id);return {item,rows,hits:rows.filter(a=>a.parsed.min<=item.real&&item.real<=a.parsed.max).length};});
  const coverage=Object.values(byPerson).map(a=>a.filter(r=>r.block===intervalBlock?.id)).filter(a=>a.length===intervals.length&&a.length).map(a=>a.filter(r=>{const real=intervalBlock.items.find(i=>i.id===r.item).real;return r.parsed.min<=real&&real<=r.parsed.max;}).length);
  const ownershipBlock=config.blocks.find(b=>b.type==='endowment');
  const endowment=(ownershipBlock?.items||[]).map(item=>({item,rows:(byBlock[ownershipBlock.id]||[]).filter(a=>a.item===item.id&&a.kind==='valuation')}));
  return {n:participants.length,complete:participants.filter(p=>p.completed_at).length,blocks,anchors,indices,anchorScores,indexExcluded:excluded.length,problems,scores,intervals,coverage,byBlock,endowment,
    roulette:answers.filter(a=>a.condition==='ruleta'&&a.kind==='estimate').map(a=>({x:a.anchor,y:a.parsed.value})),deciles:(byBlock[config.blocks.find(b=>b.type==='decile')?.id]||[]).map(a=>Number(a.parsed.value))};
}
export function histogram(values,bins=12,domain){if(!values.length)return {bins:[],min:0,max:1};let [min,max]=domain||[Math.min(...values),Math.max(...values)];if(min===max){min-=.5;max+=.5;}const width=(max-min)/bins,counts=Array(bins).fill(0);let outside=0;for(const v of values){if(v<min||v>max){outside++;continue;}counts[Math.min(bins-1,Math.floor((v-min)/width))]++;}return {min,max,outside,bins:counts.map((n,i)=>({x:min+i*width,to:min+(i+1)*width,n}))};}
export function csv(answers,session){
  const columns=['session','participant_id','design_version','anchor_group','ownership_group','block','item','kind','condition','anchor','presentation_order','option_order','raw','parsed','classification','shown_at','answered_at','reaction_time_ms','server_shown_at','received_at'];
  const cell=v=>{let s=typeof v==='object'&&v!==null?JSON.stringify(v):String(v??'');if(/^[=+\-@\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  return '\ufeff'+[columns,...answers.map(a=>columns.map(k=>({session, presentation_order:a.order,classification:a.parsed?.classification,anchor_group:a.assignment?.anchorGroup,ownership_group:a.assignment?.ownershipGroup,...a})[k]))].map(r=>r.map(cell).join(',')).join('\r\n');
}
