DO $do$
DECLARE d text; old_t text; new_t text;
BEGIN
  d := pg_get_functiondef('public.get_sdr_metrics_from_agenda(text,text,text,text,text)'::regprocedure);
  old_t := $q$    FROM public.caucoes_efetivas(start_d, effective_end, bu_filter) ce
    WHERE ce.sdr_email IS NOT NULL$q$;
  new_t := $q$    FROM public.caucoes_efetivas(start_d, effective_end, bu_filter) ce
    WHERE ce.refunded_at IS NULL AND ce.sdr_email IS NOT NULL$q$;
  IF position(old_t in d) = 0 THEN RAISE EXCEPTION 'CTE de caução não encontrada em get_sdr_metrics_from_agenda'; END IF;
  EXECUTE replace(d, old_t, new_t);

  d := pg_get_functiondef('public.get_closer_breakdown_metrics(text,text,text)'::regprocedure);
  old_t := $q$    FROM public.caucoes_efetivas(start_d, effective_end, bu_filter) ce
    WHERE ce.closer_id IS NOT NULL$q$;
  new_t := $q$    FROM public.caucoes_efetivas(start_d, effective_end, bu_filter) ce
    WHERE ce.refunded_at IS NULL AND ce.closer_id IS NOT NULL$q$;
  IF position(old_t in d) = 0 THEN RAISE EXCEPTION 'CTE de caução não encontrada em get_closer_breakdown_metrics'; END IF;
  EXECUTE replace(d, old_t, new_t);
END $do$;