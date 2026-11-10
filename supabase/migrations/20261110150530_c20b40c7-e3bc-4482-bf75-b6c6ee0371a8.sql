CREATE OR REPLACE FUNCTION public.script_reavaliar(_meeting_type text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_qtd int;
begin
  if not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager')) then
    raise exception 'sem permissao para reavaliar';
  end if;
  update meeting_recordings r
     set analysis_status = 'pendente', analysis_attempts = 0, analysis_error = null
    from meeting_slots s
   where s.id = r.meeting_slot_id
     and r.ingest_status = 'ingerido'
     and r.transcript is not null
     and s.scheduled_at >= now() - interval '7 days'
     and (_meeting_type is null or s.meeting_type = _meeting_type);
  get diagnostics v_qtd = row_count;
  return jsonb_build_object('reenfileiradas', v_qtd);
end $function$;

CREATE OR REPLACE FUNCTION public.script_reavaliacao_progresso(_meeting_type text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
  if not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager')) then
    raise exception 'sem permissao';
  end if;
  select jsonb_build_object(
    'pendentes', count(*) filter (where r.analysis_status='pendente'),
    'analisadas', count(*) filter (where r.analysis_status='analisado'),
    'erros', count(*) filter (where r.analysis_status='erro'),
    'total', count(*))
  into v
  from meeting_recordings r join meeting_slots s on s.id=r.meeting_slot_id
  where r.ingest_status='ingerido' and r.transcript is not null
    and s.scheduled_at >= now() - interval '7 days'
    and (_meeting_type is null or s.meeting_type=_meeting_type);
  return v;
end $function$;
GRANT EXECUTE ON FUNCTION public.script_reavaliacao_progresso(text) TO authenticated;