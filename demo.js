import {makePlan,interpret,shuffle} from './core.js?v=2';
const KEY='nype_decisiones_demo_v2';
export function simulate(config,n=40,seed=21026){
  let z=seed>>>0;const rng=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296;};
  const participants=[],answers=[];let deck=[],factors=[];
  for(let j=0;j<n;j++){
    if(!deck.length)deck=shuffle(['ganancias','perdidas'],rng);
    if(!factors.length)factors=shuffle(['baja:compra','baja:venta','alta:compra','alta:venta'],rng);
    const cell=factors.pop(),assignment={cell,anchorGroup:cell.split(':')[0],ownershipGroup:cell.split(':')[1]},frame=deck.pop(),id=`demo-${j+1}`,plan=makePlan(config,{frame,...assignment,rng});
    const start=Date.UTC(2026,10,5,12)+j*1100;let time=start;
    const spin=Math.floor(rng()*101);let totalTime=0;
    for(const s of plan){
      let raw;
      const block=config.blocks.find(b=>b.id===s.block),item=block.items?.find(i=>i.id===s.item)||block.roulette;
      if(s.condition==='ruleta'&&s.kind!=='spin')s.anchor=spin;
      if(s.kind==='spin')raw=spin;
      else if(s.kind==='compare')raw=rng()<.5?'mas':'menos';
      else if(s.kind==='estimate')raw=String(Math.round(s.condition==='ruleta'?88+.42*(spin-50)+(rng()-.5)*55:item.real*Math.exp((s.condition==='alta'?.27:-.3)+(rng()-.5)*.65)));
      else if(s.kind==='valuation')raw=String(Math.round(item.demoBase*(s.condition==='venta'?1.65:.9)*Math.exp((rng()-.5)*1.1)/100)*100);
      else if(s.kind==='interval'){const center=item.real*(.55+rng()*.9),width=item.real*(.04+rng()*.35);raw={min:String(Math.max(0,Math.round(center-width))),max:String(Math.round(center+width))};}
      else if(s.kind==='problem'){const r=rng();raw=String(r<.44?item.correct:r<.87?item.intuitive:item.correct*3);}
      else if(s.block==='linda')raw=rng()<.75?'conjuncion':'simple';
      else if(block.type==='framing')raw=rng()<(frame==='ganancias'?.72:.3)?'segura':'riesgosa';
      else if(block.type==='decile')raw=String(Math.min(10,1+Math.floor(rng()**1.8*10)));
      else raw=s.options[0].id;
      const rt=s.kind==='spin'?3000:2500+Math.floor(rng()*11000);time+=rt;totalTime+=rt;
      answers.push({participant_id:id,assignment,design_version:config.designVersion||1,block:s.block,item:s.item,kind:s.kind,condition:s.condition||null,anchor:s.anchor??null,order:s.order,option_order:s.options?.map(o=>o.id)||[],raw,parsed:interpret(s,raw,config),shown_at:new Date(time-rt).toISOString(),answered_at:new Date(time).toISOString(),server_shown_at:new Date(time-rt).toISOString(),received_at:new Date(time).toISOString(),reaction_time_ms:rt});
    }
    participants.push({participant_id:id,assignment,design_version:config.designVersion||1,started_at:new Date(start).toISOString(),completed_at:new Date(time).toISOString(),duration_ms:totalTime});
  }
  return {participants,answers};
}
export class DemoBackend {
  constructor(config){this.config=config;try{this.data=JSON.parse(localStorage.getItem(KEY));}catch{}if(!this.data||this.data.session!==config.id||this.data.designVersion!==(config.designVersion||1)){this.data={session:config.id,designVersion:config.designVersion||1,open:true,epoch:config.designVersion||1,...simulate(config),live:{}};this.save();}}
  save(){localStorage.setItem(KEY,JSON.stringify(this.data));}
  state(p){const q=this.data.live[p.p_participant];if(!q)throw Error('Participante inválido.');let current=q.plan[q.cursor]||null;if(current){current=structuredClone(current);if(current.condition==='ruleta'&&current.kind!=='spin'){current.anchor=q.spin;current.prompt=current.prompt.replace('{A}',String(q.spin));}}
    return {open:this.data.open,epoch:this.data.epoch,cursor:q.cursor,total:q.plan.length,current,completed_at:q.completed_at,intro:this.config.intro,title:this.config.title};}
  async call(name,p={}){
    if(name==='status')return {open:this.data.open,epoch:this.data.epoch,intro:this.config.intro,title:this.config.title};
    if(name==='admin'){
      if(p.p_action==='open')this.data.open=true;
      if(p.p_action==='close')this.data.open=false;
      if(p.p_action==='clear'){this.data.participants=[];this.data.answers=[];this.data.live={};this.data.epoch++;this.data.open=false;}
      this.save();return {...this.data,config:this.config,live:undefined};
    }
    if(!this.data.open)throw Error('CLOSED');
    if(name==='join'){
      if(!this.data.live[p.p_participant]){const cells=['baja:compra','baja:venta','alta:compra','alta:venta'],assignment={cell:cells[this.data.participants.length%4]};assignment.anchorGroup=assignment.cell.split(':')[0];assignment.ownershipGroup=assignment.cell.split(':')[1];const plan=makePlan(this.config,assignment);this.data.live[p.p_participant]={plan,cursor:0,token:p.p_token,assignment};this.data.participants.push({participant_id:p.p_participant,assignment,started_at:new Date().toISOString(),completed_at:null});}
      this.save();return this.state(p);
    }
    const q=this.data.live[p.p_participant];if(!q||q.token!==p.p_token)throw Error('Participante inválido.');
    if(p.p_epoch!==this.data.epoch)throw Error('RESET');
    if(name==='answer'){
      if(p.p_order<q.cursor+1)return this.state(p);
      if(p.p_order!==q.cursor+1)throw Error('Orden incorrecto.');
      const s=q.plan[q.cursor];let raw=p.p_raw;
      if(s.kind==='spin'){q.spin=Math.floor(Math.random()*101);raw=q.spin;}
      if(s.condition==='ruleta'&&s.kind!=='spin')s.anchor=q.spin;
      const parsed=interpret(s,raw,this.config);
      this.data.answers.push({participant_id:p.p_participant,assignment:q.assignment,design_version:this.config.designVersion||1,...s,raw,parsed,option_order:s.options?.map(o=>o.id)||[],shown_at:p.p_shown_at,answered_at:p.p_answered_at,reaction_time_ms:Date.parse(p.p_answered_at)-Date.parse(p.p_shown_at),server_shown_at:p.p_shown_at,received_at:new Date().toISOString()});q.cursor++;
      if(q.cursor===q.plan.length){q.completed_at=new Date().toISOString();this.data.participants.find(r=>r.participant_id===p.p_participant).completed_at=q.completed_at;}
      this.save();return {...this.state(p),spin:q.spin};
    }
    throw Error('Operación desconocida.');
  }
}
