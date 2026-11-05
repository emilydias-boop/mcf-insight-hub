DO $$ DECLARE n integer; BEGIN
 WITH c AS MATERIALIZED(SELECT * FROM public.jornada_cpf_candidatos()), g AS(SELECT deal_id,min(cpf) cpf FROM c GROUP BY deal_id HAVING count(DISTINCT cpf)=1)
 UPDATE public.crm_deals d SET cpf=g.cpf FROM g WHERE d.id=g.deal_id AND d.origin_id='b05a0000-0000-4000-8000-000000000002' AND NOT d.is_archived AND nullif(trim(d.cpf),'') IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT; RAISE NOTICE 'CPFs preenchidos: %',n; END $$;