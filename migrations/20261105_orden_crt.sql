-- Orden fijo CRT: máquinas, lago, pelota. Etiqueta docente de exposición previa.
-- Ejecutar en el mismo proyecto Supabase. Conserva clave y estado de recepción.
begin;
do $$
begin
  perform 1 from public.nype_dec_sessions where id='clase21' for update;
  if not found then raise exception 'Falta activar clase21'; end if;
  if exists(select 1 from public.nype_dec_sessions where id='clase21' and is_open)
     or exists(select 1 from public.nype_dec_participants where session_id='clase21') then
    raise exception 'La actualización requiere clase21 vacía y cerrada. No se modificó nada.';
  end if;
end $$;
update public.nype_dec_sessions s
set config=jsonb_set(s.config,'{blocks}',(
  select jsonb_agg(
    case when b->>'id'='problemas' then jsonb_set(b,'{items}',(
      select jsonb_agg(
        case when i->>'id'='pelota' then i||jsonb_build_object('label','Pelota y raqueta (ya vista en la clase 1)') else i end
        order by case i->>'id' when 'maquinas' then 1 when 'lago' then 2 when 'pelota' then 3 else 4 end
      ) from jsonb_array_elements(b->'items') i
    )) else b end order by pos
  ) from jsonb_array_elements(s.config->'blocks') with ordinality as blocks(b,pos)
)) where s.id='clase21';
commit;
