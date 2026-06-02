-- Helper: retorna a R1 mais recente do deal dentro de uma janela de N dias.
-- Considera attendees não cancelados/reagendados; inclui R1 futura próxima
-- e R1 passada recente (realizada, no-show, agendada).
CREATE OR REPLACE FUNCTION public.has_recent_r1(_deal_id uuid, _days integer)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ms.scheduled_at
  FROM public.meeting_slot_attendees msa
  JOIN public.meeting_slots ms ON ms.id = msa.meeting_slot_id
  WHERE msa.deal_id = _deal_id
    AND ms.meeting_type = 'r1'
    AND COALESCE(msa.status, '') NOT IN ('cancelled', 'rescheduled')
    AND ms.scheduled_at >= (now() - make_interval(days => _days))
    AND ms.scheduled_at <= (now() + make_interval(days => _days))
  ORDER BY ms.scheduled_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.has_recent_r1(uuid, integer) TO authenticated, service_role;

-- Seed da regra de cooldown (global, 30 dias) para SDR e Closer.
-- Idempotente — não sobrescreve se já existir.
INSERT INTO public.process_rules (bu, role, rule_key, rule_value, is_active, description, applies_from)
SELECT NULL, 'sdr', 'r1_cooldown_days', '{"value": 30}'::jsonb, true,
       'Janela de cooldown (dias) para reagendar R1 no mesmo lead. Vazio/0 = desativado.',
       now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.process_rules
  WHERE bu IS NULL AND role = 'sdr' AND rule_key = 'r1_cooldown_days'
);

INSERT INTO public.process_rules (bu, role, rule_key, rule_value, is_active, description, applies_from)
SELECT NULL, 'closer', 'r1_cooldown_days', '{"value": 30}'::jsonb, true,
       'Janela de cooldown (dias) para reagendar R1 no mesmo lead. Vazio/0 = desativado.',
       now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.process_rules
  WHERE bu IS NULL AND role = 'closer' AND rule_key = 'r1_cooldown_days'
);