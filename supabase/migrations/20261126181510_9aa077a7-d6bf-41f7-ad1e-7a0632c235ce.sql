CREATE OR REPLACE FUNCTION public.pos_venda_checar_entregaveis()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_old int; v_new int; v_faltando text;
BEGIN
  IF NEW.stage_id = 'b05a0001-0000-4000-8000-000000000005' THEN RETURN NEW; END IF;
  SELECT stage_order INTO v_old FROM crm_stages WHERE id = OLD.stage_id;
  SELECT stage_order INTO v_new FROM crm_stages WHERE id = NEW.stage_id;
  IF v_old IS NULL OR v_new IS NULL OR v_new <= v_old THEN RETURN NEW; END IF;
  SELECT string_agg(e.titulo, ', ') INTO v_faltando
  FROM crm_stage_entregaveis e JOIN crm_stages s ON s.id = e.stage_id
  WHERE s.origin_id = NEW.origin_id AND s.stage_order >= v_old AND s.stage_order < v_new
    AND e.obrigatorio AND e.is_active
    AND NOT EXISTS (SELECT 1 FROM crm_deal_entregaveis d WHERE d.deal_id = NEW.id AND d.entregavel_id = e.id);
  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Entregável obrigatório pendente: %', v_faltando USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.pos_venda_checar_nota_novos()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.stage_id = 'b05a0001-0000-4000-8000-000000000000'
    AND NEW.stage_id <> 'b05a0001-0000-4000-8000-000000000005' AND NOT EXISTS (
    SELECT 1 FROM deal_activities WHERE deal_id = NEW.id::text AND activity_type = 'pos_venda_nota_contato'
      AND created_at > now() - interval '15 minutes') THEN
    RAISE EXCEPTION 'Para tirar o card de Novos licenciados registre a nota do contato' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO crm_cliente_timeline (contact_id, deal_id, evento, origin_de, origin_para, stage_de, stage_para, actor_id)
  VALUES (NEW.contact_id, NEW.id, 'mudanca_etapa', OLD.origin_id, NEW.origin_id, OLD.stage_id, NEW.stage_id, auth.uid());
  RETURN NEW;
END $function$;