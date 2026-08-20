CREATE OR REPLACE FUNCTION public.consorcio_corrigir_vinculo_cota(p_card_id uuid, p_deal_id uuid, p_registration_id uuid DEFAULT NULL::uuid, p_confirmar_duplicado boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_card public.consortium_cards;
  v_reg public.consorcio_pending_registrations;
  v_ano_mes text;
  v_locked boolean;
  v_outras int;
  v_reg_id uuid;
  v_acao text;
  v_imp_cotas int := 0;
  v_imp_credito numeric := 0;
  v_doc text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT (
    has_role(v_actor, 'admin'::app_role) OR has_role(v_actor, 'manager'::app_role)
    OR has_role(v_actor, 'coordenador'::app_role) OR has_role(v_actor, 'sdr'::app_role)
    OR has_role(v_actor, 'closer'::app_role) OR has_role(v_actor, 'closer_sombra'::app_role)
  ) THEN
    RAISE EXCEPTION 'Seu perfil não permite corrigir o vínculo da cota.';
  END IF;

  SELECT * INTO v_card FROM public.consortium_cards WHERE id = p_card_id;
  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'Cota não encontrada.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_deals WHERE id = p_deal_id) THEN
    RAISE EXCEPTION 'Negócio informado não existe no CRM.';
  END IF;

  v_ano_mes := to_char(coalesce(v_card.data_contratacao, v_card.data_reserva, current_date), 'YYYY-MM');
  SELECT coalesce(is_active, false) INTO v_locked
    FROM public.meeting_status_locks WHERE ano_mes = v_ano_mes;
  IF coalesce(v_locked, false) THEN
    RAISE EXCEPTION 'O mês % está fechado — o vínculo desta cota não pode mais ser alterado.', v_ano_mes;
  END IF;

  SELECT count(*) INTO v_outras
    FROM public.consorcio_pending_registrations
   WHERE deal_id = p_deal_id
     AND consortium_card_id IS NOT NULL
     AND consortium_card_id <> p_card_id;
  IF v_outras > 0 AND NOT p_confirmar_duplicado THEN
    RETURN jsonb_build_object('status', 'confirmacao_necessaria', 'outras_cotas', v_outras);
  END IF;

  -- Impacto: outras cotas contratadas do MESMO cliente que passam a ser
  -- creditadas junto (a atribuição de SDR é por cliente, não por cota).
  v_doc := coalesce(nullif(regexp_replace(coalesce(v_card.cpf, ''), '\D', '', 'g'), ''),
                    nullif(regexp_replace(coalesce(v_card.cnpj, ''), '\D', '', 'g'), ''));
  SELECT count(*), coalesce(sum(c.valor_credito), 0)
    INTO v_imp_cotas, v_imp_credito
    FROM public.consortium_cards c
   WHERE c.tipo_registro = 'contratacao'
     AND c.id <> p_card_id
     AND (
       (v_doc IS NOT NULL AND coalesce(
          nullif(regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g'), ''),
          nullif(regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g'), '')
        ) = v_doc)
       OR (v_doc IS NULL
           AND upper(trim(coalesce(c.nome_completo, ''))) = upper(trim(coalesce(v_card.nome_completo, '')))
           AND coalesce(v_card.nome_completo, '') <> '')
     );

  IF p_registration_id IS NOT NULL THEN
    SELECT * INTO v_reg FROM public.consorcio_pending_registrations WHERE id = p_registration_id;
    IF v_reg.id IS NULL THEN
      RAISE EXCEPTION 'Cadastro pendente não encontrado.';
    END IF;
    IF v_reg.consortium_card_id IS DISTINCT FROM p_card_id THEN
      RAISE EXCEPTION 'Este cadastro pendente não pertence à cota informada.';
    END IF;

    UPDATE public.consorcio_pending_registrations
       SET deal_id = p_deal_id, updated_at = now()
     WHERE id = p_registration_id;
    v_reg_id := p_registration_id;
    v_acao := 'deal_vinculado';
  ELSE
    SELECT * INTO v_reg
      FROM public.consorcio_pending_registrations
     WHERE consortium_card_id = p_card_id
     ORDER BY created_at
     LIMIT 1;

    IF v_reg.id IS NOT NULL THEN
      UPDATE public.consorcio_pending_registrations
         SET deal_id = p_deal_id, updated_at = now()
       WHERE id = v_reg.id;
      v_reg_id := v_reg.id;
      v_acao := 'deal_vinculado';
    ELSE
      INSERT INTO public.consorcio_pending_registrations (
        tipo_pessoa, nome_completo, razao_social, cpf, cnpj, telefone, email,
        valor_credito, prazo_meses, tipo_produto, origem, origem_detalhe,
        grupo, cota, data_contratacao, vendedor_id, vendedor_name_cota,
        deal_id, consortium_card_id, status, vinculada_at, vinculada_by,
        created_by, aceite_date, observacoes
      ) VALUES (
        coalesce(v_card.tipo_pessoa, 'pf'), v_card.nome_completo, v_card.razao_social,
        v_card.cpf, v_card.cnpj, v_card.telefone, v_card.email,
        v_card.valor_credito, v_card.prazo_meses, v_card.tipo_produto,
        v_card.origem, v_card.origem_detalhe, v_card.grupo, v_card.cota,
        v_card.data_contratacao, v_card.vendedor_id, v_card.vendedor_name,
        p_deal_id, p_card_id, 'vinculada', now(), v_actor,
        v_actor, coalesce(v_card.data_contratacao, current_date),
        'Cadastro criado para corrigir o vínculo da cota com o lead do CRM.'
      )
      RETURNING id INTO v_reg_id;
      v_acao := 'cadastro_criado_e_vinculado';
    END IF;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    v_actor,
    'cota_vinculo_impacto',
    'consortium_cards',
    p_card_id,
    jsonb_build_object('deal_id', null),
    jsonb_build_object(
      'deal_id', p_deal_id,
      'acao', v_acao,
      'registration_id', v_reg_id,
      'cliente', coalesce(v_card.nome_completo, v_card.razao_social),
      'documento', v_doc,
      'cotas_arrastadas', v_imp_cotas,
      'credito_arrastado', v_imp_credito,
      'credito_desta_cota', v_card.valor_credito
    )
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'acao', v_acao,
    'registration_id', v_reg_id,
    'outras_cotas', v_outras,
    'cotas_arrastadas', v_imp_cotas,
    'credito_arrastado', v_imp_credito
  );
END;
$function$;