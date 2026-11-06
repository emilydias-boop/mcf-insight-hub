CREATE OR REPLACE FUNCTION public.vincular_venda_ao_participante(p_transaction_id uuid, p_attendee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_pode boolean := false;
  v_deal uuid;
  v_origin uuid;
  v_stage_atual uuid;
  v_stage_novo uuid;
  v_stage_nome text;
  v_stage_antigo_nome text;
  v_partner boolean;
  v_ja_vinculada uuid;
  v_produto text;
  v_liq numeric;
  v_gateway text;
  v_quando timestamptz;
  v_tipo text;
  v_is_r1 boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sem usuario autenticado';
  END IF;

  SELECT coalesce(pr.can_link_contract, false)
      OR has_role(v_user, 'admin'::app_role)
      OR has_role(v_user, 'manager'::app_role)
    INTO v_pode
    FROM profiles pr
   WHERE pr.id = v_user;

  IF NOT coalesce(v_pode, false) THEN
    RAISE EXCEPTION 'Voce nao tem permissao para vincular vendas';
  END IF;

  SELECT a.deal_id, a.is_partner, ms.meeting_type
    INTO v_deal, v_partner, v_tipo
    FROM meeting_slot_attendees a
    LEFT JOIN meeting_slots ms ON ms.id = a.meeting_slot_id
   WHERE a.id = p_attendee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participante nao encontrado';
  END IF;

  v_is_r1 := lower(coalesce(v_tipo, '')) = 'r1';

  IF coalesce(v_partner, false) THEN
    RAISE EXCEPTION 'Socio nao recebe vinculo de venda; vincule no participante principal';
  END IF;

  SELECT ht.linked_attendee_id, ht.product_name, ht.net_value, ht.source, ht.sale_date
    INTO v_ja_vinculada, v_produto, v_liq, v_gateway, v_quando
    FROM hubla_transactions ht
   WHERE ht.id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda nao encontrada';
  END IF;

  IF v_ja_vinculada IS NOT NULL AND v_ja_vinculada <> p_attendee_id THEN
    RAISE EXCEPTION 'Esta venda ja esta vinculada a outro participante';
  END IF;

  UPDATE hubla_transactions
     SET linked_attendee_id = p_attendee_id,
         linked_method      = CASE WHEN v_is_r1 THEN 'manual_r1_venda' ELSE 'manual_r2' END,
         linked_at          = now(),
         linked_by_user_id  = v_user
   WHERE id = p_transaction_id;

  IF v_deal IS NOT NULL THEN
    SELECT d.origin_id, d.stage_id INTO v_origin, v_stage_atual
      FROM crm_deals d WHERE d.id = v_deal;

    SELECT s.stage_name INTO v_stage_antigo_nome
      FROM crm_stages s WHERE s.id = v_stage_atual;

    IF v_origin IS NOT NULL THEN
      SELECT s.id, s.stage_name
        INTO v_stage_novo, v_stage_nome
        FROM crm_stages s
       WHERE s.origin_id = v_origin
         AND s.is_active IS NOT FALSE
         AND s.stage_name ILIKE '%venda%realizada%'
       ORDER BY s.stage_order DESC
       LIMIT 1;

      IF v_stage_novo IS NOT NULL AND v_stage_novo IS DISTINCT FROM v_stage_atual THEN
        UPDATE crm_deals
           SET stage_id = v_stage_novo,
               stage_moved_at = now(),
               updated_at = now()
         WHERE id = v_deal;
      END IF;
    END IF;

    INSERT INTO deal_activities (deal_id, activity_type, description, from_stage, to_stage, user_id, metadata)
    VALUES (
      v_deal::text,
      'venda_vinculada',
      'Venda vinculada manualmente na Agenda ' || CASE WHEN v_is_r1 THEN 'R1' ELSE 'R2' END || ': ' || coalesce(v_produto, 'produto') ||
      ' (' || coalesce(v_gateway, 'gateway') || ')',
      v_stage_antigo_nome,
      v_stage_nome,
      v_user,
      jsonb_build_object(
        'transaction_id', p_transaction_id,
        'attendee_id',    p_attendee_id,
        'produto',        v_produto,
        'gateway',        v_gateway,
        'liquido',        v_liq,
        'sale_date',      v_quando
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'deal_id', v_deal,
    'etapa_nova', v_stage_nome,
    'produto', v_produto,
    'liquido', v_liq,
    'gateway', v_gateway
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.desvincular_venda_do_participante(p_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_pode boolean := false;
  v_attendee uuid;
  v_deal uuid;
  v_produto text;
  v_tipo text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sem usuario autenticado';
  END IF;

  SELECT coalesce(pr.can_link_contract, false)
      OR has_role(v_user, 'admin'::app_role)
      OR has_role(v_user, 'manager'::app_role)
    INTO v_pode
    FROM profiles pr WHERE pr.id = v_user;

  IF NOT coalesce(v_pode, false) THEN
    RAISE EXCEPTION 'Voce nao tem permissao para desvincular vendas';
  END IF;

  SELECT ht.linked_attendee_id, ht.product_name
    INTO v_attendee, v_produto
    FROM hubla_transactions ht WHERE ht.id = p_transaction_id;

  IF v_attendee IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'ja_estava_solta', true);
  END IF;

  SELECT a.deal_id, ms.meeting_type INTO v_deal, v_tipo
    FROM meeting_slot_attendees a
    LEFT JOIN meeting_slots ms ON ms.id = a.meeting_slot_id
   WHERE a.id = v_attendee;

  UPDATE hubla_transactions
     SET linked_attendee_id = NULL,
         linked_method      = NULL,
         linked_at          = NULL,
         linked_by_user_id  = NULL
   WHERE id = p_transaction_id;

  IF v_deal IS NOT NULL THEN
    INSERT INTO deal_activities (deal_id, activity_type, description, user_id, metadata)
    VALUES (
      v_deal::text,
      'venda_desvinculada',
      'Venda desvinculada na Agenda ' || CASE WHEN lower(coalesce(v_tipo, '')) = 'r1' THEN 'R1' ELSE 'R2' END || ': ' || coalesce(v_produto, 'produto'),
      v_user,
      jsonb_build_object('transaction_id', p_transaction_id, 'attendee_id', v_attendee)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'attendee_id', v_attendee, 'deal_id', v_deal);
END;
$function$;