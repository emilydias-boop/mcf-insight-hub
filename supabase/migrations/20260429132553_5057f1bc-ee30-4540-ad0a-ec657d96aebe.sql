
-- Ajusta evaluate_sdr_reschedule:
-- - applies_from agora controla apenas A PARTIR DE QUANDO a regra vigora
-- - A contagem considera TODO o histórico de R1 do lead (não filtra por data)
-- Assim, leads que já têm 2+ movimentações ficam bloqueados desde o dia 1 da vigência.

CREATE OR REPLACE FUNCTION public.evaluate_sdr_reschedule(
  _deal_id uuid,
  _bu text,
  _meeting_type text DEFAULT 'r1'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rule jsonb;
  v_threshold numeric;
  v_applies_from timestamptz;
  v_count integer;
  v_has_approval boolean;
BEGIN
  IF _meeting_type <> 'r1' THEN
    RETURN jsonb_build_object('allowed', true, 'requires_approval', false);
  END IF;

  v_rule := public.get_process_rule(_bu, 'sdr', 'reschedule_approval_threshold');

  IF v_rule IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'requires_approval', false);
  END IF;

  v_threshold := NULLIF((v_rule->'rule_value'->>'value'), '')::numeric;
  v_applies_from := COALESCE((v_rule->>'applies_from')::timestamptz, '1970-01-01'::timestamptz);

  IF v_threshold IS NULL OR v_threshold <= 0 THEN
    RETURN jsonb_build_object('allowed', true, 'requires_approval', false);
  END IF;

  -- A regra só vigora a partir de applies_from.
  -- Antes dessa data, nada é bloqueado (não-retroativo no SENTIDO da aplicação).
  IF now() < v_applies_from THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'requires_approval', false,
      'reason', 'Regra ainda não vigora.',
      'applies_from', v_applies_from
    );
  END IF;

  -- A partir da vigência, considera TODO o histórico de R1 do lead.
  -- Leads com 2+ movimentos prévios ficam imediatamente bloqueados (precisam aprovação).
  SELECT COUNT(*)
  INTO v_count
  FROM public.meeting_slot_attendees msa
  JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
  WHERE msa.deal_id = _deal_id
    AND ms.meeting_type = 'r1'
    AND msa.status <> 'cancelled';

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

  v_has_approval := public.has_approved_reschedule_request(_deal_id);

  RETURN jsonb_build_object(
    'allowed', v_has_approval,
    'requires_approval', NOT v_has_approval,
    'reason', CASE WHEN v_has_approval
                   THEN 'Aprovação concedida.'
                   ELSE format('Lead já possui %s movimentação(ões) de R1. Limite (%s) atingido — aprovação do gestor obrigatória.',
                               v_count, v_threshold)
              END,
    'threshold', v_threshold,
    'count', v_count,
    'applies_from', v_applies_from
  );
END;
$function$;
