
CREATE OR REPLACE FUNCTION public.apply_retroactive_cargo_change(
  p_employee_id uuid,
  p_cargo_catalogo_id uuid,
  p_valid_from date,
  p_motivo text DEFAULT NULL,
  p_update_comp_plans boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_allowed boolean;
  v_employee record;
  v_cargo record;
  v_sdr_id uuid;
  v_today date := CURRENT_DATE;
  v_cursor_month date;
  v_end_month date;
  v_month_first date;
  v_month_last date;
  v_existing_plan record;
  v_months_affected text[] := ARRAY[]::text[];
  v_plans_touched int := 0;
BEGIN
  -- Permissão: admin ou gerente_rh ou gestor_rh
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller
      AND role IN ('admin','gerente_rh','gestor_rh')
  ) INTO v_is_allowed;

  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'Apenas Admin ou Gerente de RH podem alterar cargo retroativamente';
  END IF;

  -- Carrega colaborador e cargo
  SELECT * INTO v_employee FROM public.employees WHERE id = p_employee_id;
  IF v_employee IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;

  SELECT * INTO v_cargo FROM public.cargos_catalogo WHERE id = p_cargo_catalogo_id;
  IF v_cargo IS NULL THEN
    RAISE EXCEPTION 'Cargo não encontrado';
  END IF;

  IF p_valid_from IS NULL THEN
    RAISE EXCEPTION 'Data inicial obrigatória';
  END IF;

  -- Suprime o trigger automático nesta transação
  PERFORM set_config('app.skip_cargo_history_trigger', 'on', true);

  -- 1) Fecha segmento que cobre a data (se existir) e remove segmentos posteriores
  UPDATE public.employee_cargo_history
  SET valid_to = p_valid_from - INTERVAL '1 day'
  WHERE employee_id = p_employee_id
    AND valid_from < p_valid_from
    AND (valid_to IS NULL OR valid_to >= p_valid_from);

  DELETE FROM public.employee_cargo_history
  WHERE employee_id = p_employee_id
    AND valid_from >= p_valid_from;

  -- 2) Insere o novo segmento
  INSERT INTO public.employee_cargo_history (employee_id, cargo_catalogo_id, valid_from, valid_to, motivo, created_by)
  VALUES (p_employee_id, p_cargo_catalogo_id, p_valid_from, NULL,
          COALESCE(p_motivo, 'Alteração retroativa de cargo'),
          v_caller);

  -- 3) Atualiza cargo "vigente hoje" se a data foi alcançada
  IF p_valid_from <= v_today THEN
    UPDATE public.employees
    SET cargo_catalogo_id = p_cargo_catalogo_id,
        cargo = v_cargo.nome_exibicao,
        updated_at = now()
    WHERE id = p_employee_id;
  END IF;

  -- 4) Atualiza/cria comp plans (sdr_comp_plan) por mês afetado
  IF p_update_comp_plans THEN
    SELECT id INTO v_sdr_id FROM public.sdr
    WHERE user_id = v_employee.user_id
       OR email = v_employee.email_pessoal
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_sdr_id IS NOT NULL THEN
      -- Atualiza nível do registro sdr
      UPDATE public.sdr
      SET nivel = COALESCE(v_cargo.nivel, nivel),
          updated_at = now()
      WHERE id = v_sdr_id;

      -- Fecha planos que atravessam p_valid_from
      UPDATE public.sdr_comp_plan
      SET vigencia_fim = p_valid_from - INTERVAL '1 day',
          updated_at = now()
      WHERE sdr_id = v_sdr_id
        AND vigencia_inicio < p_valid_from
        AND (vigencia_fim IS NULL OR vigencia_fim >= p_valid_from);

      -- Para cada mês de p_valid_from até o mês corrente: cria/atualiza plano
      v_cursor_month := date_trunc('month', p_valid_from)::date;
      v_end_month := date_trunc('month', v_today)::date;

      WHILE v_cursor_month <= v_end_month LOOP
        v_month_first := GREATEST(v_cursor_month, p_valid_from);
        v_month_last  := (v_cursor_month + INTERVAL '1 month' - INTERVAL '1 day')::date;

        -- Existe um plano que cubra exatamente esse mês? Atualiza-o.
        SELECT * INTO v_existing_plan
        FROM public.sdr_comp_plan
        WHERE sdr_id = v_sdr_id
          AND vigencia_inicio >= v_cursor_month
          AND vigencia_inicio <= v_month_last
          AND vigencia_inicio >= v_month_first
        ORDER BY vigencia_inicio
        LIMIT 1;

        IF v_existing_plan.id IS NOT NULL THEN
          UPDATE public.sdr_comp_plan
          SET cargo_catalogo_id = p_cargo_catalogo_id,
              ote_total = v_cargo.ote_total,
              fixo_valor = v_cargo.fixo_valor,
              variavel_total = v_cargo.variavel_valor,
              status = CASE WHEN status = 'LOCKED' THEN status ELSE 'PENDING' END,
              updated_at = now()
          WHERE id = v_existing_plan.id;
        ELSE
          INSERT INTO public.sdr_comp_plan (
            sdr_id, cargo_catalogo_id,
            vigencia_inicio, vigencia_fim,
            ote_total, fixo_valor, variavel_total,
            meta_reunioes_agendadas, meta_reunioes_realizadas,
            status, criado_por
          ) VALUES (
            v_sdr_id, p_cargo_catalogo_id,
            v_month_first,
            CASE WHEN v_cursor_month = v_end_month THEN NULL ELSE v_month_last END,
            v_cargo.ote_total, v_cargo.fixo_valor, v_cargo.variavel_valor,
            0, 0,
            'PENDING', v_caller
          );
        END IF;

        v_plans_touched := v_plans_touched + 1;
        v_months_affected := array_append(v_months_affected, to_char(v_cursor_month, 'YYYY-MM'));
        v_cursor_month := (v_cursor_month + INTERVAL '1 month')::date;
      END LOOP;
    END IF;
  END IF;

  -- Auditoria
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (v_caller, 'cargo_change_retroativo', 'employee', p_employee_id,
          jsonb_build_object(
            'cargo_catalogo_id', p_cargo_catalogo_id,
            'cargo_nome', v_cargo.nome_exibicao,
            'valid_from', p_valid_from,
            'motivo', p_motivo,
            'months_affected', v_months_affected
          ));

  RETURN jsonb_build_object(
    'success', true,
    'employee_id', p_employee_id,
    'cargo_novo', v_cargo.nome_exibicao,
    'valid_from', p_valid_from,
    'sdr_id', v_sdr_id,
    'months_affected', v_months_affected,
    'plans_touched', v_plans_touched
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_retroactive_cargo_change(uuid, uuid, date, text, boolean) TO authenticated;
