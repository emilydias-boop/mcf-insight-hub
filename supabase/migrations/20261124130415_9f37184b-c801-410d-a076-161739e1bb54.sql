CREATE OR REPLACE FUNCTION public.gov_req_agrupar_atores()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF jsonb_typeof(NEW.atores_previstos)='array' AND jsonb_array_length(NEW.atores_previstos)>1 THEN
    SELECT coalesce(jsonb_agg(obj ORDER BY pos),'[]'::jsonb) INTO NEW.atores_previstos FROM (
      SELECT min(pos) pos,
        (array_agg(a ORDER BY pos))[1]
          || jsonb_build_object('papel', string_agg(DISTINCT a->>'papel', ' · '))
          || jsonb_build_object('alcada_ids', coalesce(jsonb_agg(a->'alcada_id') FILTER (WHERE a ? 'alcada_id' AND a->>'alcada_id' IS NOT NULL), '[]'::jsonb)) AS obj
      FROM jsonb_array_elements(NEW.atores_previstos) WITH ORDINALITY e(a,pos)
      GROUP BY coalesce(a->>'employee_id', 'role:'||coalesce(a->>'role',''), 'pos:'||pos)
    ) s;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER gov_req_zz_agrupar_atores BEFORE INSERT OR UPDATE ON public.gov_requisicoes_contratacao
FOR EACH ROW EXECUTE FUNCTION public.gov_req_agrupar_atores();