CREATE FUNCTION public.jornada_calcular(p_deal_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE d record; fase text:='f3'; historico jsonb:='{"f3":null,"f4":null,"f5":null,"f6":null,"f7":null,"f8":null}'::jsonb; h boolean; evento record;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente_relacionamento')) THEN RAISE EXCEPTION 'Sem permissão para consultar a jornada' USING ERRCODE='42501'; END IF;
 SELECT id,stage_id INTO d FROM public.crm_deals WHERE id=p_deal_id AND origin_id='b05a0000-0000-4000-8000-000000000002' AND NOT is_archived;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT e.codigo_trilha INTO fase FROM public.jornada_mapa_estagios m JOIN public.jornada_etapas e ON e.id=m.etapa_id AND e.ativa WHERE m.stage_id=d.stage_id;
 fase=coalesce(fase,'f3');
 SELECT EXISTS(SELECT 1 FROM public.deal_activities WHERE deal_id=d.id::text AND activity_type='pos_venda_anamnese') INTO h;
 IF h AND fase='f3' THEN fase='f4'; END IF;
 FOR evento IN
 WITH fatos AS (
 SELECT CASE WHEN a.activity_type='pos_venda_entrada' THEN 'f3' WHEN a.activity_type='pos_venda_anamnese' THEN 'f4' ELSE e.codigo_trilha END codigo,a.created_at
 FROM public.deal_activities a
 LEFT JOIN public.crm_stages s ON s.origin_id='b05a0000-0000-4000-8000-000000000002' AND s.id::text=CASE WHEN coalesce(a.metadata->>'to_stage_id','')<>'' THEN a.metadata->>'to_stage_id' WHEN a.to_stage ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN a.to_stage ELSE (SELECT s2.id::text FROM public.crm_stages s2 WHERE s2.origin_id='b05a0000-0000-4000-8000-000000000002' AND s2.stage_name=a.to_stage ORDER BY s2.id LIMIT 1) END
 LEFT JOIN public.jornada_mapa_estagios m ON m.stage_id=s.id
 LEFT JOIN public.jornada_etapas e ON e.id=m.etapa_id AND e.ativa
 WHERE a.deal_id=d.id::text AND a.activity_type IN ('stage_change','pos_venda_entrada','pos_venda_anamnese'))
 SELECT codigo,max(created_at) ocorrido FROM fatos WHERE codigo IN ('f3','f4','f5','f6','f7','f8') GROUP BY codigo
 LOOP historico=jsonb_set(historico,ARRAY[evento.codigo],to_jsonb(evento.ocorrido)); END LOOP;
 RETURN jsonb_build_object('etapa_atual',fase,'historico',historico,'harvey_confirmado',h);
END $$;
REVOKE ALL ON FUNCTION public.jornada_calcular(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.jornada_calcular(uuid) TO authenticated,service_role;
CREATE FUNCTION public.jornada_preencher_cpf_deal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE candidato text; n integer;
BEGIN
 IF nullif(trim(NEW.cpf),'') IS NOT NULL THEN RETURN NEW; END IF;
 BEGIN SELECT count(DISTINCT cpf),min(cpf) INTO n,candidato FROM public.jornada_cpf_candidatos() WHERE deal_id=NEW.id;
 IF n=1 THEN UPDATE public.crm_deals SET cpf=candidato WHERE id=NEW.id AND nullif(trim(cpf),'') IS NULL AND origin_id='b05a0000-0000-4000-8000-000000000002' AND NOT is_archived; END IF;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Falha ao preencher CPF na jornada para negócio %',NEW.id; END;
 RETURN NEW;
END $$;
CREATE TRIGGER jornada_cpf_deal AFTER INSERT OR UPDATE OF origin_id,contact_id,is_archived ON public.crm_deals FOR EACH ROW WHEN (NEW.origin_id='b05a0000-0000-4000-8000-000000000002'::uuid AND NOT NEW.is_archived AND (NEW.cpf IS NULL OR btrim(NEW.cpf)='')) EXECUTE FUNCTION public.jornada_preencher_cpf_deal();
CREATE FUNCTION public.jornada_preencher_cpf_compra() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 BEGIN
 WITH c AS MATERIALIZED(SELECT * FROM public.jornada_cpf_candidatos()), g AS(SELECT deal_id,min(cpf) cpf FROM c GROUP BY deal_id HAVING count(DISTINCT cpf)=1)
 UPDATE public.crm_deals d SET cpf=g.cpf FROM g WHERE d.id=g.deal_id AND g.cpf=regexp_replace(NEW.customer_document,'[^0-9]','','g') AND nullif(trim(d.cpf),'') IS NULL AND d.origin_id='b05a0000-0000-4000-8000-000000000002' AND NOT d.is_archived;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Falha ao preencher CPF da jornada na compra %',NEW.id; END;
 RETURN NEW;
END $$;
CREATE TRIGGER zzzz_jornada_cpf_compra AFTER INSERT OR UPDATE OF customer_document,customer_email,customer_phone,sale_status ON public.hubla_transactions FOR EACH ROW WHEN (NEW.customer_document IS NOT NULL) EXECUTE FUNCTION public.jornada_preencher_cpf_compra();
REVOKE ALL ON FUNCTION public.jornada_preencher_cpf_deal() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jornada_preencher_cpf_compra() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jornada_validar_mapa() FROM PUBLIC,anon,authenticated;