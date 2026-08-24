-- Gate de papel: espelha quem enxerga a tela Venda Consorcio hoje
-- (ResourceGuard resource='crm'), excluindo explicitamente viewer/marketing puros.
CREATE OR REPLACE FUNCTION public.can_reverter_etapa_consorcio(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = ANY (ARRAY[
          'admin','manager','coordenador','closer','closer_sombra',
          'sdr','financeiro','gr','assistente_administrativo','cobranca_consorcio'
        ]::app_role[])
    )
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = _user_id
        AND up.resource = 'crm'
        AND up.permission_level <> 'none'
    )
  )
  AND NOT EXISTS (
    -- viewer/marketing sem nenhum papel operacional nunca reverte etapa
    SELECT 1 FROM public.user_roles v
    WHERE v.user_id = _user_id
      AND v.role = ANY (ARRAY['viewer','marketing']::app_role[])
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles o
        WHERE o.user_id = _user_id
          AND o.role = ANY (ARRAY[
            'admin','manager','coordenador','closer','closer_sombra',
            'sdr','financeiro','gr','assistente_administrativo','cobranca_consorcio'
          ]::app_role[])
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_reverter_etapa_consorcio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_reverter_etapa_consorcio(uuid) TO authenticated;

-- Consulta de impedimentos: agora tambem exige papel de quem opera a tela.
DROP FUNCTION IF EXISTS public.consorcio_reversao_status(uuid[]);

CREATE OR REPLACE FUNCTION public.consorcio_reversao_status(p_registro_ids uuid[])
RETURNS TABLE (
  registro_id uuid,
  card_id uuid,
  card_existe boolean,
  parcela_paga boolean,
  contemplacao boolean,
  transferencia boolean,
  mes_fechado boolean,
  mes_referencia text,
  dash_anunciado boolean,
  sem_data_reserva boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_reverter_etapa_consorcio(auth.uid()) THEN
    RAISE EXCEPTION 'Seu perfil nao tem acesso as acoes de etapa do funil Consorcio.';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.consortium_card_id,
    c.id IS NOT NULL,
    COALESCE((SELECT EXISTS (SELECT 1 FROM consortium_installments i WHERE i.card_id = c.id AND lower(i.status) = 'pago')), false),
    COALESCE(c.numero_contemplacao IS NOT NULL OR c.data_contemplacao IS NOT NULL, false),
    COALESCE((SELECT EXISTS (SELECT 1 FROM consortium_transfers t WHERE t.card_id = c.id)), false),
    COALESCE((SELECT EXISTS (
      SELECT 1 FROM consorcio_closer_payout p
      WHERE p.status IN ('APPROVED','LOCKED')
        AND p.ano_mes = to_char(COALESCE(c.data_contratacao, r.cota_aberta_at::date, r.created_at::date), 'YYYY-MM')
    )), false),
    to_char(COALESCE(c.data_contratacao, r.cota_aberta_at::date, r.created_at::date), 'YYYY-MM'),
    COALESCE((SELECT EXISTS (
      SELECT 1 FROM outbound_webhook_queue q
      WHERE q.transaction_id = r.consortium_card_id
        AND q.event = 'consorcio.venda.criada'
        AND q.status = 'sent'
    )), false),
    (c.id IS NOT NULL AND c.data_reserva IS NULL)
  FROM consorcio_pending_registrations r
  LEFT JOIN consortium_cards c ON c.id = r.consortium_card_id
  WHERE r.id = ANY(p_registro_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.consorcio_reversao_status(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consorcio_reversao_status(uuid[]) TO authenticated;

-- Etapa 5 -> 4 : valida papel e etapa de origem antes de escrever.
CREATE OR REPLACE FUNCTION public.consorcio_reverter_etapa_5_para_4(p_registro_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  s RECORD;
  v_nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessao expirada. Entre novamente para voltar a etapa.';
  END IF;
  IF NOT public.can_reverter_etapa_consorcio(auth.uid()) THEN
    RAISE EXCEPTION 'Seu perfil nao tem permissao para voltar etapas no funil Consorcio.';
  END IF;
  IF length(btrim(COALESCE(p_motivo,''))) < 15 THEN
    RAISE EXCEPTION 'Informe o motivo com pelo menos 15 caracteres.';
  END IF;

  SELECT * INTO r FROM consorcio_pending_registrations WHERE id = p_registro_id;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Cadastro nao encontrado.';
  END IF;

  -- A funcao nunca escreve no que vier: confere a etapa de origem (mesma
  -- condicao da aba "Cotas Cadastradas") antes de mover.
  IF r.status IS DISTINCT FROM 'cota_aberta' AND r.status IS DISTINCT FROM 'vinculada' THEN
    RAISE EXCEPTION 'Este cadastro nao esta em Cotas Cadastradas (situacao atual: %). Nada foi alterado.', COALESCE(r.status, 'sem status');
  END IF;
  IF r.consortium_card_id IS NULL THEN
    RAISE EXCEPTION 'Este cadastro nao tem cota vinculada, portanto nao esta na etapa 5. Nada foi alterado.';
  END IF;

  SELECT * INTO s FROM consorcio_reversao_status(ARRAY[p_registro_id]);
  IF s.parcela_paga THEN RAISE EXCEPTION 'Nao e possivel voltar: existe parcela paga nesta cota.'; END IF;
  IF s.contemplacao THEN RAISE EXCEPTION 'Nao e possivel voltar: a cota tem contemplacao registrada.'; END IF;
  IF s.transferencia THEN RAISE EXCEPTION 'Nao e possivel voltar: a cota esta em processo de transferencia.'; END IF;
  IF s.mes_fechado THEN RAISE EXCEPTION 'Nao e possivel voltar: o mes de comissao % ja esta fechado.', s.mes_referencia; END IF;

  SELECT COALESCE(full_name, email) INTO v_nome FROM profiles WHERE id = auth.uid();

  -- A cota NUNCA e apagada: fica viva, marcada como revertida e fora do funil.
  -- Nenhuma das colunas abaixo e observada por trg_enqueue_outbound_consorcio_webhook.
  IF s.card_existe THEN
    UPDATE consortium_cards
       SET revertida_em = now(),
           revertida_por = auth.uid(),
           revertida_motivo = btrim(p_motivo)
     WHERE id = r.consortium_card_id;
  END IF;

  UPDATE consorcio_pending_registrations
     SET status = 'aguardando_abertura',
         consortium_card_id = NULL,
         cota_aberta_at = NULL,
         cota_aberta_by = NULL,
         parcela_inicial_paga_em = NULL,
         parcela_inicial_paga_por = NULL
   WHERE id = p_registro_id;

  INSERT INTO consorcio_funil_reversoes
    (entidade, entidade_id, consortium_card_id, de_etapa, para_etapa, motivo, revertido_por, revertido_por_nome)
  VALUES
    ('consorcio_pending_registrations', p_registro_id, r.consortium_card_id, 5, 4, btrim(p_motivo), auth.uid(), v_nome);

  RETURN jsonb_build_object(
    'ok', true,
    'card_marcado_revertido', COALESCE(s.card_existe, false),
    'dash_anunciado', COALESCE(s.dash_anunciado, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consorcio_reverter_etapa_5_para_4(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consorcio_reverter_etapa_5_para_4(uuid, text) TO authenticated;

-- Etapa 6 -> 5 : valida papel, etapa de origem e NAO inventa data de reserva.
CREATE OR REPLACE FUNCTION public.consorcio_desfazer_parcela_inicial(p_registro_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  s RECORD;
  c RECORD;
  v_nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessao expirada. Entre novamente para voltar a etapa.';
  END IF;
  IF NOT public.can_reverter_etapa_consorcio(auth.uid()) THEN
    RAISE EXCEPTION 'Seu perfil nao tem permissao para desfazer a parcela inicial.';
  END IF;
  IF length(btrim(COALESCE(p_motivo,''))) < 15 THEN
    RAISE EXCEPTION 'Informe o motivo com pelo menos 15 caracteres.';
  END IF;

  SELECT * INTO r FROM consorcio_pending_registrations WHERE id = p_registro_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Cadastro nao encontrado.'; END IF;

  -- Etapa de origem: so desfaz o que esta de fato marcado como pago.
  IF r.parcela_inicial_paga_em IS NULL THEN
    RAISE EXCEPTION 'Este cadastro nao tem parcela inicial marcada como paga, portanto nao ha o que desfazer. Nada foi alterado.';
  END IF;

  SELECT * INTO s FROM consorcio_reversao_status(ARRAY[p_registro_id]);
  IF s.parcela_paga THEN RAISE EXCEPTION 'Nao e possivel desfazer: existe parcela paga nesta cota.'; END IF;
  IF s.contemplacao THEN RAISE EXCEPTION 'Nao e possivel desfazer: a cota tem contemplacao registrada.'; END IF;
  IF s.transferencia THEN RAISE EXCEPTION 'Nao e possivel desfazer: a cota esta em processo de transferencia.'; END IF;
  IF s.mes_fechado THEN RAISE EXCEPTION 'Nao e possivel desfazer: o mes de comissao % ja esta fechado.', s.mes_referencia; END IF;

  -- Nunca inventamos data que ninguem registrou: sem data de reserva, recusa
  -- com instrucao do que ajustar antes.
  IF s.card_existe THEN
    SELECT * INTO c FROM consortium_cards WHERE id = r.consortium_card_id;
    IF c.data_reserva IS NULL THEN
      RAISE EXCEPTION 'Esta cota nao tem data de reserva registrada - nao da para devolve-la para reserva. Ajuste a data de reserva na cota antes de desfazer.';
    END IF;
  END IF;

  SELECT COALESCE(full_name, email) INTO v_nome FROM profiles WHERE id = auth.uid();

  UPDATE consorcio_pending_registrations
     SET parcela_inicial_paga_em = NULL,
         parcela_inicial_paga_por = NULL
   WHERE id = p_registro_id;

  IF s.card_existe THEN
    -- Escreve SOMENTE tipo_registro e data_contratacao. data_reserva fica como esta.
    UPDATE consortium_cards
       SET tipo_registro = 'reserva',
           data_contratacao = NULL
     WHERE id = r.consortium_card_id;
  END IF;

  INSERT INTO consorcio_funil_reversoes
    (entidade, entidade_id, consortium_card_id, de_etapa, para_etapa, motivo, revertido_por, revertido_por_nome)
  VALUES
    ('consorcio_pending_registrations', p_registro_id, r.consortium_card_id, 6, 5, btrim(p_motivo), auth.uid(), v_nome);

  RETURN jsonb_build_object(
    'ok', true,
    'cota_devolvida_reserva', COALESCE(s.card_existe, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consorcio_desfazer_parcela_inicial(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consorcio_desfazer_parcela_inicial(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_reverter_etapa_consorcio(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consorcio_reversao_status(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consorcio_reverter_etapa_5_para_4(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consorcio_desfazer_parcela_inicial(uuid, text) FROM anon;