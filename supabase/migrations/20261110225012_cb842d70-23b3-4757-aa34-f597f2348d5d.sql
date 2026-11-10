ALTER TABLE public.hubla_transactions DROP CONSTRAINT IF EXISTS hubla_transactions_linked_method_check;
ALTER TABLE public.hubla_transactions ADD CONSTRAINT hubla_transactions_linked_method_check CHECK (linked_method IS NULL OR linked_method = ANY (ARRAY['auto','manual','manual_r2','manual_r1','manual_r1_venda','manual_sugestao','auto_r1_venda']));

CREATE OR REPLACE FUNCTION public.e_produto_war_room(p_name text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT lower(btrim(coalesce(p_name,''))) LIKE 'war room%' $$;

CREATE OR REPLACE FUNCTION public.war_room_autovincular(p_transaction_id uuid, p_dry_run boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record; v_email text; v_fone text; v_cpf text;
  c1 record; c2 record; n int := 0;
  v_origin uuid; v_stage_atual uuid; v_stage_antigo text; v_stage_novo uuid; v_stage_nome text;
BEGIN
  SELECT * INTO t FROM hubla_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('acao','ignorada','motivo','venda nao encontrada'); END IF;
  IF t.sale_status IS DISTINCT FROM 'completed' THEN RETURN jsonb_build_object('acao','ignorada','motivo','venda nao paga'); END IF;
  IF NOT e_produto_war_room(t.product_name) THEN RETURN jsonb_build_object('acao','ignorada','motivo','produto nao e War Room'); END IF;
  IF t.linked_attendee_id IS NOT NULL THEN RETURN jsonb_build_object('acao','ignorada','motivo','ja vinculada'); END IF;

  v_email := nullif(lower(btrim(coalesce(t.customer_email,''))),'');
  v_fone := nullif(right(regexp_replace(coalesce(t.customer_phone,''),'\D','','g'),9),'');
  IF length(coalesce(v_fone,'')) < 9 THEN v_fone := NULL; END IF;
  v_cpf := regexp_replace(coalesce(t.customer_document,''),'\D','','g');
  IF length(v_cpf) <> 11 THEN v_cpf := NULL; END IF;
  IF v_email IS NULL AND v_fone IS NULL AND v_cpf IS NULL THEN
    RETURN jsonb_build_object('acao','ignorada','motivo','venda sem chaves');
  END IF;

  FOR c1 IN
    WITH cand AS (
      SELECT a.id att, a.deal_id, a.status, ms.scheduled_at, a.contact_id ac, d.contact_id dc,
             a.attendee_phone, a.cpf
        FROM meeting_slot_attendees a
        JOIN meeting_slots ms ON ms.id = a.meeting_slot_id
        JOIN closers cl ON cl.id = ms.closer_id
        LEFT JOIN crm_deals d ON d.id = a.deal_id
       WHERE lower(coalesce(ms.meeting_type,'')) = 'r1' AND cl.bu = 'solar'
         AND coalesce(a.is_partner,false) = false
         AND coalesce(a.status,'') <> 'cancelled'
         AND ms.scheduled_at <= t.sale_date
         AND ms.scheduled_at >= t.sale_date - interval '60 days'
    ), k AS (
      SELECT c.att,
        array_remove(ARRAY[
          CASE WHEN v_email IS NOT NULL AND EXISTS (
            SELECT 1 FROM crm_contacts ct WHERE ct.id IN (c.ac,c.dc) AND lower(btrim(ct.email)) = v_email
            UNION ALL SELECT 1 FROM crm_contact_aliases al WHERE al.contact_id IN (c.ac,c.dc) AND lower(btrim(al.email)) = v_email
          ) THEN 'email' END,
          CASE WHEN v_fone IS NOT NULL AND (
            right(regexp_replace(coalesce(c.attendee_phone,''),'\D','','g'),9) = v_fone OR EXISTS (
            SELECT 1 FROM crm_contacts ct WHERE ct.id IN (c.ac,c.dc) AND right(regexp_replace(coalesce(ct.phone,''),'\D','','g'),9) = v_fone
            UNION ALL SELECT 1 FROM crm_contact_aliases al WHERE al.contact_id IN (c.ac,c.dc) AND right(regexp_replace(coalesce(al.telefone,''),'\D','','g'),9) = v_fone)
          ) THEN 'telefone' END,
          CASE WHEN v_cpf IS NOT NULL AND regexp_replace(coalesce(c.cpf,''),'\D','','g') = v_cpf THEN 'cpf' END
        ], NULL) chaves
      FROM cand c
    )
    SELECT c.*, k.chaves, (c.status IS DISTINCT FROM 'no_show') ok
      FROM cand c JOIN k ON k.att = c.att
     WHERE cardinality(k.chaves) > 0
     ORDER BY (c.status IS DISTINCT FROM 'no_show') DESC, c.scheduled_at DESC
     LIMIT 2
  LOOP
    n := n + 1;
    IF n = 1 THEN c2 := c1; ELSE
      IF c1.ok = c2.ok AND c1.scheduled_at = c2.scheduled_at AND c1.deal_id IS DISTINCT FROM c2.deal_id THEN
        RETURN jsonb_build_object('acao','ambigua','attendee_id',c2.att,'deal_id',c2.deal_id,'outro_attendee_id',c1.att,'outro_deal_id',c1.deal_id,'chaves',to_jsonb(c2.chaves));
      END IF;
    END IF;
  END LOOP;
  IF n = 0 THEN RETURN jsonb_build_object('acao','sem_r1'); END IF;

  IF c2.deal_id IS NOT NULL THEN
    SELECT d.origin_id, d.stage_id INTO v_origin, v_stage_atual FROM crm_deals d WHERE d.id = c2.deal_id;
    SELECT s.stage_name INTO v_stage_antigo FROM crm_stages s WHERE s.id = v_stage_atual;
    IF v_origin IS NOT NULL THEN
      SELECT s.id, s.stage_name INTO v_stage_novo, v_stage_nome FROM crm_stages s
       WHERE s.origin_id = v_origin AND s.is_active IS NOT FALSE AND s.stage_name ILIKE '%venda%realizada%'
       ORDER BY s.stage_order DESC LIMIT 1;
    END IF;
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object('acao','vincularia','attendee_id',c2.att,'deal_id',c2.deal_id,'chaves',to_jsonb(c2.chaves),'etapa_nova',v_stage_nome);
  END IF;

  UPDATE hubla_transactions SET linked_attendee_id = c2.att, linked_method = 'auto_r1_venda', linked_at = now()
   WHERE id = p_transaction_id AND linked_attendee_id IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('acao','ignorada','motivo','ja vinculada'); END IF;

  IF c2.deal_id IS NOT NULL THEN
    IF v_stage_novo IS NOT NULL AND v_stage_novo IS DISTINCT FROM v_stage_atual THEN
      PERFORM set_config('mcf.mov_contexto', jsonb_build_object('deal_id',c2.deal_id,'origem','war_room_autovincular','motivo','venda War Room paga')::text, true);
      UPDATE crm_deals SET stage_id = v_stage_novo, stage_moved_at = now(), updated_at = now() WHERE id = c2.deal_id;
    END IF;
    INSERT INTO deal_activities (deal_id, activity_type, description, from_stage, to_stage, user_id, metadata)
    VALUES (c2.deal_id::text, 'venda_vinculada',
      'Venda vinculada automaticamente na Agenda R1: ' || coalesce(t.product_name,'produto') || ' (' || coalesce(t.source,'gateway') || ')',
      v_stage_antigo, v_stage_nome, NULL,
      jsonb_build_object('transaction_id',p_transaction_id,'attendee_id',c2.att,'produto',t.product_name,'gateway',t.source,
        'liquido',t.net_value,'sale_date',t.sale_date,'chaves',to_jsonb(c2.chaves),'automatico',true));
  END IF;

  RETURN jsonb_build_object('acao','vinculada','attendee_id',c2.att,'deal_id',c2.deal_id,'chaves',to_jsonb(c2.chaves),'etapa_nova',v_stage_nome);
END $$;

REVOKE ALL ON FUNCTION public.war_room_autovincular(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_war_room_autovincular() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM war_room_autovincular(NEW.id, false);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'war_room_autovincular falhou para %: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS zz_war_room_autovincular_ins ON public.hubla_transactions;
CREATE TRIGGER zz_war_room_autovincular_ins AFTER INSERT ON public.hubla_transactions
FOR EACH ROW WHEN (new.sale_status = 'completed' AND public.e_produto_war_room(new.product_name) AND new.linked_attendee_id IS NULL)
EXECUTE FUNCTION public.trg_war_room_autovincular();

DROP TRIGGER IF EXISTS zz_war_room_autovincular_upd ON public.hubla_transactions;
CREATE TRIGGER zz_war_room_autovincular_upd AFTER UPDATE OF sale_status, customer_email, customer_phone, customer_document, product_name ON public.hubla_transactions
FOR EACH ROW WHEN (new.sale_status = 'completed' AND public.e_produto_war_room(new.product_name) AND new.linked_attendee_id IS NULL)
EXECUTE FUNCTION public.trg_war_room_autovincular();