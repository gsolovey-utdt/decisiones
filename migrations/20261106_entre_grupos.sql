-- Ejecutar este archivo COMPLETO una sola vez en Supabase. No hace falta otro SQL.
begin;
-- NyPE Decisiones. Ejecutar UNA VEZ en el SQL Editor del Supabase compartido.
-- No modifica tablas de otras apps. Después ejecutar el SQL de activación privado.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.nype_dec_sessions (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  config jsonb not null,
  key_hash text not null,
  is_open boolean not null default false,
  epoch integer not null default 1,
  frame_deck text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.nype_dec_participants (
  session_id text not null references public.nype_dec_sessions(id),
  participant_id uuid not null,
  token_hash text not null,
  plan jsonb not null,
  cursor integer not null default 0,
  spin integer check (spin between 0 and 100),
  server_shown_at timestamptz not null default clock_timestamp(),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  primary key (session_id,participant_id)
);
create table if not exists public.nype_dec_answers (
  session_id text not null,
  participant_id uuid not null,
  presentation_order integer not null,
  event_id uuid not null,
  block text not null,
  item text not null,
  kind text not null,
  condition text,
  anchor numeric,
  option_order jsonb not null default '[]',
  raw jsonb not null,
  parsed jsonb not null,
  shown_at timestamptz not null,
  answered_at timestamptz not null,
  reaction_time_ms numeric not null check (reaction_time_ms >= 0),
  server_shown_at timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  primary key(session_id,participant_id,presentation_order),
  unique(session_id,participant_id,event_id),
  foreign key(session_id,participant_id) references public.nype_dec_participants(session_id,participant_id) on delete cascade
);
-- Safe upgrades for existing installations. Legacy responses retain version 1.
alter table public.nype_dec_sessions add column if not exists factor_deck text[] not null default '{}';
alter table public.nype_dec_participants add column if not exists assignment jsonb not null default '{}';
alter table public.nype_dec_participants add column if not exists design_version integer not null default 1;
alter table public.nype_dec_answers add column if not exists assignment jsonb not null default '{}';
alter table public.nype_dec_answers add column if not exists design_version integer not null default 1;
alter table public.nype_dec_sessions enable row level security;
alter table public.nype_dec_participants enable row level security;
alter table public.nype_dec_answers enable row level security;
revoke all on public.nype_dec_sessions, public.nype_dec_participants, public.nype_dec_answers from anon,authenticated;

create or replace function public._nype_dec_shuffle(a jsonb) returns jsonb
language sql volatile set search_path=public,extensions,pg_temp as $$
  select coalesce(jsonb_agg(v order by random()),'[]'::jsonb) from jsonb_array_elements(a) v
$$;

create or replace function public._nype_dec_plan(c jsonb, frame text, assignment jsonb) returns jsonb
language plpgsql volatile set search_path=public,extensions,pg_temp as $$
declare plan jsonb='[]'; b jsonb; i jsonb; s jsonb; highs jsonb; items jsonb;
  cond text; a numeric; options jsonb; idx integer;
begin
  for b in select value from jsonb_array_elements(c->'blocks') loop
    if b->>'type'='anchors' then
      items=public._nype_dec_shuffle(b->'items');
      select jsonb_agg(value->>'id') into highs from
        (select value from jsonb_array_elements(public._nype_dec_shuffle(b->'items')) limit jsonb_array_length(b->'items')/2) q;
      for i in select value from jsonb_array_elements(items) loop
        cond=case when b->>'design'='between' then coalesce(assignment->>'anchorGroup',case when random()<.5 then 'baja' else 'alta' end) when highs ? (i->>'id') then 'alta' else 'baja' end;
        a=(i->>case when cond='alta' then 'high' else 'low' end)::numeric;
        s=jsonb_build_object('block',b->>'id','item',i->>'id','condition',cond,'anchor',a,'unit',i->>'unit');
        plan=plan||jsonb_build_array(s||jsonb_build_object('kind','compare','prompt',replace(i->>'compare','{A}',replace(to_char(a,'FM999,999,999,990'),',','.')),'options',jsonb_build_array(jsonb_build_object('id','mas','text','Más'),jsonb_build_object('id','menos','text','Menos'))));
        plan=plan||jsonb_build_array(s||jsonb_build_object('kind','estimate','prompt',i->>'prompt','subtitle','¿Cuál es tu mejor estimación?'));
      end loop;
      if b ? 'roulette' then
        i=b->'roulette';s=jsonb_build_object('block',b->>'id','item',i->>'id','condition','ruleta','unit',i->>'unit');
        plan=plan||jsonb_build_array(s||jsonb_build_object('kind','spin','prompt','Girá la ruleta'));
        plan=plan||jsonb_build_array(s||jsonb_build_object('kind','compare','prompt',i->>'compare','options',jsonb_build_array(jsonb_build_object('id','mas','text','Más'),jsonb_build_object('id','menos','text','Menos'))));
        plan=plan||jsonb_build_array(s||jsonb_build_object('kind','estimate','prompt',i->>'prompt'));
      end if;
    elsif b->>'type'='endowment' then
      cond=coalesce(assignment->>'ownershipGroup','compra');
      items=case when coalesce((b->>'shuffle')::boolean,false) then public._nype_dec_shuffle(b->'items') else b->'items' end;
      for i in select value from jsonb_array_elements(items) loop
        plan=plan||jsonb_build_array(jsonb_build_object('block',b->>'id','item',i->>'id','kind','valuation','condition',cond,'prompt',i->'prompts'->>cond,'text',i->>'description','instruction',b->>'instruction','unit',b->>'unit','image',i->>'image','imageAlt',i->>'imageAlt'));
      end loop;
    elsif b->>'type' in ('choice','framing','decile') then
      if b->>'type'='choice' then
        options=case when coalesce((b->>'shuffle')::boolean,false) then public._nype_dec_shuffle(b->'options') else b->'options' end;
      elsif b->>'type'='framing' then options=b->'versions'->frame;
      else
        select jsonb_agg(jsonb_build_object('id',j::text,'text',case when j=1 then '1 · el 10 % de notas más altas' when j=10 then '10 · el 10 % de notas más bajas' else j||' · decil '||j end) order by j) into options from generate_series(1,10) j;
      end if;
      plan=plan||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('block',b->>'id','item',b->>'idItem','kind','choice','text',b->>'text','prompt',b->>'prompt','condition',case when b->>'type'='framing' then frame end,'options',options)));
    elsif b->>'type' in ('intervals','problems') then
      for i in select value from jsonb_array_elements(b->'items') loop
        plan=plan||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('block',b->>'id','item',i->>'id','kind',case when b->>'type'='intervals' then 'interval' else 'problem' end,'prompt',i->>'prompt','unit',i->>'unit','instruction',b->>'instruction')));
      end loop;
    else raise exception 'Tipo de bloque no implementado';
    end if;
  end loop;
  for idx in 0..jsonb_array_length(plan)-1 loop
    plan=jsonb_set(plan,array[idx::text,'order'],to_jsonb(idx+1));
  end loop;
  return plan;
end $$;

-- Compatibility wrapper; production join always supplies the balanced assignment.
create or replace function public._nype_dec_plan(c jsonb,frame text) returns jsonb
language sql volatile set search_path=public,extensions,pg_temp as $$
 select public._nype_dec_plan(c,frame,jsonb_build_object('anchorGroup',case when random()<.5 then 'baja' else 'alta' end,'ownershipGroup',case when random()<.5 then 'compra' else 'venta' end))
$$;

create or replace function public._nype_dec_number(raw text, free boolean default false) returns numeric
language plpgsql immutable set search_path=public,extensions,pg_temp as $$
declare s text; n numeric;
begin
  s=regexp_replace(trim(raw),'[[:space:]]','','g');
  if free then
    s=(regexp_match(s,'([+-]?[0-9]+(?:[.,][0-9]+)*)'))[1];
  end if;
  if s is null or s !~ '^[+-]?[0-9]+([.,][0-9]+)*$' then return null; end if;
  if position(',' in s)>0 then
    if length(s)-length(replace(s,',',''))<>1 then return null; end if;
    s=replace(replace(s,'.',''),',','.');
  elsif s ~ '^[+-]?[0-9]{1,3}(\.[0-9]{3})+$' then s=replace(s,'.',''); end if;
  if s !~ '^[+-]?[0-9]+(\.[0-9]+)?$' then return null; end if;
  n=s::numeric;if abs(n)>1e15 then return null;end if;return n;
end $$;

create or replace function public._nype_dec_state(s public.nype_dec_sessions, p public.nype_dec_participants) returns jsonb
language plpgsql stable set search_path=public,extensions,pg_temp as $$
declare current jsonb;
begin
  current=p.plan->p.cursor;
  if current->>'condition'='ruleta' and current->>'kind'<>'spin' then
    current=current||jsonb_build_object('anchor',p.spin,'prompt',replace(current->>'prompt','{A}',p.spin::text));
  end if;
  return jsonb_build_object('open',s.is_open,'epoch',s.epoch,'cursor',p.cursor,'total',jsonb_array_length(p.plan),'current',current,'completed_at',p.completed_at,'spin',p.spin);
end $$;

create or replace function public.nype_dec_status(p_session text) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare s public.nype_dec_sessions;
begin
  select * into s from public.nype_dec_sessions where id=p_session;
  if not found then raise exception 'La sesión no está activada. Avisale al docente.'; end if;
  return jsonb_build_object('open',s.is_open,'epoch',s.epoch,'title',s.config->>'title','intro',s.config->>'intro');
end $$;

create or replace function public.nype_dec_join(p_session text,p_participant uuid,p_token text) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare s public.nype_dec_sessions;p public.nype_dec_participants; deck text[]; frame text; factors text[]; cell text; assigned jsonb='{}';
begin
  if p_token is null or length(p_token)<>64 or p_token !~ '^[0-9a-f]{64}$' then raise exception 'UNAUTHORIZED';end if;
  select * into s from public.nype_dec_sessions where id=p_session for update;
  if not found then raise exception 'Sesión inexistente';end if;
  if not s.is_open then raise exception 'CLOSED';end if;
  select * into p from public.nype_dec_participants where session_id=p_session and participant_id=p_participant;
  if found then
    if p.token_hash<>encode(extensions.digest(p_token,'sha256'),'hex') then raise exception 'UNAUTHORIZED';end if;
  else
    deck=s.frame_deck;
    if cardinality(deck)=0 then deck=case when random()<.5 then array['ganancias','perdidas'] else array['perdidas','ganancias'] end;end if;
    frame=deck[1];
    factors=s.factor_deck;
    if s.config->'design'->>'type'='between' then
      if cardinality(factors)=0 then
        select array_agg(v order by random()) into factors from unnest(array['baja:compra','baja:venta','alta:compra','alta:venta']) v;
      end if;
      cell=factors[1];factors=factors[2:cardinality(factors)];
      assigned=jsonb_build_object('cell',cell,'anchorGroup',split_part(cell,':',1),'ownershipGroup',split_part(cell,':',2));
    end if;
    update public.nype_dec_sessions set frame_deck=deck[2:cardinality(deck)],factor_deck=factors where id=p_session;
    insert into public.nype_dec_participants(session_id,participant_id,token_hash,plan,assignment,design_version)
    values(p_session,p_participant,encode(extensions.digest(p_token,'sha256'),'hex'),public._nype_dec_plan(s.config,frame,assigned),assigned,coalesce((s.config->>'designVersion')::integer,1)) returning * into p;
  end if;
  return public._nype_dec_state(s,p);
end $$;

create or replace function public.nype_dec_answer(p_session text,p_participant uuid,p_token text,p_epoch integer,p_order integer,p_raw jsonb,p_shown_at timestamptz,p_answered_at timestamptz,p_event uuid) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare s public.nype_dec_sessions;p public.nype_dec_participants;q jsonb;parsed jsonb;raw jsonb=p_raw;
  item jsonb;b jsonb;n numeric;lo numeric;hi numeric;options jsonb;old public.nype_dec_answers;
begin
  -- Always lock session before participant. Closing/resetting cannot race a write.
  select * into s from public.nype_dec_sessions where id=p_session for share;
  if not found then raise exception 'Sesión inexistente';end if;
  if p_epoch is null or s.epoch<>p_epoch then raise exception 'RESET';end if;
  if not s.is_open then raise exception 'CLOSED';end if;
  select * into p from public.nype_dec_participants where session_id=p_session and participant_id=p_participant for update;
  if not found or p_token is null or p.token_hash<>encode(extensions.digest(p_token,'sha256'),'hex') then raise exception 'UNAUTHORIZED';end if;
  if p_order<=p.cursor then
    select * into old from public.nype_dec_answers where session_id=p_session and participant_id=p_participant and presentation_order=p_order;
    if old.event_id<>p_event then raise exception 'Esta pantalla ya fue respondida. Recargá la página.';end if;
    return public._nype_dec_state(s,p);
  end if;
  if p_order<>p.cursor+1 then raise exception 'Orden de presentación incorrecto';end if;
  if p_shown_at is null or p_answered_at is null or p_answered_at<p_shown_at then raise exception 'Tiempos inválidos';end if;
  if octet_length(coalesce(raw::text,''))>4000 then raise exception 'Respuesta demasiado larga';end if;
  q=p.plan->p.cursor;
  select value into b from jsonb_array_elements(s.config->'blocks') where value->>'id'=q->>'block';
  if q->>'kind' in ('choice','compare') then
    if not exists(select 1 from jsonb_array_elements(q->'options') o where o->>'id'=raw#>>'{}') then raise exception 'Elegí una opción';end if;
    parsed=jsonb_build_object('value',case when b->>'type'='decile' then to_jsonb((raw#>>'{}')::integer) else raw end);
  elsif q->>'kind'='spin' then
    n=floor(random()*101);raw=to_jsonb(n);parsed=jsonb_build_object('value',n);p.spin=n;
  elsif q->>'kind'='interval' then
    lo=public._nype_dec_number(raw->>'min');hi=public._nype_dec_number(raw->>'max');
    if lo is null or hi is null or lo<0 or hi<lo then raise exception 'Intervalo inválido';end if;
    parsed=jsonb_build_object('min',lo,'max',hi);
  else
    if raw is null or jsonb_typeof(raw)<>'string' then raise exception 'Respuesta inválida';end if;
    n=public._nype_dec_number(raw#>>'{}',q->>'kind'='problem');
    if (n is null and q->>'kind'<>'problem') or n<0 or length(trim(raw#>>'{}'))=0 or raw is null then raise exception 'Respuesta inválida';end if;
    parsed=jsonb_build_object('value',n);
    if q->>'kind'='problem' then
      select value into item from jsonb_array_elements(b->'items') where value->>'id'=q->>'item';
      parsed=parsed||jsonb_build_object('classification',case when n=(item->>'correct')::numeric then 'correcta' when n=(item->>'intuitive')::numeric then 'intuitiva' else 'otra' end);
    end if;
  end if;
  select coalesce(jsonb_agg(o->>'id'),'[]') into options from jsonb_array_elements(coalesce(q->'options','[]')) o;
  insert into public.nype_dec_answers(session_id,participant_id,presentation_order,event_id,block,item,kind,condition,anchor,option_order,raw,parsed,shown_at,answered_at,reaction_time_ms,server_shown_at,assignment,design_version)
  values(p_session,p_participant,p_order,p_event,q->>'block',q->>'item',q->>'kind',q->>'condition',case when q->>'condition'='ruleta' then p.spin else (q->>'anchor')::numeric end,options,raw,parsed,p_shown_at,p_answered_at,extract(epoch from (p_answered_at-p_shown_at))*1000,p.server_shown_at,p.assignment,p.design_version);
  update public.nype_dec_participants set cursor=cursor+1,spin=p.spin,server_shown_at=clock_timestamp(),
    completed_at=case when cursor+1=jsonb_array_length(plan) then clock_timestamp() end
    where session_id=p_session and participant_id=p_participant returning * into p;
  return public._nype_dec_state(s,p);
end $$;

create or replace function public.nype_dec_admin(p_session text,p_key text,p_action text default 'snapshot') returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare s public.nype_dec_sessions;participants jsonb;answers jsonb;
begin
  select * into s from public.nype_dec_sessions where id=p_session for update;
  if not found or s.key_hash<>encode(extensions.digest(p_key,'sha256'),'hex') or p_key is null then raise exception 'UNAUTHORIZED';end if;
  if p_action='open' then update public.nype_dec_sessions set is_open=true where id=p_session;
  elsif p_action='close' then update public.nype_dec_sessions set is_open=false where id=p_session;
  elsif p_action='clear' then
    delete from public.nype_dec_participants where session_id=p_session;
    update public.nype_dec_sessions set is_open=false,epoch=epoch+1,frame_deck='{}',factor_deck='{}' where id=p_session;
  elsif p_action<>'snapshot' then raise exception 'Acción inválida';end if;
  select * into s from public.nype_dec_sessions where id=p_session;
  select coalesce(jsonb_agg(jsonb_build_object('participant_id',p.participant_id,'started_at',p.started_at,'completed_at',p.completed_at,'current_block',p.plan->p.cursor->>'block','assignment',p.assignment,'design_version',p.design_version) order by p.started_at),'[]') into participants from public.nype_dec_participants p where p.session_id=p_session;
  select coalesce(jsonb_agg((to_jsonb(a)-'event_id'-'session_id'-'presentation_order')||jsonb_build_object('order',a.presentation_order) order by a.participant_id,a.presentation_order),'[]') into answers from public.nype_dec_answers a where a.session_id=p_session;
  return jsonb_build_object('open',s.is_open,'epoch',s.epoch,'config',s.config,'participants',participants,'answers',answers);
end $$;

-- Publicly callable endpoints are the only access. Internal helpers and tables stay private.
revoke all on function public._nype_dec_shuffle(jsonb),public._nype_dec_plan(jsonb,text),public._nype_dec_plan(jsonb,text,jsonb),public._nype_dec_number(text,boolean),public._nype_dec_state(public.nype_dec_sessions,public.nype_dec_participants) from public,anon,authenticated;
revoke all on function public.nype_dec_status(text),public.nype_dec_join(text,uuid,text),public.nype_dec_answer(text,uuid,text,integer,integer,jsonb,timestamptz,timestamptz,uuid),public.nype_dec_admin(text,text,text) from public,anon,authenticated;
grant execute on function public.nype_dec_status(text),public.nype_dec_join(text,uuid,text),public.nype_dec_answer(text,uuid,text,integer,integer,jsonb,timestamptz,timestamptz,uuid),public.nype_dec_admin(text,text,text) to anon;
notify pgrst,'reload schema';


-- Upgrade the active session atomically, keeping its URL, key and open/closed state.
-- The entire prior session is retained as clase21-v1, including unfinished plans.
do $upgrade$
declare old public.nype_dec_sessions; archived text='clase21-v1';
begin
  select * into old from public.nype_dec_sessions where id='clase21' for update;
  if not found then raise exception 'Primero hay que activar clase21';end if;
  if coalesce((old.config->>'designVersion')::integer,1)>=2 then return;end if;
  if exists(select 1 from public.nype_dec_sessions where id=archived) then raise exception 'Ya existe clase21-v1: no se modificó nada';end if;
  insert into public.nype_dec_sessions(id,config,key_hash,is_open,epoch,frame_deck,factor_deck,created_at)
    values(archived,jsonb_set(old.config,'{id}',to_jsonb(archived)),old.key_hash,false,old.epoch,old.frame_deck,old.factor_deck,old.created_at);
  insert into public.nype_dec_participants(session_id,participant_id,token_hash,plan,cursor,spin,server_shown_at,started_at,completed_at,assignment,design_version)
    select archived,participant_id,token_hash,plan,cursor,spin,server_shown_at,started_at,completed_at,assignment,design_version from public.nype_dec_participants where session_id=old.id;
  insert into public.nype_dec_answers(session_id,participant_id,presentation_order,event_id,block,item,kind,condition,anchor,option_order,raw,parsed,shown_at,answered_at,reaction_time_ms,server_shown_at,received_at,assignment,design_version)
    select archived,participant_id,presentation_order,event_id,block,item,kind,condition,anchor,option_order,raw,parsed,shown_at,answered_at,reaction_time_ms,server_shown_at,received_at,assignment,design_version from public.nype_dec_answers where session_id=old.id;
  delete from public.nype_dec_participants where session_id=old.id;
  update public.nype_dec_sessions set config='{"id":"clase21","title":"Actividades de clase","intro":"Respondé solo o sola, sin mirar el celular de al lado. Es anónimo y no hay respuestas que sumen o resten: estamos juntando datos para la clase. Respondé como lo harías normalmente.","blocks":[{"id":"anclaje","type":"anchors","label":"Anclaje","items":[{"id":"gandhi","label":"Gandhi","compare":"Al momento de su muerte, ¿Gandhi tenía más o menos de {A} años?","prompt":"¿Cuántos años creés que tenía Gandhi cuando murió?","unit":"años","low":36,"high":114,"real":78,"domain":[0,130]},{"id":"lennon","label":"John Lennon","compare":"Al momento de su muerte, ¿John Lennon tenía más o menos de {A} años?","prompt":"¿Cuántos años creés que tenía John Lennon cuando murió?","unit":"años","low":18,"high":58,"real":40,"domain":[0,100]},{"id":"obelisco","label":"Obelisco","compare":"¿El Obelisco de Buenos Aires mide más o menos de {A} centímetros de alto?","prompt":"¿Cuántos centímetros creés que mide el Obelisco?","unit":"centímetros","low":3120,"high":9860,"real":6750,"domain":[0,15000]},{"id":"onu","label":"ONU","compare":"¿La ONU tiene más o menos de {A} países miembros?","prompt":"¿Cuántos países miembros creés que tiene la ONU?","unit":"países","low":89,"high":282,"real":193,"domain":[0,350]}],"roulette":{"id":"piano","label":"Piano","compare":"¿Un piano tiene más o menos de {A} teclas?","prompt":"¿Cuántas teclas creés que tiene un piano?","unit":"teclas","real":88,"domain":[0,200]},"design":"between"},{"id":"linda","type":"choice","label":"Linda","idItem":"linda","shuffle":true,"text":"Linda tiene 31 años, es soltera, franca y muy inteligente. Estudió filosofía. Como estudiante, le preocupaban mucho los temas de discriminación y justicia social, y participó en manifestaciones antinucleares.","prompt":"¿Qué es más probable?","options":[{"id":"simple","text":"Linda es cajera de banco."},{"id":"conjuncion","text":"Linda es cajera de banco y participa activamente en el movimiento feminista."}]},{"id":"enfermedad","type":"framing","label":"Enfermedad","idItem":"enfermedad","text":"Imaginá que el país se prepara para el brote de una enfermedad aviar poco común que, se espera, va a matar a 600 personas. Se propusieron dos programas para combatirla. Las estimaciones científicas exactas de sus consecuencias son las siguientes.","prompt":"¿Qué programa elegís?","versions":{"ganancias":[{"id":"segura","text":"Programa A: se van a salvar 200 personas."},{"id":"riesgosa","text":"Programa B: hay una probabilidad de 1/3 de que se salven las 600 personas y una probabilidad de 2/3 de que no se salve nadie."}],"perdidas":[{"id":"segura","text":"Programa C: van a morir 400 personas."},{"id":"riesgosa","text":"Programa D: hay una probabilidad de 1/3 de que no muera nadie y una probabilidad de 2/3 de que mueran las 600."}]}},{"id":"dotacion","type":"endowment","label":"Efecto de dotación","design":"between","shuffle":true,"unit":"pesos argentinos","items":[{"id":"lentes","label":"Lentes oscuros","description":"Un par de lentes de sol nuevos, con marco negro de acetato y lentes oscuros.","image":"assets/lentes.webp","imageAlt":"Lentes de sol negros de marco angular","prompts":{"compra":"Imaginá que estos lentes de sol le pertenecen a otra persona y podés comprárselos. ¿Cuál es el precio máximo que pagarías por ellos?","venta":"Imaginá que estos lentes de sol son tuyos. ¿Cuál es el precio mínimo que aceptarías para venderlos?"},"domain":[0,200000],"demoBase":55000},{"id":"auriculares","label":"Auriculares","description":"Unos auriculares inalámbricos nuevos, de vincha y con almohadillas acolchadas.","image":"assets/auriculares.webp","imageAlt":"Auriculares inalámbricos negros de vincha","prompts":{"compra":"Imaginá que estos auriculares le pertenecen a otra persona y podés comprárselos. ¿Cuál es el precio máximo que pagarías por ellos?","venta":"Imaginá que estos auriculares son tuyos. ¿Cuál es el precio mínimo que aceptarías para venderlos?"},"domain":[0,300000],"demoBase":85000},{"id":"botella","label":"Botella térmica","description":"Una botella térmica nueva de acero inoxidable, de 750 ml, con tapa a rosca.","image":"assets/botella.webp","imageAlt":"Botella térmica verde de acero inoxidable","prompts":{"compra":"Imaginá que esta botella térmica le pertenece a otra persona y podés comprársela. ¿Cuál es el precio máximo que pagarías por ella?","venta":"Imaginá que esta botella térmica es tuya. ¿Cuál es el precio mínimo que aceptarías para venderla?"},"domain":[0,150000],"demoBase":35000}],"instruction":"La situación es imaginaria: no vas a comprar ni vender nada. Respondé en pesos argentinos, con el valor que te parezca."},{"id":"problemas","type":"problems","label":"Tres problemas","items":[{"id":"maquinas","label":"Máquinas","prompt":"5 máquinas tardan 5 minutos en fabricar 5 artefactos. ¿Cuántos minutos tardan 100 máquinas en fabricar 100 artefactos?","unit":"minutos","correct":5,"intuitive":100},{"id":"lago","label":"Lago","prompt":"Un lago está empezando a congelarse y cada día que pasa el hielo duplica su tamaño. Si va a tardar 48 días en congelarse por completo, ¿cuántos días pasan hasta que se congele la mitad?","unit":"días","correct":47,"intuitive":24},{"id":"pelota","label":"Pelota y raqueta (ya vista en la clase 1)","prompt":"Una raqueta y una pelota cuestan $1.100. La raqueta cuesta $1.000 más que la pelota. ¿Cuánto cuesta la pelota?","unit":"pesos","correct":50,"intuitive":100}]}],"designVersion":2,"design":{"type":"between","factors":["anchorGroup","ownershipGroup"],"cells":["baja:compra","baja:venta","alta:compra","alta:venta"],"blockSize":4}}'::jsonb,epoch=epoch+1,frame_deck='{}',factor_deck='{}' where id=old.id;
end $upgrade$;
-- Isolated, closed session for the 40-participant HTTP verification.
insert into public.nype_dec_sessions(id,config,key_hash)
 select 'qa-clase21-v2-20261106',jsonb_set(config,'{id}','"qa-clase21-v2-20261106"'::jsonb),key_hash from public.nype_dec_sessions where id='clase21'
 on conflict(id) do nothing;

commit;
