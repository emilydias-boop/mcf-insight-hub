-- 1) Adicionar coluna applies_from
ALTER TABLE public.process_rules
  ADD COLUMN IF NOT EXISTS applies_from timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.process_rules.applies_from IS
  'Data a partir da qual a regra é considerada. Movimentos anteriores são ignorados (regra não-retroativa).';

-- 2) Atualizar get_process_rule para devolver value + applies_from
CREATE OR REPLACE FUNCTION public.get_process_rule(_bu text, _role text, _rule_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'rule_value', rule_value,
    'applies_from', applies_from
  )
  FROM public.process_rules
  WHERE role = _role
    AND rule_key = _rule_key
    AND is_active = true
    AND (bu = _bu OR bu IS NULL)
  ORDER BY (bu IS NOT NULL) DESC
  LIMIT 1;
$$;

-- 3) Função: verifica se existe aprovação ativa para o lead+chave de regra
CREATE OR REPLACE FUNCTION public.has_approved_reschedule_request(_deal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rule_approval_requests
    WHERE target_deal_id = _deal_id
      AND rule_key = 'reschedule_approval_threshold'
      AND status = 'approved'
      -- aprovação válida só por 24h após decisão (anti-reuso)
      AND COALESCE(reviewed_at, created_at) > now() - interval '24 hours'
  );
$$;

-- 4) Função central de validação (servidor é a fonte da verdade)
-- Retorna jsonb { allowed, requires_approval, reason, threshold, count, applies_from }
CREATE OR REPLACE FUNCTION public.evaluate_sdr_reschedule(
  _deal_id uuid,
  _bu text,
  _meeting_type text DEFAULT 'r1'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule jsonb;
  v_threshold numeric;
  v_applies_from timestamptz;
  v_count integer;
  v_has_approval boolean;
BEGIN
  -- Apenas R1 entra nesta lógica de threshold
  IF _meeting_type <> 'r1' THEN
    RETURN jsonb_build_object('allowed', true, 'requires_approval', false);
  END IF;

  -- Buscar regra efetiva (BU > global)
  v_rule := public.get_process_rule(_bu, 'sdr', 'reschedule_approval_threshold');

  IF v_rule IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'requires_approval', false);
  END IF;

  v_threshold := NULLIF((v_rule->'rule_value'->>'value'), '')::numeric;
  v_applies_from := COALESCE((v_rule->>'applies_from')::timestamptz, '1970-01-01'::timestamptz);

  IF v_threshold IS NULL OR v_threshold <= 0 THEN
    RETURN jsonb_build_object('allowed', true, 'requires_approval', false);
  END IF;

  -- Contar movimentos R1 do deal SOMENTE a partir da vigência
  SELECT COUNT(*)
  INTO v_count
  FROM public.meeting_slot_attendees msa
  JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
  WHERE msa.deal_id = _deal_id
    AND ms.meeting_type = 'r1'
    AND msa.status <> 'cancelled'
    AND COALESCE(msa.booked_at, msa.created_at) >= v_applies_from;

  -- Próximo movimento será v_count + 1
  IF (v_count + 1) < v_threshold THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'requires_approval', false,
      'threshold', v_threshold,
      'count', v_count,
      'applies_from', v_applies_from
    );
  END IF;

  -- Atingiu/passou o limite: precisa de aprovação válida
  v_has_approval := public.has_approved_reschedule_request(_deal_id);

  RETURN jsonb_build_object(
    'allowed', v_has_approval,
    'requires_approval', NOT v_has_approval,
    'reason', CASE WHEN v_has_approval
                   THEN 'Aprovação concedida.'
                   ELSE format('Reagendamento nº %s atinge o limite (%s). Aprovação do gestor obrigatória.',
                               v_count + 1, v_threshold)
              END,
    'threshold', v_threshold,
    'count', v_count,
    'applies_from', v_applies_from
  );
END;
$$;

-- 5) Índice para performance da contagem por deal
CREATE INDEX IF NOT EXISTS idx_msa_deal_booked
  ON public.meeting_slot_attendees(deal_id, booked_at)
  WHERE status <> 'cancelled';

-- 6) Backfill: regras existentes assumem vigência = agora (regras passam a valer a partir desta migration)
UPDATE public.process_rules
SET applies_from = now()
WHERE applies_from IS NULL OR applies_from < '2024-01-01'::timestamptz;